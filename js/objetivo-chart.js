/* ============================================
   DataLife — Objetivos: gráfico de projeção
   ============================================
   Linha cheia: saldo mês a mês até hoje (com área).
   Linha tracejada: projeção guardando o valor mensal planejado.
   Traço horizontal: o alvo. Traço vertical: o prazo.
   Passar o mouse (ou o dedo) mostra o saldo de cada mês.
   ============================================ */

import { compactBRL, niceScale } from './escala.js';
import { mesCurto, mesesEntre, somaMeses } from './objetivos-calc.js';
import { formatBRL, escapeHtml } from './utils.js';

const COR_REAL = 'var(--accent)';
const COR_PROJ = 'var(--p-100)';
const H = 240, PAD_T = 18, PAD_B = 30, PAD_L = 58, PAD_R = 14;

/**
 * @param {HTMLElement} wrap
 * @param {{real:Array<{key,saldo}>, proj:Array<{key,saldo}>, alvo:number, prazo:string, hoje:string}} d
 */
export function renderProjecao(wrap, d) {
  const pontos = [...d.real.map(p => ({ ...p, tipo: 'real' })), ...d.proj.map(p => ({ ...p, tipo: 'proj' }))];
  if (!pontos.length) {
    wrap.innerHTML = '<p class="chart-empty">Lance o primeiro aporte para ver a evolução.</p>';
    return;
  }
  const inicio = pontos[0].key;
  const fim = pontos[pontos.length - 1].key;
  const span = Math.max(1, mesesEntre(inicio, fim));
  const W = Math.max(wrap.clientWidth || 640, 300);
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const { max, ticks } = niceScale(Math.max(d.alvo, ...pontos.map(p => p.saldo), 1));
  const x = key => PAD_L + (mesesEntre(inicio, key) / span) * plotW;
  const y = v => PAD_T + plotH - (Math.max(0, v) / max) * plotH;

  // Eixo X: o menor passo (meses) que deixa ~72px por rótulo; a partir de 12, só anos
  const cabem = Math.max(2, Math.floor(plotW / 72));
  const passo = [1, 3, 6, 12, 24, 36, 60, 120, 240].find(p => span / p <= cabem) ?? 600;
  const xTicks = [];
  for (let k = inicio; k <= fim; k = somaMeses(k, 1)) {
    const m = Number(k.slice(5));
    if (passo >= 12 ? m === 1 && Number(k.slice(0, 4)) % (passo / 12) === 0 : (m - 1) % passo === 0) xTicks.push(k);
  }

  const linha = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.key).toFixed(1)},${y(p.saldo).toFixed(1)}`).join('');
  const base = PAD_T + plotH;
  const real = d.real;
  // A projeção começa no último ponto real, para as duas linhas se encontrarem
  const proj = real.length && d.proj.length ? [real[real.length - 1], ...d.proj] : d.proj;

  let svg = ticks.map(t => `
    <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(t)}" y2="${y(t)}" class="grid ${t === 0 ? 'base' : ''}"/>
    <text x="${PAD_L - 8}" y="${y(t)}" class="tick" text-anchor="end" dominant-baseline="middle">${compactBRL(t)}</text>`).join('');
  // Rótulos nas pontas alinham para dentro, para não serem cortados
  const anchor = px => (px < PAD_L + 24 ? 'start' : px > W - PAD_R - 24 ? 'end' : 'middle');
  svg += xTicks.map(k => {
    const px = x(k);
    return `<text x="${px}" y="${H - 10}" class="tick" text-anchor="${anchor(px)}">${passo >= 12 ? k.slice(0, 4) : mesCurto(k)}</text>`;
  }).join('');

  // Alvo e prazo
  svg += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(d.alvo)}" y2="${y(d.alvo)}" class="goal-line"/>
    <text x="${PAD_L + 6}" y="${y(d.alvo) - 6}" class="goal-label">Alvo</text>`;
  if (d.prazo >= inicio && d.prazo <= fim) {
    svg += `<line x1="${x(d.prazo)}" x2="${x(d.prazo)}" y1="${PAD_T}" y2="${base}" class="deadline-line"/>
      ${x(d.prazo) > W - PAD_R - 50
        ? `<text x="${x(d.prazo) - 5}" y="${PAD_T + 10}" class="goal-label" text-anchor="end">Prazo</text>`
        : `<text x="${x(d.prazo) + 5}" y="${PAD_T + 10}" class="goal-label">Prazo</text>`}`;
  }

  if (real.length) {
    const area = `${linha(real)}L${x(real[real.length - 1].key).toFixed(1)},${base}L${x(real[0].key).toFixed(1)},${base}Z`;
    svg += `<path d="${area}" class="real-area" style="fill:${COR_REAL}"/>
      <path d="${linha(real)}" class="real-line" style="stroke:${COR_REAL}"/>`;
  }
  if (proj.length > 1) svg += `<path d="${linha(proj)}" class="proj-line" style="stroke:${COR_PROJ}"/>`;
  if (real.length) {
    const last = real[real.length - 1];
    svg += `<circle cx="${x(last.key)}" cy="${y(last.saldo)}" r="4" style="fill:${COR_REAL}" class="now-dot"/>`;
  }

  svg += `<g class="cross" hidden><line class="cross-line" y1="${PAD_T}" y2="${base}"/><circle class="cross-dot" r="4"/></g>
    <rect class="hit" x="${PAD_L}" y="0" width="${plotW}" height="${H}"/>`;

  const ultimo = real[real.length - 1];
  const resumo = `Saldo atual ${ultimo ? formatBRL(ultimo.saldo) : formatBRL(0)}; alvo ${formatBRL(d.alvo)} até ${mesCurto(d.prazo)}.`;
  wrap.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="proj-svg" role="img" aria-label="${escapeHtml(resumo)}">${svg}</svg>
    <div class="chart-tip" role="status" hidden></div>`;

  const el = wrap.querySelector('svg');
  const tip = wrap.querySelector('.chart-tip');
  const cross = el.querySelector('.cross');
  const move = e => {
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - PAD_L) / plotW) * span);
    const key = somaMeses(inicio, Math.max(0, Math.min(span, i)));
    const p = pontos.find(q => q.key === key && q.tipo === 'real') || pontos.find(q => q.key === key);
    if (!p) return;
    const cx = x(p.key), cy = y(p.saldo);
    cross.removeAttribute('hidden'); // <g> é SVG: sem a propriedade .hidden
    cross.querySelector('line').setAttribute('x1', cx);
    cross.querySelector('line').setAttribute('x2', cx);
    const dot = cross.querySelector('circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.style.fill = p.tipo === 'real' ? COR_REAL : COR_PROJ;
    tip.innerHTML = `<strong class="tip-title"></strong>
      <div class="tip-row"><i style="background:${p.tipo === 'real' ? COR_REAL : COR_PROJ}"></i><span>${p.tipo === 'real' ? 'Saldo' : 'Projeção'}</span><b class="num">${formatBRL(p.saldo)}</b></div>
      <div class="tip-row"><i></i><span>${p.saldo >= d.alvo ? 'Alvo alcançado' : 'Falta'}</span><b class="num">${p.saldo >= d.alvo ? '' : formatBRL(d.alvo - p.saldo)}</b></div>`;
    tip.querySelector('.tip-title').textContent = mesCurto(p.key);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = cx + 12 + tw > W ? cx - 12 - tw : cx + 12;
    tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, Math.min(cy - 30, H - tip.offsetHeight))}px)`;
  };
  const leave = () => { cross.setAttribute('hidden', ''); tip.hidden = true; };
  const hit = el.querySelector('.hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
}
