/* ============================================
   DataLife — Gastos recorrentes (fixos)
   ============================================
   Um gasto marcado como "repetir todo mês" vira um modelo em
   settings/recorrentes. Em cada mês (a partir de `desde`), os modelos
   ainda não lançados aparecem num aviso para lançar com um clique.
   O gasto lançado guarda `rec` = id do modelo.
   ============================================ */

import { fetchRecorrentes, saveRecorrentes } from './db.js';
import { CATEGORIAS, icon, formatBRL, monthLabel, escapeHtml, uid } from './utils.js';

const $ = id => document.getElementById(id);

let ctx = null;          // { userId, getMonth, getGastos, onLaunch(gastos) }
let templates = [];
let selected = new Set();
const dismissed = new Set(); // meses em que o aviso foi fechado (nesta sessão)

export async function loadRecorrentes(userId) {
  templates = await fetchRecorrentes(userId);
}

export const findTemplate = id => (id ? templates.find(t => t.id === id) : null);

/** Grava a nova lista de modelos; desfaz localmente se falhar. */
export async function setTemplates(next) {
  const prev = templates;
  templates = next;
  renderBanner();
  try {
    await saveRecorrentes(ctx.userId, next);
  } catch (e) {
    templates = prev;
    renderBanner();
    throw e;
  }
}

export const getTemplates = () => templates;

export function templateFrom(g, month, id = uid()) {
  return { id, cat: g.cat, desc: g.desc, valor: g.valor, dia: Number(g.data.slice(8, 10)) || 1, desde: month };
}

/** Modelos que ainda não têm gasto lançado no mês aberto. */
export function pendentes() {
  const month = ctx.getMonth();
  const gastos = ctx.getGastos();
  return templates.filter(t => t.desde <= month && !gastos.some(g => g.rec === t.id));
}

function gastoFrom(t, month) {
  const [y, m] = month.split('-').map(Number);
  const dia = Math.min(t.dia, new Date(y, m, 0).getDate());
  return { id: uid(), cat: t.cat, desc: t.desc, valor: t.valor, data: `${month}-${String(dia).padStart(2, '0')}`, rec: t.id };
}

function launch(list) {
  const month = ctx.getMonth();
  ctx.onLaunch(list.map(t => gastoFrom(t, month)));
}

export function renderBanner() {
  const banner = $('rec-banner');
  const month = ctx?.getMonth();
  const pend = ctx ? pendentes() : [];
  if (!pend.length || dismissed.has(month)) {
    banner.hidden = true;
    return;
  }
  const total = pend.reduce((a, t) => a + t.valor, 0);
  banner.hidden = false;
  banner.innerHTML = `
    <span class="rec-banner-icon">${icon('repeat', 16)}</span>
    <p class="rec-banner-text">
      <strong>${pend.length} ${pend.length === 1 ? 'gasto fixo' : 'gastos fixos'}</strong>
      ainda não ${pend.length === 1 ? 'lançado' : 'lançados'} em ${monthLabel(month)}
      <span class="num">· ${formatBRL(total)}</span>
    </p>
    <div class="rec-banner-actions">
      <button class="btn btn-ghost btn-sm" type="button" data-rec="review">Revisar</button>
      <button class="btn btn-primary btn-sm" type="button" data-rec="all">Lançar ${pend.length === 1 ? '' : 'todos'}</button>
      <button class="icon-btn" type="button" data-rec="dismiss" aria-label="Dispensar aviso neste mês">${icon('x', 16)}</button>
    </div>`;
}

function renderDialog() {
  const pend = pendentes();
  $('rec-list').innerHTML = CATEGORIAS.map(c => {
    const itens = pend.filter(t => t.cat === c.id);
    if (!itens.length) return '';
    return `
      <fieldset class="copy-group">
        <legend class="copy-group-head"><span class="dot" style="--c:${c.cor}"></span>${c.nome}</legend>
        ${itens.map(t => `
          <label class="copy-item">
            <input type="checkbox" data-id="${escapeHtml(t.id)}" ${selected.has(t.id) ? 'checked' : ''}>
            <span class="day num">dia ${t.dia}</span>
            <span class="desc">${escapeHtml(t.desc)}</span>
            <span class="val num">${formatBRL(t.valor)}</span>
          </label>`).join('')}
      </fieldset>`;
  }).join('') || '<p class="copy-empty">Nenhum gasto fixo pendente.</p>';

  const sel = pend.filter(t => selected.has(t.id));
  const total = sel.reduce((a, t) => a + t.valor, 0);
  $('rec-summary').innerHTML = sel.length
    ? `<strong>${sel.length}</strong> selecionado${sel.length === 1 ? '' : 's'} · <span class="num">${formatBRL(total)}</span>`
    : 'Nenhum selecionado';
  $('rec-submit').disabled = !sel.length;
  $('rec-submit').textContent = sel.length ? `Lançar ${sel.length}` : 'Lançar';
}

export function initRecorrentes(options) {
  ctx = options;
  const dialog = $('rec-dialog');
  dialog.querySelectorAll('[data-close]').forEach(b => {
    if (b.classList.contains('icon-btn')) b.innerHTML = icon('x', 18);
    b.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  $('rec-banner').addEventListener('click', e => {
    const action = e.target.closest('[data-rec]')?.dataset.rec;
    if (action === 'all') launch(pendentes());
    if (action === 'dismiss') {
      dismissed.add(ctx.getMonth());
      renderBanner();
    }
    if (action === 'review') {
      selected = new Set(pendentes().map(t => t.id));
      $('rec-sub').textContent = `Marque o que entra em ${monthLabel(ctx.getMonth())}. Os valores podem ser editados depois de lançados.`;
      renderDialog();
      dialog.showModal();
    }
  });

  $('rec-list').addEventListener('change', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    e.target.checked ? selected.add(id) : selected.delete(id);
    renderDialog();
  });

  $('rec-form').addEventListener('submit', e => {
    e.preventDefault();
    const list = pendentes().filter(t => selected.has(t.id));
    dialog.close();
    if (list.length) launch(list);
  });
}
