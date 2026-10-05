/* ============================================
   DataLife — Seletor de data
   ============================================
   O calendário nativo do navegador não aceita CSS, então este componente
   desenha o próprio por cima de um <input type="date"> que continua no DOM
   (escondido): valor, min/max e `required` seguem funcionando como antes.

   Teclado: setas movem o dia · PageUp/PageDown trocam o mês · Home/End
   início/fim da semana · Enter/Espaço escolhe · Esc fecha.
   Motion (Emil): abre a partir do gatilho, 160ms ease-out, scale 0.97 + opacity;
   fecha mais rápido.
   ============================================ */

import { icon, MESES, placeFixed } from './utils.js';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

const pad = n => String(n).padStart(2, '0');
const toIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = s => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const fmt = iso => (iso ? iso.split('-').reverse().join('/') : '');

let open = null; // { input, pop, view: Date(1º dia do mês exibido), focus: Date }

/* ---------- Popover ---------- */

function inRange(input, iso) {
  return (!input.min || iso >= input.min) && (!input.max || iso <= input.max);
}

function render() {
  const { input, pop, view, focus } = open;
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay()); // domingo antes do dia 1
  const today = toIso(new Date());
  const selected = valueDesc.get.call(input);
  const prevOk = !input.min || toIso(new Date(y, m, 0)) >= input.min;
  const nextOk = !input.max || toIso(new Date(y, m + 1, 1)) <= input.max;

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toIso(d);
    const outside = d.getMonth() !== m;
    const enabled = inRange(input, iso);
    const isFocus = iso === toIso(focus);
    cells += `
      <button type="button" class="dp-day ${outside ? 'is-outside' : ''} ${iso === today ? 'is-today' : ''} ${iso === selected ? 'is-selected' : ''}"
        data-iso="${iso}" tabindex="${isFocus ? 0 : -1}" ${enabled ? '' : 'disabled'}
        aria-label="${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}, ${SEMANA_LONGA[d.getDay()]}"
        aria-pressed="${iso === selected}">${d.getDate()}</button>`;
  }

  pop.innerHTML = `
    <div class="dp-head">
      <strong class="dp-title" aria-live="polite">${MESES[m]} <span>${y}</span></strong>
      <div class="dp-nav">
        <button type="button" class="icon-btn" data-nav="-1" aria-label="Mês anterior" ${prevOk ? '' : 'disabled'}>${icon('chevronLeft', 16)}</button>
        <button type="button" class="icon-btn" data-nav="1" aria-label="Próximo mês" ${nextOk ? '' : 'disabled'}>${icon('chevronRight', 16)}</button>
      </div>
    </div>
    <div class="dp-week" aria-hidden="true">${SEMANA.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="dp-grid" role="grid">${cells}</div>
    <div class="dp-foot">
      <span class="dp-keys" aria-hidden="true">
        <kbd>←</kbd><kbd>→</kbd> dia <kbd>PgUp</kbd><kbd>PgDn</kbd> mês <kbd>Esc</kbd> fechar
      </span>
      <button type="button" class="link-btn" data-today ${inRange(input, today) ? '' : 'disabled'}>Hoje</button>
    </div>`;
}

function position() {
  const { pop, trigger } = open;
  const r = trigger.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const below = window.innerHeight - r.bottom >= h + 12 || r.top < h + 12;
  const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  placeFixed(pop, left, below ? r.bottom + 6 : r.top - h - 6);
  // Origem no gatilho: o popover "sai" de onde foi clicado
  pop.style.transformOrigin = `${r.right - left - r.width / 2}px ${below ? 'top' : 'bottom'}`;
}

function focusDay() {
  open.pop.querySelector(`[data-iso="${toIso(open.focus)}"]`)?.focus({ preventScroll: true });
}

function moveFocus(d) {
  const { input } = open;
  // Mantém o foco dentro do intervalo permitido
  if (input.min && toIso(d) < input.min) d = fromIso(input.min);
  if (input.max && toIso(d) > input.max) d = fromIso(input.max);
  open.focus = d;
  if (d.getMonth() !== open.view.getMonth() || d.getFullYear() !== open.view.getFullYear()) {
    open.view = new Date(d.getFullYear(), d.getMonth(), 1);
  }
  render();
  focusDay();
}

function choose(iso) {
  const { input } = open;
  if (!input.isConnected) return close(); // a linha foi redesenhada enquanto o calendário estava aberto
  input.value = iso;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  close(true);
}

function close(returnFocus = false) {
  if (!open) return;
  const { pop, trigger } = open;
  open = null;
  trigger.setAttribute('aria-expanded', 'false');
  pop.classList.add('is-leaving');
  setTimeout(() => pop.remove(), 120);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', onViewport);
  window.removeEventListener('scroll', onViewport, true);
  if (returnFocus) trigger.focus();
}

function onOutside(e) {
  if (open && !open.pop.contains(e.target) && !open.trigger.contains(e.target)) close();
}

function onViewport(e) {
  // Rolar dentro do próprio popover não fecha
  if (e?.type === 'scroll' && open?.pop.contains(e.target)) return;
  close();
}

function openPicker(input, trigger) {
  if (open?.input === input) return close(true);
  close();
  const selected = fromIso(valueDesc.get.call(input));
  const base = selected || fromIso(input.min) || new Date();
  const pop = document.createElement('div');
  pop.className = 'dp-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Escolher data');
  // Dentro de <dialog> modal o popover precisa estar no mesmo top layer
  (trigger.closest('dialog') || document.body).append(pop);

  open = { input, trigger, pop, view: new Date(base.getFullYear(), base.getMonth(), 1), focus: base };
  trigger.setAttribute('aria-expanded', 'true');
  render();
  position();
  focusDay();

  pop.addEventListener('click', e => {
    const day = e.target.closest('.dp-day');
    if (day && !day.disabled) return choose(day.dataset.iso);
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const n = Number(nav.dataset.nav);
      open.view = new Date(open.view.getFullYear(), open.view.getMonth() + n, 1);
      open.focus = new Date(open.view);
      render();
      return;
    }
    if (e.target.closest('[data-today]')) choose(toIso(new Date()));
  });

  pop.addEventListener('keydown', e => {
    const f = open.focus;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      return moveFocus(new Date(f.getFullYear(), f.getMonth(), f.getDate() + step));
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      return moveFocus(new Date(f.getFullYear(), f.getMonth() + (e.key === 'PageUp' ? -1 : 1), f.getDate()));
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      return moveFocus(new Date(f.getFullYear(), f.getMonth(), f.getDate() + (e.key === 'Home' ? -f.getDay() : 6 - f.getDay())));
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // não fecha o <dialog> nem cancela a edição da linha
      close(true);
    }
    if (e.key === 'Tab') close();
  });

  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onViewport);
  // Só depois de abrir: o próprio foco inicial pode disparar scroll
  requestAnimationFrame(() => {
    if (open?.pop === pop) window.addEventListener('scroll', onViewport, true);
  });
}

/* ---------- API ---------- */

/**
 * Troca o calendário nativo pelo do app. Idempotente.
 * @param {HTMLInputElement} input <input type="date">
 */
export function enhanceDateInput(input) {
  if (!input || input.dataset.dp) return;
  input.dataset.dp = '1';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `${input.className} dp-trigger`;
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  if (input.getAttribute('aria-label')) trigger.setAttribute('aria-label', input.getAttribute('aria-label'));
  input.classList.add('dp-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.after(trigger);

  // Rótulo <label> envolvendo o campo passa a apontar para o botão
  const paint = () => {
    const v = valueDesc.get.call(input);
    trigger.innerHTML = `<span class="dp-value num">${v ? fmt(v) : 'dd/mm/aaaa'}</span>${icon('calendar', 15)}`;
    trigger.classList.toggle('is-empty', !v);
  };

  // Atualiza o botão também quando o código altera input.value diretamente
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return valueDesc.get.call(this); },
    set(v) { valueDesc.set.call(this, v); paint(); }
  });
  input.addEventListener('change', paint);
  paint();

  trigger.addEventListener('click', e => {
    e.preventDefault();
    openPicker(input, trigger);
  });
  trigger.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      openPicker(input, trigger);
    }
  });
}
