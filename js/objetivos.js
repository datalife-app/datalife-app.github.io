/* ============================================
   DataLife — Objetivos (metas de longo prazo)
   ============================================
   Lista (#) e detalhe (#<id>) na mesma página.

   Ideias emprestadas de organizadores de metas:
   - Quadro de 100: cada quadrado é 1% do alvo, pintado conforme você guarda
     (como os "savings coloring charts" de papel).
   - Marcos de 25/50/75/100%, com a data em que foram atingidos ou a previsão.
   - Horizonte: todos os objetivos numa linha do tempo, com prazo e previsão.
   - "E se?": simula outro valor mensal e mostra a nova data de chegada.
   - Cabe no orçamento? compara o que os objetivos pedem por mês com o que o
     Orçamento doméstico reserva para Metas e Liberdade financeira.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist as salvar, dadosProntos } from './pagina.js';
import { fetchMonth, fetchMetas } from './db.js';
import { fetchObjetivos, saveObjetivo, deleteObjetivo, addMovimento, removeMovimento, TIPOS, ICONE_NOMES } from './objetivos-db.js';
import {
  resumir, serieMensal, projetar, marcosAtingidos, ritmoReal, mesesAte, mesesEntre, somaMeses,
  taxaMensal, duracao, mesCurto, folgaLabel, MARCOS, mesDe, ordenar
} from './objetivos-calc.js';
import { renderProjecao } from './objetivo-chart.js';
import { initObjetivoDialog, openObjetivoDialog } from './objetivo-dialog.js';
import { enhanceDateInput } from './datepicker.js';
import {
  icon, formatBRL, formatBRLRaw, formatPct, parseBRL, bindCurrencyInput, bindPrivacyToggle, monthKey, monthLabel,
  dayKey, escapeHtml, showToast, uid, debounce
} from './utils.js';

const $ = id => document.getElementById(id);

const user = await requireAuth();

const state = {
  objetivos: [],
  hoje: monthKey(new Date()),
  arquivados: false,
  orcamento: null,      // { renda, reservado, mes } do Orçamento doméstico
  simulado: null,       // valor do "E se?" no detalhe
  tipoMov: 'aporte',
  quadroAntes: null     // quadrados pintados antes da última mudança (anima só os novos)
};

const STATUS = {
  concluido: { nome: 'Concluído', cls: 'is-done' },
  'no-ritmo': { nome: 'No ritmo', cls: 'is-ok' },
  // Estimativas, não erros: tom neutro e nome que aponta a ação
  atrasado: { nome: 'Ajustar ritmo', cls: 'is-adjust' },
  vencido: { nome: 'Prazo passou', cls: 'is-adjust' },
  'sem-plano': { nome: 'Sem valor mensal', cls: 'is-idle' }
};

const find = id => state.objetivos.find(o => o.id === id);
const ativos = () => state.objetivos.filter(o => !o.arquivado);
const chip = st => `<span class="status-chip ${STATUS[st].cls}">${STATUS[st].nome}</span>`;
const tempoAte = prazo => {
  const n = mesesEntre(state.hoje, prazo);
  return n < 0 ? `venceu há ${duracao(-n)}` : n === 0 ? 'vence este mês' : `faltam ${duracao(n)}`;
};

/* ---------- Gravação ---------- */

/** Gravação comum (pagina.js) + redesenha a tela quando precisou desfazer. */
const persist = (promise, rollback, msg) => salvar(promise, () => { rollback?.(); render(); }, msg);

function upsert(obj) {
  const i = state.objetivos.findIndex(o => o.id === obj.id);
  if (i >= 0) state.objetivos[i] = obj;
  else state.objetivos.push(obj);
  state.objetivos.sort((a, b) => a.prazo.localeCompare(b.prazo) || a.nome.localeCompare(b.nome));
}

function onSave(dados, { novo, inicial }) {
  if (novo) {
    const obj = {
      id: uid(), arquivado: false, criado: dayKey(new Date()), ...dados,
      movimentos: inicial ? [{ id: uid(), tipo: 'aporte', valor: inicial, data: dayKey(new Date()), nota: 'Saldo inicial', inicial: true }] : []
    };
    upsert(obj);
    location.hash = obj.id;
    persist(saveObjetivo(user.uid, obj, { novo: true }), () => {
      state.objetivos = state.objetivos.filter(o => o.id !== obj.id);
      location.hash = '';
    }).then(ok => ok && showToast('Objetivo criado.'));
    render();
    return;
  }
  const prev = find(dados.id);
  upsert(dados);
  state.simulado = null;
  render();
  persist(saveObjetivo(user.uid, dados), () => upsert(prev)).then(ok => ok && showToast('Objetivo atualizado.'));
}

/* ---------- Lista ---------- */

function renderKpis(list) {
  const rs = list.map(o => ({ o, r: resumir(o, state.hoje) }));
  const guardado = rs.reduce((a, x) => a + x.r.saldo, 0);
  const alvo = rs.reduce((a, x) => a + x.o.alvo, 0);
  const abertos = rs.filter(x => x.r.status !== 'concluido');
  const porMes = abertos.filter(x => x.r.status !== 'vencido').reduce((a, x) => a + x.r.necessario, 0);
  const proximo = abertos.filter(x => x.r.status !== 'vencido').sort((a, b) => a.o.prazo.localeCompare(b.o.prazo))[0];
  const tile = (label, value, sub, cls = '') => `
    <div class="kpi ${cls}"><span class="kpi-label">${label}</span><strong class="kpi-value num">${value}</strong><span class="kpi-sub">${sub}</span></div>`;
  return `<div class="kpis">
    ${tile('Guardado', formatBRL(guardado), alvo ? `${formatPct((guardado / alvo) * 100, 0)} do total de ${formatBRL(alvo)}` : '')}
    ${tile('Falta juntar', formatBRL(Math.max(0, alvo - guardado)), `${abertos.length} ${abertos.length === 1 ? 'objetivo em andamento' : 'objetivos em andamento'}`)}
    ${tile('Por mês, para cumprir os prazos', formatBRL(porMes), 'soma do necessário de cada objetivo')}
    ${proximo
      ? `<a class="kpi kpi-link" href="#${escapeHtml(proximo.o.id)}"><span class="kpi-label">Próximo prazo</span><strong class="kpi-value kpi-text">${escapeHtml(proximo.o.nome)}</strong><span class="kpi-sub">${mesCurto(proximo.o.prazo)} · ${tempoAte(proximo.o.prazo)}</span></a>`
      : tile('Próximo prazo', '—', 'nenhum em aberto')}
  </div>`;
}

/** Linha do tempo: barra até o prazo, preenchida pelo % guardado; losango na previsão. */
function renderHorizonte(list) {
  const itens = list.map(o => ({ o, r: resumir(o, state.hoje) }));
  const fimPrazo = itens.reduce((a, x) => (x.o.prazo > a ? x.o.prazo : a), somaMeses(state.hoje, 12));
  // previsões muito distantes não esticam o eixo além de 10 anos depois do último prazo
  const teto = somaMeses(fimPrazo, 120);
  const fim = itens.reduce((a, x) => (x.r.previsto && x.r.previsto > a ? (x.r.previsto > teto ? teto : x.r.previsto) : a), fimPrazo);
  const span = Math.max(1, mesesEntre(state.hoje, fim) + 1);
  const pos = key => Math.min(100, Math.max(0, ((mesesEntre(state.hoje, key) + 1) / span) * 100));

  const anos = [];
  const y0 = Number(state.hoje.slice(0, 4)), y1 = Number(fim.slice(0, 4));
  const passo = Math.max(1, Math.ceil((y1 - y0) / 6));
  for (let y = y0 + 1; y <= y1; y += passo) {
    if (pos(`${y}-01`) >= 9) anos.push(y); // perto demais de "Hoje", os rótulos se sobrepõem
  }

  const rows = itens.map(({ o, r }) => {
    const bar = pos(o.prazo);
    const prev = r.previsto ? pos(r.previsto) : null;
    const late = prev !== null && r.previsto > o.prazo;
    const title = `${o.nome}: ${formatPct(r.pct, 0)} guardado; prazo ${mesCurto(o.prazo)}${r.previsto ? `; previsão ${mesCurto(r.previsto)}` : ''}`;
    return `
      <li class="hz-row">
        <a class="hz-name" href="#${escapeHtml(o.id)}"><span class="obj-icon">${icon(o.icone, 14)}</span><span>${escapeHtml(o.nome)}</span></a>
        <div class="hz-track" role="img" aria-label="${escapeHtml(title)}">
          <div class="hz-bar ${r.status === 'concluido' ? 'is-done' : ''}" style="width:${bar}%"><i style="width:${r.pct}%"></i></div>
          ${late ? `<div class="hz-late" style="left:${bar}%; width:${prev - bar}%"></div>` : ''}
          ${prev !== null && r.status !== 'concluido' ? `<span class="hz-prev ${late ? 'is-late' : ''}" style="left:${prev}%"></span>` : ''}
          <span class="hz-flag" style="left:${bar}%">${icon('flag', 12)}</span>
        </div>
      </li>`;
  }).join('');

  return `
    <section class="card hz-card" aria-labelledby="hz-title">
      <div class="card-head">
        <h2 class="card-title" id="hz-title">Horizonte</h2>
        <ul class="hz-legend" aria-hidden="true">
          <li><i class="lg-bar"></i>Até o prazo, preenchido pelo guardado</li>
          <li><i class="lg-prev"></i>Previsão com o valor mensal</li>
        </ul>
      </div>
      <ol class="hz-list">${rows}</ol>
      <div class="hz-axis" aria-hidden="true">
        <span style="left:0">Hoje</span>
        ${anos.map(y => `<span style="left:${pos(`${y}-01`)}%">${y}</span>`).join('')}
      </div>
    </section>`;
}

function renderOrcamento(list) {
  const abertos = list.map(o => resumir(o, state.hoje)).filter(r => r.status !== 'concluido' && r.status !== 'vencido');
  const pede = abertos.reduce((a, r) => a + r.necessario, 0);
  const mesAtual = list.flatMap(o => o.movimentos).filter(m => m.tipo !== 'rendimento' && mesDe(m.data) === state.hoje)
    .reduce((a, m) => a + (m.tipo === 'resgate' ? -m.valor : m.valor), 0);
  const orc = state.orcamento;
  const head = `<div class="card-head"><h2 class="card-title">Cabe no orçamento?</h2></div>`;
  if (!orc) return `<section class="card orc-card">${head}<p class="orc-msg text-muted">Carregando o orçamento…</p></section>`;
  if (!orc.renda) {
    return `<section class="card orc-card">${head}
      <p class="orc-msg">Lance a renda de ${monthLabel(state.hoje)} no <a href="budget.html">Orçamento doméstico</a> para comparar com o que seus objetivos pedem: <strong class="num">${formatBRL(pede)}</strong> por mês.</p></section>`;
  }
  const max = Math.max(pede, orc.reservado, 1);
  const falta = pede - orc.reservado;
  return `
    <section class="card orc-card">${head}
      <div class="orc-bars">
        <div class="orc-bar"><span>Reservado em ${monthLabel(state.hoje).split('/')[0]}</span><b class="num">${formatBRL(orc.reservado)}</b>
          <div class="orc-track"><i style="transform:scaleX(${orc.reservado / max})"></i></div></div>
        <div class="orc-bar ${falta > 0 ? 'is-more' : ''}"><span>Seus objetivos pedem</span><b class="num">${formatBRL(pede)}</b>
          <div class="orc-track"><i style="transform:scaleX(${pede / max})"></i></div></div>
      </div>
      <p class="orc-msg">${falta > 0
        ? `Para caber, ajuste <strong class="num">${formatBRL(falta)}</strong> por mês: alongue um prazo ou aumente a parte de Metas e Liberdade financeira em <a href="budget.html#targets">Minhas metas</a>.`
        : pede ? `Sobra <strong class="num">${formatBRL(-falta)}</strong> por mês: dá para adiantar algum objetivo.` : 'Nenhum objetivo em aberto pede aportes agora.'}</p>
      <p class="orc-foot">${formatPct(orc.pct, 0)} da renda (Metas + Liberdade financeira) · ${mesAtual > 0 ? `${formatBRL(mesAtual)} já guardados este mês` : 'nenhum aporte este mês'}</p>
    </section>`;
}

function ring(pct, size = 56) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function renderCard(o) {
  const r = resumir(o, state.hoje);
  const rodape = {
    concluido: `Alvo alcançado. ${r.saldo > o.alvo ? `${formatBRL(r.saldo - o.alvo)} além do alvo.` : ''}`,
    vencido: `Faltaram ${formatBRL(r.falta)}. Ajuste o prazo para replanejar.`,
    'sem-plano': `Guarde <strong class="num">${formatBRL(r.necessario)}</strong>/mês para chegar no prazo.`,
    'no-ritmo': `<strong class="num">${formatBRL(r.necessario)}</strong>/mês até o prazo · chega em ${mesCurto(r.previsto)}`,
    atrasado: `Precisa de <strong class="num">${formatBRL(r.necessario)}</strong>/mês · no ritmo atual, ${mesCurto(r.previsto || o.prazo)}`
  }[r.status];
  return `
    <li>
      <a class="obj-card ${o.arquivado ? 'is-archived' : ''}" href="#${escapeHtml(o.id)}">
        <div class="obj-card-head">
          <span class="obj-icon">${icon(o.icone, 16)}</span>
          <h3>${escapeHtml(o.nome)}</h3>
          ${chip(r.status)}
        </div>
        <div class="obj-card-body">
          <div class="obj-ring">${ring(r.pct)}<span class="num">${formatPct(r.pct, 0)}</span></div>
          <div class="obj-card-vals">
            <strong class="num">${formatBRL(r.saldo)}</strong>
            <span>de <b class="num">${formatBRL(o.alvo)}</b></span>
            <span class="obj-card-when">${mesCurto(o.prazo)} · ${r.status === 'concluido' ? 'concluído' : tempoAte(o.prazo)}</span>
          </div>
        </div>
        <p class="obj-card-foot">${rodape}</p>
      </a>
    </li>`;
}

const SUGESTOES = [
  { nome: 'Certificações profissionais', icone: 'cap' },
  { nome: 'Reserva de emergência', icone: 'shield' },
  { nome: 'Viagem', icone: 'plane' },
  { nome: 'Investimento', icone: 'trending' }
];

function renderVazio() {
  const reserva = state.orcamento?.custosFixos ? state.orcamento.custosFixos * 6 : 0;
  return `
    <section class="obj-empty">
      <h2>Qual é o seu próximo grande objetivo?</h2>
      <p>Diga quanto quer juntar e até quando. Mostramos quanto guardar por mês, quando você chega lá e se isso cabe no seu orçamento.</p>
      <ul class="sugestoes">
        ${SUGESTOES.map((s, i) => `<li><button type="button" class="sugestao" data-sugestao="${i}">${icon(s.icone, 16)} ${s.nome}</button></li>`).join('')}
      </ul>
      ${reserva ? `<p class="obj-empty-note">Uma reserva de emergência costuma cobrir 6 meses de custos fixos. Pelo seu orçamento de ${monthLabel(state.hoje)}, isso dá <strong class="num">${formatBRL(reserva)}</strong>.</p>` : ''}
    </section>`;
}

function renderLista() {
  const list = state.arquivados ? state.objetivos.filter(o => o.arquivado) : ativos();
  const nArq = state.objetivos.filter(o => o.arquivado).length;
  let html;
  if (!state.objetivos.length) {
    html = renderVazio();
  } else if (state.arquivados) {
    html = `<ul class="obj-grid">${list.map(renderCard).join('')}</ul>`;
  } else {
    html = list.length
      ? `${renderKpis(list)}<div class="obj-overview">${renderHorizonte(list)}${renderOrcamento(list)}</div>
         <h2 class="section-title">Seus objetivos</h2><ul class="obj-grid">${list.map(renderCard).join('')}</ul>`
      : '<p class="obj-none">Nenhum objetivo ativo. Crie um novo ou veja os arquivados.</p>';
  }
  if (nArq) {
    html += `<button type="button" class="link-btn arq-toggle" id="arq-toggle">${state.arquivados ? 'Voltar aos objetivos ativos' : `Ver arquivados (${nArq})`}</button>`;
  }
  $('lista-body').innerHTML = html;
}

/* ---------- Detalhe ---------- */

function renderQuadro(o, r) {
  const cheios = Math.floor(r.pct);
  const parcial = r.pct - cheios;
  const antes = state.quadroAntes ?? cheios;
  state.quadroAntes = cheios;
  const cells = Array.from({ length: 100 }, (_, i) => {
    const cls = i < cheios ? `on${i >= antes ? ' is-new' : ''}` : '';
    const style = i === cheios && parcial > 0 ? ` style="--fill:${parcial.toFixed(2)}"` : '';
    return `<i class="${cls}${style ? ' partial' : ''}"${style}></i>`;
  }).join('');

  const datas = marcosAtingidos(o.movimentos, o.alvo);
  const rate = taxaMensal(o.taxa);
  const marcos = MARCOS.map(p => {
    const valor = Math.ceil((o.alvo * p) / 100);
    let quando, cls = '';
    if (datas[p] && r.saldo >= valor) {
      quando = `atingido em ${datas[p].split('-').reverse().join('/')}`;
      cls = 'is-done';
    } else {
      const n = mesesAte(r.saldo, valor, o.mensal, rate);
      quando = Number.isFinite(n) && o.mensal > 0 ? `previsto para ${mesCurto(somaMeses(state.hoje, n))}` : 'sem previsão';
    }
    return `<li class="${cls}"><span class="marco-pct num">${p}%</span><span class="marco-val num">${formatBRL(valor)}</span><span class="marco-when">${quando}</span></li>`;
  }).join('');

  return `
    <section class="card quadro-card" aria-labelledby="quadro-title">
      <div class="card-head">
        <h2 class="card-title" id="quadro-title">Quadro de 100</h2>
        <span class="card-hint">cada quadrado vale <b class="num">${formatBRL(Math.round(o.alvo / 100))}</b></span>
      </div>
      <div class="quadro" role="img" aria-label="${cheios} de 100 quadrados pintados">${cells}</div>
      <ol class="marcos">${marcos}</ol>
    </section>`;
}

/** Resultado do "E se?" para um valor mensal. */
function simTexto(o, saldo, sim) {
  const n = mesesAte(saldo, o.alvo, sim, taxaMensal(o.taxa));
  if (!Number.isFinite(n)) return sim ? 'Com esse valor, levaria mais de 100 anos.' : 'Sem aportes, o objetivo não avança.';
  const quando = somaMeses(state.hoje, n);
  return `Chega em <strong>${mesCurto(quando)}</strong>, ${folgaLabel(mesesEntre(quando, o.prazo))}.`;
}

function renderRitmo(o, r) {
  const real = ritmoReal(o.movimentos, state.hoje);
  const sim = state.simulado ?? o.mensal;
  const maxSim = Math.max(r.necessario * 2, o.mensal * 2, real * 2, 10000);
  const step = maxSim > 1000000 ? 10000 : maxSim > 200000 ? 5000 : 1000;
  const linhas = [
    ['Para chegar no prazo',
      r.status === 'vencido' ? 'prazo vencido' : r.meses ? `${formatBRL(r.necessario)}/mês` : formatBRL(r.necessario),
      r.status === 'vencido' ? `era ${mesCurto(o.prazo)}` : r.meses ? `${r.meses} ${r.meses === 1 ? 'aporte' : 'aportes'} até ${mesCurto(o.prazo)}` : 'o prazo é este mês'],
    ['Seu plano', o.mensal ? `${formatBRL(o.mensal)}/mês` : 'não definido', r.previsto ? `chega em ${mesCurto(r.previsto)}` : o.mensal ? 'não chega com esse valor' : ''],
    ['Ritmo real', `${formatBRL(Math.max(0, real))}/mês`, 'média dos últimos 3 meses']
  ];
  return `
    <section class="card ritmo-card" aria-labelledby="ritmo-title">
      <div class="card-head"><h2 class="card-title" id="ritmo-title">Ritmo</h2>${chip(r.status)}</div>
      <dl class="ritmo-list">
        ${linhas.map(([k, v, s]) => `<div><dt>${k}<small>${s}</small></dt><dd class="num">${v}</dd></div>`).join('')}
      </dl>
      ${r.status === 'concluido' ? '' : `
      <div class="sim">
        <label class="sim-label" for="sim-range">E se eu guardar <strong class="num" id="sim-val">${formatBRL(sim)}</strong> por mês?</label>
        <input type="range" class="range" id="sim-range" min="0" max="${maxSim}" step="${step}" value="${Math.min(sim, maxSim)}"
          style="--p:${(Math.min(sim, maxSim) / maxSim) * 100}%" aria-describedby="sim-out">
        <p class="sim-out" id="sim-out" aria-live="polite">${simTexto(o, r.saldo, sim)}</p>
        <button type="button" class="btn btn-ghost btn-sm" id="sim-usar" ${sim === o.mensal ? 'hidden' : ''}>Usar ${formatBRL(sim)} como plano</button>
      </div>`}
    </section>`;
}

function renderMovs(o) {
  const movs = ordenar(o.movimentos).reverse();
  const hoje = dayKey(new Date());
  return `
    <section class="card movs-card" aria-labelledby="movs-title">
      <div class="card-head"><h2 class="card-title" id="movs-title">Movimentações</h2><span class="card-hint">${movs.length} ${movs.length === 1 ? 'lançamento' : 'lançamentos'}</span></div>
      <form class="mov-form" id="mov-form" autocomplete="off">
        <div class="segmented" id="mov-tipo" role="radiogroup" aria-label="Tipo">
          ${Object.entries(TIPOS).map(([k, t]) => `<button type="button" role="radio" data-tipo="${k}" aria-checked="${k === state.tipoMov}">${t.nome}</button>`).join('')}
        </div>
        <label class="field"><span class="field-label">Valor</span>
          <input class="input num" name="valor" inputmode="numeric" placeholder="R$ 0,00" maxlength="22" required></label>
        <label class="field"><span class="field-label">Data</span>
          <input class="input" name="data" type="date" value="${hoje}" max="${hoje}" required></label>
        <label class="field grow"><span class="field-label">Observação (opcional)</span>
          <input class="input" name="nota" maxlength="80" placeholder="Ex.: 13º salário"></label>
        <button class="btn btn-primary" type="submit">Lançar</button>
      </form>
      <ul class="mov-list">
        ${movs.map(m => `
          <li data-id="${escapeHtml(m.id)}">
            <span class="day num">${m.data.split('-').reverse().join('/')}</span>
            <span class="mov-tag tag-${m.tipo}">${TIPOS[m.tipo].nome}</span>
            <span class="desc">${m.nota ? escapeHtml(m.nota) : ''}</span>
            <span class="val num ${m.tipo === 'resgate' ? 'is-out' : ''}">${formatBRL(m.valor)}</span>
            <button class="icon-btn danger" type="button" data-remove aria-label="Excluir lançamento">${icon('trash', 15)}</button>
          </li>`).join('') || '<li class="mov-empty">Nenhuma movimentação ainda. Lance o primeiro aporte acima.</li>'}
      </ul>
    </section>`;
}

function renderDetalhe(id) {
  const o = find(id);
  if (!o) {
    location.hash = '';
    return;
  }
  const r = resumir(o, state.hoje);
  $('det-icon').innerHTML = icon(o.icone, 22);
  $('det-icon').title = ICONE_NOMES[o.icone];
  $('det-nome').textContent = o.nome;
  $('det-sub').innerHTML = `${formatBRL(o.alvo)} até ${mesCurto(o.prazo)} · ${r.status === 'concluido' ? 'concluído' : tempoAte(o.prazo)}${o.taxa ? ` · ${formatPct(o.taxa / 100, o.taxa % 100 ? 2 : 0)} a.a. esperados` : ''}${o.arquivado ? ' · arquivado' : ''}`;
  $('det-arquivar').innerHTML = `${icon('archive', 15)} ${o.arquivado ? 'Desarquivar' : 'Arquivar'}`;
  document.title = `${o.nome} · Objetivos · DataLife`;

  const tile = (label, value, sub, cls = '') => `
    <div class="kpi ${cls}"><span class="kpi-label">${label}</span><strong class="kpi-value num">${value}</strong><span class="kpi-sub">${sub}</span></div>`;
  const kpis = `<div class="kpis">
    ${tile('Guardado', formatBRL(r.saldo), r.rendimentos ? `${formatBRL(r.investido)} investido + ${formatBRL(r.rendimentos)} de rendimento` : `${formatPct(r.pct, 1)} do alvo`)}
    ${tile('Falta', formatBRL(r.falta), r.status === 'concluido' ? 'alvo alcançado' : `${formatPct(100 - r.pct, 1)} do alvo`)}
    ${tile('Por mês até o prazo', r.status === 'vencido' ? '—' : formatBRL(r.necessario),
      r.status === 'vencido' ? 'o prazo já passou' : r.meses ? `por ${duracao(r.meses)}` : 'tudo este mês')}
    ${tile('Previsão', r.status === 'concluido' ? 'Concluído' : r.previsto ? mesCurto(r.previsto) : '—',
      r.status === 'concluido' ? '' : r.previsto ? folgaLabel(r.folga) : 'defina quanto guardar por mês')}
  </div>`;

  const real = serieMensal(o.movimentos, state.hoje);
  const ultimo = real.at(-1)?.saldo ?? 0;
  const ateProj = r.previsto && r.previsto > o.prazo ? r.previsto : o.prazo;
  const nProj = r.status === 'concluido' ? 0 : Math.min(Math.max(mesesEntre(state.hoje, ateProj), 6), 600);
  // ponto i = saldo no fim do mês hoje+i (mesma convenção de resumir: o mês atual já está no saldo)
  const proj = o.mensal || o.taxa ? projetar(ultimo, o.mensal, taxaMensal(o.taxa), state.hoje, nProj) : [];
  // Projeção para quando bate o alvo (não precisa desenhar além)
  const corte = proj.findIndex(p => p.saldo >= o.alvo);
  const projVis = corte >= 0 ? proj.slice(0, Math.max(corte + 1, mesesEntre(state.hoje, o.prazo))) : proj;

  $('detalhe-body').innerHTML = `
    ${kpis}
    <div class="det-grid">${renderQuadro(o, r)}${renderRitmo(o, r)}</div>
    <section class="card proj-card" aria-labelledby="proj-title">
      <div class="card-head">
        <h2 class="card-title" id="proj-title">Evolução e projeção</h2>
        <ul class="chart-legend" aria-hidden="true">
          <li><span class="key" style="--c:var(--accent)"></span>Saldo</li>
          ${projVis.length ? '<li><span class="key key-dash" style="--c:var(--p-100)"></span>Projeção com o plano</li>' : ''}
        </ul>
      </div>
      <div class="proj-chart" id="proj-chart"></div>
    </section>
    ${renderMovs(o)}`;

  state.chart = {
    real: real.length ? real : [{ key: state.hoje, saldo: 0 }],
    proj: projVis,
    alvo: o.alvo,
    prazo: o.prazo,
    hoje: state.hoje
  };
  renderProjecao($('proj-chart'), state.chart);
  chartWidth = $('proj-chart').clientWidth;

  const form = $('mov-form');
  bindCurrencyInput(form.valor);
  enhanceDateInput(form.data);
}

/* ---------- Rotas ---------- */

let currentId = null;
let chartWidth = 0;

function render() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* hash malformado (ex.: "#%E0"): vai para a lista */ }
  const detalhe = !!id && !!find(id);
  if (id && !detalhe && state.loaded) history.replaceState(null, '', location.pathname);
  $('view-lista').hidden = detalhe;
  $('view-detalhe').hidden = !detalhe;
  if (detalhe) {
    if (id !== currentId) {
      state.simulado = null;
      state.quadroAntes = null;
    }
    currentId = id;
    renderDetalhe(id);
  } else {
    currentId = null;
    document.title = 'Objetivos · DataLife';
    renderLista();
  }
}

function onRoute() {
  render();
  window.scrollTo(0, 0);
}

/* ---------- Eventos ---------- */

function bind() {
  $('btn-novo').innerHTML = `${icon('plus', 16)} Novo objetivo`;
  $('det-editar').innerHTML = `${icon('pencil', 15)} Editar`;
  $('det-excluir').innerHTML = icon('trash', 17);
  $('btn-novo').addEventListener('click', () => openObjetivoDialog());
  $('det-editar').addEventListener('click', () => openObjetivoDialog(find(currentId)));

  $('det-arquivar').addEventListener('click', () => {
    const prev = find(currentId);
    const next = { ...prev, arquivado: !prev.arquivado };
    upsert(next);
    if (next.arquivado) location.hash = '';
    else render();
    showToast(next.arquivado ? `"${next.nome}" arquivado.` : `"${next.nome}" voltou para os ativos.`);
    persist(saveObjetivo(user.uid, next), () => upsert(prev));
  });

  $('det-excluir').addEventListener('click', () => {
    const o = find(currentId);
    state.objetivos = state.objetivos.filter(x => x.id !== o.id);
    location.hash = '';
    persist(deleteObjetivo(user.uid, o.id), () => upsert(o));
    showToast(`"${o.nome}" excluído.`, 'success', 8000, {
      label: 'Desfazer',
      onClick: () => {
        upsert(o);
        render();
        persist(saveObjetivo(user.uid, o, { novo: true }), () => {
          state.objetivos = state.objetivos.filter(x => x.id !== o.id);
        });
      }
    });
  });

  $('lista-body').addEventListener('click', e => {
    if (e.target.closest('#arq-toggle')) {
      state.arquivados = !state.arquivados;
      return renderLista();
    }
    const sug = e.target.closest('[data-sugestao]');
    if (sug) {
      const s = SUGESTOES[Number(sug.dataset.sugestao)];
      openObjetivoDialog(null);
      const f = $('obj-form');
      f.nome.value = s.nome;
      f.querySelector(`[name="icone"][value="${s.icone}"]`).checked = true;
      if (s.icone === 'shield' && state.orcamento?.custosFixos) f.alvo.value = formatBRLRaw(state.orcamento.custosFixos * 6);
      f.dispatchEvent(new Event('input'));
      f.alvo.focus();
    }
  });

  const body = $('detalhe-body');
  // "E se?": atualiza só o texto (re-renderizar recriaria o slider no meio do arraste)
  body.addEventListener('input', e => {
    if (e.target.id !== 'sim-range') return;
    const o = find(currentId);
    state.simulado = Number(e.target.value);
    $('sim-val').textContent = formatBRL(state.simulado);
    e.target.style.setProperty('--p', `${(state.simulado / Number(e.target.max)) * 100}%`);
    $('sim-out').innerHTML = simTexto(o, resumir(o, state.hoje).saldo, state.simulado);
    $('sim-usar').hidden = state.simulado === o.mensal;
    $('sim-usar').textContent = `Usar ${formatBRL(state.simulado)} como plano`;
  });

  body.addEventListener('click', e => {
    const tipo = e.target.closest('[data-tipo]');
    if (tipo) {
      state.tipoMov = tipo.dataset.tipo;
      $('mov-tipo').querySelectorAll('[data-tipo]').forEach(b => b.setAttribute('aria-checked', b.dataset.tipo === state.tipoMov));
      return;
    }
    if (e.target.closest('#sim-usar')) {
      const prev = find(currentId);
      const next = { ...prev, mensal: state.simulado };
      upsert(next);
      state.simulado = null;
      render();
      persist(saveObjetivo(user.uid, next), () => upsert(prev)).then(ok => ok && showToast(`Plano: ${formatBRL(next.mensal)} por mês.`));
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const o = find(currentId);
      const mov = o.movimentos.find(m => m.id === rm.closest('[data-id]').dataset.id);
      const next = { ...o, movimentos: o.movimentos.filter(m => m.id !== mov.id) };
      upsert(next);
      render();
      persist(removeMovimento(user.uid, o.id, mov), () => upsert(o));
      showToast(`${TIPOS[mov.tipo].nome} de ${formatBRL(mov.valor)} excluído.`, 'success', 6000, {
        label: 'Desfazer',
        onClick: () => {
          const cur = find(o.id);
          if (!cur || cur.movimentos.some(m => m.id === mov.id)) return;
          upsert({ ...cur, movimentos: [...cur.movimentos, mov] });
          render();
          persist(addMovimento(user.uid, o.id, mov), () => upsert(cur));
        }
      });
    }
  });

  body.addEventListener('submit', e => {
    if (e.target.id !== 'mov-form') return;
    e.preventDefault();
    const f = e.target;
    const o = find(currentId);
    const valor = parseBRL(f.valor.value);
    const saldo = resumir(o, state.hoje).saldo;
    const erro = !valor ? 'Informe um valor.'
      : !f.data.value ? 'Informe uma data.'
      : state.tipoMov === 'resgate' && valor > saldo ? `O resgate passa do saldo (${formatBRL(saldo)}).`
      : null;
    if (erro) return showToast(erro, 'error');
    const mov = { id: uid(), tipo: state.tipoMov, valor, data: f.data.value };
    if (f.nota.value.trim()) mov.nota = f.nota.value.trim();
    const antes = resumir(o, state.hoje);
    const next = { ...o, movimentos: [...o.movimentos, mov] };
    upsert(next);
    render();
    const depois = resumir(next, state.hoje);
    const marco = MARCOS.find(p => antes.pct < p && depois.pct >= p);
    persist(addMovimento(user.uid, o.id, mov), () => upsert(o)).then(ok => {
      if (!ok) return;
      showToast(marco === 100 ? `Alvo alcançado! "${o.nome}" está completo.` : marco ? `Marco de ${marco}% atingido.` : `${TIPOS[mov.tipo].nome} lançado.`);
    });
    $('mov-form')?.valor.focus();
  });

  window.addEventListener('hashchange', onRoute);
  window.addEventListener('datalife:privacy', render);
  // O gráfico usa a largura do card: redesenha só ele, e só se a largura mudou.
  // (Re-renderizar o detalhe apagaria o formulário — e no celular o teclado
  // abrir já dispara resize.)
  window.addEventListener('resize', debounce(() => {
    const el = currentId && $('proj-chart');
    if (!el || el.clientWidth === chartWidth) return;
    chartWidth = el.clientWidth;
    renderProjecao(el, state.chart);
  }, 150));
}

async function loadOrcamento() {
  try {
    const [mes, metas] = await Promise.all([fetchMonth(user.uid, state.hoje), fetchMetas(user.uid)]);
    const pct = (metas.metas || 0) + (metas.liberdade || 0);
    state.orcamento = {
      renda: mes.renda,
      pct,
      reservado: Math.round((mes.renda * pct) / 100),
      custosFixos: Math.round((mes.renda * (metas.custosFixos || 0)) / 100)
    };
  } catch (e) {
    console.error(e);
    state.orcamento = { renda: 0, pct: 0, reservado: 0, custosFixos: 0 };
  }
}

/* ---------- Init ---------- */

initPagina();
bindPrivacyToggle($('btn-privacy'));
initObjetivoDialog({ onSave });
bind();

try {
  state.objetivos = await fetchObjetivos(user.uid);
  state.loaded = true;
  render();
  dadosProntos();
  loadOrcamento().then(() => { if (!currentId) renderLista(); });
} catch (e) {
  console.error(e);
  $('view-lista').hidden = false;
  $('lista-body').innerHTML = `
    <div class="load-error">
      <h1>Não foi possível carregar seus objetivos.</h1>
      <p>Verifique a conexão e recarregue a página.</p>
    </div>`;
}
