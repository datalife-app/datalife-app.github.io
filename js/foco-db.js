/* ============================================
   DataLife — Foco: persistência
   ============================================
   users/{uid}/foco/{YYYY-MM-DD}   um documento por dia:
     { tarefas:   [ {id, texto, feita, criada, concluida?, fazendo?} ],   // fazendo: coluna do Quadro
       notas:     [ {id, titulo, texto, criada} ],
       agua:      [ true, false, ... ]          // um item por copo de 250 ml
       refeicoes: { cafe, almoco, janta },
       exercicio: bool,
       pomodoros: int }                        // focos concluídos no dia
   users/{uid}/settings/foco
     { pomodoro: {foco, curta, longa, ciclos, som}, agua?: {peso, exercicio, calor} }

   Abrir um dia custa uma leitura; o calendário lê o mês visível de uma vez.
   Cada parte do dia é gravada no próprio campo (merge): mexer nas tarefas
   não sobrescreve as notas, nem a água, nem o contador do pomodoro.
   O estado do cronômetro em andamento fica só no aparelho (localStorage).
   ============================================ */

import {
  fs, LOCAL_MODE, ref, col, commitInBatches, lsRead, lsWrite, lsList, isId, DAY_RE
} from './store.js';

export const LIMITES = { tarefas: 200, texto: 280, notas: 10, titulo: 60, nota: 20000, copos: 40, pomodoros: 500 };
export const REFEICOES = [
  { id: 'cafe', nome: 'Café da manhã', quando: 'Manhã', porque: 'Comece o dia com energia' },
  { id: 'almoco', nome: 'Almoço', quando: 'Tarde', porque: 'A refeição principal do dia' },
  { id: 'janta', nome: 'Janta', quando: 'Noite', porque: 'Leve, antes de dormir' }
];
export const POMODORO_PADRAO = { foco: 25, curta: 5, longa: 15, ciclos: 4, som: true };

/* ---------- Validação ---------- */

const isTime = v => Number.isSafeInteger(v) && v > 0;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;

function sanitizeTarefa(t) {
  if (!t || typeof t !== 'object') return null;
  const { id, texto, feita, criada, concluida } = t;
  if (!isId(id) || !isStr(texto, LIMITES.texto) || !texto.trim() || typeof feita !== 'boolean' || !isTime(criada)) return null;
  const clean = { id, texto, feita, criada };
  if (feita && isTime(concluida)) clean.concluida = concluida;
  if (!feita && t.fazendo === true) clean.fazendo = true; // "Fazendo" no Quadro
  return clean;
}

function sanitizeNota(n) {
  if (!n || typeof n !== 'object') return null;
  const { id, titulo, texto, criada } = n;
  if (!isId(id) || !isStr(titulo, LIMITES.titulo) || !isStr(texto, LIMITES.nota) || !isTime(criada)) return null;
  return { id, titulo, texto, criada };
}

const list = (v, fn, max) => (Array.isArray(v) ? v.map(fn).filter(Boolean).slice(0, max) : []);

export function diaVazio() {
  return { tarefas: [], notas: [], agua: [], refeicoes: { cafe: false, almoco: false, janta: false }, exercicio: false, pomodoros: 0 };
}

function sanitizeDia(raw) {
  const dia = diaVazio();
  if (!raw || typeof raw !== 'object') return dia;
  dia.tarefas = list(raw.tarefas, sanitizeTarefa, LIMITES.tarefas);
  dia.notas = list(raw.notas, sanitizeNota, LIMITES.notas);
  dia.agua = Array.isArray(raw.agua) ? raw.agua.slice(0, LIMITES.copos).map(v => v === true) : [];
  for (const r of REFEICOES) dia.refeicoes[r.id] = raw.refeicoes?.[r.id] === true;
  dia.exercicio = raw.exercicio === true;
  dia.pomodoros = isInt(raw.pomodoros, 0, LIMITES.pomodoros) ? raw.pomodoros : 0;
  return dia;
}

/** Valida um campo antes de gravar; lança se vier algo inesperado. */
function cleanCampo(campo, valor) {
  switch (campo) {
    case 'tarefas': {
      const c = valor.map(sanitizeTarefa);
      if (c.some(t => !t) || c.length > LIMITES.tarefas) throw new Error('Tarefa inválida');
      return c;
    }
    case 'notas': {
      const c = valor.map(sanitizeNota);
      if (c.some(n => !n) || c.length > LIMITES.notas) throw new Error('Nota inválida');
      return c;
    }
    case 'agua':
      if (!Array.isArray(valor) || valor.length > LIMITES.copos) throw new Error('Água inválida');
      return valor.map(v => v === true);
    case 'refeicoes':
      return Object.fromEntries(REFEICOES.map(r => [r.id, valor?.[r.id] === true]));
    case 'exercicio':
      return valor === true;
    default:
      throw new Error(`Campo desconhecido: ${campo}`);
  }
}

function assertDay(key) {
  if (!DAY_RE.test(key)) throw new Error(`Dia inválido: ${key}`);
}

function sanitizeConfig(raw) {
  const p = raw?.pomodoro || {};
  const pomodoro = {
    foco: isInt(p.foco, 1, 180) ? p.foco : POMODORO_PADRAO.foco,
    curta: isInt(p.curta, 1, 60) ? p.curta : POMODORO_PADRAO.curta,
    longa: isInt(p.longa, 1, 60) ? p.longa : POMODORO_PADRAO.longa,
    ciclos: isInt(p.ciclos, 1, 12) ? p.ciclos : POMODORO_PADRAO.ciclos,
    som: typeof p.som === 'boolean' ? p.som : POMODORO_PADRAO.som
  };
  const a = raw?.agua;
  const agua = a && isInt(a.peso, 25, 250)
    ? { peso: a.peso, exercicio: a.exercicio === true, calor: a.calor === true }
    : null;
  return { pomodoro, agua };
}

/* ---------- API ---------- */

export async function fetchDia(uid, key) {
  assertDay(key);
  if (LOCAL_MODE) return sanitizeDia(lsRead(`foco/${key}`));
  const snap = await fs.getDoc(ref(uid, 'foco', key));
  return sanitizeDia(snap.exists() ? snap.data() : null);
}

/** Dias entre `de` e `ate` (inclusive), para os indicadores do calendário: Map(key -> dia). */
export async function fetchDias(uid, de, ate) {
  assertDay(de);
  assertDay(ate);
  let entries;
  if (LOCAL_MODE) {
    entries = lsList('foco').filter(([k]) => k >= de && k <= ate);
  } else {
    const q = fs.query(col(uid, 'foco'), fs.where(fs.documentId(), '>=', de), fs.where(fs.documentId(), '<=', ate));
    entries = (await fs.getDocs(q)).docs.map(d => [d.id, d.data()]);
  }
  return new Map(entries.filter(([k]) => DAY_RE.test(k)).map(([k, raw]) => [k, sanitizeDia(raw)]));
}

/** Grava um campo do dia (tarefas, notas, agua, refeicoes ou exercicio). */
export async function saveCampo(uid, key, campo, valor) {
  assertDay(key);
  const clean = cleanCampo(campo, valor);
  if (LOCAL_MODE) return lsWrite(`foco/${key}`, { ...sanitizeDia(lsRead(`foco/${key}`)), [campo]: clean });
  await fs.setDoc(ref(uid, 'foco', key), { [campo]: clean }, { merge: true });
}

/** +1 foco concluído no dia (incremento atômico: duas abas não se atropelam). */
export async function addPomodoro(uid, key) {
  assertDay(key);
  if (LOCAL_MODE) {
    const dia = sanitizeDia(lsRead(`foco/${key}`));
    return lsWrite(`foco/${key}`, { ...dia, pomodoros: Math.min(dia.pomodoros + 1, LIMITES.pomodoros) });
  }
  await fs.setDoc(ref(uid, 'foco', key), { pomodoros: fs.increment(1) }, { merge: true });
}

export async function fetchConfig(uid) {
  if (LOCAL_MODE) return sanitizeConfig(lsRead('settings/foco'));
  const snap = await fs.getDoc(ref(uid, 'settings', 'foco'));
  return sanitizeConfig(snap.exists() ? snap.data() : null);
}

export async function saveConfig(uid, config) {
  const clean = sanitizeConfig(config);
  const data = clean.agua ? clean : { pomodoro: clean.pomodoro };
  if (LOCAL_MODE) return lsWrite('settings/foco', data);
  await fs.setDoc(ref(uid, 'settings', 'foco'), data);
}

/* ---------- Backup ---------- */

export async function exportFoco(uid) {
  let entries;
  if (LOCAL_MODE) {
    entries = lsList('foco');
  } else {
    entries = (await fs.getDocs(col(uid, 'foco'))).docs.map(d => [d.id, d.data()]);
  }
  const dias = entries
    .filter(([k]) => DAY_RE.test(k))
    .map(([key, raw]) => ({ key, ...sanitizeDia(raw) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { config: await fetchConfig(uid), dias };
}

export function parseFoco(json) {
  if (!json || typeof json !== 'object') return null;
  const dias = Array.isArray(json.dias)
    ? json.dias.filter(d => DAY_RE.test(d?.key)).map(d => ({ key: d.key, ...sanitizeDia(d) }))
    : [];
  return { config: sanitizeConfig(json.config), dias };
}

/**
 * Mescla: dias novos entram inteiros; em dias que já existem, só entram
 * tarefas e notas que ainda não estão lá (mesmo id não duplica).
 * Água, refeições, exercício e pomodoros de dias existentes ficam como estão.
 */
export async function importFoco(uid, parsed) {
  const atuais = new Map((await exportFoco(uid)).dias.map(d => [d.key, d]));
  const writes = [];
  for (const { key, ...dia } of parsed.dias) {
    const cur = atuais.get(key);
    if (!cur) {
      writes.push([key, dia]);
      continue;
    }
    const idsT = new Set(cur.tarefas.map(t => t.id));
    const idsN = new Set(cur.notas.map(n => n.id));
    const tarefas = [...cur.tarefas, ...dia.tarefas.filter(t => !idsT.has(t.id))].slice(0, LIMITES.tarefas);
    const notas = [...cur.notas, ...dia.notas.filter(n => !idsN.has(n.id))].slice(0, LIMITES.notas);
    if (tarefas.length !== cur.tarefas.length || notas.length !== cur.notas.length) writes.push([key, { tarefas, notas }]);
  }

  if (LOCAL_MODE) {
    for (const [key, data] of writes) lsWrite(`foco/${key}`, { ...(atuais.get(key) || diaVazio()), ...data, key: undefined });
    lsWrite('settings/foco', parsed.config);
    return writes.length;
  }
  await commitInBatches([
    ...writes.map(([key, data]) => [ref(uid, 'foco', key), data, { merge: true }]),
    [ref(uid, 'settings', 'foco'), parsed.config.agua ? parsed.config : { pomodoro: parsed.config.pomodoro }]
  ]);
  return writes.length;
}
