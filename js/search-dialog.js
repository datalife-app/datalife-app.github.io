/* ============================================
   DataLife — Busca de lançamentos entre meses
   ============================================
   Filtra por texto (sem acento/caixa), categoria e período.
   Clicar num resultado abre o mês e a categoria dele.
   ============================================ */

import { fetchAllMonths } from './db.js';
import { CATEGORIAS, icon, formatBRL, monthKey, shiftMonth, debounce, escapeHtml } from './utils.js';
import { enhanceSelect } from './selectpicker.js';

const $ = id => document.getElementById(id);
const MAX_RESULTS = 200;
const CAT = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

let ctx = null;  // { userId, getLive, onOpen(key, cat) }
let all = [];    // [{ ...gasto, key }]

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtDate = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

function periodStart(p) {
  const atual = monthKey(new Date());
  if (p === 'year') return `${atual.slice(0, 4)}-01`;
  if (p === '12') return shiftMonth(atual, -11);
  return '0000-00';
}

function render() {
  const q = norm($('search-q').value.trim());
  const cat = $('search-cat').value;
  const start = periodStart($('search-period').value);

  const hits = all
    .filter(g => g.key >= start && (!cat || g.cat === cat) && (!q || norm(g.desc).includes(q)))
    .sort((a, b) => b.data.localeCompare(a.data));
  const total = hits.reduce((a, g) => a + g.valor, 0);

  $('search-results').innerHTML = hits.length
    ? hits.slice(0, MAX_RESULTS).map(g => `
        <button type="button" class="search-hit" data-key="${g.key}" data-cat="${g.cat}">
          <span class="day num">${fmtDate(g.data)}</span>
          <span class="desc"><span class="dot" style="--c:${CAT[g.cat].cor}"></span>${escapeHtml(g.desc)}</span>
          <span class="search-cat">${CAT[g.cat].nome}</span>
          <span class="val num">${formatBRL(g.valor)}</span>
        </button>`).join('')
    : `<p class="copy-empty">${q || cat ? 'Nada encontrado com esses filtros.' : 'Nenhum lançamento no período.'}</p>`;

  $('search-summary').innerHTML = hits.length
    ? `<strong>${hits.length}</strong> lançamento${hits.length === 1 ? '' : 's'} · total <span class="num">${formatBRL(total)}</span>`
      + (hits.length > MAX_RESULTS ? ` · mostrando os ${MAX_RESULTS} mais recentes` : '')
    : '';
}

export function initSearchDialog(options) {
  ctx = options;
  const dialog = $('search-dialog');
  dialog.querySelectorAll('[data-close]').forEach(b => {
    b.innerHTML = icon('x', 18);
    b.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  $('search-cat').innerHTML = '<option value="">Todas as categorias</option>' +
    CATEGORIAS.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  enhanceSelect($('search-cat'));
  enhanceSelect($('search-period'));

  // Em <input type="search"> o Esc só limparia o texto; aqui ele fecha a busca
  $('search-q').addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.close();
    }
  });

  const rerender = debounce(render, 120);
  $('search-q').addEventListener('input', rerender);
  $('search-cat').addEventListener('change', render);
  $('search-period').addEventListener('change', render);

  $('search-results').addEventListener('click', e => {
    const hit = e.target.closest('.search-hit');
    if (!hit) return;
    dialog.close();
    ctx.onOpen(hit.dataset.key, hit.dataset.cat);
  });
}

export async function openSearchDialog() {
  const dialog = $('search-dialog');
  $('search-results').innerHTML = '<p class="copy-empty">Carregando…</p>';
  $('search-summary').textContent = '';
  dialog.showModal();
  $('search-q').focus();
  try {
    const months = await fetchAllMonths(ctx.userId);
    const live = ctx.getLive(); // o mês aberto é a versão mais recente
    const byKey = new Map(months.map(m => [m.key, m]));
    byKey.set(live.key, live);
    all = [...byKey.values()].flatMap(m => m.gastos.map(g => ({ ...g, key: m.key })));
  } catch (e) {
    console.error(e);
    all = [];
  }
  render();
}

/** Re-renderiza se estiver aberto (ex.: modo privacidade mudou). */
export function refreshSearch() {
  if ($('search-dialog').open) render();
}
