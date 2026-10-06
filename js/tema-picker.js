/* ============================================
   DataLife — Seletor de tema
   ============================================
   Botão de paleta no cabeçalho; abre a lista de temas pré-definidos
   (mesmo popover das listas do app). ↑ ↓ escolhem, Enter aplica, Esc fecha.
   ============================================ */

import { icon, escapeHtml, placeFixed } from './utils.js';

let pop = null;

function close(returnFocus) {
  if (!pop) return;
  const { el, btn } = pop;
  pop = null;
  btn.setAttribute('aria-expanded', 'false');
  el.classList.add('is-leaving');
  setTimeout(() => el.remove(), 110);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', onClose);
  window.removeEventListener('scroll', onClose, true);
  if (returnFocus) btn.focus();
}
// A lista rola por dentro (são muitos temas): rolar nela não fecha
const onClose = e => { if (e?.type === 'scroll' && pop?.el.contains(e.target)) return; close(); };
const onOutside = e => { if (pop && !pop.el.contains(e.target) && !pop.btn.contains(e.target)) close(); };

function render(active) {
  const T = window.DataLifeTema;
  pop.active = active;
  pop.el.innerHTML = T.lista.map((t, i) => `
    ${i === 0 || T.lista[i - 1].grupo !== t.grupo ? `<div class="tema-grupo" role="presentation">${escapeHtml(t.grupo)}</div>` : ''}
    <div class="sp-opt tema-opt ${i === active ? 'is-active' : ''}" role="option" id="tema-${t.id}" data-i="${i}" aria-selected="${t.id === T.atual()}">
      <span class="tema-swatch" style="--sw-bg:${t.bg}" aria-hidden="true">${t.cores.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="tema-nome">${escapeHtml(t.nome)}<small>${escapeHtml(t.desc)}</small></span>${t.id === T.atual() ? icon('check', 14) : ''}
    </div>`).join('');
  pop.el.setAttribute('aria-activedescendant', `tema-${T.lista[active].id}`);
  pop.el.querySelector('.tema-opt.is-active')?.scrollIntoView({ block: 'nearest' });
}

function escolher(i) {
  window.DataLifeTema.definir(window.DataLifeTema.lista[i].id);
  render(i);
}

function abrir(btn) {
  if (pop) return close(true);
  const T = window.DataLifeTema;
  const el = document.createElement('div');
  el.className = 'sp-pop tema-pop';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'Tema');
  el.tabIndex = -1;
  document.body.append(el);
  pop = { el, btn, active: 0 };
  btn.setAttribute('aria-expanded', 'true');
  render(Math.max(0, T.lista.findIndex(t => t.id === T.atual())));

  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  placeFixed(el, Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8), r.bottom + 6);
  el.style.transformOrigin = 'top right';
  el.focus({ preventScroll: true });

  el.addEventListener('click', e => {
    const o = e.target.closest('.tema-opt');
    if (o) escolher(Number(o.dataset.i));
  });
  el.addEventListener('keydown', e => {
    const n = T.lista.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); render((pop.active + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); render((pop.active - 1 + n) % n); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(pop.active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onClose);
  requestAnimationFrame(() => { if (pop?.el === el) window.addEventListener('scroll', onClose, true); });
}

/** Liga o botão de tema do cabeçalho (se a página tiver um). */
export function initTemaPicker() {
  const btn = document.getElementById('btn-tema');
  if (!btn || !window.DataLifeTema) return;
  btn.innerHTML = icon('palette');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => abrir(btn));
}
