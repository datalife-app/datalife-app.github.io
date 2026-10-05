/* ============================================
   DataLife — Copiar gastos para outro mês
   ============================================
   Lista os gastos do mês atual agrupados por categoria;
   o usuário marca só os que quer e escolhe o mês de destino.
   Gastos que já existem no destino (mesma categoria, descrição e valor)
   aparecem desabilitados para não duplicar.
   ============================================ */

import { fetchMonth, addGastos } from './db.js';
import {
  CATEGORIAS, icon, formatBRL, formatDay, monthLabel, shiftMonth, escapeHtml, showToast, uid
} from './utils.js';

const $ = id => document.getElementById(id);
const sig = g => `${g.cat}|${g.desc.trim().toLowerCase()}|${g.valor}`;

let ctx = null; // { userId, fromKey, gastos, onDone }
let targetKey = null;
let existing = new Set();
let selected = new Set();
let loadSeq = 0;

/** Mesmo dia no mês de destino (limitado ao último dia: 31/01 -> 28/02). */
function moveDate(iso, key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(Number(iso.slice(8, 10)) || 1, last);
  return `${key}-${String(day).padStart(2, '0')}`;
}

async function loadTarget(key) {
  targetKey = key;
  $('copy-to').textContent = monthLabel(key);
  const seq = ++loadSeq;
  $('copy-list').setAttribute('aria-busy', 'true');
  let target;
  try {
    target = await fetchMonth(ctx.userId, key);
  } catch (e) {
    console.error(e);
    target = { gastos: [] };
  }
  if (seq !== loadSeq) return;
  existing = new Set(target.gastos.map(sig));
  // Desmarca o que já existe no destino
  for (const id of [...selected]) {
    const g = ctx.gastos.find(x => x.id === id);
    if (!g || existing.has(sig(g))) selected.delete(id);
  }
  $('copy-list').removeAttribute('aria-busy');
  render();
}

function render() {
  const groups = CATEGORIAS
    .map(c => ({ cat: c, itens: ctx.gastos.filter(g => g.cat === c.id).sort((a, b) => a.data.localeCompare(b.data)) }))
    .filter(gr => gr.itens.length);

  if (!groups.length) {
    $('copy-list').innerHTML = '<p class="copy-empty">Nenhum gasto lançado neste mês.</p>';
  } else {
    $('copy-list').innerHTML = groups.map(({ cat, itens }) => {
      const copiaveis = itens.filter(g => !existing.has(sig(g)));
      const marcados = copiaveis.filter(g => selected.has(g.id)).length;
      const state = marcados === 0 ? '' : marcados === copiaveis.length ? 'checked' : 'data-mixed';
      return `
        <fieldset class="copy-group" style="--c:${cat.cor}">
          <label class="copy-group-head">
            <input type="checkbox" data-group="${cat.id}" ${state === 'checked' ? 'checked' : ''} ${state === 'data-mixed' ? 'data-mixed' : ''} ${copiaveis.length ? '' : 'disabled'}>
            <span class="dot"></span>${cat.nome}
          </label>
          ${itens.map(g => {
            const dup = existing.has(sig(g));
            return `
              <label class="copy-item ${dup ? 'is-dup' : ''}">
                <input type="checkbox" data-id="${escapeHtml(g.id)}" ${selected.has(g.id) ? 'checked' : ''} ${dup ? 'disabled' : ''}>
                <span class="day num">${escapeHtml(formatDay(g.data))}</span>
                <span class="desc">${escapeHtml(g.desc)}${dup ? '<em class="tag">já existe</em>' : ''}</span>
                <span class="val num">${formatBRL(g.valor)}</span>
              </label>`;
          }).join('')}
        </fieldset>`;
    }).join('');
    // Estado "parcial" do checkbox do grupo só existe via JS
    $('copy-list').querySelectorAll('[data-mixed]').forEach(el => { el.indeterminate = true; });
  }
  renderSummary();
}

function renderSummary() {
  const itens = ctx.gastos.filter(g => selected.has(g.id));
  const total = itens.reduce((a, g) => a + g.valor, 0);
  $('copy-summary').innerHTML = itens.length
    ? `<strong>${itens.length}</strong> ${itens.length === 1 ? 'gasto' : 'gastos'} · <span class="num">${formatBRL(total)}</span>`
    : 'Nenhum gasto selecionado';
  $('copy-submit').disabled = !itens.length;
  $('copy-submit').textContent = itens.length ? `Copiar ${itens.length}` : 'Copiar';
}

const copiaveis = () => ctx.gastos.filter(g => !existing.has(sig(g)));

function submit() {
  const itens = ctx.gastos.filter(g => selected.has(g.id));
  if (!itens.length) return;
  const key = targetKey;
  const novos = itens.map(g => ({ ...g, id: uid(), data: moveDate(g.data, key) }));
  // Não espera o servidor: offline o Firestore só confirma quando a conexão voltar.
  // A escrita já fica na fila local; erro de verdade (ex.: permissão) vira aviso.
  addGastos(ctx.userId, key, novos).catch(e => {
    console.error(e);
    showToast(`Não foi possível copiar para ${monthLabel(key)}. Tente novamente.`, 'error', 6000);
  });
  $('copy-dialog').close();
  showToast(`${novos.length} ${novos.length === 1 ? 'gasto copiado' : 'gastos copiados'} para ${monthLabel(key)}.`);
  ctx.onDone?.(key);
}

export function initCopyDialog() {
  const dialog = $('copy-dialog');
  $('copy-close').innerHTML = icon('x', 18);
  $('copy-prev').innerHTML = icon('chevronLeft', 16);
  $('copy-next').innerHTML = icon('chevronRight', 16);

  const close = () => dialog.close();
  $('copy-close').addEventListener('click', close);
  $('copy-cancel').addEventListener('click', close);
  // Clique fora do conteúdo (no backdrop) fecha
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });

  $('copy-prev').addEventListener('click', () => {
    // Pula o próprio mês de origem
    const prev = shiftMonth(targetKey, -1);
    loadTarget(prev === ctx.fromKey ? shiftMonth(prev, -1) : prev);
  });
  $('copy-next').addEventListener('click', () => {
    const next = shiftMonth(targetKey, 1);
    loadTarget(next === ctx.fromKey ? shiftMonth(next, 1) : next);
  });

  $('copy-all').addEventListener('click', () => {
    copiaveis().forEach(g => selected.add(g.id));
    render();
  });
  $('copy-none').addEventListener('click', () => {
    selected.clear();
    render();
  });

  $('copy-list').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.id) {
      t.checked ? selected.add(t.dataset.id) : selected.delete(t.dataset.id);
    } else if (t.dataset.group) {
      const ids = copiaveis().filter(g => g.cat === t.dataset.group).map(g => g.id);
      ids.forEach(id => (t.checked ? selected.add(id) : selected.delete(id)));
    }
    render();
  });

  $('copy-form').addEventListener('submit', e => {
    e.preventDefault();
    submit();
  });
}

/**
 * @param {{userId:string, fromKey:string, gastos:Array, onDone?:(key:string)=>void}} options
 */
export function openCopyDialog(options) {
  ctx = options;
  selected = new Set();
  existing = new Set();
  $('copy-from').textContent = monthLabel(ctx.fromKey);
  $('copy-submit').disabled = true;
  $('copy-dialog').showModal();
  render();
  loadTarget(shiftMonth(ctx.fromKey, 1));
}
