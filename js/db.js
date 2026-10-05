/* ============================================
   DataLife — Persistência
   ============================================
   Firestore (por usuário) ou localStorage em modo local.

   users/{uid}/settings/metas        { custosFixos: 30, conforto: 10, ... }
   users/{uid}/settings/recorrentes  { itens: [ {id, cat, desc, valor, dia, desde} ] }
   users/{uid}/months/{YYYY-MM}      { renda: <total centavos>, rendas: [ {id, desc, valor} ],
                                       gastos: [ {id, cat, desc, valor, data, rec?} ] }
   rec = id do modelo recorrente que gerou o gasto.

   Escritas são atômicas por campo (arrayUnion/arrayRemove/merge),
   então duas abas ou dispositivos abertos não apagam lançamentos um do outro.
   Tudo que vem do banco passa por sanitize* antes de chegar na UI.
   ============================================ */

import {
  fs, db, LOCAL_MODE, ref, commitInBatches, lsRead, lsWrite, lsList, isCents, isId, isText, MONTH_RE
} from './store.js';
import { CATEGORIAS, defaultMetas } from './utils.js';

const CAT_IDS = new Set(CATEGORIAS.map(c => c.id));

/* ---------- Validação ---------- */

function sanitizeGasto(g) {
  if (!g || typeof g !== 'object') return null;
  const { id, cat, desc, valor, data, rec } = g;
  if (!isId(id) || !CAT_IDS.has(cat) || !isText(desc, 80)) return null;
  if (!isCents(valor) || valor === 0) return null;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const clean = { id, cat, desc, valor, data };
  if (isId(rec)) clean.rec = rec;
  return clean;
}

function sanitizeRenda(r) {
  if (!r || typeof r !== 'object') return null;
  const { id, desc, valor } = r;
  if (!isId(id) || !isText(desc, 60) || !isCents(valor)) return null;
  return { id, desc, valor };
}

function sanitizeMonth(raw) {
  const gastos = Array.isArray(raw?.gastos) ? raw.gastos.map(sanitizeGasto).filter(Boolean) : [];
  let rendas = Array.isArray(raw?.rendas) ? raw.rendas.map(sanitizeRenda).filter(Boolean).slice(0, 50) : [];
  const renda = isCents(raw?.renda) ? raw.renda : 0;
  // Meses antigos (antes das fontes de renda): vira uma fonte única
  if (!rendas.length && renda > 0) rendas = [{ id: 'renda', desc: 'Renda', valor: renda }];
  return { renda: rendas.reduce((a, r) => a + r.valor, 0), rendas, gastos };
}

function sanitizeRecorrente(t) {
  if (!t || typeof t !== 'object') return null;
  const { id, cat, desc, valor, dia, desde } = t;
  if (!isId(id) || !CAT_IDS.has(cat) || !isText(desc, 80) || !isCents(valor) || valor === 0) return null;
  if (!Number.isInteger(dia) || dia < 1 || dia > 31 || !MONTH_RE.test(desde)) return null;
  return { id, cat, desc, valor, dia, desde };
}

function sanitizeMetas(raw) {
  const metas = defaultMetas();
  for (const id of CAT_IDS) {
    const v = raw?.[id];
    if (Number.isInteger(v) && v >= 0 && v <= 100) metas[id] = v;
  }
  return metas;
}

function assertMonth(key) {
  if (!MONTH_RE.test(key)) throw new Error(`Mês inválido: ${key}`);
}

/* ---------- API ---------- */

export async function fetchMetas(uid) {
  if (LOCAL_MODE) return sanitizeMetas(lsRead('settings/metas'));
  const snap = await fs.getDoc(ref(uid, 'settings', 'metas'));
  return sanitizeMetas(snap.exists() ? snap.data() : null);
}

export async function saveMetas(uid, metas) {
  const clean = sanitizeMetas(metas);
  if (LOCAL_MODE) return lsWrite('settings/metas', clean);
  await fs.setDoc(ref(uid, 'settings', 'metas'), clean);
}

export async function fetchMonth(uid, key) {
  assertMonth(key);
  if (LOCAL_MODE) return sanitizeMonth(lsRead(`months/${key}`));
  const snap = await fs.getDoc(ref(uid, 'months', key));
  return sanitizeMonth(snap.exists() ? snap.data() : null);
}

/** Todos os meses salvos, em ordem cronológica: [{ key, renda, gastos }]. Usado na visão geral. */
export async function fetchAllMonths(uid) {
  let entries;
  if (LOCAL_MODE) {
    entries = lsList('months');
  } else {
    const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'months'));
    entries = snap.docs.map(d => [d.id, d.data()]);
  }
  return entries
    .filter(([key]) => MONTH_RE.test(key))
    .map(([key, raw]) => ({ key, ...sanitizeMonth(raw) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Substitui as fontes de renda do mês (lista pequena) e o total em `renda`. */
export async function saveRendas(uid, key, rendas) {
  assertMonth(key);
  const clean = rendas.map(sanitizeRenda);
  if (clean.some(r => !r) || clean.length > 50) throw new Error('Renda inválida');
  const renda = clean.reduce((a, r) => a + r.valor, 0);
  if (!isCents(renda)) throw new Error('Renda inválida');
  if (LOCAL_MODE) return lsWrite(`months/${key}`, { ...sanitizeMonth(lsRead(`months/${key}`)), rendas: clean, renda });
  await fs.setDoc(ref(uid, 'months', key), { rendas: clean, renda }, { merge: true });
}

/* ---------- Gastos recorrentes (modelos) ---------- */

export async function fetchRecorrentes(uid) {
  const raw = LOCAL_MODE
    ? lsRead('settings/recorrentes')
    : await fs.getDoc(ref(uid, 'settings', 'recorrentes')).then(s => (s.exists() ? s.data() : null));
  return Array.isArray(raw?.itens) ? raw.itens.map(sanitizeRecorrente).filter(Boolean) : [];
}

export async function saveRecorrentes(uid, itens) {
  const clean = itens.map(sanitizeRecorrente);
  if (clean.some(t => !t) || clean.length > 300) throw new Error('Recorrente inválido');
  if (LOCAL_MODE) return lsWrite('settings/recorrentes', { itens: clean });
  await fs.setDoc(ref(uid, 'settings', 'recorrentes'), { itens: clean });
}

export const addGasto = (uid, key, gasto) => addGastos(uid, key, [gasto]);

/** Adiciona vários gastos numa única escrita (usado para copiar entre meses). */
export async function addGastos(uid, key, gastos) {
  assertMonth(key);
  const clean = gastos.map(sanitizeGasto);
  if (!clean.length || clean.some(g => !g)) throw new Error('Gasto inválido');
  if (LOCAL_MODE) {
    const m = sanitizeMonth(lsRead(`months/${key}`));
    return lsWrite(`months/${key}`, { ...m, gastos: [...m.gastos, ...clean] });
  }
  await fs.setDoc(ref(uid, 'months', key), { gastos: fs.arrayUnion(...clean) }, { merge: true });
}

export async function removeGasto(uid, key, gasto) {
  assertMonth(key);
  if (LOCAL_MODE) {
    const m = sanitizeMonth(lsRead(`months/${key}`));
    return lsWrite(`months/${key}`, { ...m, gastos: m.gastos.filter(g => g.id !== gasto.id) });
  }
  // arrayRemove compara o objeto inteiro; os gastos já chegam sanitizados com os mesmos campos
  await fs.updateDoc(ref(uid, 'months', key), { gastos: fs.arrayRemove(gasto) });
}

/** Substitui um gasto (edição). Remove + adiciona num batch atômico. */
export async function updateGasto(uid, key, oldGasto, newGasto) {
  assertMonth(key);
  const clean = sanitizeGasto(newGasto);
  if (!clean || clean.id !== oldGasto.id) throw new Error('Gasto inválido');
  if (LOCAL_MODE) {
    const m = sanitizeMonth(lsRead(`months/${key}`));
    return lsWrite(`months/${key}`, { ...m, gastos: m.gastos.map(g => (g.id === clean.id ? clean : g)) });
  }
  const docRef = ref(uid, 'months', key);
  const batch = fs.writeBatch(db);
  batch.update(docRef, { gastos: fs.arrayRemove(oldGasto) });
  batch.update(docRef, { gastos: fs.arrayUnion(clean) });
  await batch.commit();
}

/* ---------- Backup ---------- */

const BACKUP_VERSION = 1;

/** Tudo do usuário num objeto serializável. */
export async function exportAll(uid) {
  const [metas, recorrentes, months] = await Promise.all([fetchMetas(uid), fetchRecorrentes(uid), fetchAllMonths(uid)]);
  return { app: 'datalife', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), metas, recorrentes, months };
}

/**
 * Valida um backup e devolve um resumo, sem gravar nada.
 * @returns {{metas:Object, recorrentes:Array, months:Array, totalGastos:number}}
 */
export function parseBackup(json) {
  // 'datarenda': backups de antes da mudança de nome continuam valendo
  if (!['datalife', 'datarenda'].includes(json?.app) || !Array.isArray(json.months)) throw new Error('Arquivo não é um backup do DataLife.');
  const months = json.months
    .filter(m => MONTH_RE.test(m?.key))
    .map(m => ({ key: m.key, ...sanitizeMonth(m) }));
  return {
    metas: sanitizeMetas(json.metas),
    recorrentes: Array.isArray(json.recorrentes) ? json.recorrentes.map(sanitizeRecorrente).filter(Boolean) : [],
    months,
    totalGastos: months.reduce((a, m) => a + m.gastos.length, 0)
  };
}

/**
 * Importa mesclando: lançamentos são adicionados (os de mesmo id não duplicam),
 * renda só é preenchida em meses sem renda; metas e recorrentes são substituídos.
 */
export async function importBackup(uid, parsed) {
  const current = new Map((await fetchAllMonths(uid)).map(m => [m.key, m]));
  const writes = parsed.months.map(m => {
    const cur = current.get(m.key);
    const ids = new Set(cur?.gastos.map(g => g.id));
    const novos = m.gastos.filter(g => !ids.has(g.id));
    const data = {};
    if (novos.length) data.gastos = novos;
    if (!cur?.renda && m.rendas.length) Object.assign(data, { rendas: m.rendas, renda: m.renda });
    return [m.key, data, cur];
  }).filter(([, data]) => Object.keys(data).length);

  if (LOCAL_MODE) {
    for (const [key, data, cur] of writes) {
      const base = cur || { renda: 0, rendas: [], gastos: [] };
      lsWrite(`months/${key}`, { ...base, ...data, gastos: [...base.gastos, ...(data.gastos || [])] });
    }
    lsWrite('settings/metas', parsed.metas);
    lsWrite('settings/recorrentes', { itens: parsed.recorrentes });
    return writes.length;
  }

  // Lotes de até 450 escritas (limite do Firestore: 500 por batch)
  const ops = [
    ...writes.map(([key, data]) => [ref(uid, 'months', key),
      data.gastos ? { ...data, gastos: fs.arrayUnion(...data.gastos) } : data, { merge: true }]),
    [ref(uid, 'settings', 'metas'), parsed.metas],
    [ref(uid, 'settings', 'recorrentes'), { itens: parsed.recorrentes }]
  ];
  await commitInBatches(ops);
  return writes.length;
}

/**
 * Apaga o cache offline do Firestore (IndexedDB) deste navegador.
 * Chamado no logout para não deixar dados financeiros em computadores compartilhados.
 */
export async function clearLocalCache() {
  if (LOCAL_MODE) return;
  await fs.terminate(db);
  await fs.clearIndexedDbPersistence(db);
}
