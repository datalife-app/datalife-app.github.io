/* ============================================
   DataLife — Conselhos: progresso
   ============================================
   users/{uid}/settings/conselhos  { feitos: [idDaAção, ..] }
   ============================================ */

import { fs, LOCAL_MODE, ref, lsRead, lsWrite } from './store.js';
import { TOPICOS } from './conselhos-data.js';

const VALIDOS = new Set(TOPICOS.flatMap(t => t.fazer.map(([id]) => id)));
const limpar = lista => [...new Set(Array.isArray(lista) ? lista.filter(id => VALIDOS.has(id)) : [])].slice(0, 100);

export async function fetchFeitos(uid) {
  const raw = LOCAL_MODE
    ? lsRead('settings/conselhos')
    : await fs.getDoc(ref(uid, 'settings', 'conselhos')).then(s => (s.exists() ? s.data() : null));
  return new Set(limpar(raw?.feitos));
}

export async function saveFeitos(uid, feitos) {
  const doc = { feitos: limpar([...feitos]) };
  if (LOCAL_MODE) return lsWrite('settings/conselhos', doc);
  await fs.setDoc(ref(uid, 'settings', 'conselhos'), doc);
}

/* ---------- Backup ---------- */

export const exportConselhos = async uid => [...(await fetchFeitos(uid))];
export const parseConselhos = json => limpar(json);
/** Soma: o que estava feito continua feito. */
export async function importConselhos(uid, parsed) {
  const atual = await fetchFeitos(uid);
  const novos = parsed.filter(id => !atual.has(id));
  if (novos.length) await saveFeitos(uid, [...atual, ...novos]);
  return novos.length;
}
