/* ============================================
   DataLife — Lista suspensa e sugestões
   ============================================
   As listas nativas (<select> e <datalist>) abrem uma janela do sistema que
   não aceita CSS. Como no seletor de data, desenhamos a nossa por cima:

   enhanceSelect(select)  — o <select> continua no DOM (escondido): value,
     selectedIndex, 'change' e formulários seguem funcionando. Opções trocadas
     depois (innerHTML) são lidas na hora de abrir.
     Teclado: ↑ ↓ movem · Home/End · Enter/Espaço escolhem · letras buscam ·
     Esc fecha.
   enhanceSuggest(input, getItems) — sugestões enquanto digita (substitui
     <datalist>). ↑ ↓ escolhem · Enter aceita · Esc fecha.

   Motion (Emil): abre a partir do gatilho, 160ms ease-out; fecha mais rápido.
   ============================================ */

import { icon, escapeHtml, placeFixed } from './utils.js';

const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let open = null;   // { kind, owner (select|input), trigger, pop, items, active }
let seq = 0;

/* ---------- Popover comum ---------- */

function position() {
  const { pop, trigger } = open;
  const r = trigger.getBoundingClientRect();
  pop.style.minWidth = `${r.width}px`;
  pop.style.maxHeight = '';
  const w = pop.offsetWidth;
  let h = pop.offsetHeight;
  const espacoAbaixo = window.innerHeight - r.bottom - 12, espacoAcima = r.top - 12;
  const below = espacoAbaixo >= h || espacoAbaixo >= espacoAcima;
  // Sem espaço inteiro em nenhum lado: encolhe (a lista rola por dentro)
  const espaco = below ? espacoAbaixo : espacoAcima;
  if (h > espaco) { pop.style.maxHeight = `${Math.max(120, espaco)}px`; h = pop.offsetHeight; }
  const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  placeFixed(pop, left, below ? r.bottom + 6 : r.top - h - 6);
  pop.style.transformOrigin = `${r.left - left + r.width / 2}px ${below ? 'top' : 'bottom'}`;
}

function setActive(i, scroll = true) {
  if (!open || !open.items.length) return;
  open.active = Math.max(0, Math.min(open.items.length - 1, i));
  open.pop.querySelectorAll('.sp-opt').forEach((el, k) => el.classList.toggle('is-active', k === open.active));
  const el = open.pop.querySelector(`[data-i="${open.active}"]`);
  if (el) {
    (open.kind === 'select' ? open.pop : open.owner).setAttribute('aria-activedescendant', el.id);
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }
}

function close(returnFocus = false) {
  if (!open) return;
  const { pop, trigger, owner, kind } = open;
  open = null;
  (kind === 'select' ? trigger : owner).setAttribute('aria-expanded', 'false');
  if (kind === 'suggest') owner.removeAttribute('aria-activedescendant');
  pop.classList.add('is-leaving');
  setTimeout(() => pop.remove(), 110);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', onViewport);
  window.removeEventListener('scroll', onViewport, true);
  if (returnFocus) trigger.focus();
}

function onOutside(e) {
  if (open && !open.pop.contains(e.target) && !open.trigger.contains(e.target)) close();
}

function onViewport(e) {
  if (e?.type === 'scroll' && open?.pop.contains(e.target)) return;
  close();
}

function mount(state) {
  close();
  const pop = document.createElement('div');
  pop.className = `sp-pop ${state.kind === 'suggest' ? 'sp-suggest' : ''}`;
  pop.id = `sp-${++seq}`;
  pop.setAttribute('role', 'listbox');
  // Dentro de <dialog> modal o popover precisa estar no mesmo top layer
  (state.trigger.closest('dialog') || document.body).append(pop);
  open = { ...state, pop };
  renderList();
  position();
  if (open.active >= 0) setActive(open.active); // sugestões começam sem nenhuma marcada
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onViewport);
  requestAnimationFrame(() => {
    if (open?.pop === pop) window.addEventListener('scroll', onViewport, true);
  });
  // Clique escolhe; pointerdown não tira o foco do gatilho/campo
  pop.addEventListener('pointerdown', e => e.preventDefault());
  pop.addEventListener('click', e => {
    const opt = e.target.closest('.sp-opt');
    if (opt && !opt.classList.contains('is-disabled')) choose(Number(opt.dataset.i));
  });
  pop.addEventListener('pointermove', e => {
    const opt = e.target.closest('.sp-opt');
    if (opt && Number(opt.dataset.i) !== open?.active) setActive(Number(opt.dataset.i), false);
  });
}

function renderList() {
  const { pop, items, selected } = open;
  pop.innerHTML = items.map((it, i) => `
    <div class="sp-opt ${it.disabled ? 'is-disabled' : ''}" role="option" id="${pop.id}-${i}" data-i="${i}"
      aria-selected="${i === selected}" ${it.disabled ? 'aria-disabled="true"' : ''}>
      <span>${escapeHtml(it.label)}</span>${i === selected ? icon('check', 14) : ''}
    </div>`).join('');
}

function choose(i) {
  const st = open;
  if (!st || st.items[i]?.disabled) return;
  if (st.kind === 'select') {
    if (!st.owner.isConnected) return close();
    if (st.owner.selectedIndex !== st.items[i].index) {
      st.owner.selectedIndex = st.items[i].index;
      st.owner.dispatchEvent(new Event('input', { bubbles: true }));
      st.owner.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close(true);
  } else {
    close();
    st.owner.dataset.picking = '1'; // o 'input' abaixo não deve reabrir a lista
    st.owner.value = st.items[i].label;
    st.owner.dispatchEvent(new Event('input', { bubbles: true }));
    delete st.owner.dataset.picking;
  }
}

/* ---------- <select> ---------- */

function selectItems(select) {
  return [...select.options]
    .map((o, index) => ({ label: o.textContent.trim(), index, disabled: o.disabled, hidden: o.hidden }))
    .filter(o => !o.hidden);
}

function openSelect(select, trigger) {
  if (open?.owner === select) return close(true);
  const items = selectItems(select);
  const selected = items.findIndex(it => it.index === select.selectedIndex);
  trigger.setAttribute('aria-expanded', 'true');
  mount({ kind: 'select', owner: select, trigger, items, selected, active: Math.max(0, selected), typed: '', typedAt: 0 });
  trigger.setAttribute('aria-controls', open.pop.id);
}

/** Busca por letras: "ma" vai para "Maio", repetir a mesma letra percorre as que começam com ela. */
function typeahead(key) {
  const now = Date.now();
  open.typed = now - open.typedAt < 600 ? open.typed + key : key;
  open.typedAt = now;
  const q = norm(open.typed);
  const start = open.typed.length === 1 ? open.active + 1 : open.active;
  const n = open.items.length;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (norm(open.items[i].label).startsWith(q)) return setActive(i);
  }
}

export function enhanceSelect(select) {
  if (!select || select.dataset.sp) return;
  select.dataset.sp = '1';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `${select.className} sp-trigger`;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const label = select.getAttribute('aria-label');
  select.classList.add('sp-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(trigger);

  const paint = () => {
    const o = select.options[select.selectedIndex];
    const text = o ? o.textContent.trim() : '';
    trigger.innerHTML = `<span class="sp-value">${escapeHtml(text)}</span>${icon('chevronDown', 15)}`;
    trigger.setAttribute('aria-label', label ? `${label}: ${text}` : text);
    trigger.disabled = select.disabled;
  };
  // Atualiza o botão quando o código muda o valor ou as opções
  for (const [prop, desc] of [['value', valueDesc], ['selectedIndex', indexDesc]]) {
    Object.defineProperty(select, prop, {
      configurable: true,
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); paint(); }
    });
  }
  new MutationObserver(paint).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
  select.addEventListener('change', paint);
  paint();

  trigger.addEventListener('click', () => openSelect(select, trigger));
  trigger.addEventListener('keydown', e => {
    const isOpen = open?.owner === select;
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openSelect(select, trigger);
      } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        openSelect(select, trigger);
        typeahead(e.key);
      }
      return;
    }
    const keys = {
      ArrowDown: () => setActive(open.active + 1),
      ArrowUp: () => setActive(open.active - 1),
      Home: () => setActive(0),
      End: () => setActive(open.items.length - 1),
      PageDown: () => setActive(open.active + 8),
      PageUp: () => setActive(open.active - 8),
      Enter: () => choose(open.active),
      ' ': () => (open.typed && Date.now() - open.typedAt < 600 ? typeahead(' ') : choose(open.active)),
      Escape: () => close(true),
      Tab: () => close()
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      if (e.key === 'Escape') e.stopPropagation(); // não fecha o <dialog> junto
      keys[e.key]();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typeahead(e.key);
    }
  });
}

/* ---------- Sugestões (substitui <datalist>) ---------- */

/**
 * @param {HTMLInputElement} input
 * @param {() => string[]} getItems lista atual de sugestões
 */
export function enhanceSuggest(input, getItems) {
  if (!input || input.dataset.suggest) return;
  input.dataset.suggest = '1';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.autocomplete = 'off';

  const show = () => {
    const q = norm(input.value.trim());
    const list = getItems()
      .filter(s => s && norm(s) !== q && (!q || norm(s).includes(q)))
      // Começa com o texto digitado primeiro
      .sort((a, b) => Number(!norm(a).startsWith(q)) - Number(!norm(b).startsWith(q)) || a.localeCompare(b, 'pt-BR'))
      .slice(0, 6);
    if (!list.length) return open?.owner === input && close();
    input.setAttribute('aria-expanded', 'true');
    if (open?.owner === input) {
      open.items = list.map(label => ({ label }));
      open.active = -1;
      renderList();
      position();
      return;
    }
    mount({ kind: 'suggest', owner: input, trigger: input, items: list.map(label => ({ label })), selected: -1, active: -1 });
    input.setAttribute('aria-controls', open.pop.id);
  };

  input.addEventListener('input', () => {
    if (!input.dataset.picking) show();
  });
  input.addEventListener('focus', () => { if (!input.value) show(); });
  input.addEventListener('blur', () => { if (open?.owner === input) close(); });
  input.addEventListener('keydown', e => {
    if (open?.owner !== input) {
      if (e.key === 'ArrowDown') { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(open.active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(open.active - 1); }
    else if (e.key === 'Enter' && open.active >= 0) { e.preventDefault(); choose(open.active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  });
}
