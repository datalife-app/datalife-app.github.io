/* ============================================
   DataLife — Livros
   ============================================
   Ideias de rastreadores de leitura (StoryGraph, estantes ilustradas
   de diários de leitura):
   - Estante: os lidos viram lombadas em prateleiras por ano; a altura e a
     espessura seguem o número de páginas, a cor segue quem leu, e os
     abandonados ficam tombados. "Quero ler" é uma pilha ao lado.
   - Lendo agora: progresso por página, ritmo (páginas/dia) e previsão de término.
   - Desafio do ano: meta de livros e se você está no ritmo.
   - Diário: citações guardadas em cada livro; uma delas abre a página.
   - Lista no formato do Notion (Título, Autor, Leitor, Início, Fim,
     Avaliação, Comentários) e importação do CSV exportado de lá.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist as salvarComum, dadosProntos } from './pagina.js';
import { fetchLivros, saveLivro, deleteLivro, saveLivros, fetchConfig, saveConfig, STATUS, CORES } from './livros-db.js';
import { ritmo, desafio, estatisticas, lombada, livrosDoCsv, chaveLivro, diasEntre } from './livros-calc.js';
import { initLivroDialog, openLivroDialog } from './livro-dialog.js';
import { enhanceSelect } from './selectpicker.js';
import { icon, escapeHtml, showToast, uid, dayKey, MESES, formatDay } from './utils.js';

const $ = id => document.getElementById(id);
const VISTA_KEY = 'datalife:livros-vista';

const user = await requireAuth();

const state = {
  livros: [],
  config: { leitores: [], metas: {} },
  hoje: dayKey(new Date()),
  ano: new Date().getFullYear(),
  anoStats: new Date().getFullYear(),
  vista: (() => { try { return localStorage.getItem(VISTA_KEY) === 'lista' ? 'lista' : 'estante'; } catch { return 'estante'; } })(),
  filtro: { leitor: '', status: '', busca: '' },
  sort: { campo: 'fim', dir: -1 },
  csv: null,
  editandoMeta: false
};

const find = id => state.livros.find(l => l.id === id);
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtData = iso => (iso ? iso.split('-').reverse().join('/') : '');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* Cores dos leitores: o cadastro guarda um dos 8 valores de CORES (Firestore);
   na tela, cada um vira o token --leitor-N do tema atual (e --leitor-N-ink
   para o texto por cima). Trocar de tema recolore tudo sem mexer nos dados. */
const slot = hex => Math.max(0, CORES.indexOf(hex)) + 1;

/** Cor guardada do leitor; desconhecido ganha uma cor estável pelo nome. */
function corHex(nome) {
  const c = state.config.leitores.find(l => l.nome === nome)?.cor;
  if (c) return c;
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}
const corDe = nome => `var(--leitor-${slot(corHex(nome))})`;

/** Lombada: cor do primeiro leitor; sem leitor, um tom estável pelo título. */
const hexLivro = l => (l.leitores[0] ? corHex(l.leitores[0]) : CORES[lombada(l).seed % CORES.length]);
const corLivro = l => `var(--leitor-${slot(hexLivro(l))})`;
const tintaLivro = l => `var(--leitor-${slot(hexLivro(l))}-ink)`;

const stars = (n, size = 13) => n
  ? `<span class="stars" role="img" aria-label="${n} de 5 estrelas">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${icon('star', size)}</i>`).join('')}</span>`
  : '';

const chips = leitores => leitores.map(n => `<span class="leitor-tag" style="--c:${corDe(n)}"><i></i>${escapeHtml(n)}</span>`).join('');

/* ---------- Gravação ---------- */

/** Gravação comum (pagina.js) + redesenha a tela quando precisou desfazer. */
const persist = (promise, rollback, msg) => salvarComum(promise, () => { rollback?.(); render(); }, msg);

function upsert(livro) {
  const i = state.livros.findIndex(l => l.id === livro.id);
  if (i >= 0) state.livros[i] = livro;
  else state.livros.push(livro);
}

/** Cadastra leitores novos (cada um com a próxima cor da paleta). */
function cadastrar(nomes) {
  if (!nomes.length) return;
  const prev = state.config;
  const leitores = [...prev.leitores];
  for (const nome of nomes) {
    if (leitores.some(l => l.nome.toLowerCase() === nome.toLowerCase())) continue;
    leitores.push({ nome, cor: CORES[leitores.length % CORES.length] });
  }
  state.config = { ...prev, leitores };
  persist(saveConfig(user.uid, state.config), () => { state.config = prev; });
}

function salvar(livro, { prev = find(livro.id), toast } = {}) {
  const antes = desafio(state.livros, state.ano, state.config.metas[state.ano], state.hoje);
  upsert(livro);
  render();
  const depois = desafio(state.livros, state.ano, state.config.metas[state.ano], state.hoje);
  persist(saveLivro(user.uid, livro), () => (prev ? upsert(prev) : (state.livros = state.livros.filter(l => l.id !== livro.id))))
    .then(ok => {
      if (!ok) return;
      if (antes.status !== 'concluido' && depois.status === 'concluido') showToast(`Desafio de ${state.ano} concluído: ${depois.lidos} livros!`);
      else if (toast) showToast(...toast);
    });
}

function onSave(livro, novosLeitores, novo) {
  cadastrar(novosLeitores);
  salvar(livro, { toast: [novo ? `"${livro.titulo}" adicionado.` : 'Livro salvo.'] });
}

function onDelete(livro) {
  state.livros = state.livros.filter(l => l.id !== livro.id);
  render();
  persist(deleteLivro(user.uid, livro.id), () => upsert(livro));
  showToast(`"${livro.titulo}" excluído.`, 'success', 8000, {
    label: 'Desfazer',
    onClick: () => salvar(livro, { prev: null })
  });
}

function abrir(livro, status) {
  const autores = [...new Set(state.livros.map(l => l.autor).filter(Boolean))].sort();
  const generos = [...new Set(state.livros.map(l => l.genero).filter(Boolean))].sort();
  openLivroDialog(livro, { leitores: state.config.leitores.map(l => l.nome), autores, generos, status });
}

/* ---------- Citação do dia ---------- */

function renderCitacao() {
  const todas = state.livros.flatMap(l => l.citacoes.map(c => ({ ...c, livro: l })));
  const el = $('citacao');
  el.hidden = !todas.length;
  if (!todas.length) return;
  // Uma por dia (estável ao recarregar), de qualquer livro
  const seed = Number(state.hoje.replace(/-/g, ''));
  const c = todas[seed % todas.length];
  el.innerHTML = `
    <span class="citacao-icon" aria-hidden="true">${icon('quote', 18)}</span>
    <blockquote>${escapeHtml(c.texto)}</blockquote>
    <figcaption>${c.livro.autor ? `${escapeHtml(c.livro.autor)}, ` : ''}<button type="button" class="link-btn" data-open="${escapeHtml(c.livro.id)}">${escapeHtml(c.livro.titulo)}</button>${c.pagina ? ` · p. ${c.pagina}` : ''}</figcaption>`;
}

/* ---------- Lendo agora ---------- */

function renderLendo() {
  const lendo = state.livros.filter(l => l.status === 'lendo').sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
  const quero = state.livros.filter(l => l.status === 'quero').length;
  if (!lendo.length) {
    $('lendo').innerHTML = `
      <li class="lendo-empty">
        <p>Nenhum livro em leitura agora.</p>
        <button class="btn btn-ghost btn-sm" type="button" data-novo="lendo">${icon('plus', 14)} Começar um livro</button>
        ${quero ? `<span class="text-muted">ou escolha da lista <button type="button" class="link-btn" data-filtrar="quero">Quero ler</button> (${plural(quero, 'livro', 'livros')})</span>` : ''}
      </li>`;
    return;
  }
  $('lendo').innerHTML = lendo.map(l => {
    const r = ritmo(l, state.hoje);
    const prog = l.paginas
      ? `<div class="progress"><div class="progress-bar" style="transform:scaleX(${(r.pct || 0) / 100}); --c:${corLivro(l)}"></div></div>
         <p class="lendo-meta"><span class="num">p. ${l.pagina || 0} de ${l.paginas}</span> · ${Math.round(r.pct || 0)}%${r.porDia ? ` · ${Math.round(r.porDia)} pág./dia` : ''}${r.termina ? ` · termina por volta de ${formatDay(r.termina)}` : ''}</p>`
      : `<p class="lendo-meta">Informe o número de páginas para ver o progresso.</p>`;
    return `
      <li class="lendo-item" data-id="${escapeHtml(l.id)}" style="--c:${corLivro(l)}">
        <button type="button" class="lendo-spine" data-open="${escapeHtml(l.id)}" aria-label="Abrir ficha de ${escapeHtml(l.titulo)}"></button>
        <div class="lendo-main">
          <button type="button" class="lendo-title" data-open="${escapeHtml(l.id)}">${escapeHtml(l.titulo)}</button>
          <p class="lendo-autor">${escapeHtml(l.autor || 'Autor desconhecido')}${r.dias ? ` · ${r.dias === 1 ? 'começou hoje' : `há ${r.dias} dias`}` : ''}</p>
          ${l.leitores.length ? `<div class="tags">${chips(l.leitores)}</div>` : ''}
          ${prog}
          <form class="lendo-form" data-pagina-form>
            <input class="input num" name="pagina" type="number" min="0" max="${l.paginas || 20000}" placeholder="Página" value="${l.pagina || ''}" aria-label="Parei na página">
            <button class="btn btn-ghost btn-sm" type="submit">Atualizar</button>
            <button class="btn btn-primary btn-sm" type="button" data-terminei>${icon('check', 14)} Terminei</button>
          </form>
        </div>
      </li>`;
  }).join('');
}

function atualizarPagina(id, pagina) {
  const l = find(id);
  if (!Number.isFinite(pagina) || pagina < 0) return showToast('Informe a página.', 'error');
  const next = { ...l, pagina: l.paginas ? Math.min(pagina, l.paginas) : pagina };
  salvar(next, { toast: [`Página ${next.pagina}${l.paginas ? ` de ${l.paginas}` : ''}.`] });
  if (l.paginas && pagina >= l.paginas) {
    showToast(`Chegou ao fim de "${l.titulo}".`, 'success', 6000, { label: 'Marcar como lido', onClick: () => terminar(id) });
  }
}

function terminar(id) {
  const l = find(id);
  const next = { ...l, status: 'lido', fim: state.hoje < (l.inicio || '') ? l.inicio : state.hoje, ...(l.paginas ? { pagina: l.paginas } : {}) };
  salvar(next);
  showToast(`"${l.titulo}" foi para a estante.`, 'success', 7000, { label: 'Avaliar', onClick: () => abrir(find(id)) });
}

/* ---------- Desafio do ano ---------- */

function renderDesafio() {
  const meta = state.config.metas[state.ano] || 0;
  const d = desafio(state.livros, state.ano, meta, state.hoje);
  const el = $('desafio');
  const head = `<div class="card-head"><h2 class="card-title" id="desafio-title">Desafio de ${state.ano}</h2>
    ${meta && !state.editandoMeta ? '<button type="button" class="link-btn" data-meta-edit>Mudar meta</button>' : ''}</div>`;
  if (!meta || state.editandoMeta) {
    el.innerHTML = `${head}
      <form class="meta-form" id="meta-form">
        <label class="field"><span class="field-label">Quantos livros quer ler em ${state.ano}?</span>
          <input class="input num" name="meta" type="number" min="1" max="1000" value="${meta || ''}" placeholder="Ex.: 12" required></label>
        <button class="btn btn-primary" type="submit">Definir meta</button>
        ${meta ? '<button class="btn btn-ghost" type="button" data-meta-cancel>Cancelar</button>' : ''}
      </form>
      <p class="desafio-note">${plural(d.lidos, 'livro lido', 'livros lidos')} até agora em ${state.ano}.</p>`;
    return;
  }
  const pct = Math.min(100, (d.lidos / d.meta) * 100);
  const R = 34, C = 2 * Math.PI * R;
  const fimAno = `${state.ano}-12-31`;
  const diasRest = state.hoje <= fimAno ? diasEntre(state.hoje, fimAno) : 0;
  const cada = d.falta && diasRest ? Math.max(1, Math.round(diasRest / d.falta)) : 0;
  // Sem vermelho: ritmo é estimativa, não erro. O texto aponta o próximo passo
  // e a marca no anel mostra onde a meta "espera" você hoje.
  const ritmoMeta = cada ? `Um livro a cada ${plural(cada, 'dia', 'dias')} fecha a meta.` : 'Termine os que faltam para fechar a meta.';
  const msg = {
    concluido: `Meta batida${d.lidos > d.meta ? `, com ${plural(d.lidos - d.meta, 'livro', 'livros')} a mais` : ''}.`,
    adiantado: 'À frente do ritmo da meta.',
    'no-ritmo': 'No ritmo da meta.',
    atrasado: ritmoMeta
  }[d.status];
  const nota = d.status === 'atrasado'
    ? `Pelo ritmo da meta, seriam ${plural(d.esperado, 'livro', 'livros')} até hoje (a marca no anel).`
    : d.falta ? `Faltam ${d.falta}${cada ? `: um a cada ${plural(cada, 'dia', 'dias')}` : ''}.` : '';
  // Marca do ritmo esperado sobre o anel (ângulo a partir do topo, sentido horário)
  const ang = (Math.min(d.esperado, d.meta) / d.meta) * 2 * Math.PI - Math.PI / 2;
  const mark = d.status !== 'concluido' && d.esperado > 0
    ? `<circle cx="${(40 + R * Math.cos(ang)).toFixed(2)}" cy="${(40 + R * Math.sin(ang)).toFixed(2)}" r="4" class="ring-mark"/>` : '';
  el.innerHTML = `${head}
    <div class="desafio-body">
      <div class="desafio-ring-wrap">
        <svg class="desafio-ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="${R}" class="ring-track"/>
          <circle cx="40" cy="40" r="${R}" class="ring-fill ${d.status}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 40 40)"/>
          ${mark}
        </svg>
        <span class="desafio-pct num">${Math.round(pct)}%</span>
      </div>
      <div>
        <p class="desafio-num"><strong class="num">${d.lidos}</strong> <span>de ${d.meta} livros</span></p>
        <p class="desafio-msg">${msg}</p>
        ${nota ? `<p class="desafio-note">${nota}</p>` : ''}
      </div>
    </div>`;
}

/* ---------- Filtros ---------- */

function filtrados() {
  const { leitor, status, busca } = state.filtro;
  const q = norm(busca);
  return state.livros.filter(l =>
    (!leitor || (leitor === '-' ? !l.leitores.length : l.leitores.includes(leitor))) &&
    (!status || l.status === status) &&
    (!q || norm(l.titulo).includes(q) || norm(l.autor).includes(q)));
}

function renderFiltroLeitor() {
  const nomes = [...new Set([...state.config.leitores.map(l => l.nome), ...state.livros.flatMap(l => l.leitores)])];
  const sel = $('filtro-leitor');
  if (state.filtro.leitor && state.filtro.leitor !== '-' && !nomes.includes(state.filtro.leitor)) state.filtro.leitor = '';
  sel.innerHTML = `<option value="">Todos os leitores</option>${nomes.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
    ${state.livros.some(l => !l.leitores.length) ? '<option value="-">Sem leitor</option>' : ''}`;
  sel.value = state.filtro.leitor;
}

/* ---------- Estante ---------- */

function spine(l) {
  const { largura, altura } = lombada(l);
  const label = `${l.titulo}${l.autor ? `, de ${l.autor}` : ''}${l.avaliacao ? ` · ${l.avaliacao} de 5` : ''}${l.status === 'abandonado' ? ' · abandonado' : ''}`;
  return `
    <li class="slot">
      <button type="button" class="spine ${l.status === 'abandonado' ? 'is-dnf' : ''} spine-${lombada(l).seed % 3}" data-open="${escapeHtml(l.id)}"
        style="--c:${corLivro(l)}; --ink:${tintaLivro(l)}; --w:${largura}px; --h:${altura}px" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <span class="spine-title">${escapeHtml(l.titulo)}</span>
        ${l.avaliacao ? `<span class="spine-stars" aria-hidden="true">${'•'.repeat(l.avaliacao)}</span>` : ''}
      </button>
    </li>`;
}

function renderEstante(list) {
  const lendo = list.filter(l => l.status === 'lendo');
  const quero = list.filter(l => l.status === 'quero').sort((a, b) => b.criado - a.criado);
  const prateleira = list.filter(l => l.status === 'lido' || l.status === 'abandonado');
  const porAno = new Map();
  for (const l of prateleira.sort((a, b) => (b.fim || '').localeCompare(a.fim || ''))) {
    const ano = l.fim ? l.fim.slice(0, 4) : 'Sem data';
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push(l);
  }
  const shelf = (titulo, livros, sub = '') => `
    <section class="shelf">
      <h3 class="shelf-title">${titulo} <span>${sub || plural(livros.length, 'livro', 'livros')}</span></h3>
      <ol class="shelf-books">${livros.map(spine).join('')}</ol>
    </section>`;

  const shelves = [
    lendo.length ? shelf('Lendo agora', lendo) : '',
    ...[...porAno].map(([ano, livros]) => {
      const lidos = livros.filter(l => l.status === 'lido').length;
      const dnf = livros.length - lidos;
      return shelf(ano, livros, `${plural(lidos, 'lido', 'lidos')}${dnf ? ` · ${plural(dnf, 'abandonado', 'abandonados')}` : ''}`);
    })
  ].join('');

  const pilha = quero.length ? `
    <aside class="pilha" aria-labelledby="pilha-title">
      <h3 class="shelf-title" id="pilha-title">Quero ler <span>${plural(quero.length, 'livro', 'livros')}</span></h3>
      <ol class="pilha-books">
        ${quero.slice(0, 14).map((l, i) => `
          <li><button type="button" class="pilha-book" data-open="${escapeHtml(l.id)}"
            style="--c:${corLivro(l)}; --ink:${tintaLivro(l)}; --w:${78 + (lombada(l).seed % 22)}%; --r:${((lombada(l).seed % 5) - 2) * 0.6}deg; --i:${i}">
            <span>${escapeHtml(l.titulo)}</span></button></li>`).join('')}
      </ol>
      ${quero.length > 14 ? `<button type="button" class="link-btn" data-filtrar="quero">Ver os ${quero.length}</button>` : ''}
    </aside>` : '';

  if (!shelves && !pilha) return '';
  return `<div class="estante ${pilha ? 'has-pilha' : ''}"><div class="shelves">${shelves || '<p class="estante-vazia">Nenhum livro lido com esses filtros.</p>'}</div>${pilha}</div>`;
}

/* ---------- Lista (formato do Notion) ---------- */

const COLS = [
  ['titulo', 'Título'], ['autor', 'Autor'], ['leitores', 'Leitor'], ['inicio', 'Início da leitura'],
  ['fim', 'Fim da leitura'], ['avaliacao', 'Avaliação'], ['status', 'Situação']
];

function ordenar(list) {
  const { campo, dir } = state.sort;
  const val = l => (campo === 'leitores' ? l.leitores.join(', ') : campo === 'status' ? STATUS[l.status].nome : l[campo] ?? '');
  return [...list].sort((a, b) => {
    const va = val(a), vb = val(b);
    // vazios sempre por último
    if (va === '' && vb !== '') return 1;
    if (vb === '' && va !== '') return -1;
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
    return c * dir || a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

function renderLista(list) {
  const { campo, dir } = state.sort;
  const head = COLS.map(([k, nome]) => `
    <th scope="col" aria-sort="${campo === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">
      <button type="button" class="sort-btn ${campo === k ? 'is-on' : ''}" data-sort="${k}">${nome}${campo === k ? icon(dir > 0 ? 'chevronUp' : 'chevronDown', 13) : ''}</button>
    </th>`).join('');
  const rows = ordenar(list).map(l => `
    <tr data-open="${escapeHtml(l.id)}">
      <td class="col-titulo" data-label="Título">
        <button type="button" class="row-title" data-open="${escapeHtml(l.id)}">${icon('book', 15)}<span>${escapeHtml(l.titulo)}</span></button>
        ${l.comentario ? `<p class="row-coment">${escapeHtml(l.comentario)}</p>` : ''}
      </td>
      <td data-label="Autor">${escapeHtml(l.autor)}</td>
      <td data-label="Leitor"><div class="tags">${chips(l.leitores)}</div></td>
      <td class="num" data-label="Início">${fmtData(l.inicio)}</td>
      <td class="num" data-label="Fim">${fmtData(l.fim)}</td>
      <td data-label="Avaliação">${stars(l.avaliacao)}</td>
      <td data-label="Situação"><span class="status-tag st-${l.status}">${STATUS[l.status].nome}</span></td>
    </tr>`).join('');
  return `<div class="card lista-card"><div class="table-wrap"><table class="livros-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <button type="button" class="lista-add" data-novo="">${icon('plus', 15)} Novo livro</button></div>`;
}

function renderVista() {
  const list = filtrados();
  const el = $('livros-view');
  if (!state.livros.length) {
    el.innerHTML = `
      <section class="livros-vazio">
        <span class="vazio-icon" aria-hidden="true">${icon('book', 26)}</span>
        <h2>Sua estante está vazia.</h2>
        <p>Adicione o livro que está lendo, os que já leu e os que quer ler. Se você usa o Notion, exporte a tabela em CSV e importe aqui.</p>
        <div class="vazio-actions">
          <button class="btn btn-primary" type="button" data-novo="lendo">${icon('plus', 15)} Adicionar livro</button>
          <button class="btn btn-ghost" type="button" data-importar>${icon('upload', 15)} Importar do Notion</button>
        </div>
      </section>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = '<p class="livros-none">Nenhum livro com esses filtros. <button type="button" class="link-btn" data-limpar>Limpar filtros</button></p>';
    return;
  }
  el.innerHTML = state.vista === 'lista' ? renderLista(list) : renderEstante(list) || renderLista(list);
}

/* ---------- Estatísticas ---------- */

function renderStats() {
  const ano = state.anoStats;
  const anos = state.livros.filter(l => l.fim && l.status === 'lido').map(l => Number(l.fim.slice(0, 4)));
  $('stats-ano').textContent = ano;
  $('stats-prev').disabled = !anos.some(a => a < ano);
  $('stats-next').disabled = ano >= Math.max(state.ano, ...anos);
  const e = estatisticas(state.livros, ano);
  if (!e.total) {
    $('stats').innerHTML = `<p class="stats-empty">Nenhum livro terminado em ${ano}.</p>`;
    return;
  }
  const max = Math.max(...e.porMes, 1);
  const tile = (label, value, sub = '') => `<div class="stat"><span class="stat-label">${label}</span><strong class="stat-value num">${value}</strong>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
  const ranking = (titulo, itens) => itens.length ? `
    <div class="rank"><h3 class="rank-title">${titulo}</h3><ol>${itens.slice(0, 3).map(([nome, n]) => `<li><span>${escapeHtml(nome)}</span><b class="num">${n}</b></li>`).join('')}</ol></div>` : '';
  $('stats').innerHTML = `
    <div class="stats-grid">
      ${tile('Livros lidos', e.total)}
      ${tile('Páginas', e.paginas ? e.paginas.toLocaleString('pt-BR') : '—', e.paginas ? `≈ ${Math.round(e.paginas / e.total)} por livro` : 'informe as páginas dos livros')}
      ${tile('Nota média', e.media ? e.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—', e.media ? 'de 5 estrelas' : 'sem avaliações')}
      ${tile('Tempo por livro', e.diasPorLivro ? plural(e.diasPorLivro, 'dia', 'dias') : '—', 'do início ao fim, em média')}
    </div>
    <div class="stats-body">
      <div class="meses" role="img" aria-label="Livros terminados por mês em ${ano}: ${e.porMes.map((n, i) => `${MESES[i]} ${n}`).join(', ')}">
        ${e.porMes.map((n, i) => `
          <div class="mes ${n ? '' : 'is-zero'}">
            <span class="mes-n num">${n || ''}</span>
            <i style="transform:scaleY(${n / max})"></i>
            <span class="mes-label">${MESES[i].slice(0, 3)}</span>
          </div>`).join('')}
      </div>
      <div class="ranks">
        ${e.favorito ? `<div class="rank"><h3 class="rank-title">Favorito do ano</h3>
          <button type="button" class="fav" data-open="${escapeHtml(e.favorito.id)}"><strong>${escapeHtml(e.favorito.titulo)}</strong>${stars(e.favorito.avaliacao, 12)}</button></div>` : ''}
        ${ranking('Autores mais lidos', e.autores)}
        ${ranking('Por leitor', e.leitores)}
      </div>
    </div>`;
}

/* ---------- Importar do Notion ---------- */

async function lerCsv(file) {
  if (file.size > 2 * 1024 * 1024) return showToast('Arquivo grande demais.', 'error');
  let r;
  try {
    r = livrosDoCsv(await file.text());
  } catch (e) {
    return showToast(e.message || 'Não foi possível ler o CSV.', 'error', 5000);
  }
  const existentes = new Set(state.livros.map(chaveLivro));
  const vistos = new Set();
  const novos = r.livros.filter(l => {
    const k = chaveLivro(l);
    if (existentes.has(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const leitoresNovos = [...new Set(novos.flatMap(l => l.leitores))]
    .filter(n => !state.config.leitores.some(c => c.nome.toLowerCase() === n.toLowerCase()));
  const porStatus = Object.keys(STATUS).map(s => [s, novos.filter(l => l.status === s).length]).filter(([, n]) => n);
  const faltando = ['autor', 'leitores', 'inicio', 'fim', 'avaliacao', 'comentario'].filter(c => r.colunas[c] === undefined);
  state.csv = { novos, leitoresNovos };
  $('csv-sub').textContent = file.name;
  $('csv-body').innerHTML = `
    <ul class="import-facts">
      <li><strong>${novos.length}</strong> ${novos.length === 1 ? 'livro novo' : 'livros novos'}</li>
      <li><strong>${r.livros.length - novos.length}</strong> já na estante (não duplicam)</li>
      ${porStatus.map(([s, n]) => `<li><strong>${n}</strong> ${STATUS[s].nome.toLowerCase()}</li>`).join('')}
    </ul>
    ${novos.length ? `<ol class="csv-preview">${novos.slice(0, 6).map(l => `<li><strong>${escapeHtml(l.titulo)}</strong><span>${escapeHtml([l.autor, l.leitores.join(', '), l.fim ? `terminado em ${fmtData(l.fim)}` : l.inicio ? `desde ${fmtData(l.inicio)}` : ''].filter(Boolean).join(' · '))}</span></li>`).join('')}
      ${novos.length > 6 ? `<li class="csv-more">e mais ${novos.length - 6}</li>` : ''}</ol>` : ''}
    ${leitoresNovos.length ? `<p class="csv-note">Leitores novos no cadastro: <strong>${leitoresNovos.map(escapeHtml).join(', ')}</strong>.</p>` : ''}
    ${faltando.length ? `<p class="csv-note">Colunas não encontradas (ficam em branco): ${faltando.map(c => ({ autor: 'Autor', leitores: 'Leitor', inicio: 'Início', fim: 'Fim', avaliacao: 'Avaliação', comentario: 'Comentários' }[c])).join(', ')}.</p>` : ''}
    <p class="csv-note">Sem fim da leitura, o livro entra como <em>Lendo</em>; sem início também, como <em>Quero ler</em>.</p>`;
  $('csv-submit').disabled = !novos.length;
  $('csv-dialog').showModal();
}

async function importarCsv() {
  const { novos, leitoresNovos } = state.csv;
  const agora = Date.now();
  const livros = novos.map((l, i) => ({ ...l, id: uid(), criado: agora + i }));
  $('csv-dialog').close();
  cadastrar(leitoresNovos);
  state.livros.push(...livros);
  render();
  const ok = await persist(saveLivros(user.uid, livros), () => {
    const ids = new Set(livros.map(l => l.id));
    state.livros = state.livros.filter(l => !ids.has(l.id));
  }, 'Não foi possível importar. Nada foi salvo; tente de novo.');
  if (ok) showToast(`${plural(livros.length, 'livro importado', 'livros importados')}.`);
}

/* ---------- Render geral ---------- */

function render() {
  renderCitacao();
  renderLendo();
  renderDesafio();
  renderFiltroLeitor();
  renderVista();
  renderStats();
  $('vista').querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-checked', b.dataset.vista === state.vista));
}

/* ---------- Eventos ---------- */

function bind() {
  $('btn-novo').innerHTML = `${icon('plus', 16)} Adicionar livro`;
  $('btn-importar').innerHTML = `${icon('upload', 15)} Importar do Notion`;
  document.querySelector('.search-icon').innerHTML = icon('search', 15);
  $('stats-prev').innerHTML = icon('chevronLeft');
  $('stats-next').innerHTML = icon('chevronRight');
  $('btn-novo').addEventListener('click', () => abrir(null));
  $('btn-importar').addEventListener('click', () => $('csv-file').click());
  $('csv-file').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) lerCsv(file);
  });
  const csv = $('csv-dialog');
  csv.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  csv.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => csv.close()));
  $('csv-form').addEventListener('submit', e => { e.preventDefault(); importarCsv(); });

  $('vista').addEventListener('click', e => {
    const b = e.target.closest('[data-vista]');
    if (!b) return;
    state.vista = b.dataset.vista;
    try { localStorage.setItem(VISTA_KEY, state.vista); } catch { /* ok */ }
    render();
  });
  enhanceSelect($('filtro-leitor'));
  enhanceSelect($('filtro-status'));
  $('busca').addEventListener('input', e => { state.filtro.busca = e.target.value; renderVista(); });
  $('filtro-leitor').addEventListener('change', e => { state.filtro.leitor = e.target.value; renderVista(); });
  $('filtro-status').addEventListener('change', e => { state.filtro.status = e.target.value; renderVista(); });

  $('stats-prev').addEventListener('click', () => { state.anoStats--; renderStats(); });
  $('stats-next').addEventListener('click', () => { state.anoStats++; renderStats(); });

  // Cliques delegados na página inteira (ficha, novo, filtros rápidos, ordenação, lendo agora, meta)
  $('view-livros').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('form') && !t.closest('[data-terminei]')) {
      if (t.closest('[data-meta-cancel]')) { state.editandoMeta = false; renderDesafio(); }
      return;
    }
    const open = t.closest('[data-open]');
    if (open) return abrir(find(open.dataset.open));
    const novo = t.closest('[data-novo]');
    if (novo) return abrir(null, novo.dataset.novo || undefined);
    if (t.closest('[data-importar]')) return $('csv-file').click();
    const filtrar = t.closest('[data-filtrar]');
    if (filtrar) {
      state.filtro.status = filtrar.dataset.filtrar;
      $('filtro-status').value = state.filtro.status;
      state.vista = 'lista';
      render();
      return $('livros-view').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    if (t.closest('[data-limpar]')) {
      state.filtro = { leitor: '', status: '', busca: '' };
      $('busca').value = '';
      $('filtro-status').value = '';
      return render();
    }
    const sort = t.closest('[data-sort]');
    if (sort) {
      const campo = sort.dataset.sort;
      state.sort = { campo, dir: state.sort.campo === campo ? -state.sort.dir : ['titulo', 'autor', 'leitores', 'status'].includes(campo) ? 1 : -1 };
      return renderVista();
    }
    if (t.closest('[data-terminei]')) return terminar(t.closest('[data-id]').dataset.id);
    if (t.closest('[data-meta-edit]')) { state.editandoMeta = true; renderDesafio(); $('meta-form')?.meta.focus(); }
  });

  $('view-livros').addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.matches('[data-pagina-form]')) {
      return atualizarPagina(e.target.closest('[data-id]').dataset.id, parseInt(e.target.pagina.value, 10));
    }
    if (e.target.id === 'meta-form') {
      const n = parseInt(e.target.meta.value, 10);
      if (!(n >= 1 && n <= 1000)) return showToast('Use uma meta entre 1 e 1000 livros.', 'error');
      const prev = state.config;
      state.config = { ...prev, metas: { ...prev.metas, [state.ano]: n } };
      state.editandoMeta = false;
      renderDesafio();
      persist(saveConfig(user.uid, state.config), () => { state.config = prev; }).then(ok => ok && showToast(`Meta de ${state.ano}: ${plural(n, 'livro', 'livros')}.`));
    }
  });

}

/* ---------- Init ---------- */

initPagina();
initLivroDialog({ onSave, onDelete, corDe, cadastrados: () => state.config.leitores.map(l => l.nome) });
bind();

try {
  [state.livros, state.config] = await Promise.all([fetchLivros(user.uid), fetchConfig(user.uid)]);
  render();
  dadosProntos();
} catch (e) {
  console.error(e);
  $('livros-view').innerHTML = `
    <div class="load-error">
      <h1>Não foi possível carregar seus livros.</h1>
      <p>Verifique a conexão e recarregue a página.</p>
    </div>`;
}
