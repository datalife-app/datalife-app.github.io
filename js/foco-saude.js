/* ============================================
   DataLife — Foco: saúde do dia
   ============================================
   Hidratação
     meta (ml) = peso × 35, +500 ml para quem se exercita, +500 ml em clima quente.
     Copos de 250 ml (arredondado para cima), divididos em
     manhã 30% · tarde 50% · noite 20%; a sobra do arredondamento vai para a tarde.
   Alimentação: café, almoço e janta.  Exercício: fez ou não.
   ============================================ */

import { REFEICOES } from './foco-db.js';
import { icon } from './utils.js';

const $ = id => document.getElementById(id);
export const COPO_ML = 250;

let ctx = null; // { dia(), config(), save(campo, valor, prev), openAjustes() }

/* ---------- Cálculo ---------- */

export function planoAgua(cfg) {
  const base = Math.round(cfg.peso * 35);
  const extra = (cfg.exercicio ? 500 : 0) + (cfg.calor ? 500 : 0);
  const meta = base + extra;
  const copos = Math.max(1, Math.ceil(meta / COPO_ML));
  const manha = Math.round(copos * 0.3);
  const noite = Math.round(copos * 0.2);
  return {
    base, extra, meta, copos,
    periodos: [
      { nome: 'Manhã', porque: 'Acordar o corpo', copos: manha },
      { nome: 'Tarde', porque: 'Manter o foco e a energia', copos: copos - manha - noite },
      { nome: 'Noite', porque: 'Pouco, antes de dormir', copos: noite }
    ]
  };
}

/** 2500 -> "2,5 L" · 750 -> "750 ml" */
export function formatMl(ml) {
  if (ml < 1000) return `${ml} ml`;
  return `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`;
}

/** Marcações do dia ajustadas ao número de copos atual (o peso pode ter mudado). */
function marcados(copos) {
  const a = ctx.dia().agua;
  return Array.from({ length: copos }, (_, i) => a[i] === true);
}

/* ---------- Tela ---------- */

const COPO_SVG = `
  <svg viewBox="0 0 24 28" aria-hidden="true">
    <path class="cup-water" d="M5.6 12h12.8l-1.25 11.9a2 2 0 0 1-2 1.8H8.85a2 2 0 0 1-2-1.8z"/>
    <path class="cup-glass" d="M4.5 4h15l-1.7 20a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/>
  </svg>`;

function renderAgua() {
  const el = $('agua');
  const cfg = ctx.config().agua;
  if (!cfg) {
    el.innerHTML = `
      <h3 class="saude-title">${icon('droplet', 15)} Hidratação</h3>
      <div class="saude-nudge">
        <p>Informe seu peso para calcular quanta água tomar por dia.</p>
        <button class="btn btn-ghost btn-sm" type="button" data-ajustes>Informar peso</button>
      </div>`;
    return;
  }
  const plano = planoAgua(cfg);
  const checks = marcados(plano.copos);
  const bebido = checks.filter(Boolean).length * COPO_ML;
  const pct = Math.min(1, bebido / plano.meta);
  let i = 0;
  const linhas = plano.periodos.map(p => {
    const ini = i;
    i += p.copos;
    const feitos = checks.slice(ini, i).filter(Boolean).length;
    const cups = Array.from({ length: p.copos }, (_, k) => {
      const idx = ini + k;
      return `<button type="button" class="cup ${checks[idx] ? 'is-on' : ''}" data-cup="${idx}"
        aria-pressed="${checks[idx]}" aria-label="${p.nome}: copo ${k + 1} de ${p.copos}">${COPO_SVG}</button>`;
    }).join('');
    return `
      <li class="agua-row ${p.copos && feitos === p.copos ? 'is-done' : ''}">
        <div class="agua-when"><strong>${p.nome}</strong><span>${p.porque}</span></div>
        <span class="agua-count num">${feitos}/${p.copos}</span>
        <div class="cups">${cups}</div>
      </li>`;
  }).join('');

  el.innerHTML = `
    <h3 class="saude-title">${icon('droplet', 15)} Hidratação</h3>
    <div class="saude-progress">
      <p><strong class="num">${formatMl(bebido)}</strong> <span>de ${formatMl(plano.meta)}</span></p>
      <div class="progress"><div class="progress-bar ${pct >= 1 ? 'is-full' : ''}" style="transform: scaleX(${pct})"></div></div>
    </div>
    <ul class="agua-list">${linhas}</ul>
    ${plano.extra ? `<p class="saude-note">A meta inclui ${formatMl(plano.extra)} a mais (${[cfg.exercicio && 'exercícios', cfg.calor && 'clima quente'].filter(Boolean).join(' e ')}).</p>` : ''}`;
}

function renderRefeicoes() {
  const r = ctx.dia().refeicoes;
  const feitas = REFEICOES.filter(x => r[x.id]).length;
  $('refeicoes').innerHTML = `
    <h3 class="saude-title">${icon('utensils', 15)} Alimentação <span class="saude-count num">${feitas}/${REFEICOES.length}</span></h3>
    <ul class="check-list">
      ${REFEICOES.map(x => `
        <li>
          <button type="button" class="check-item ${r[x.id] ? 'is-on' : ''}" data-refeicao="${x.id}" aria-pressed="${r[x.id]}">
            <span class="check-box" aria-hidden="true">${icon('check', 13)}</span>
            <span class="check-text"><strong>${x.nome}</strong><span>${x.porque}</span></span>
            <span class="check-when">${x.quando}</span>
          </button>
        </li>`).join('')}
    </ul>`;
}

function renderExercicio() {
  const on = ctx.dia().exercicio;
  $('exercicio').innerHTML = `
    <h3 class="saude-title">${icon('activity', 15)} Exercício</h3>
    <ul class="check-list">
      <li>
        <button type="button" class="check-item ${on ? 'is-on' : ''}" data-exercicio aria-pressed="${on}">
          <span class="check-box" aria-hidden="true">${icon('check', 13)}</span>
          <span class="check-text"><strong>Treino do dia</strong><span>${on ? 'Feito. Bom trabalho.' : 'Ainda não'}</span></span>
        </button>
      </li>
    </ul>`;
}

export function render() {
  renderAgua();
  renderRefeicoes();
  renderExercicio();
}

/* ---------- Eventos ---------- */

export function initSaude(options) {
  ctx = options;

  $('agua').addEventListener('click', e => {
    if (e.target.closest('[data-ajustes]')) return ctx.openAjustes('peso');
    const cup = e.target.closest('[data-cup]');
    if (!cup) return;
    const plano = planoAgua(ctx.config().agua);
    const prev = ctx.dia().agua;
    const next = marcados(plano.copos);
    const idx = Number(cup.dataset.cup);
    next[idx] = !next[idx];
    ctx.save('agua', next, prev);
    $('agua').querySelector(`[data-cup="${idx}"]`)?.focus();
  });

  $('refeicoes').addEventListener('click', e => {
    const b = e.target.closest('[data-refeicao]');
    if (!b) return;
    const prev = ctx.dia().refeicoes;
    ctx.save('refeicoes', { ...prev, [b.dataset.refeicao]: !prev[b.dataset.refeicao] }, prev);
    $('refeicoes').querySelector(`[data-refeicao="${b.dataset.refeicao}"]`)?.focus();
  });

  $('exercicio').addEventListener('click', e => {
    if (!e.target.closest('[data-exercicio]')) return;
    const prev = ctx.dia().exercicio;
    ctx.save('exercicio', !prev, prev);
    $('exercicio').querySelector('[data-exercicio]')?.focus();
  });
}
