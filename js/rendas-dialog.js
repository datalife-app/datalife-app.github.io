/* ============================================
   DataLife — Fontes de renda do mês
   ============================================
   Lista editável (salário, freela, rendimentos...). O total vira a
   "Renda do mês" usada nas metas. O vale-alimentação (VA/VR) é opcional:
   soma na renda e vai inteiro para Custos fixos.
   Trabalha numa cópia: só grava ao Salvar.
   ============================================ */

import { fetchMonth } from './db.js';
import { icon, formatBRL, formatBRLRaw, parseBRL, bindCurrencyInput, monthLabel, shiftMonth, escapeHtml, showToast, uid } from './utils.js';

const $ = id => document.getElementById(id);

let ctx = null;   // { userId, key, rendas, va, onSave }
let rows = [];    // [{ id, desc, valor }]
const vaInput = () => $('rendas-form').elements.va;

function render(focusLast = false) {
  $('rendas-list').innerHTML = rows.map(r => `
    <li class="renda-row" data-id="${escapeHtml(r.id)}">
      <input class="input" name="desc" value="${escapeHtml(r.desc)}" placeholder="Ex.: Salário" maxlength="60" aria-label="Descrição da fonte">
      <input class="input num" name="valor" value="${r.valor ? formatBRLRaw(r.valor) : ''}" placeholder="R$ 0,00" inputmode="numeric" maxlength="22" aria-label="Valor">
      <button class="icon-btn danger" type="button" data-remove aria-label="Remover fonte">${icon('trash', 15)}</button>
    </li>`).join('') || '<li class="rendas-empty">Nenhuma fonte de renda neste mês.</li>';

  $('rendas-list').querySelectorAll('[name="valor"]').forEach(input => bindCurrencyInput(input, () => sync()));
  if (focusLast) $('rendas-list').querySelector('.renda-row:last-child [name="desc"]')?.focus();
  renderTotal();
}

/** Lê os inputs de volta para `rows`. */
function sync() {
  $('rendas-list').querySelectorAll('.renda-row').forEach(li => {
    const r = rows.find(x => x.id === li.dataset.id);
    if (!r) return;
    r.desc = li.querySelector('[name="desc"]').value;
    r.valor = parseBRL(li.querySelector('[name="valor"]').value);
  });
  renderTotal();
}

function renderTotal() {
  // formatBRL respeita o modo privacidade (os inputs já ficam mascarados pelo CSS)
  $('rendas-total').textContent = formatBRL(rows.reduce((a, r) => a + r.valor, 0) + parseBRL(vaInput().value));
}

function save() {
  sync();
  // Linhas totalmente vazias são ignoradas; com valor mas sem nome ganham um nome padrão
  const clean = rows
    .filter(r => r.desc.trim() || r.valor)
    .map(r => ({ id: r.id, desc: r.desc.trim() || 'Renda', valor: r.valor }));
  $('rendas-dialog').close();
  ctx.onSave(clean, parseBRL(vaInput().value));
}

export function initRendasDialog() {
  const dialog = $('rendas-dialog');
  dialog.querySelectorAll('[data-close]').forEach(b => {
    if (b.classList.contains('icon-btn')) b.innerHTML = icon('x', 18);
    b.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  bindCurrencyInput(vaInput(), () => renderTotal());

  $('rendas-add').addEventListener('click', () => {
    sync();
    rows.push({ id: uid(), desc: '', valor: 0 });
    render(true);
  });

  $('rendas-prev').addEventListener('click', async () => {
    const prevKey = shiftMonth(ctx.key, -1);
    let prev;
    try {
      prev = await fetchMonth(ctx.userId, prevKey);
    } catch {
      prev = { rendas: [] };
    }
    if (!prev.rendas.length && !prev.va) {
      showToast(`${monthLabel(prevKey)} não tem renda cadastrada.`, 'error');
      return;
    }
    sync();
    // Fonte com o mesmo nome e ainda sem valor recebe o valor anterior; as que faltam são adicionadas
    rows = rows.filter(r => r.desc.trim() || r.valor);
    const porNome = new Map(rows.map(r => [r.desc.trim().toLowerCase(), r]));
    for (const r of prev.rendas) {
      const atual = porNome.get(r.desc.trim().toLowerCase());
      if (!atual) rows.push({ id: uid(), desc: r.desc, valor: r.valor });
      else if (!atual.valor) atual.valor = r.valor;
    }
    if (!parseBRL(vaInput().value) && prev.va) vaInput().value = formatBRLRaw(prev.va);
    render();
  });

  $('rendas-list').addEventListener('input', e => {
    if (e.target.name === 'desc') sync();
  });
  $('rendas-list').addEventListener('click', e => {
    const li = e.target.closest('[data-remove]')?.closest('.renda-row');
    if (!li) return;
    sync();
    rows = rows.filter(r => r.id !== li.dataset.id);
    render();
  });

  $('rendas-form').addEventListener('submit', e => {
    e.preventDefault();
    save();
  });
}

/**
 * @param {{userId:string, key:string, rendas:Array, va:number, onSave:(rendas:Array, va:number)=>void}} options
 */
export function openRendasDialog(options) {
  ctx = options;
  rows = ctx.rendas.map(r => ({ ...r }));
  if (!rows.length) rows.push({ id: uid(), desc: 'Salário', valor: 0 });
  vaInput().value = ctx.va ? formatBRLRaw(ctx.va) : '';
  $('rendas-title').textContent = 'Renda do mês';
  $('rendas-sub').textContent = `${monthLabel(ctx.key)} · some salário, freelas, rendimentos e outras entradas.`;
  render();
  $('rendas-dialog').showModal();
  // Foco no primeiro valor vazio (o mais provável de ser preenchido)
  const empty = [...$('rendas-list').querySelectorAll('[name="valor"]')].find(i => !i.value);
  (empty || $('rendas-list').querySelector('[name="desc"]'))?.focus();
}
