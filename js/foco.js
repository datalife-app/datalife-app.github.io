/* ============================================
   DataLife — Foco
   ============================================
   Um dia por vez: tarefas, notas, pomodoro, saúde e calendário.
   Cada parte é um módulo (foco-*.js); este arquivo guarda o dia aberto,
   faz as gravações (otimistas, com desfazer em caso de erro) e cuida do
   calendário, dos ajustes, dos atalhos e do Lo-Fi.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import { fetchDia, fetchDias, saveCampo, addPomodoro, fetchConfig, saveConfig, diaVazio, LIMITES, POMODORO_PADRAO } from './foco-db.js';
import { initTarefas, render as renderTarefas, reset as resetTarefas, focusInput } from './foco-tarefas.js';
import { initNotas, render as renderNotas, flush as flushNotas, focus as focusNotas, pendentes as notasPendentes } from './foco-notas.js';
import { initPomodoro, render as renderPomodoro, alternar as alternarPomodoro } from './foco-pomodoro.js';
import { initSaude, render as renderSaude, planoAgua, formatMl } from './foco-saude.js';
import { initQuadro, render as renderQuadro } from './foco-quadro.js';
import { icon, showToast, dayKey, fromDayKey, shiftDay, monthKey, shiftMonth, MESES, escapeHtml } from './utils.js';

const $ = id => document.getElementById(id);
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const user = await requireAuth();

const state = {
  today: dayKey(new Date()),
  day: dayKey(new Date()),
  dia: diaVazio(),
  config: null,
  calMonth: monthKey(new Date()),
  resumo: new Map()   // dia -> dados do dia, para os indicadores do calendário
};

/* ---------- Gravação ---------- */


/** Atualiza um campo do dia aberto na tela e no banco. */
function saveDia(campo, valor, prev) {
  const day = state.day;
  setCampo(day, campo, valor);
  persist(saveCampo(user.uid, day, campo, valor), () => setCampo(day, campo, prev));
}

function setCampo(day, campo, valor) {
  writes++;
  const cached = state.resumo.get(day) || (day === state.day ? state.dia : diaVazio());
  const dia = { ...cached, [campo]: valor };
  state.resumo.set(day, dia);
  if (day === state.day) {
    state.dia = dia;
    if (campo === 'tarefas') renderTarefas();
    if (['agua', 'refeicoes', 'exercicio'].includes(campo)) renderSaude();
  }
  if (campo === 'tarefas' || campo === 'notas') renderQuadro();
  renderCal();
}

/** Tarefas de qualquer dia (o Quadro em "Semana" mexe em vários). */
function salvarTarefas(day, next, prev) {
  setCampo(day, 'tarefas', next);
  persist(saveCampo(user.uid, day, 'tarefas', next), () => setCampo(day, 'tarefas', prev));
}

/* ---------- Dia ---------- */

let loadSeq = 0;
let writes = 0; // escritas feitas na tela; uma leitura iniciada antes delas já está velha

async function loadDay(key, { animate = true } = {}) {
  flushNotas(); // grava as notas do dia que está saindo
  const seq = ++loadSeq;
  const w = writes;
  state.day = key;
  resetTarefas();
  renderDayLabel();
  if (monthKey(fromDayKey(key)) !== state.calMonth) setCalMonth(monthKey(fromDayKey(key)));
  else renderCal();

  // Com o dia em cache (o calendário já leu o mês), mostra na hora e confere depois.
  // Sem cache, a tela do dia anterior fica inerte até chegar a leitura:
  // nada do que estiver nela pode ser gravado no dia novo.
  const cached = state.resumo.get(key);
  const grid = $('foco-grid');
  if (cached) {
    state.dia = cached;
    renderDay(animate);
  } else {
    state.dia = diaVazio();
    grid.inert = true;
  }
  $('view-foco').setAttribute('aria-busy', 'true');
  try {
    const dia = await fetchDia(user.uid, key);
    if (seq !== loadSeq) return;
    if (cached && writes !== w) return; // a tela já tem mudanças mais novas que esta leitura
    state.resumo.set(key, dia);
    state.dia = dia;
    if (!cached) renderDay(animate);
    else if (JSON.stringify(dia) !== JSON.stringify(cached)) renderDay(false, { keepNotes: notasPendentes() });
    renderCal();
  } catch (e) {
    if (seq !== loadSeq) return;
    console.error(e);
    if (!cached) renderDay(false);
    showToast('Não foi possível carregar este dia. Verifique a conexão.', 'error', 5000);
  } finally {
    if (seq === loadSeq) {
      grid.inert = false;
      $('view-foco').removeAttribute('aria-busy');
    }
  }
}

function renderDay(animate, { keepNotes = false } = {}) {
  renderQuadro();
  renderTarefas();
  if (!keepNotes) renderNotas();
  renderSaude();
  renderPomodoro();
  if (animate) {
    const grid = $('foco-grid');
    grid.classList.remove('is-switching');
    void grid.offsetWidth; // reinicia a animação
    grid.classList.add('is-switching');
  }
}

function renderDayLabel() {
  const d = fromDayKey(state.day);
  const isToday = state.day === state.today;
  const ontem = state.day === shiftDay(state.today, -1);
  const amanha = state.day === shiftDay(state.today, 1);
  $('day-label').textContent = `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
  $('day-weekday').textContent = isToday ? `Hoje, ${SEMANA[d.getDay()]}` : ontem ? `Ontem, ${SEMANA[d.getDay()]}` : amanha ? `Amanhã, ${SEMANA[d.getDay()]}` : SEMANA[d.getDay()];
  $('btn-hoje').hidden = isToday;
  document.title = `${isToday ? 'Foco' : `Foco · ${$('day-label').textContent}`} · DataLife`;
}

/* ---------- Calendário ---------- */

let calSeq = 0;

const mesesLidos = new Set(); // meses do calendário já lidos nesta visita

async function setCalMonth(month) {
  state.calMonth = month;
  renderCal();
  if (mesesLidos.has(month)) return;
  const cells = calCells(month);
  const seq = ++calSeq;
  try {
    const dias = await fetchDias(user.uid, cells[0], cells[cells.length - 1]);
    mesesLidos.add(month);
    if (seq !== calSeq) return;
    // Dias sem documento no intervalo lido estão vazios: abrir um deles não precisa esperar
    for (const k of cells) if (k !== state.day && !state.resumo.has(k)) state.resumo.set(k, dias.get(k) || diaVazio());
    for (const [k, d] of dias) if (k !== state.day) state.resumo.set(k, d);
    renderCal();
    renderQuadro(); // a "Semana" do Quadro usa este mesmo cache
  } catch (e) {
    console.error(e); // indicadores são extras: sem eles o calendário segue funcionando
  }
}

/** 42 dias (6 semanas) começando no domingo antes do dia 1. */
function calCells(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  return Array.from({ length: 42 }, (_, i) => dayKey(new Date(y, m - 1, 1 - first.getDay() + i)));
}

function marks(dia) {
  if (!dia) return '';
  const out = [];
  if (dia.tarefas.length) out.push(dia.tarefas.some(t => !t.feita) ? 'pend' : 'done');
  if (dia.notas.some(n => n.texto.trim())) out.push('note');
  return out.map(m => `<i class="mark mark-${m}"></i>`).join('');
}

function renderCal() {
  const [y, m] = state.calMonth.split('-').map(Number);
  $('cal-title').innerHTML = `${MESES[m - 1]} <span>${y}</span>`;
  $('cal-grid').innerHTML = calCells(state.calMonth).map(k => {
    const d = fromDayKey(k);
    const dia = k === state.day ? state.dia : state.resumo.get(k);
    const cls = [
      d.getMonth() !== m - 1 && 'is-outside',
      k === state.today && 'is-today',
      k === state.day && 'is-selected'
    ].filter(Boolean).join(' ');
    const pend = dia?.tarefas.filter(t => !t.feita).length || 0;
    const label = `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}${pend ? `, ${pend} ${pend === 1 ? 'tarefa pendente' : 'tarefas pendentes'}` : ''}`;
    return `<button type="button" class="cal-day ${cls}" data-day="${k}" aria-label="${label}" aria-pressed="${k === state.day}">
      <span class="num">${d.getDate()}</span><span class="cal-marks">${marks(dia)}</span></button>`;
  }).join('');
}

/* ---------- Ajustes ---------- */

function openAjustes(focusField) {
  const f = $('ajustes-form');
  const { pomodoro: p, agua: a } = state.config;
  f.foco.value = p.foco;
  f.curta.value = p.curta;
  f.longa.value = p.longa;
  f.ciclos.value = p.ciclos;
  f.som.checked = p.som;
  f.peso.value = a?.peso ?? '';
  f.exercicio.checked = a?.exercicio ?? false;
  f.calor.checked = a?.calor ?? false;
  renderMetaAgua();
  $('ajustes-dialog').showModal();
  if (focusField) f[focusField].focus();
}

function lerAjustes() {
  const f = $('ajustes-form');
  const int = el => Math.round(Number(el.value));
  const peso = int(f.peso);
  return {
    pomodoro: { foco: int(f.foco), curta: int(f.curta), longa: int(f.longa), ciclos: int(f.ciclos), som: f.som.checked },
    agua: f.peso.value && peso >= 25 && peso <= 250 ? { peso, exercicio: f.exercicio.checked, calor: f.calor.checked } : null
  };
}

function renderMetaAgua() {
  const { agua } = lerAjustes();
  const p = agua && planoAgua(agua);
  $('ajustes-meta').innerHTML = p
    ? `Meta diária: <strong class="num">${formatMl(p.meta)}</strong>, ou ${p.copos} copos de 250 ml.`
    : 'Peso × 35 ml, mais 500 ml para exercícios e 500 ml para clima quente.';
}

function initAjustes() {
  const dialog = $('ajustes-dialog');
  const form = $('ajustes-form');
  dialog.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  form.addEventListener('input', renderMetaAgua);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.peso.value && !lerAjustes().agua) {
      form.peso.setCustomValidity('Informe um peso entre 25 e 250 kg.');
      form.peso.reportValidity();
      form.peso.addEventListener('input', () => form.peso.setCustomValidity(''), { once: true });
      return;
    }
    const prev = state.config;
    const next = lerAjustes();
    state.config = next;
    dialog.close();
    renderPomodoro();
    renderSaude();
    if (await persist(saveConfig(user.uid, next), () => { state.config = prev; renderPomodoro(); renderSaude(); })) {
      showToast('Ajustes salvos.');
    }
  });
}

/* ---------- Lo-Fi ----------
   Padrão "fachada": até o clique, é só um botão local, sem nenhuma conexão
   com o YouTube. Ao tocar, entra um iframe do youtube-nocookie; "Parar" o remove. */

const LOFI_VIDEO = 'E2vONfzoyRI'; // a mesma live do no-distraction

function renderLofi(playing = false) {
  const el = $('lofi');
  if (!playing) {
    el.innerHTML = `
      <button type="button" class="lofi-facade" id="lofi-play">
        <span class="lofi-icon">${icon('headphones', 22)}</span>
        <span class="lofi-text"><strong>Tocar rádio lo-fi</strong><span>Carrega o player do YouTube só agora</span></span>
        <span class="lofi-go">${icon('play', 14)}</span>
      </button>`;
    $('lofi-play').addEventListener('click', () => renderLofi(true));
    return;
  }
  const src = `https://www.youtube-nocookie.com/embed/${LOFI_VIDEO}?autoplay=1&rel=0&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
  el.innerHTML = `
    <div class="lofi-frame"><iframe title="Rádio lo-fi" src="${escapeHtml(src)}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <button type="button" class="btn btn-ghost btn-sm lofi-stop" id="lofi-stop">${icon('pause', 14)} Parar</button>`;
  $('lofi-stop').addEventListener('click', () => renderLofi(false));
}

/* ---------- Atalhos ---------- */

function onKey(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const editing = t.closest?.('input, textarea, select, [contenteditable="true"]');
  if (e.key === 'Escape' && editing) return t.blur();
  if (editing || document.querySelector('dialog[open]')) return;
  // Espaço/Enter num botão focado mantêm o comportamento nativo
  if (e.key === ' ' && t.closest?.('button, a, [role="tab"]')) return;

  const actions = {
    ' ': () => alternarPomodoro(),
    ArrowLeft: () => loadDay(shiftDay(state.day, -1)),
    ArrowRight: () => loadDay(shiftDay(state.day, 1)),
    h: () => state.day !== state.today && loadDay(state.today),
    t: () => focusInput(),
    n: () => focusNotas(),
    a: () => $('agua').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }),
    '?': () => $('atalhos-dialog').showModal()
  };
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (tabAtual === 'quadro' && !['ArrowLeft', 'ArrowRight', 'h', '?'].includes(k)) return;
  const fn = actions[k];
  if (!fn) return;
  e.preventDefault();
  fn();
}

/* ---------- Init ---------- */

initPagina();
$('btn-ajustes').innerHTML = icon('sliders');
$('btn-atalhos').innerHTML = icon('keyboard');
$('day-prev').innerHTML = icon('chevronLeft');
$('day-next').innerHTML = icon('chevronRight');
$('cal-prev').innerHTML = icon('chevronLeft', 16);
$('cal-next').innerHTML = icon('chevronRight', 16);
$('atalhos-dialog').querySelector('[data-close]').innerHTML = icon('x', 18);
$('atalhos-dialog').querySelector('[data-close]').addEventListener('click', () => $('atalhos-dialog').close());

$('day-prev').addEventListener('click', () => loadDay(shiftDay(state.day, -1)));
$('day-next').addEventListener('click', () => loadDay(shiftDay(state.day, 1)));
$('btn-hoje').addEventListener('click', () => loadDay(state.today));
$('cal-prev').addEventListener('click', () => setCalMonth(shiftMonth(state.calMonth, -1)));
$('cal-next').addEventListener('click', () => setCalMonth(shiftMonth(state.calMonth, 1)));
$('cal-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-day]');
  if (b && b.dataset.day !== state.day) loadDay(b.dataset.day);
});
$('btn-ajustes').addEventListener('click', () => openAjustes());
$('btn-atalhos').addEventListener('click', () => $('atalhos-dialog').showModal());
document.addEventListener('keydown', onKey);
initAjustes();
renderLofi();

const isToday = () => state.day === state.today;

initTarefas({
  tarefas: () => state.dia.tarefas,
  save: (next, prev) => saveDia('tarefas', next, prev),
  isToday
});
initNotas({
  day: () => state.day,
  notas: () => state.dia.notas,
  persist: (day, notas) => {
    const prev = state.resumo.get(day)?.notas ?? [];
    setCampo(day, 'notas', notas);
    return persist(saveCampo(user.uid, day, 'notas', notas), () => setCampo(day, 'notas', prev),
      'Não foi possível salvar a nota. Ela continua na tela; tente de novo.');
  }
});
initQuadro({
  day: () => state.day,
  today: () => state.today,
  tarefasDe: day => (day === state.day ? state.dia : state.resumo.get(day))?.tarefas ?? [],
  notas: () => state.dia.notas,
  salvar: salvarTarefas
});

/* ---------- Abas: Meu dia | Quadro (via hash, como no Orçamento) ---------- */
let tabAtual = 'dia';
const TAB_HASH = { '#day': 'dia', '#board': 'quadro' };

function showTab() {
  tabAtual = TAB_HASH[location.hash] || 'dia';
  $('view-dia').hidden = tabAtual !== 'dia';
  $('view-quadro').hidden = tabAtual !== 'quadro';
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === tabAtual;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  moveTabIndicator();
  renderQuadro();
}

function moveTabIndicator() {
  const active = document.querySelector('.tab.active');
  if (!active) return;
  $('tab-indicator').style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
  requestAnimationFrame(() => $('tab-indicator').classList.add('ready'));
}

window.addEventListener('hashchange', showTab);
window.addEventListener('resize', moveTabIndicator);
document.fonts?.ready.then(moveTabIndicator);
showTab();

initSaude({
  dia: () => state.dia,
  config: () => state.config,
  save: saveDia,
  openAjustes
});

// Vira o dia com a página aberta (passou da meia-noite)
setInterval(() => {
  const t = dayKey(new Date());
  if (t === state.today) return;
  state.today = t;
  renderDayLabel();
  renderCal();
}, 60_000);

// Não perder a última nota se a aba for fechada durante o debounce
window.addEventListener('pagehide', flushNotas);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushNotas();
});

try {
  state.config = await fetchConfig(user.uid);
} catch (e) {
  console.error(e);
  state.config = { pomodoro: POMODORO_PADRAO, agua: null };
}

initPomodoro({
  config: () => state.config,
  focosDoDia: () => state.dia.pomodoros,
  isToday,
  // O foco conta para o dia de hoje, mesmo que outro dia esteja aberto na tela
  onFoco: () => {
    const day = state.today;
    const atual = (day === state.day ? state.dia : state.resumo.get(day))?.pomodoros ?? 0;
    setCampo(day, 'pomodoros', Math.min(atual + 1, LIMITES.pomodoros));
    persist(addPomodoro(user.uid, day), () => setCampo(day, 'pomodoros', atual));
    renderPomodoro();
  }
});

// ?dia=YYYY-MM-DD abre um dia específico (ex.: link do Diário)
const pedido = new URLSearchParams(location.search).get('dia');
if (pedido && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(pedido)) {
  state.day = pedido;
  state.calMonth = monthKey(fromDayKey(pedido));
}

// Mês visível do calendário (marcas dos dias e "Semana" do Quadro): sem isto,
// só era lido ao trocar de mês
setCalMonth(state.calMonth);
await loadDay(state.day, { animate: false });
dadosProntos();
