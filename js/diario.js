/* ============================================
   DataLife — Diário
   ============================================
   Referências de diários digitais:
   - Day One: pergunta do dia e "Neste dia" (a mesma data em outros anos).
   - Daylio: humor em um toque (escala de 5) + atividades, e o "ano em
     pixels" (cada dia do ano pintado pelo humor; ideia original dos
     bullet journals de Camille, do Passion Carnets).
   - Five Minute Journal: três coisas boas do dia.
   - Apple Journal: sequência de dias escritos e contexto automático do dia.
   Contexto próprio do DataLife: o que o Foco e o Orçamento registraram
   naquele dia aparece ao lado ("Seu dia em números").
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import { fetchEntradas, fetchEntradasAno, fetchEntradasEntre, fetchPrimeiroDia, fetchEntrada, saveEntrada, fetchTags, saveTags, entradaVazia, temConteudo, HUMORES, TAGS_PADRAO, LIMITES } from './diario-db.js';
import { sequencia, maiorSequencia, nesteDia, perguntaDoDia, PERGUNTAS, buscar, atividades, contarPalavras } from './diario-calc.js';
import { fetchDia, fetchConfig as fetchFocoConfig } from './foco-db.js';
import { exigirCofre, antesDeTrancar } from './cofre-ui.js';
import { fetchMonth } from './db.js';
import { planoAgua, formatMl, COPO_ML } from './foco-saude.js';
import {
  icon, escapeHtml, showToast, debounce, dayKey, fromDayKey, shiftDay, MESES, formatBRL, bindPrivacyToggle, placeFixed
} from './utils.js';

const $ = id => document.getElementById(id);
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MES_CURTO = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const user = await requireAuth();

const state = {
  hoje: dayKey(new Date()),
  day: dayKey(new Date()),
  entradas: new Map(),
  anos: new Map(),       // ano -> Promise da leitura (anos já pedidos)
  tudo: null,            // Promise da leitura completa (busca)
  consultados: new Set(),// dias lidos um a um ("neste dia")
  primeiroAno: new Date().getFullYear(),
  entrada: entradaVazia(),
  tagsProprias: [],
  ano: new Date().getFullYear(),
  pergunta: 0,           // deslocamento da pergunta do dia ("Outra pergunta")
  contexto: new Map(),   // dia -> itens do "Seu dia em números"
  focoCfg: null,
  salvoEm: null,
  salvando: false,
  pendente: false
};

const clone = e => ({ ...e, tags: [...e.tags], gratidao: [...e.gratidao] });

/* ---------- Gravação (automática) ---------- */

const gravar = debounce(async (day, entrada) => {
  state.salvando = true;
  state.pendente = false;
  renderStatus();
  const antes = state.entradas.get(day);
  // Mapa local já reflete a escrita (sequência, pixels e "neste dia" na hora)
  if (temConteudo(entrada)) state.entradas.set(day, clone(entrada));
  else state.entradas.delete(day);
  state.primeiroAno = Math.min(state.primeiroAno, Number(day.slice(0, 4)));
  renderResumo();
  const gravando = saveEntrada(user.uid, day, entrada);
  state.gravando = gravando.catch(() => {});
  const ok = await persist(gravando, () => {
    if (antes) state.entradas.set(day, antes);
    else state.entradas.delete(day);
    renderResumo();
  }, 'Não foi possível salvar a entrada. Ela continua na tela; tente de novo.');
  state.salvando = false;
  if (ok) state.salvoEm = Date.now();
  renderStatus();
}, 800);

function agendar() {
  state.salvoEm = null;
  state.pendente = true;
  gravar(state.day, clone(state.entrada));
  renderStatus();
}

function renderStatus() {
  const el = $('entrada-status');
  if (state.salvando) el.textContent = 'Salvando…';
  else if (state.pendente) el.textContent = '';
  else if (state.salvoEm) {
    const s = Math.round((Date.now() - state.salvoEm) / 1000);
    el.textContent = s < 5 ? 'Salvo agora' : s < 60 ? `Salvo há ${s}s` : `Salvo há ${Math.round(s / 60)} min`;
  } else el.textContent = temConteudo(state.entrada) ? '' : 'Salva sozinha';
  const n = contarPalavras(state.entrada.texto);
  $('palavras').textContent = n ? `${n} ${n === 1 ? 'palavra' : 'palavras'}` : '';
}

/* ---------- Dia ---------- */

function renderDayLabel() {
  const d = fromDayKey(state.day);
  const isToday = state.day === state.hoje;
  const ontem = state.day === shiftDay(state.hoje, -1);
  $('day-label').textContent = `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
  $('day-weekday').textContent = isToday ? `Hoje, ${SEMANA[d.getDay()]}` : ontem ? `Ontem, ${SEMANA[d.getDay()]}` : SEMANA[d.getDay()];
  $('btn-hoje').hidden = isToday;
  $('day-next').disabled = state.day >= state.hoje; // diário não tem futuro
  document.title = `${isToday ? 'Diário' : `Diário · ${$('day-label').textContent}`} · DataLife`;
}

/* ---------- Leitura por ano ---------- */

const juntar = mapa => { for (const [k, e] of mapa) if (!state.entradas.has(k)) state.entradas.set(k, e); };

/** Garante as entradas de um ano na memória (uma leitura por ano, por visita). */
function garantirAno(ano) {
  if (ano < state.primeiroAno || ano > Number(state.hoje.slice(0, 4))) return Promise.resolve();
  if (!state.anos.has(ano)) {
    state.anos.set(ano, fetchEntradasAno(user.uid, ano).then(juntar).catch(e => {
      state.anos.delete(ano);
      throw e;
    }));
  }
  return state.anos.get(ano);
}

/** Tudo (para a busca): só na primeira busca. */
function garantirTudo() {
  if (!state.tudo) {
    state.tudo = fetchEntradas(user.uid).then(mapa => {
      juntar(mapa);
      for (const k of mapa.keys()) state.anos.set(Number(k.slice(0, 4)), Promise.resolve());
    }).catch(e => { state.tudo = null; throw e; });
  }
  return state.tudo;
}

/** "Neste dia" em anos não carregados: lê só as datas que importam. */
async function garantirNeste(dia) {
  const [y, m, d] = dia.split('-');
  const keys = [];
  for (let a = 1; a <= 10; a++) {
    const ano = Number(y) - a;
    if (ano < state.primeiroAno) break;
    const k = `${ano}-${m}-${d}`;
    if (!state.anos.has(ano) && !state.consultados.has(k) && DAY_OK(k)) keys.push(k);
  }
  // "Há 1 mês" de janeiro cai em dezembro do ano anterior, que pode não estar lido
  if (m === '01') {
    const k = `${Number(y) - 1}-12-${d}`;
    if (Number(y) - 1 >= state.primeiroAno && !state.anos.has(Number(y) - 1) && !state.consultados.has(k) && DAY_OK(k)) keys.push(k);
  }
  if (!keys.length) return false;
  keys.forEach(k => state.consultados.add(k));
  const res = await Promise.all(keys.map(k => fetchEntrada(user.uid, k).catch(() => null)));
  res.forEach((e, i) => { if (e && !state.entradas.has(keys[i])) state.entradas.set(keys[i], e); });
  return res.some(Boolean);
}
// 29/02 em ano comum não existe
const DAY_OK = k => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c).getDate() === c; };

let pedidoDia = 0;
async function loadDay(key) {
  if (key > state.hoje) return;
  gravar.flush(); // grava o dia que está saindo
  const pedido = ++pedidoDia;
  // Antes de mostrar (e permitir editar) um dia, o ano dele precisa estar lido:
  // senão a entrada vazia na tela sobrescreveria a que já existe.
  try {
    await garantirAno(Number(key.slice(0, 4)));
  } catch (e) {
    console.error(e);
    return showToast('Não foi possível abrir esse dia. Verifique a conexão.', 'error', 5000);
  }
  if (pedido !== pedidoDia) return; // outro dia foi pedido enquanto lia
  garantirNeste(key).then(achou => { if (achou && state.day === key) renderNeste(); });
  state.day = key;
  state.entrada = clone(state.entradas.get(key) || entradaVazia());
  state.pergunta = 0;
  state.salvoEm = null;
  state.pendente = false;
  if (Number(key.slice(0, 4)) !== state.ano) state.ano = Number(key.slice(0, 4));
  renderDayLabel();
  renderEntrada();
  renderHumores();
  renderTags();
  renderResumo();
  renderContexto();
  const grid = $('diario-grid');
  grid.classList.remove('is-switching');
  void grid.offsetWidth;
  grid.classList.add('is-switching');
  return true;
}

/* ---------- Entrada ---------- */

function renderPergunta() {
  $('pergunta').textContent = perguntaDoDia(state.day, state.pergunta);
}

function renderEntrada() {
  renderPergunta();
  const ta = $('texto');
  ta.value = state.entrada.texto;
  ta.placeholder = 'Escreva livremente. O que aconteceu, o que você sentiu, o que quer lembrar.';
  [0, 1, 2].forEach(i => { $('diario-grid').querySelector(`[name="g${i}"]`).value = state.entrada.gratidao[i]; });
  renderStatus();
}

/* ---------- Humor e atividades ---------- */

function renderHumores() {
  $('humores').innerHTML = HUMORES.map(h => `
    <button type="button" role="radio" class="humor h${h.n}" data-humor="${h.n}" aria-checked="${state.entrada.humor === h.n}">
      <i aria-hidden="true"></i><span>${h.nome}</span>
    </button>`).join('');
}

function todasTags() {
  return [...new Set([...TAGS_PADRAO, ...state.tagsProprias, ...state.entrada.tags])];
}

function renderTags() {
  const on = new Set(state.entrada.tags);
  $('tags').innerHTML = todasTags().map(t => `
    <button type="button" class="tag-chip ${on.has(t) ? 'is-on' : ''}" data-tag="${escapeHtml(t)}" aria-pressed="${on.has(t)}">${escapeHtml(t)}</button>`).join('') +
    `<input class="input tag-nova" id="tag-nova" maxlength="${LIMITES.tag}" placeholder="+ Atividade" aria-label="Nova atividade">`;
}

function addTag(nome) {
  const t = nome.trim().slice(0, LIMITES.tag);
  if (!t) return;
  const existente = todasTags().find(x => x.toLowerCase() === t.toLowerCase());
  const tag = existente || t;
  if (!existente) {
    state.tagsProprias = [...state.tagsProprias, tag];
    persist(saveTags(user.uid, state.tagsProprias), () => { state.tagsProprias = state.tagsProprias.filter(x => x !== tag); renderTags(); });
  }
  if (!state.entrada.tags.includes(tag)) {
    if (state.entrada.tags.length >= LIMITES.tags) return showToast(`Até ${LIMITES.tags} atividades por dia.`, 'error');
    state.entrada.tags.push(tag);
    agendar();
  }
  renderTags();
  $('tag-nova').focus();
}

/* ---------- Seu dia em números (Foco + Orçamento) ---------- */

async function renderContexto() {
  const day = state.day;
  const el = $('contexto');
  if (!state.contexto.has(day)) {
    el.innerHTML = '<li class="contexto-vazio">Carregando…</li>';
    try {
      const [dia, mes, cfg] = await Promise.all([
        fetchDia(user.uid, day),
        fetchMonth(user.uid, day.slice(0, 7)),
        state.focoCfg ? Promise.resolve(state.focoCfg) : fetchFocoConfig(user.uid)
      ]);
      state.focoCfg = cfg;
      state.contexto.set(day, { dia, gastos: mes.gastos.filter(g => g.data === day) });
    } catch (e) {
      console.error(e);
      state.contexto.set(day, null);
    }
    if (day !== state.day) return; // trocou de dia enquanto carregava
  }
  const c = state.contexto.get(day);
  if (!c) {
    el.innerHTML = '<li class="contexto-vazio">Não foi possível ler as outras ferramentas agora.</li>';
    return;
  }
  const { dia, gastos } = c;
  const itens = [];
  if (dia.tarefas.length) {
    const feitas = dia.tarefas.filter(t => t.feita).length;
    itens.push(['listChecks', `${feitas} de ${dia.tarefas.length}`, feitas === 1 ? 'tarefa feita' : 'tarefas feitas']);
  }
  if (dia.pomodoros) itens.push(['timer', String(dia.pomodoros), dia.pomodoros === 1 ? 'foco concluído' : 'focos concluídos']);
  const copos = dia.agua.filter(Boolean).length;
  if (copos) {
    const meta = state.focoCfg?.agua ? planoAgua(state.focoCfg.agua).meta : 0;
    itens.push(['droplet', formatMl(copos * COPO_ML), meta ? `de água (meta ${formatMl(meta)})` : 'de água']);
  }
  const ref = Object.values(dia.refeicoes).filter(Boolean).length;
  if (ref) itens.push(['utensils', `${ref} de 3`, 'refeições']);
  if (dia.exercicio) itens.push(['activity', 'Treino', 'feito']);
  if (gastos.length) {
    const total = gastos.reduce((a, g) => a + g.valor, 0);
    itens.push(['wallet', formatBRL(total), `em ${gastos.length === 1 ? '1 gasto' : `${gastos.length} gastos`}`]);
  }
  el.innerHTML = itens.length
    ? itens.map(([ic, v, l]) => `<li><span class="ctx-icon">${icon(ic, 15)}</span><strong class="num">${escapeHtml(v)}</strong><span>${l}</span></li>`).join('') +
      `<li class="contexto-links"><a class="link-btn" href="focus.html?dia=${day}">Abrir no Foco</a>${gastos.length ? ' · <a class="link-btn" href="budget.html">Ver no Orçamento</a>' : ''}</li>`
    : '<li class="contexto-vazio">Nada registrado no Foco ou no Orçamento neste dia.</li>';
}

/* ---------- Resumo: sequência, neste dia, ano em pixels ---------- */

function renderNeste() {
  const itens = nesteDia(state.entradas, state.day);
  $('neste').innerHTML = itens.length
    ? itens.map(({ key, rotulo }) => {
      const e = state.entradas.get(key);
      const trecho = (e.texto.trim() || e.gratidao.find(g => g.trim()) || e.tags.join(', ')).replace(/\s+/g, ' ').slice(0, 140);
      return `
        <li><button type="button" class="neste-item" data-dia="${key}">
          <span class="neste-head"><i class="humor-dot h${e.humor}" aria-hidden="true"></i><strong>${rotulo}</strong><span class="num">${key.split('-').reverse().join('/')}</span></span>
          <span class="neste-trecho diario-priv">${escapeHtml(trecho)}${trecho.length >= 140 ? '…' : ''}</span>
        </button></li>`;
    }).join('')
    : '<li class="neste-vazio">Nada escrito nesta data em meses ou anos anteriores. Daqui a um ano, este dia aparece aqui.</li>';
  const seq = sequencia(state.entradas, state.hoje);
  $('sequencia').textContent = seq ? `${seq} ${seq === 1 ? 'dia seguido' : 'dias seguidos'}` : '';
}

function renderPixels() {
  const ano = state.ano;
  $('ano-label').textContent = ano;
  $('ano-prev').disabled = ano <= state.primeiroAno;
  $('ano-next').disabled = ano >= Number(state.hoje.slice(0, 4));

  let html = '<span class="px-corner"></span>' + Array.from({ length: 31 }, (_, d) =>
    `<span class="px-col">${(d + 1) % 5 === 0 || d === 0 ? d + 1 : ''}</span>`).join('');
  for (let m = 0; m < 12; m++) {
    html += `<span class="px-row" title="${MESES[m]}">${MES_CURTO[m]}</span>`;
    const dias = new Date(ano, m + 1, 0).getDate();
    for (let d = 1; d <= 31; d++) {
      if (d > dias) { html += '<span class="px-none"></span>'; continue; }
      const key = `${ano}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const e = state.entradas.get(key);
      const futuro = key > state.hoje;
      const cls = ['px', e ? (e.humor ? `h${e.humor}` : 'is-escrito') : '', futuro ? 'is-futuro' : '',
        key === state.hoje ? 'is-hoje' : '', key === state.day ? 'is-sel' : ''].filter(Boolean).join(' ');
      const label = `${d} de ${MESES[m].toLowerCase()}${e ? `: ${e.humor ? HUMORES[e.humor - 1].nome.toLowerCase() : 'escrito'}` : ''}`;
      html += `<button type="button" class="${cls}" data-dia="${key}" aria-label="${label}" ${futuro ? 'disabled' : ''}></button>`;
    }
  }
  $('pixels').innerHTML = html;

  $('pixels-legend').innerHTML = HUMORES.map(h => `<li><i class="humor-dot h${h.n}"></i>${h.nome}</li>`).join('') +
    '<li><i class="humor-dot is-escrito"></i>Só texto</li>';

  const doAno = [...state.entradas].filter(([k]) => k.startsWith(`${ano}-`));
  const comHumor = doAno.filter(([, e]) => e.humor);
  const media = comHumor.length ? comHumor.reduce((a, [, e]) => a + e.humor, 0) / comHumor.length : 0;
  const palavras = doAno.reduce((a, [, e]) => a + contarPalavras(e.texto), 0);
  $('pixels-stats').innerHTML = [
    ['Dias escritos', doAno.length],
    ['Humor médio', media ? `${HUMORES[Math.round(media) - 1].nome} (${media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })})` : '—'],
    ['Maior sequência', `${maiorSequencia(new Map(doAno))} dias`],
    ['Palavras', palavras.toLocaleString('pt-BR')]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('');

  const ativ = atividades(state.entradas, ano).slice(0, 6);
  $('pixels-ativ').innerHTML = ativ.length ? `
    <h3 class="sub-title">Atividades e humor</h3>
    <ul>${ativ.map(a => `<li><span>${escapeHtml(a.tag)}</span><span class="num">${a.n}×</span>${a.humor ? `<i class="humor-dot h${Math.round(a.humor)}" title="Humor médio: ${HUMORES[Math.round(a.humor) - 1].nome}"></i>` : '<i></i>'}</li>`).join('')}</ul>` : '';
}

function renderResumo() {
  renderNeste();
  renderPixels();
}

/* ---------- Busca ---------- */

let buscaAtiva = -1;

function fecharBusca() {
  $('busca-pop').hidden = true;
  $('busca').setAttribute('aria-expanded', 'false');
  buscaAtiva = -1;
}

function renderBusca() {
  const q = $('busca').value;
  const res = buscar(state.entradas, q);
  const pop = $('busca-pop');
  if (q.trim().length < 2) return fecharBusca();
  pop.innerHTML = res.length
    ? res.map((r, i) => `
      <div class="sp-opt busca-opt ${i === buscaAtiva ? 'is-active' : ''}" role="option" id="busca-${i}" data-dia="${r.key}">
        <strong class="num">${r.key.split('-').reverse().join('/')}</strong><span class="diario-priv">${escapeHtml(r.trecho)}</span>
      </div>`).join('')
    : '<div class="busca-vazio">Nada encontrado.</div>';
  pop.hidden = false;
  $('busca').setAttribute('aria-expanded', 'true');
  const r = $('busca').getBoundingClientRect();
  pop.style.width = `${Math.max(r.width, 340)}px`;
  placeFixed(pop, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8), r.bottom + 6);
}

/* ---------- Eventos ---------- */

function bind() {
  $('day-prev').innerHTML = icon('chevronLeft');
  $('day-next').innerHTML = icon('chevronRight');
  $('ano-prev').innerHTML = icon('chevronLeft', 16);
  $('ano-next').innerHTML = icon('chevronRight', 16);
  document.querySelector('.search-icon').innerHTML = icon('search', 15);
  bindPrivacyToggle($('btn-privacy'));

  $('day-prev').addEventListener('click', () => loadDay(shiftDay(state.day, -1)));
  $('day-next').addEventListener('click', () => loadDay(shiftDay(state.day, 1)));
  $('btn-hoje').addEventListener('click', () => loadDay(state.hoje));
  const irAno = delta => {
    state.ano += delta;
    renderPixels();
    const ano = state.ano;
    garantirAno(ano).then(() => { if (state.ano === ano) renderPixels(); })
      .catch(() => showToast(`Não foi possível ler ${ano}. Verifique a conexão.`, 'error', 5000));
  };
  $('ano-prev').addEventListener('click', () => irAno(-1));
  $('ano-next').addEventListener('click', () => irAno(1));

  $('texto').addEventListener('input', e => {
    state.entrada.texto = e.target.value.slice(0, LIMITES.texto);
    agendar();
  });
  $('diario-grid').addEventListener('input', e => {
    const m = e.target.name?.match(/^g([0-2])$/);
    if (!m) return;
    state.entrada.gratidao[Number(m[1])] = e.target.value.slice(0, LIMITES.gratidao);
    agendar();
  });
  $('outra-pergunta').addEventListener('click', () => {
    state.pergunta = (state.pergunta + 1) % PERGUNTAS.length;
    renderPergunta();
  });

  $('humores').addEventListener('click', e => {
    const b = e.target.closest('[data-humor]');
    if (!b) return;
    const n = Number(b.dataset.humor);
    state.entrada.humor = state.entrada.humor === n ? 0 : n; // tocar de novo desmarca
    renderHumores();
    $('humores').querySelector(`[data-humor="${n}"]`).focus();
    agendar();
  });

  $('tags').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const t = b.dataset.tag;
    const i = state.entrada.tags.indexOf(t);
    if (i >= 0) state.entrada.tags.splice(i, 1);
    else if (state.entrada.tags.length >= LIMITES.tags) return showToast(`Até ${LIMITES.tags} atividades por dia.`, 'error');
    else state.entrada.tags.push(t);
    renderTags();
    $('tags').querySelector(`[data-tag="${CSS.escape(t)}"]`)?.focus();
    agendar();
  });
  $('tags').addEventListener('keydown', e => {
    if (e.target.id === 'tag-nova' && e.key === 'Enter') { e.preventDefault(); addTag(e.target.value); }
  });

  // Dias clicáveis: "Neste dia", ano em pixels, resultados da busca
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-dia]');
    if (!d || d.disabled) return;
    loadDay(d.dataset.dia);
    fecharBusca();
    if (d.closest('#pixels')) d.blur();
  });

  const busca = $('busca');
  busca.addEventListener('input', () => {
    buscaAtiva = -1;
    if (busca.value.trim().length < 2) return renderBusca();
    garantirTudo().then(renderBusca).catch(() => showToast('Não foi possível buscar. Verifique a conexão.', 'error', 5000));
  });
  busca.addEventListener('focus', renderBusca);
  busca.addEventListener('blur', () => setTimeout(fecharBusca, 150));
  busca.addEventListener('keydown', e => {
    const opts = $('busca-pop').querySelectorAll('.busca-opt');
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); buscaAtiva = Math.min(opts.length - 1, buscaAtiva + 1); renderBusca(); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); buscaAtiva = Math.max(0, buscaAtiva - 1); renderBusca(); }
    else if (e.key === 'Enter' && buscaAtiva >= 0) { e.preventDefault(); loadDay(opts[buscaAtiva].dataset.dia); fecharBusca(); busca.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); busca.value = ''; fecharBusca(); }
    if (buscaAtiva >= 0) busca.setAttribute('aria-activedescendant', `busca-${buscaAtiva}`);
  });
  $('busca-pop').addEventListener('pointerdown', e => e.preventDefault()); // clique não tira o foco antes de escolher

  // ← → trocam de dia fora dos campos de texto
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], .sp-pop')) return;
    if (tabAtual !== 'diario') return;
    if (e.key === 'ArrowLeft') loadDay(shiftDay(state.day, -1));
    if (e.key === 'ArrowRight' && state.day < state.hoje) loadDay(shiftDay(state.day, 1));
  });

  // Privacidade: valores do "dia em números" e trechos se ajustam ao modo
  window.addEventListener('datalife:privacy', renderContexto);

  // Não perder a última frase ao fechar ou trocar de aba
  window.addEventListener('pagehide', () => gravar.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) gravar.flush(); });
  setInterval(() => {
    renderStatus();
    const t = dayKey(new Date());
    if (t !== state.hoje) { state.hoje = t; renderDayLabel(); renderPixels(); }
  }, 5000);
}

/* ---------- Abas: Entradas | Vícios (via hash, como no Foco) ---------- */
let tabAtual = 'diario';
const TAB_HASH = { '#entries': 'diario', '#habits': 'vicios' };

function showTab() {
  tabAtual = TAB_HASH[location.hash] || 'diario';
  $('view-diario').hidden = tabAtual !== 'diario';
  $('view-vicios').hidden = tabAtual !== 'vicios';
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === tabAtual;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  moveTabIndicator();
  // Vícios só é lido quando a aba abre
  if (tabAtual === 'vicios') import('./vicios.js').then(m => m.initVicios(user));
  else gravar.flush();
}

function moveTabIndicator() {
  const active = document.querySelector('.tab.active');
  if (!active) return;
  $('tab-indicator').style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
  requestAnimationFrame(() => $('tab-indicator').classList.add('ready'));
}

window.addEventListener('hashchange', showTab);
window.addEventListener('resize', moveTabIndicator);
document.fonts?.ready.then(moveTabIndicator);

/* ---------- Init ---------- */

// Trancar o cadeado com texto ainda por salvar: grava antes (com a chave ainda na memória)
antesDeTrancar.add(async () => { gravar.flush(); await state.gravando; });

initPagina();
bind();
// Cadeado: com ele ligado, nada é lido antes da senha
await exigirCofre(user);
showTab();

// ?dia=YYYY-MM-DD abre um dia específico (links de outras ferramentas)
const pedido = new URLSearchParams(location.search).get('dia');
if (pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) && pedido <= state.hoje) state.day = pedido;

try {
  const ano = Number(state.hoje.slice(0, 4));
  let primeiro;
  [primeiro, state.tagsProprias] = await Promise.all([fetchPrimeiroDia(user.uid), fetchTags(user.uid)]);
  state.primeiroAno = primeiro ? Number(primeiro.slice(0, 4)) : ano;
  // Ano atual + nov/dez do anterior: a sequência e o "há 1 mês" de janeiro
  // atravessam a virada sem pagar a leitura do ano passado inteiro
  await Promise.all([
    garantirAno(ano),
    garantirAno(Number(state.day.slice(0, 4))),
    ano - 1 >= state.primeiroAno ? fetchEntradasEntre(user.uid, `${ano - 1}-11-01`, `${ano - 1}-12-31`).then(juntar) : null
  ]);
  // Sequência que chega ao limite do que foi lido: lê o ano anterior inteiro
  const seq = sequencia(state.entradas, state.hoje);
  const fimSeq = state.entradas.has(state.hoje) ? state.hoje : shiftDay(state.hoje, -1);
  if (seq && shiftDay(fimSeq, 1 - seq) <= `${ano - 1}-11-01`) await garantirAno(ano - 1);
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar o diário. Verifique a conexão.', 'error', 6000);
}
// Só depois de ler o dia a entrada pode ser editada: antes, o texto vazio
// sobrescreveria a de hoje. Se a leitura falhar, a tela continua travada.
if (await loadDay(state.day)) dadosProntos();
