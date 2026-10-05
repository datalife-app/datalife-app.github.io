/* ============================================
   DataLife — Foco: Quadro (kanban)
   ============================================
   As tarefas do Foco em três colunas: A fazer · Fazendo · Feito.
   Os cartões SÃO as tarefas dos dias (não há cópia): mover no Quadro
   marca feita/fazendo no "Meu dia" e vice-versa.

   Dia: o dia aberto. Semana: domingo a sábado do dia aberto, cada cartão
   com o dia dele (os dados vêm do mesmo cache do calendário).
   "Criar cartões das notas": linhas de lista das notas do dia
   ("- item", "* item", "• item", "[ ] item", "[x] feito") viram tarefas.

   Mover: arrastar entre colunas (mouse) ou setas no cartão (toque/teclado).
   ============================================ */

import { LIMITES } from './foco-db.js';
import { icon, escapeHtml, showToast, uid, shiftDay, fromDayKey, MESES } from './utils.js';

const $ = id => document.getElementById(id);
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const COLUNAS = [
  { id: 'fazer', nome: 'A fazer', vazio: 'Nada pendente.' },
  { id: 'fazendo', nome: 'Fazendo', vazio: 'Arraste para cá o que está em andamento.' },
  { id: 'feito', nome: 'Feito', vazio: 'Nada concluído ainda.' }
];

let ctx = null;   // { day(), today(), tarefasDe(day), salvar(day, next, prev), notas() }
let escopo = 'dia';
let dragKey = null;
let novos = new Set(); // ids recém-criados (animam uma vez)

const colunaDe = t => (t.feita ? 'feito' : t.fazendo ? 'fazendo' : 'fazer');

/** Dias do escopo atual (o dia aberto, ou a semana dele de domingo a sábado). */
function dias() {
  const d = ctx.day();
  if (escopo === 'dia') return [d];
  const ini = shiftDay(d, -fromDayKey(d).getDay());
  return Array.from({ length: 7 }, (_, i) => shiftDay(ini, i));
}

function cartoes() {
  return dias().flatMap(day => ctx.tarefasDe(day).map((t, i) => ({ day, t, ordem: i })));
}

const label = day => {
  const d = fromDayKey(day);
  return day === ctx.today() ? 'hoje' : `${SEMANA[d.getDay()]} ${d.getDate()}`;
};

/* ---------- Notas -> cartões ---------- */

const LINHA = /^\s*(?:[-*•]\s+(?:\[( |x|X)\]\s+)?|\[( |x|X)\]\s+)(.+?)\s*$/;

/** Itens de lista das notas do dia que ainda não são tarefas. */
function itensDasNotas() {
  const existentes = new Set(ctx.tarefasDe(ctx.day()).map(t => t.texto.trim().toLowerCase()));
  const vistos = new Set();
  const out = [];
  for (const n of ctx.notas()) {
    for (const linha of n.texto.split('\n')) {
      const m = linha.match(LINHA);
      if (!m) continue;
      const texto = m[3].slice(0, LIMITES.texto);
      const k = texto.toLowerCase();
      if (existentes.has(k) || vistos.has(k)) continue;
      vistos.add(k);
      out.push({ texto, feita: /x/i.test(m[1] || m[2] || '') });
    }
  }
  return out;
}

/* ---------- Tela ---------- */

export function render() {
  if (!ctx || $('view-quadro').hidden) return;
  const todos = cartoes();
  const sub = escopo === 'dia'
    ? `${fromDayKey(ctx.day()).getDate()} de ${MESES[fromDayKey(ctx.day()).getMonth()].toLowerCase()}`
    : (() => { const [a, b] = [dias()[0], dias()[6]].map(fromDayKey); return `${a.getDate()}/${a.getMonth() + 1} a ${b.getDate()}/${b.getMonth() + 1}`; })();
  $('quadro-sub').textContent = sub;

  const daNota = itensDasNotas();
  const btn = $('quadro-notas');
  btn.disabled = !daNota.length;
  btn.innerHTML = `${icon('listChecks', 15)} ${daNota.length ? `Criar ${daNota.length === 1 ? '1 cartão' : `${daNota.length} cartões`} das notas` : 'Nenhuma lista nas notas do dia'}`;

  $('quadro-board').innerHTML = COLUNAS.map((col, ci) => {
    const cards = todos.filter(c => colunaDe(c.t) === col.id)
      // Feito: mais recentes primeiro; demais: ordem do dia
      .sort((a, b) => (col.id === 'feito' ? (b.t.concluida || 0) - (a.t.concluida || 0) : a.day.localeCompare(b.day) || a.ordem - b.ordem));
    return `
      <section class="kb-col" data-col="${col.id}" aria-labelledby="kb-${col.id}">
        <header class="kb-head"><h3 id="kb-${col.id}">${col.nome}</h3><span class="kb-count num">${cards.length}</span></header>
        <ol class="kb-list" data-drop="${col.id}">
          ${cards.map(({ day, t }) => `
            <li class="kb-card ${t.feita ? 'is-done' : ''} ${novos.has(t.id) ? 'is-new' : ''}" draggable="true" data-key="${day}|${escapeHtml(t.id)}">
              <p class="kb-text">${escapeHtml(t.texto)}</p>
              <div class="kb-foot">
                ${escopo === 'semana' ? `<span class="kb-day ${day === ctx.today() ? 'is-today' : ''}">${label(day)}</span>` : '<span></span>'}
                <div class="kb-actions">
                  <button class="icon-btn" type="button" data-move="-1" aria-label="Mover para ${COLUNAS[ci - 1]?.nome || ''}" ${ci === 0 ? 'disabled' : ''}>${icon('chevronLeft', 15)}</button>
                  <button class="icon-btn" type="button" data-move="1" aria-label="Mover para ${COLUNAS[ci + 1]?.nome || ''}" ${ci === COLUNAS.length - 1 ? 'disabled' : ''}>${icon('chevronRight', 15)}</button>
                  <button class="icon-btn danger" type="button" data-remove aria-label="Excluir tarefa">${icon('trash', 14)}</button>
                </div>
              </div>
            </li>`).join('') || `<li class="kb-empty">${col.vazio}</li>`}
        </ol>
        ${col.id === 'fazer' ? `
        <form class="kb-add" data-add autocomplete="off">
          <input class="input" name="texto" maxlength="${LIMITES.texto}" placeholder="Novo cartão${escopo === 'semana' ? ` (${label(ctx.day())})` : ''}" aria-label="Novo cartão">
          <button class="icon-btn" type="submit" aria-label="Adicionar cartão">${icon('plus', 16)}</button>
        </form>` : ''}
      </section>`;
  }).join('');
  novos = new Set();
}

/* ---------- Ações ---------- */

function mover(key, col) {
  const [day, id] = key.split('|');
  const prev = ctx.tarefasDe(day);
  const t = prev.find(x => x.id === id);
  if (!t || colunaDe(t) === col) return;
  const { fazendo, concluida, ...base } = t;
  const novo = col === 'feito' ? { ...base, feita: true, concluida: Date.now() }
    : col === 'fazendo' ? { ...base, feita: false, fazendo: true }
    : { ...base, feita: false };
  ctx.salvar(day, prev.map(x => (x.id === id ? novo : x)), prev);
}

function remover(key) {
  const [day, id] = key.split('|');
  const prev = ctx.tarefasDe(day);
  const t = prev.find(x => x.id === id);
  if (!t) return;
  ctx.salvar(day, prev.filter(x => x.id !== id), prev);
  showToast(`"${t.texto}" excluída.`, 'success', 6000, {
    label: 'Desfazer',
    onClick: () => {
      const cur = ctx.tarefasDe(day);
      if (cur.some(x => x.id === id)) return;
      const at = Math.min(prev.findIndex(x => x.id === id), cur.length);
      ctx.salvar(day, [...cur.slice(0, at), t, ...cur.slice(at)], cur);
    }
  });
}

function adicionar(texto) {
  const day = ctx.day();
  const prev = ctx.tarefasDe(day);
  if (prev.length >= LIMITES.tarefas) return showToast(`Limite de ${LIMITES.tarefas} tarefas por dia.`, 'error');
  const t = { id: uid(), texto, feita: false, criada: Date.now() };
  novos.add(t.id);
  ctx.salvar(day, [...prev, t], prev);
}

function criarDasNotas() {
  const itens = itensDasNotas();
  if (!itens.length) return;
  const day = ctx.day();
  const prev = ctx.tarefasDe(day);
  const agora = Date.now();
  const criados = itens.slice(0, LIMITES.tarefas - prev.length).map((it, i) => ({
    id: uid(), texto: it.texto, feita: it.feita, criada: agora + i, ...(it.feita ? { concluida: agora } : {})
  }));
  criados.forEach(t => novos.add(t.id));
  ctx.salvar(day, [...prev, ...criados], prev);
  showToast(`${criados.length === 1 ? '1 cartão criado' : `${criados.length} cartões criados`} a partir das notas.`);
}

/* ---------- Eventos ---------- */

export function initQuadro(options) {
  ctx = options;
  const board = $('quadro-board');

  $('quadro-escopo').addEventListener('click', e => {
    const b = e.target.closest('[data-escopo]');
    if (!b) return;
    escopo = b.dataset.escopo;
    $('quadro-escopo').querySelectorAll('[data-escopo]').forEach(x => x.setAttribute('aria-checked', x.dataset.escopo === escopo));
    render();
  });
  $('quadro-notas').addEventListener('click', criarDasNotas);

  board.addEventListener('click', e => {
    const card = e.target.closest('.kb-card');
    if (!card) return;
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const ci = COLUNAS.findIndex(c => c.id === card.closest('[data-col]').dataset.col);
      const key = card.dataset.key;
      mover(key, COLUNAS[ci + Number(mv.dataset.move)].id);
      // Foco acompanha o cartão na nova coluna (teclado)
      board.querySelector(`.kb-card[data-key="${CSS.escape(key)}"] [data-move="${mv.dataset.move}"]:not(:disabled)`)?.focus()
        || board.querySelector(`.kb-card[data-key="${CSS.escape(key)}"] [data-move]:not(:disabled)`)?.focus();
    } else if (e.target.closest('[data-remove]')) {
      remover(card.dataset.key);
    }
  });

  board.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.texto;
    const texto = input.value.trim();
    if (!texto) return;
    adicionar(texto);
    board.querySelector('[data-add] input')?.focus();
  });

  /* Arrastar entre colunas */
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.kb-card');
    if (!card) return;
    dragKey = card.dataset.key;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
    requestAnimationFrame(() => card.classList.add('is-dragging'));
  });
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.kb-col');
    if (!dragKey || !col) return;
    e.preventDefault();
    board.querySelectorAll('.kb-col.is-over').forEach(c => c !== col && c.classList.remove('is-over'));
    col.classList.add('is-over');
  });
  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.kb-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over');
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.kb-col');
    if (!dragKey || !col) return;
    e.preventDefault();
    const key = dragKey;
    dragKey = null;
    mover(key, col.dataset.col);
  });
  board.addEventListener('dragend', () => {
    dragKey = null;
    board.querySelectorAll('.is-dragging, .is-over').forEach(x => x.classList.remove('is-dragging', 'is-over'));
  });
}
