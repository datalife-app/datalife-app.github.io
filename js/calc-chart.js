/* ============================================
   DataLife — Calculadoras: gráficos
   ============================================
   SVG desenhado à mão, no mesmo estilo da projeção dos Objetivos.
   - renderLinhas: eixo X em meses (rótulos por ano), áreas e linhas,
     faixas empilhadas (`de`), linhas de referência e marcos com rótulo.
     Passar o mouse (ou o dedo) mostra a cruz e a dica do mês.
   - renderColunas: colunas empilhadas (uma por ano), com dica por coluna.
   Cores vêm dos tokens do tema; texto sempre nas cores de texto.
   ============================================ */

import { compactBRL, niceScale } from './escala.js';
import { escapeHtml } from './utils.js';

const PAD_T = 22, PAD_B = 30, PAD_L = 58, PAD_R = 16;

const f1 = n => n.toFixed(1);

function eixoY(ticks, y, W) {
  return ticks.map(t => `
    <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${f1(y(t))}" y2="${f1(y(t))}" class="grid ${t === 0 ? 'base' : ''}"/>
    <text x="${PAD_L - 8}" y="${f1(y(t))}" class="tick" text-anchor="end" dominant-baseline="middle">${compactBRL(t)}</text>`).join('');
}

/**
 * Dica ao lado do ponto, sem sair do gráfico. `cx`/`cy` vêm em unidades do SVG;
 * `k` converte para pixels da tela quando o SVG está encolhido (max-width: 100%).
 */
function posicionar(tip, cx, cy, W, H, k = 1) {
  tip.hidden = false;
  const tw = tip.offsetWidth, px = cx * k, py = cy * k, w = W * k, h = H * k;
  const left = px + 14 + tw > w ? px - 14 - tw : px + 14;
  tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, Math.min(py - 30, h - tip.offsetHeight))}px)`;
}

/** Quantos pixels da tela vale uma unidade do SVG (1 quando não está encolhido). */
const escalaDe = (el, W) => el.getBoundingClientRect().width / W || 1;

const linhaTip = ({ cor, nome, valor, forte }) =>
  `<div class="tip-row ${forte ? 'tip-total' : ''}"><i style="background:${cor || 'transparent'}"></i><span>${escapeHtml(nome)}</span><b class="num">${valor}</b></div>`;

/**
 * @param {HTMLElement} wrap
 * @param {{
 *   n:number,
 *   series:Array<{nome:string, cor:string, v:number[], area?:boolean, de?:number, tracejada?:boolean, rotulo?:string, foraDaEscala?:boolean}>,
 *   rotuloX:(i:number)=>string, tituloTip:(i:number)=>string, linhasTip:(i:number)=>Array<{cor?,nome,valor,forte?}>,
 *   refY?:Array<{v:number, rotulo:string}>, refX?:Array<{i:number, rotulo:string}>,
 *   marcos?:Array<{i:number, v:number, rotulo?:string, cor?:string}>, altura?:number, aria:string, inicioX?:number
 * }} d
 */
export function renderLinhas(wrap, d) {
  const H = d.altura || 280;
  const W = Math.max(wrap.clientWidth || 640, 300);
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const n = Math.max(1, d.n);
  // Séries `foraDaEscala` (cenários) não definem a escala: passam do topo e são cortadas
  const topo = Math.max(1, ...d.series.filter(s => !s.foraDaEscala).flatMap(s => s.v), ...(d.refY || []).map(r => r.v));
  const { max, ticks } = niceScale(topo);
  const x = i => PAD_L + (i / n) * plotW;
  const y = v => PAD_T + plotH - (Math.max(0, Math.min(v, max)) / max) * plotH;
  const base = PAD_T + plotH;

  // Rótulos do eixo X: de quantos em quantos anos cabe ~64px por rótulo
  const anos = n / 12;
  const cabem = Math.max(2, Math.floor(plotW / 64));
  const passoAnos = n < 24 ? null : [1, 2, 5, 10, 20, 25, 50].find(p => anos / p <= cabem) ?? 100;
  const passo = passoAnos ? passoAnos * 12 : [1, 2, 3, 6, 12].find(p => n / p <= cabem) ?? 12;
  const off = d.inicioX || 0; // desloca os rótulos (ex.: idade atual em meses)
  const xTicks = [];
  for (let i = 0; i <= n; i++) if ((i + off) % passo === 0) xTicks.push(i);
  const anchor = px => (px < PAD_L + 20 ? 'start' : px > W - PAD_R - 20 ? 'end' : 'middle');

  let svg = eixoY(ticks, y, W);
  svg += xTicks.map(i => `<text x="${f1(x(i))}" y="${H - 10}" class="tick" text-anchor="${anchor(x(i))}">${escapeHtml(d.rotuloX(i))}</text>`).join('');

  const caminho = v => v.map((p, i) => `${i ? 'L' : 'M'}${f1(x(i))},${f1(y(p))}`).join('');
  // Áreas primeiro (de baixo para cima), linhas depois, para nenhuma área cobrir uma linha
  d.series.forEach(s => {
    if (!s.area) return;
    const de = s.de != null ? d.series[s.de].v : null;
    const volta = de
      ? de.map((p, i) => [i, p]).reverse().map(([i, p]) => `L${f1(x(i))},${f1(y(p))}`).join('')
      : `L${f1(x(s.v.length - 1))},${base}L${f1(x(0))},${base}`;
    svg += `<path d="${caminho(s.v)}${volta}Z" class="cc-area" style="fill:${s.cor}"/>`;
  });
  for (const r of d.refY || []) {
    if (r.v > max) continue;
    svg += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${f1(y(r.v))}" y2="${f1(y(r.v))}" class="cc-ref"/>
      <text x="${PAD_L + 6}" y="${f1(y(r.v) - 6)}" class="cc-ref-label">${escapeHtml(r.rotulo)}</text>`;
  }
  for (const r of d.refX || []) {
    if (r.i < 0 || r.i > n) continue;
    const px = x(r.i), fim = px > W - PAD_R - 90;
    svg += `<line x1="${f1(px)}" x2="${f1(px)}" y1="${PAD_T}" y2="${base}" class="cc-ref-x"/>
      <text x="${f1(fim ? px - 5 : px + 5)}" y="${PAD_T + 10}" class="cc-ref-label" text-anchor="${fim ? 'end' : 'start'}">${escapeHtml(r.rotulo)}</text>`;
  }
  d.series.forEach(s => {
    svg += `<path d="${caminho(s.v)}" class="cc-line ${s.tracejada ? 'is-dash' : ''} ${s.area ? '' : 'is-thin'}" style="stroke:${s.cor}"/>`;
  });
  // Rótulo direto na ponta das linhas soltas (cenários), para não depender só da cor
  const pontas = d.series.filter(s => s.rotulo).map(s => ({ s, py: y(s.v[s.v.length - 1]) })).sort((a, b) => a.py - b.py);
  pontas.forEach((p, k) => { if (k && p.py - pontas[k - 1].py < 13) p.py = pontas[k - 1].py + 13; });
  svg += pontas.map(p => `<text x="${W - PAD_R - 4}" y="${f1(p.py - 6)}" class="cc-end-label" text-anchor="end">${escapeHtml(p.s.rotulo)}</text>`).join('');
  for (const m of d.marcos || []) {
    if (m.i < 0 || m.i > n) continue;
    const px = x(m.i), py = y(m.v);
    svg += `<circle cx="${f1(px)}" cy="${f1(py)}" r="5" class="cc-dot" style="fill:${m.cor || 'var(--text)'}"/>`;
    if (m.rotulo) {
      const fim = px > W - PAD_R - 70;
      svg += `<text x="${f1(fim ? px - 9 : px + 9)}" y="${f1(Math.max(PAD_T + 4, py - 9))}" class="cc-dot-label" text-anchor="${fim ? 'end' : 'start'}">${escapeHtml(m.rotulo)}</text>`;
    }
  }
  svg += `<g class="cross" hidden><line class="cross-line" y1="${PAD_T}" y2="${base}"/>${d.series.map(() => '<circle class="cross-dot" r="4"/>').join('')}</g>
    <rect class="hit" x="${PAD_L}" y="0" width="${plotW}" height="${H}"/>`;

  wrap.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="cc-svg svg-grafico" role="img" aria-label="${escapeHtml(d.aria)}">${svg}</svg>
    <div class="chart-tip" role="status" hidden></div>`;

  const el = wrap.querySelector('svg');
  const tip = wrap.querySelector('.chart-tip');
  const cross = el.querySelector('.cross');
  const dots = [...cross.querySelectorAll('circle')];
  const mover = e => {
    const r = el.getBoundingClientRect();
    const k = r.width / W || 1;
    const i = Math.max(0, Math.min(n, Math.round((((e.clientX - r.left) / k - PAD_L) / plotW) * n)));
    const cx = x(i);
    cross.removeAttribute('hidden'); // <g> é SVG: sem a propriedade .hidden
    cross.querySelector('line').setAttribute('x1', cx);
    cross.querySelector('line').setAttribute('x2', cx);
    d.series.forEach((s, k) => {
      dots[k].setAttribute('cx', cx);
      dots[k].setAttribute('cy', y(s.v[i] ?? 0));
      dots[k].style.fill = s.cor;
    });
    tip.innerHTML = `<strong class="tip-title">${escapeHtml(d.tituloTip(i))}</strong>${d.linhasTip(i).map(linhaTip).join('')}`;
    posicionar(tip, cx, y(Math.max(...d.series.map(s => s.v[i] ?? 0))), W, H, k);
  };
  const sair = () => { cross.setAttribute('hidden', ''); tip.hidden = true; };
  const hit = el.querySelector('.hit');
  hit.addEventListener('pointermove', mover);
  hit.addEventListener('pointerdown', mover);
  hit.addEventListener('pointerleave', sair);
}

/** Retângulo com os cantos de cima arredondados (ponta do dado), base reta. */
function colunaPath(x0, y0, w, h, raio) {
  const r = Math.min(raio, h, w / 2);
  if (r <= 0) return `M${f1(x0)},${f1(y0 + h)}V${f1(y0)}H${f1(x0 + w)}V${f1(y0 + h)}Z`;
  return `M${f1(x0)},${f1(y0 + h)}V${f1(y0 + r)}Q${f1(x0)},${f1(y0)} ${f1(x0 + r)},${f1(y0)}H${f1(x0 + w - r)}Q${f1(x0 + w)},${f1(y0)} ${f1(x0 + w)},${f1(y0 + r)}V${f1(y0 + h)}Z`;
}

/**
 * @param {HTMLElement} wrap
 * @param {{grupos:Array<{rotulo:string, titulo:string, partes:Array<{nome,cor,v}>, total?:{nome,valor}}>, aria:string, altura?:number, fmt:(v:number)=>string}} d
 */
export function renderColunas(wrap, d) {
  const H = d.altura || 260;
  const W = Math.max(wrap.clientWidth || 640, 300);
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const somas = d.grupos.map(g => g.partes.reduce((a, p) => a + Math.max(0, p.v), 0));
  const { max, ticks } = niceScale(Math.max(1, ...somas));
  const y = v => PAD_T + plotH - (v / max) * plotH;
  const slot = plotW / d.grupos.length;
  const bw = Math.max(2, Math.min(36, slot * 0.68));
  const cabem = Math.max(2, Math.floor(plotW / 44));
  const passo = [1, 2, 5, 10, 20, 25, 50].find(p => d.grupos.length / p <= cabem) ?? 100;

  let svg = eixoY(ticks, y, W);
  d.grupos.forEach((g, k) => {
    const x0 = PAD_L + k * slot + (slot - bw) / 2;
    let acum = 0;
    const vis = g.partes.filter(p => p.v > 0);
    vis.forEach((p, j) => {
      const topo = j === vis.length - 1;
      const y1 = y(acum + p.v), y0 = y(acum);
      // 2px de respiro entre segmentos empilhados
      const h = Math.max(0, y0 - y1 - (j ? 2 : 0));
      svg += `<path d="${colunaPath(x0, y1, bw, h, topo ? 4 : 0)}" style="fill:${p.cor}" class="cc-bar"/>`;
      acum += p.v;
    });
    if ((k + 1) % passo === 0 || d.grupos.length <= cabem) {
      svg += `<text x="${f1(x0 + bw / 2)}" y="${H - 10}" class="tick" text-anchor="middle">${escapeHtml(g.rotulo)}</text>`;
    }
    svg += `<rect class="hit cc-hit" data-k="${k}" x="${f1(PAD_L + k * slot)}" y="${PAD_T}" width="${f1(slot)}" height="${plotH}"/>`;
  });

  wrap.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="cc-svg svg-grafico" role="img" aria-label="${escapeHtml(d.aria)}">${svg}</svg>
    <div class="chart-tip" role="status" hidden></div>`;
  const el = wrap.querySelector('svg');
  const tip = wrap.querySelector('.chart-tip');
  const mover = e => {
    const r = e.target.closest('[data-k]');
    if (!r) return;
    const k = Number(r.dataset.k);
    const g = d.grupos[k];
    el.querySelectorAll('.cc-hit').forEach(h => h.classList.toggle('is-on', h === r));
    tip.innerHTML = `<strong class="tip-title">${escapeHtml(g.titulo)}</strong>
      ${[...g.partes].reverse().map(p => linhaTip({ cor: p.cor, nome: p.nome, valor: d.fmt(p.v) })).join('')}
      ${g.total ? linhaTip({ nome: g.total.nome, valor: g.total.valor, forte: true }) : ''}`;
    posicionar(tip, PAD_L + k * slot + slot / 2, y(somas[k]), W, H, escalaDe(el, W));
  };
  el.addEventListener('pointermove', mover);
  el.addEventListener('pointerdown', mover);
  el.addEventListener('pointerleave', () => { tip.hidden = true; el.querySelectorAll('.cc-hit').forEach(h => h.classList.remove('is-on')); });
}
