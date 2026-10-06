/* ============================================
   DataLife — Foco: pomodoro
   ============================================
   Cronômetro por timestamp: o tempo restante é sempre calculado a partir
   do instante de início, então a aba pode dormir ou recarregar sem perder
   a contagem. O estado em andamento fica neste aparelho (localStorage) e é
   compartilhado entre abas; cada foco concluído soma +1 no dia (Firestore).
   ============================================ */

import { icon, showToast } from './utils.js';

const $ = id => document.getElementById(id);
const KEY = 'datalife:pomodoro';
const FASES = { foco: 'Foco', curta: 'Pausa curta', longa: 'Pausa longa' };
const R = 88;
const CIRC = 2 * Math.PI * R;

let ctx = null;
let s = null;          // { fase, status: parado|rodando|pausado, inicio, restante, feitos }
let raf = 0, lastSec = -1;
const baseTitle = document.title;

/* ---------- Estado ---------- */

const cfg = () => ctx.config().pomodoro;
const duracao = (fase = s.fase) => cfg()[fase] * 60_000;

function padrao() {
  return { fase: 'foco', status: 'parado', inicio: null, restante: null, feitos: 0 };
}

function ler() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && FASES[raw.fase] && ['parado', 'rodando', 'pausado'].includes(raw.status)) return { ...padrao(), ...raw };
  } catch { /* storage indisponível ou corrompido */ }
  return padrao();
}

function gravar() {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ok */ }
}

function restante(now = Date.now()) {
  if (s.status === 'rodando') return Math.max(0, duracao() - Math.max(0, now - s.inicio));
  if (s.status === 'pausado') return Math.min(s.restante ?? duracao(), duracao());
  return duracao();
}

/* ---------- Ações ---------- */

function iniciar() {
  if (s.status === 'rodando') return;
  const now = Date.now();
  s.inicio = s.status === 'pausado' ? now - (duracao() - restante()) : now;
  s.restante = null;
  s.status = 'rodando';
  gravar();
  render();
}

function pausar() {
  if (s.status !== 'rodando') return;
  s.restante = restante();
  s.status = 'pausado';
  gravar();
  render();
}

export function alternar() {
  if (s.status === 'rodando') pausar();
  else iniciar();
}

/**
 * "Estou fazendo" numa tarefa: o foco começa junto (se estiver numa pausa,
 * pula para um foco novo). Parar a tarefa pausa o cronômetro.
 */
export function seguirTarefa(ligou) {
  if (!s) return;
  if (!ligou) return pausar();
  if (s.fase !== 'foco') Object.assign(s, { fase: 'foco', status: 'parado', inicio: null, restante: null });
  iniciar();
  if (s.status === 'rodando') showToast('Pomodoro iniciado junto com a tarefa.');
}

function recomecar() {
  Object.assign(s, { status: 'parado', inicio: null, restante: null });
  gravar();
  render();
}

/** Fecha a fase atual. `natural`: o tempo acabou (conta o foco, toca o aviso). */
function concluir(natural) {
  if (natural) {
    // Outra aba pode ter fechado esta mesma fase um instante antes: não conta duas vezes
    const atual = ler();
    if (atual.status !== 'rodando' || atual.inicio !== s.inicio) {
      s = atual;
      return render();
    }
  }
  // Avança e grava ANTES dos efeitos: eles re-renderizam, e a fase velha
  // (já zerada) seria concluída de novo
  const fase = s.fase;
  if (fase === 'foco') {
    s.feitos += 1;
    s.fase = s.feitos % cfg().ciclos === 0 ? 'longa' : 'curta';
  } else {
    s.fase = 'foco';
    if (fase === 'longa') s.feitos = 0;
  }
  Object.assign(s, { status: 'parado', inicio: null, restante: null });
  gravar();

  if (natural) {
    if (fase === 'foco') ctx.onFoco();
    if (cfg().som) chime();
    showToast(fase === 'foco' ? 'Foco concluído. Hora de respirar.' : 'Pausa encerrada. Recomece quando quiser.');
  }
  render();
}

/* ---------- Som (WebAudio, sem arquivo externo) ---------- */

let audio = null;
const AudioCtx = window.AudioContext || window.webkitAudioContext;

/** O navegador só libera áudio depois de um gesto: prepara o contexto no primeiro clique/tecla. */
function liberarAudio() {
  if (!AudioCtx) return;
  audio ||= new AudioCtx();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function chime() {
  if (!audio || audio.state !== 'running') return; // sem gesto ainda: só o aviso visual
  const t0 = audio.currentTime;
  for (const { f, at, dur, g } of [{ f: 660, at: 0, dur: 0.32, g: 0.1 }, { f: 880, at: 0.18, dur: 0.42, g: 0.08 }]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(g, t0 + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  }
}

/* ---------- Tela ---------- */

const mmss = ms => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function frame() {
  raf = 0;
  const ms = restante();
  if (s.status === 'rodando' && ms <= 0) return concluir(true);
  $('pomo-arc').style.strokeDashoffset = CIRC * (1 - ms / duracao()); // cheio no início, esvazia com o tempo
  const sec = Math.ceil(ms / 1000);
  if (sec !== lastSec) {
    lastSec = sec;
    // Dígitos tabulares (não tremem), mas o ":" tabular fica largo: aperta só ele
    $('pomo-time').innerHTML = mmss(ms).replace(':', '<span class="pomo-colon">:</span>');
    document.title = s.status === 'rodando' ? `${mmss(ms)} · ${FASES[s.fase]}` : baseTitle;
  }
  if (s.status === 'rodando' && !document.hidden) raf = requestAnimationFrame(frame);
}

export function render() {
  if (!s) return;
  lastSec = -1;
  cancelAnimationFrame(raf);
  $('pomo-dial').dataset.fase = s.fase;
  $('pomo-dial').classList.toggle('is-running', s.status === 'rodando');
  $('pomo-phase').textContent = FASES[s.fase];
  const rodando = s.status === 'rodando';
  $('pomo-toggle').innerHTML = `${icon(rodando ? 'pause' : 'play', 15)} ${rodando ? 'Pausar' : s.status === 'pausado' ? 'Continuar' : 'Iniciar'}`;
  $('pomo-toggle').setAttribute('aria-label', rodando ? 'Pausar pomodoro' : 'Iniciar pomodoro');
  $('pomo-reset').disabled = s.status === 'parado';

  const ciclos = cfg().ciclos;
  const cheios = s.fase === 'longa' ? ciclos : s.feitos % ciclos;
  $('pomo-cycles').innerHTML = Array.from({ length: ciclos }, (_, i) =>
    `<i class="${i < cheios ? 'on' : ''}"></i>`).join('');
  $('pomo-cycles').setAttribute('aria-label', `${cheios} de ${ciclos} focos até a pausa longa`);

  const n = ctx.focosDoDia();
  $('pomo-today').textContent = n ? `${n} ${n === 1 ? 'foco' : 'focos'} ${ctx.isToday() ? 'hoje' : 'neste dia'}` : '';
  frame();
}

export function initPomodoro(options) {
  ctx = options;
  s = ler();
  $('pomo-arc').style.strokeDasharray = CIRC;
  $('pomo-skip').innerHTML = icon('skip', 17);
  $('pomo-reset').innerHTML = icon('reset', 17);
  $('pomo-toggle').addEventListener('click', alternar);
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, liberarAudio, { once: true, capture: true });
  $('pomo-skip').addEventListener('click', () => concluir(false));
  $('pomo-reset').addEventListener('click', recomecar);

  // Rodou com a aba fechada e o tempo acabou: fecha o ciclo sem som
  if (s.status === 'rodando' && restante() <= 0) {
    if (s.fase === 'foco') ctx.onFoco();
    concluir(false);
  }
  // Outra aba mexeu no cronômetro
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    s = ler();
    render();
  });
  // Aba em segundo plano não desenha; ao voltar, confere se a fase acabou
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  // rAF para quando a aba está oculta: um timer de reserva mantém o título da aba
  // em contagem e fecha a fase (com aviso) quando o tempo acaba
  setInterval(() => {
    if (s.status !== 'rodando' || !document.hidden) return;
    const ms = restante();
    if (ms <= 0) concluir(true);
    else document.title = `${mmss(ms)} · ${FASES[s.fase]}`;
  }, 1000);
  render();
}
