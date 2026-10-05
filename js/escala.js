/* ============================================
   DataLife — Escalas de gráfico
   ============================================
   Compartilhado pela Visão geral (colunas) e pelos Objetivos (projeção).
   ============================================ */

import { isPrivate } from './utils.js';

/** Rótulo curto de eixo: 1234500 -> "12,3 mil" (mascarado no modo privacidade). */
export function compactBRL(cents) {
  if (isPrivate()) return cents ? '•••' : '0';
  const v = cents / 100;
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Escala "redonda" para o eixo Y: passo 1/2/2,5/5 × 10^n e ~4 divisões. */
export function niceScale(v) {
  const alvo = Math.max(v, 100000) / 4;
  const exp = 10 ** Math.floor(Math.log10(alvo));
  const step = [1, 2, 2.5, 5, 10].map(s => s * exp).find(s => s >= alvo);
  const max = Math.ceil(v / step) * step || step * 4;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}
