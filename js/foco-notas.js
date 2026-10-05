/* ============================================
   DataLife — Foco: notas do dia
   ============================================
   Várias notas por dia, em abas. Salva sozinho 700ms depois da última
   tecla; trocar de dia, de aba do navegador ou fechar a página grava
   na hora o que estiver pendente (para o dia certo).
   ============================================ */

import { LIMITES } from './foco-db.js';
import { icon, escapeHtml, debounce, uid, showToast } from './utils.js';

const $ = id => document.getElementById(id);

let ctx = null;      // { day(), notas(), persist(day, notas) -> Promise }
let pages = [];      // cópia de trabalho das notas do dia
let activeId = null;
let renamingId = null;
let savedAt = null;  // Date.now() da última gravação
let saving = false;
let dirty = false;    // edição agendada e ainda não gravada

const nova = (titulo = 'Nota') => ({ id: uid(), titulo, texto: '', criada: Date.now() });
const temConteudo = list => list.some(p => p.texto.trim() || p.titulo !== 'Nota');

/* ---------- Gravação ---------- */

const persist = debounce(async (day, snapshot) => {
  saving = true;
  dirty = false;
  renderStatus();
  // Só a nota padrão vazia não vale um documento
  const ok = await ctx.persist(day, temConteudo(snapshot) ? snapshot : []);
  saving = false;
  if (ok) savedAt = Date.now();
  renderStatus();
}, 700);

function schedule() {
  savedAt = null;
  dirty = true;
  persist(ctx.day(), pages.map(p => ({ ...p })));
  renderStatus();
}

export const flush = () => persist.flush();

/** Há texto digitado ainda não gravado (não recarregar a nota por cima). */
export const pendentes = () => savedAt === null && (saving || dirty);

/* ---------- Tela ---------- */

function renderStatus() {
  const el = $('nota-status');
  if (saving) el.textContent = 'Salvando…';
  else if (savedAt) {
    const s = Math.round((Date.now() - savedAt) / 1000);
    el.textContent = s < 5 ? 'Salvo agora' : s < 60 ? `Salvo há ${s}s` : `Salvo há ${Math.round(s / 60)} min`;
  } else el.textContent = pages.length > 1 || temConteudo(pages) ? '' : 'Salva sozinha';
}

function renderTabs() {
  const tabs = pages.map(p => {
    const sel = p.id === activeId;
    if (p.id === renamingId) {
      return `<div class="nota-tab is-active"><input class="nota-rename" data-rename="${escapeHtml(p.id)}" value="${escapeHtml(p.titulo)}" maxlength="${LIMITES.titulo}" aria-label="Nome da nota"></div>`;
    }
    return `
      <div class="nota-tab ${sel ? 'is-active' : ''}">
        <button type="button" role="tab" aria-selected="${sel}" class="nota-tab-btn" data-tab="${escapeHtml(p.id)}" title="Clique duas vezes para renomear">${escapeHtml(p.titulo || 'Sem título')}</button>
        ${pages.length > 1 ? `<button type="button" class="nota-close" data-close-tab="${escapeHtml(p.id)}" aria-label="Apagar ${escapeHtml(p.titulo)}">${icon('x', 12)}</button>` : ''}
      </div>`;
  }).join('');
  $('nota-tabs').innerHTML = `<div class="nota-tabs-scroll">${tabs}</div>
    <button type="button" class="icon-btn nota-add" id="nota-add" aria-label="Nova nota" title="Nova nota" ${pages.length >= LIMITES.notas ? 'disabled' : ''}>${icon('plus', 16)}</button>`;
  const ren = $('nota-tabs').querySelector('[data-rename]');
  if (ren) { ren.focus(); ren.select(); }
}

function renderText() {
  const p = pages.find(x => x.id === activeId);
  const ta = $('nota-text');
  if (ta.value !== p.texto) ta.value = p.texto;
  ta.setAttribute('aria-label', `Texto de ${p.titulo}`);
}

/** Carrega as notas do dia selecionado (chamado ao trocar de dia). */
export function render() {
  pages = ctx.notas().map(p => ({ ...p }));
  if (!pages.length) pages = [nova()];
  activeId = pages[0].id;
  renamingId = null;
  savedAt = null;
  renderTabs();
  renderText();
  renderStatus();
}

export function focus() {
  $('nota-text').focus();
}

/* ---------- Ações ---------- */

function add() {
  if (pages.length >= LIMITES.notas) return;
  const p = nova(`Nota ${pages.length + 1}`);
  pages.push(p);
  activeId = p.id;
  renderTabs();
  renderText();
  schedule();
  focus();
}

/** Apaga na hora, com Desfazer no aviso (sem janela de confirmação). */
function removePage(id) {
  const i = pages.findIndex(p => p.id === id);
  if (i < 0 || pages.length === 1) return;
  const p = pages[i];
  const day = ctx.day();
  pages.splice(i, 1);
  if (activeId === id) activeId = pages[Math.max(0, i - 1)].id;
  renderTabs();
  renderText();
  schedule();
  showToast(`Nota "${p.titulo}" apagada.`, 'success', 6000, {
    label: 'Desfazer',
    onClick: () => {
      // Só desfaz no mesmo dia (trocar de dia já gravou a lista sem ela)
      if (ctx.day() !== day || pages.some(x => x.id === p.id) || pages.length >= LIMITES.notas) return;
      pages.splice(Math.min(i, pages.length), 0, p);
      activeId = p.id;
      renderTabs();
      renderText();
      schedule();
    }
  });
}

function rename(id, titulo) {
  renamingId = null;
  const p = pages.find(x => x.id === id);
  const t = titulo.trim().slice(0, LIMITES.titulo) || p.titulo;
  if (p && t !== p.titulo) {
    p.titulo = t;
    schedule();
  }
  renderTabs();
}

export function initNotas(options) {
  ctx = options;

  $('nota-text').addEventListener('input', e => {
    const p = pages.find(x => x.id === activeId);
    p.texto = e.target.value.slice(0, LIMITES.nota);
    schedule();
  });

  const tabs = $('nota-tabs');
  tabs.addEventListener('click', e => {
    if (e.target.closest('#nota-add')) return add();
    const close = e.target.closest('[data-close-tab]');
    if (close) return removePage(close.dataset.closeTab);
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.dataset.tab !== activeId) {
      activeId = tab.dataset.tab;
      renderTabs();
      renderText();
    }
  });
  tabs.addEventListener('dblclick', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    renamingId = tab.dataset.tab;
    renderTabs();
  });
  tabs.addEventListener('keydown', e => {
    const ren = e.target.closest('[data-rename]');
    if (ren && e.key === 'Enter') { e.preventDefault(); rename(ren.dataset.rename, ren.value); }
    if (ren && e.key === 'Escape') { e.stopPropagation(); renamingId = null; renderTabs(); }
    // F2 renomeia a aba focada, como em gerenciadores de arquivo
    const tab = e.target.closest('[data-tab]');
    if (tab && e.key === 'F2') { renamingId = tab.dataset.tab; renderTabs(); }
  });
  tabs.addEventListener('focusout', e => {
    const ren = e.target.closest('[data-rename]');
    if (ren && renamingId) rename(ren.dataset.rename, ren.value);
  });

  setInterval(renderStatus, 5000);
}
