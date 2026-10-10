/* ============================================
   DataLife — Gráfico de rosca (SVG puro)
   ============================================
   Fatias clicáveis: a ativa "salta" para fora na direção do
   próprio ângulo e as demais esmaecem (transform/opacity via CSS).
   ============================================ */

import { escapeHtml } from './utils.js';

const SIZE = 200;
const R = 80;
const STROKE = 28;
const GAP = 1.5; // graus entre fatias
const POP = 7;   // px que a fatia ativa se desloca

function polar(deg, r = R) {
  const rad = (deg - 90) * Math.PI / 180;
  return [SIZE / 2 + r * Math.cos(rad), SIZE / 2 + r * Math.sin(rad)];
}

function arc(start, end) {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * @param {HTMLElement} el
 * @param {Array<{key:string, label:string, value:number, color:string, center?:string, caption?:string}>} slices
 * @param {{center?:string, caption?:string, total?:number, active?:string|null, onSelect?:(key:string|null)=>void}} opts
 *   total: valor que representa 360° (default = soma das fatias)
 *   active: fatia destacada (fixada); center/caption dela substituem os do gráfico
 *   onHover: chamado com a fatia sob o mouse (ou null), para destacar elementos relacionados
 */
export function renderDonut(el, slices, { center = '', caption = '', total, active = null, onSelect, onHover } = {}) {
  const visible = slices.filter(s => s.value > 0);
  const sum = total ?? visible.reduce((a, s) => a + s.value, 0);
  let paths = '';

  const attrs = s => `class="slice" data-key="${escapeHtml(s.key)}"
    tabindex="0" role="button" aria-label="${escapeHtml(s.label)}"`;

  if (visible.length === 1 && visible[0].value >= sum) {
    const s = visible[0];
    paths = `<circle ${attrs(s)} cx="${SIZE / 2}" cy="${SIZE / 2}" r="${R}" fill="none" style="stroke:${s.color}" stroke-width="${STROKE}"><title>${escapeHtml(s.label)}</title></circle>`;
  } else if (sum > 0) {
    let angle = 0;
    for (const s of visible) {
      const sweep = (s.value / sum) * 360;
      const gap = sweep > GAP * 2 ? GAP : 0;
      const [dx, dy] = polar(angle + sweep / 2, POP).map(v => v - SIZE / 2);
      paths += `<path ${attrs(s)} style="--dx:${dx.toFixed(2)}px;--dy:${dy.toFixed(2)}px;stroke:${s.color}"
        d="${arc(angle + gap / 2, angle + sweep - gap / 2)}" fill="none" style="stroke:${s.color}" stroke-width="${STROKE}"><title>${escapeHtml(s.label)}</title></path>`;
      angle += sweep;
    }
  }

  // Mesmas fatias de antes? Só troca classes e textos, para a transição CSS rodar.
  // Fatias diferentes (dados mudaram): redesenha.
  const fresh = el.dataset.sig !== paths;
  if (fresh) {
    el.innerHTML = `
      <svg viewBox="-10 -10 ${SIZE + 20} ${SIZE + 20}" class="donut-svg">
        <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${R}" fill="none" style="stroke:var(--track)" stroke-width="${STROKE}"/>
        ${paths}
        <text x="${SIZE / 2}" text-anchor="middle" dominant-baseline="middle" class="donut-center"></text>
        <text x="${SIZE / 2}" y="${SIZE * 0.6}" text-anchor="middle" dominant-baseline="middle" class="donut-caption"></text>
      </svg>`;
    el.dataset.sig = paths;
  }

  const byKey = new Map(visible.map(s => [s.key, s]));
  const paint = key => paintActive(el, byKey.get(key) || null, center, caption, !fresh);
  paint(active);

  // Hover (mouse): pré-visualiza o destaque; ao sair volta para o fixado (active).
  // Clique/toque/Enter: fixa ou limpa o destaque via onSelect.
  // Atribuição direta (não addEventListener) para não acumular handlers a cada render.
  let hovered = null;
  el.onpointerover = e => {
    if (e.pointerType !== 'mouse') return;
    const key = e.target.closest('.slice')?.dataset.key ?? null;
    if (!key || key === hovered) return;
    hovered = key;
    paint(key);
    onHover?.(key);
  };
  el.onpointerleave = e => {
    if (e.pointerType !== 'mouse' || hovered === null) return;
    hovered = null;
    paint(active);
    onHover?.(null);
  };
  // Cruzar o buraco do meio também conta como sair das fatias
  el.onpointerout = e => {
    if (e.pointerType !== 'mouse' || hovered === null) return;
    if (e.relatedTarget?.closest?.('.slice')) return;
    hovered = null;
    paint(active);
    onHover?.(null);
  };

  if (!onSelect) return;
  el.onclick = e => {
    const key = e.target.closest('.slice')?.dataset.key ?? null;
    onSelect(key && key === active ? null : key); // clicar de novo (ou fora) limpa
  };
  el.onkeydown = e => {
    if (e.key === 'Escape' && active) onSelect(null);
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('slice')) {
      e.preventDefault();
      const key = e.target.dataset.key;
      onSelect(key === active ? null : key);
    }
  };
}

/** Aplica o destaque in-place (classes + texto do centro), para as transições CSS rodarem. */
/** Valor longo (ex.: R$ 12.345,67) encolhe para caber no furo do anel, sem vazar. */
const FURO = (R - STROKE / 2) * 2 - 18;
function caber(t) {
  t.style.fontSize = '';
  const w = t.getComputedTextLength?.() || 0;
  if (w > FURO) t.style.fontSize = `${parseFloat(getComputedStyle(t).fontSize) * (FURO / w)}px`;
}

function paintActive(el, act, center, caption, animateText) {
  const svg = el.querySelector('svg');
  svg.classList.toggle('has-active', !!act);
  svg.querySelectorAll('.slice').forEach(p => {
    const on = !!act && p.dataset.key === act.key;
    p.classList.toggle('active', on);
    p.setAttribute('aria-pressed', on);
  });
  const c = act ? (act.center ?? center) : center;
  const cap = act ? (act.caption ?? caption) : caption;
  const [centerEl, capEl] = svg.querySelectorAll('text');
  const changed = centerEl.textContent !== c || capEl.textContent !== cap;
  centerEl.textContent = c;
  centerEl.setAttribute('y', cap ? SIZE * 0.47 : SIZE / 2);
  capEl.textContent = cap;
  caber(centerEl);
  // Troca de destaque: crossfade com blur leve mascara a troca do texto (Emil)
  if (changed && animateText && 'animate' in centerEl) {
    const frames = [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0)' }];
    for (const t of [centerEl, capEl]) t.animate(frames, { duration: 160, easing: 'ease-out' });
  }
}
