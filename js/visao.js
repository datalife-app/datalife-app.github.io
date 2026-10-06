/* ============================================
   DataLife — Visão geral (ganhos x gastos x resultado)
   ============================================
   Períodos: últimos 3 / 6 / 12 meses (até o mês atual) ou Total.
   Gráfico em SVG puro seguindo a skill dataviz:
   - 2 séries: ganhos #d4b4ff · gastos #7d52b8 (ΔE 29, CVD ok, ambas >= 3:1 no fundo).
     Ganhos fica acima da faixa de luminosidade sugerida para tema escuro, de propósito:
     prioridade para separar bem as duas séries e para o contraste.
   - colunas <= 20px, ponta arredondada 4px, gap de 2px, grid hairline
   - tooltip por mês (hover e foco), legenda sempre visível, tabela como alternativa
   ============================================ */

import { fetchAllMonths } from './db.js';
import { CATEGORIAS, MESES, formatBRL, formatPct, monthKey, shiftMonth, debounce, escapeHtml, icon } from './utils.js';
import { compactBRL, niceScale } from './escala.js';

const COR_GANHOS = 'var(--serie-ganhos)';
const COR_GASTOS = 'var(--serie-gastos)';
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const $ = id => document.getElementById(id);

let ctx = null;      // { userId, getLive, getMetas, onOpenMonth }
let range = '6';
let year = Number(monthKey(new Date()).slice(0, 4)); // usado no modo "Ano"
let months = [];     // dados carregados
let loadSeq = 0;

const label = key => { const [y, m] = key.split('-').map(Number); return `${MESES[m - 1]}/${y}`; };
const shortLabel = key => { const [y, m] = key.split('-').map(Number); return { m: MESES_CURTOS[m - 1], y: String(y) }; };
const totalGastos = m => m.gastos.reduce((a, g) => a + g.valor, 0);
const hasData = m => m.renda > 0 || m.gastos.length > 0;

/** R$ compacto para eixos: 1,2 mil / 15 mil / 1,5 mi */
/* ---------- Dados do período ---------- */

function periodKeys() {
  const atual = monthKey(new Date());
  if (range === 'year') return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  if (range === 'all') {
    const keys = months.filter(hasData).map(m => m.key);
    if (!keys.length) return [atual];
    const start = keys[0];
    const end = keys[keys.length - 1] > atual ? keys[keys.length - 1] : atual;
    const out = [];
    for (let k = start; k <= end; k = shiftMonth(k, 1)) out.push(k);
    return out;
  }
  const n = Number(range);
  return Array.from({ length: n }, (_, i) => shiftMonth(atual, i - n + 1));
}

function periodData() {
  const byKey = new Map(months.map(m => [m.key, m]));
  // O mês aberto na aba Orçamento é a fonte mais recente
  const live = ctx.getLive();
  byKey.set(live.key, live);
  return periodKeys().map(key => {
    const m = byKey.get(key) || { key, renda: 0, gastos: [] };
    const gastos = totalGastos(m);
    return { key, renda: m.renda, gastos, resultado: m.renda - gastos, itens: m.gastos, has: hasData(m) };
  });
}

/* ---------- Render ---------- */

function render() {
  const data = periodData();
  const comDados = data.filter(d => d.has);
  const ganhos = data.reduce((a, d) => a + d.renda, 0);
  const gastos = data.reduce((a, d) => a + d.gastos, 0);
  const resultado = ganhos - gastos;
  const nMedia = Math.max(comDados.length, 1);

  $('visao-sub').textContent = data.length > 1
    ? `${label(data[0].key)} a ${label(data[data.length - 1].key)}`
    : label(data[0].key);

  if (!comDados.length) {
    $('visao-body').hidden = true;
    $('visao-empty').hidden = false;
    return;
  }
  $('visao-body').hidden = false;
  $('visao-empty').hidden = true;

  renderKpis({ ganhos, gastos, resultado, nMedia });
  renderChart(data);
  renderCats(data, ganhos, gastos);
  renderTable(data);
  renderDestaques(data, { ganhos, gastos });
}

/* ---------- Resumo do ano ---------- */

function yearBounds() {
  const anos = months.filter(hasData).map(m => Number(m.key.slice(0, 4)));
  const atual = Number(monthKey(new Date()).slice(0, 4));
  return { min: Math.min(atual, ...anos), max: Math.max(atual, ...anos) };
}

function renderYearNav() {
  const nav = $('visao-year');
  nav.hidden = range !== 'year';
  if (nav.hidden) return;
  const { min, max } = yearBounds();
  $('visao-year-label').textContent = year;
  $('visao-year-prev').disabled = year <= min;
  $('visao-year-next').disabled = year >= max;
}

function renderDestaques(data, { ganhos, gastos }) {
  const card = $('visao-destaques');
  card.hidden = range !== 'year';
  if (card.hidden) return;

  const comDados = data.filter(d => d.has);
  const comRenda = comDados.filter(d => d.renda > 0);
  const melhor = comRenda.length ? comRenda.reduce((a, d) => (d.resultado > a.resultado ? d : a)) : null;
  const pior = comDados.length ? comDados.reduce((a, d) => (d.resultado < a.resultado ? d : a)) : null;
  const itens = data.flatMap(d => d.itens);
  const top = [...itens].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const porCat = CATEGORIAS.map(c => ({ c, v: itens.filter(g => g.cat === c.id).reduce((a, g) => a + g.valor, 0) }))
    .sort((a, b) => b.v - a.v);

  // Comparação com o ano anterior (só se houver dados)
  const prev = months.filter(m => m.key.startsWith(`${year - 1}-`) && hasData(m));
  const prevGastos = prev.reduce((a, m) => a + totalGastos(m), 0);
  const prevGanhos = prev.reduce((a, m) => a + m.renda, 0);
  const delta = (cur, old) => {
    if (!old) return '';
    const pct = (cur - old) / old * 100;
    const up = pct >= 0;
    return `<span class="delta">${up ? '▲' : '▼'} ${formatPct(Math.abs(pct), 0)}</span>`;
  };

  const fact = (lbl, valor, sub = '') => `
    <div class="fact">
      <span class="fact-label">${lbl}</span>
      <strong class="fact-value">${valor}</strong>
      ${sub ? `<span class="fact-sub">${sub}</span>` : ''}
    </div>`;

  $('visao-destaques-body').innerHTML = `
    <div class="facts">
      ${prevGastos || prevGanhos ? fact(`Comparado a ${year - 1}`,
        `${delta(gastos, prevGastos) ? 'Gastos ' + delta(gastos, prevGastos) : ''}`,
        delta(ganhos, prevGanhos) ? 'ganhos ' + delta(ganhos, prevGanhos) : '') : ''}
      ${melhor ? fact('Melhor mês', label(melhor.key), `sobrou ${formatBRL(melhor.resultado)}`) : ''}
      ${pior && pior !== melhor ? fact('Mês mais apertado', label(pior.key),
        pior.resultado < 0 ? `<span class="text-danger">déficit de ${formatBRL(-pior.resultado)}</span>` : `sobrou ${formatBRL(pior.resultado)}`) : ''}
      ${porCat[0]?.v ? fact('Onde mais foi dinheiro', porCat[0].c.nome, `${formatBRL(porCat[0].v)} · ${formatPct(porCat[0].v / (gastos || 1) * 100, 0)} dos gastos`) : ''}
      ${fact('Lançamentos', String(itens.length), comDados.length ? `em ${comDados.length} ${comDados.length === 1 ? 'mês' : 'meses'}` : '')}
    </div>
    ${top.length ? `
      <h3 class="top-title">Maiores gastos do ano</h3>
      <ol class="top-list">
        ${top.map(g => `
          <li>
            <span class="dot" style="--c:${CATEGORIAS.find(c => c.id === g.cat).cor}"></span>
            <span class="desc">${escapeHtml(g.desc)}</span>
            <span class="day num">${g.data.slice(8, 10)}/${g.data.slice(5, 7)}</span>
            <span class="val num">${formatBRL(g.valor)}</span>
          </li>`).join('')}
      </ol>` : ''}`;
}

function renderKpis({ ganhos, gastos, resultado, nMedia }) {
  const taxa = ganhos > 0 ? resultado / ganhos * 100 : 0;
  const neg = resultado < 0;
  const tile = (lbl, valor, sub, over = false) => `
    <div class="kpi ${over ? 'is-over' : ''}">
      <span class="kpi-label">${lbl}</span>
      <strong class="kpi-value">${valor}</strong>
      <span class="kpi-sub">${sub}</span>
    </div>`;
  $('visao-kpis').innerHTML =
    tile('Ganhos', formatBRL(ganhos), `média ${formatBRL(Math.round(ganhos / nMedia))}/mês`) +
    tile('Gastos', formatBRL(gastos), `média ${formatBRL(Math.round(gastos / nMedia))}/mês`) +
    tile(neg ? 'Déficit' : 'Resultado', formatBRL(Math.abs(resultado)),
      neg ? 'gastou mais do que ganhou' : 'o que sobrou no período', neg) +
    tile(neg ? 'Acima da renda' : 'Taxa de economia', formatPct(Math.abs(taxa), 1),
      neg ? 'dos ganhos' : 'dos ganhos guardados', neg);
}

function renderChart(data) {
  const wrap = $('visao-chart');
  const H = 260, PAD_T = 12, PAD_B = 36, PAD_L = 66, PAD_R = 8;
  const BAND_MIN = 44;
  const W = Math.max(wrap.clientWidth || 600, PAD_L + PAD_R + data.length * BAND_MIN);
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const { max, ticks } = niceScale(Math.max(...data.map(d => Math.max(d.renda, d.gastos)), 1));
  const y = v => PAD_T + plotH - (v / max) * plotH;
  const band = plotW / data.length;
  const barW = Math.min(20, (band - 12) / 2);

  // Coluna com ponta arredondada (4px) e base reta
  const col = (x, v, color) => {
    if (v <= 0) return '';
    const top = y(v), h = PAD_T + plotH - top, r = Math.min(4, h, barW / 2);
    return `<path d="M${x},${PAD_T + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD_T + plotH} Z" style="fill:${color}"/>`;
  };

  let svg = ticks.map(t => `
    <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(t)}" y2="${y(t)}" class="grid ${t === 0 ? 'base' : ''}"/>
    <text x="${PAD_L - 8}" y="${y(t)}" class="tick" text-anchor="end" dominant-baseline="middle">${compactBRL(t)}</text>`).join('');

  data.forEach((d, i) => {
    const x0 = PAD_L + i * band;
    const cx = x0 + band / 2;
    const { m, y: ano } = shortLabel(d.key);
    const showYear = i === 0 || m === 'jan';
    svg += `
      <g class="band" data-i="${i}" tabindex="0" role="img"
        aria-label="${escapeHtml(label(d.key))}: ganhos ${formatBRL(d.renda)}, gastos ${formatBRL(d.gastos)}">
        <rect class="band-hit" x="${x0}" y="${PAD_T}" width="${band}" height="${plotH + PAD_B}"/>
        ${col(cx - barW - 1, d.renda, COR_GANHOS)}
        ${col(cx + 1, d.gastos, COR_GASTOS)}
        <text x="${cx}" y="${H - PAD_B + 16}" class="tick" text-anchor="middle">${m}</text>
        ${showYear ? `<text x="${cx}" y="${H - PAD_B + 29}" class="tick tick-year" text-anchor="middle">${ano}</text>` : ''}
      </g>`;
  });

  wrap.innerHTML = `
    <div class="chart-scroll">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="bars-svg">${svg}</svg>
    </div>
    <div class="chart-tip" id="visao-tip" role="status" hidden></div>`;

  const tip = $('visao-tip');
  const show = g => {
    const d = data[Number(g.dataset.i)];
    const neg = d.resultado < 0;
    tip.innerHTML = `
      <strong class="tip-title"></strong>
      <div class="tip-row"><i style="background:${COR_GANHOS}"></i><span>Ganhos</span><b class="num">${formatBRL(d.renda)}</b></div>
      <div class="tip-row"><i style="background:${COR_GASTOS}"></i><span>Gastos</span><b class="num">${formatBRL(d.gastos)}</b></div>
      <div class="tip-row tip-total ${neg ? 'is-over' : ''}"><i></i><span>${neg ? 'Déficit' : 'Resultado'}</span><b class="num">${formatBRL(Math.abs(d.resultado))}</b></div>`;
    tip.querySelector('.tip-title').textContent = label(d.key);
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect(), br = g.getBoundingClientRect();
    // Ao lado da coluna (direita; esquerda se não couber) para não cobrir as barras do mês
    const gap = 8;
    const right = br.right - wr.left + gap;
    const left = right + tip.offsetWidth <= wr.width ? right : Math.max(br.left - wr.left - tip.offsetWidth - gap, 0);
    tip.style.transform = `translate(${left}px, 8px)`;
    wrap.querySelectorAll('.band.is-hover').forEach(b => b.classList.remove('is-hover'));
    g.classList.add('is-hover');
  };
  const hide = () => {
    tip.hidden = true;
    wrap.querySelectorAll('.band.is-hover').forEach(b => b.classList.remove('is-hover'));
  };
  wrap.querySelectorAll('.band').forEach(g => {
    g.addEventListener('pointerenter', () => show(g));
    g.addEventListener('focus', () => show(g));
    g.addEventListener('blur', hide);
    g.addEventListener('click', () => ctx.onOpenMonth(data[Number(g.dataset.i)].key));
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter') ctx.onOpenMonth(data[Number(g.dataset.i)].key);
    });
  });
  wrap.querySelector('svg').addEventListener('pointerleave', hide);
}

function renderCats(data, ganhos, gastos) {
  const metas = ctx.getMetas();
  const rows = CATEGORIAS.map(c => {
    const gasto = data.reduce((a, d) => a + d.itens.filter(g => g.cat === c.id).reduce((s, g) => s + g.valor, 0), 0);
    const meta = Math.round(ganhos * (metas[c.id] || 0) / 100);
    return { c, gasto, meta };
  });
  const max = Math.max(...rows.map(r => Math.max(r.gasto, r.meta)), 1);
  $('visao-cats').innerHTML = rows.map(({ c, gasto, meta }) => {
    const over = meta > 0 ? gasto > meta : gasto > 0;
    const share = gastos > 0 ? gasto / gastos * 100 : 0;
    return `
      <li class="cat-row ${over ? 'is-over' : ''}">
        <div class="cat-row-head">
          <span class="cat-row-name"><span class="dot" style="--c:${c.cor}"></span>${c.nome}</span>
          <span class="cat-row-val"><span class="num">${formatBRL(gasto)}</span> <span class="cat-row-meta">de ${formatBRL(meta)}</span></span>
        </div>
        <div class="cat-track" title="${formatPct(share, 0)} dos gastos">
          <div class="cat-fill" style="width:${(gasto / max * 100).toFixed(2)}%"></div>
          ${meta > 0 ? `<span class="cat-goal" style="left:${(meta / max * 100).toFixed(2)}%" aria-hidden="true"></span>` : ''}
        </div>
        <span class="cat-row-share">${formatPct(share, 0)} dos gastos${over ? ' · acima da meta' : ''}</span>
      </li>`;
  }).join('');
}

function renderTable(data) {
  $('visao-table').innerHTML = `
    <thead><tr><th>Mês</th><th>Ganhos</th><th>Gastos</th><th>Resultado</th><th>Economia</th></tr></thead>
    <tbody>${[...data].reverse().map(d => {
      if (!d.has) return `<tr class="is-empty" data-key="${d.key}"><td>${label(d.key)}</td><td colspan="4">sem lançamentos</td></tr>`;
      const neg = d.resultado < 0;
      const taxa = d.renda > 0 ? d.resultado / d.renda * 100 : 0;
      return `
        <tr data-key="${d.key}">
          <td>${label(d.key)}</td>
          <td data-label="Ganhos">${formatBRL(d.renda)}</td>
          <td data-label="Gastos">${formatBRL(d.gastos)}</td>
          <td data-label="${neg ? 'Déficit' : 'Resultado'}" class="${neg ? 'cell-over' : ''}">${formatBRL(Math.abs(d.resultado))}</td>
          <td data-label="Economia" class="${neg ? 'cell-over' : ''}">${d.renda > 0 ? formatPct(Math.abs(taxa), 0) : '—'}</td>
        </tr>`;
    }).join('')}</tbody>`;
}

/* ---------- API ---------- */

export function initVisao(options) {
  ctx = options;
  $('visao-range').addEventListener('click', e => {
    const btn = e.target.closest('[data-range]');
    if (!btn || btn.dataset.range === range) return;
    range = btn.dataset.range;
    $('visao-range').querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-checked', b === btn));
    renderYearNav();
    render();
  });
  $('visao-year-prev').innerHTML = icon('chevronLeft', 16);
  $('visao-year-next').innerHTML = icon('chevronRight', 16);
  $('visao-year-prev').addEventListener('click', () => { year--; renderYearNav(); render(); });
  $('visao-year-next').addEventListener('click', () => { year++; renderYearNav(); render(); });
  $('visao-table').addEventListener('click', e => {
    const row = e.target.closest('tr[data-key]');
    if (row) ctx.onOpenMonth(row.dataset.key);
  });
  window.addEventListener('resize', debounce(() => {
    if (!$('view-visao').hidden && months) render();
  }, 150));
}

/** Chamado ao abrir a aba: todos os meses (lidos uma vez por visita; db.js relê após uma edição). */
export async function showVisao() {
  const seq = ++loadSeq;
  $('view-visao').setAttribute('aria-busy', 'true');
  try {
    const all = await fetchAllMonths(ctx.userId);
    if (seq !== loadSeq) return;
    months = all;
  } catch (e) {
    console.error(e);
  }
  $('view-visao').removeAttribute('aria-busy');
  renderYearNav();
  render();
}

/** Re-renderiza sem buscar de novo (ex.: modo privacidade mudou). */
export function refreshVisao() {
  if (!$('view-visao').hidden) render();
}
