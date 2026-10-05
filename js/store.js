/* ============================================
   DataLife — Base da persistência
   ============================================
   Peças comuns a todas as ferramentas: SDK do Firestore (ou nada,
   em modo local), caminhos por usuário, localStorage e validadores.
   Cada ferramenta tem seu módulo de dados (db.js, foco-db.js,
   objetivos-db.js) e valida tudo que lê antes de chegar na tela.
   ============================================ */

import { SDK, db } from './firebase-init.js';
import { LOCAL_MODE } from './config.js';
import { MAX_CENTS } from './utils.js';

export let fs = null;
if (!LOCAL_MODE) fs = await import(`${SDK}/firebase-firestore.js`);

export { db, LOCAL_MODE };

/* ---------- Validação ---------- */

export const isCents = v => Number.isSafeInteger(v) && v >= 0 && v <= MAX_CENTS;
export const isId = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
export const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/* ---------- Firestore ---------- */

/** users/{uid}/... */
export const ref = (uid, ...path) => fs.doc(db, 'users', uid, ...path);
export const col = (uid, ...path) => fs.collection(db, 'users', uid, ...path);

/** Executa [ref, data, options?] em lotes (limite do Firestore: 500 escritas por batch). */
export async function commitInBatches(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = fs.writeBatch(db);
    ops.slice(i, i + 450).forEach(([r, d, o]) => (o ? batch.set(r, d, o) : batch.set(r, d)));
    await batch.commit();
  }
}

/* ---------- Modo local ---------- */

const LS_PREFIX = 'datalife:';

export function lsRead(path) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + path);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function lsWrite(path, data) {
  localStorage.setItem(LS_PREFIX + path, JSON.stringify(data));
}

export function lsRemove(path) {
  localStorage.removeItem(LS_PREFIX + path);
}

/** Documentos de uma "coleção" local: [[id, data]]. */
export function lsList(collection) {
  const prefix = `${LS_PREFIX}${collection}/`;
  return Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .map(k => [k.slice(prefix.length), lsRead(k.slice(LS_PREFIX.length))]);
}
