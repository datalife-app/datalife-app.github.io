/* ============================================
   DataLife — Exercícios: o que é seu
   ============================================
   users/{uid}/settings/exercicios
     { extras: { <idDoExercicio>: {midia?, nota?, fav?} },   // nos exercícios da biblioteca
       proprios: [ {id, nome, grupo, equipamento, passos: [..], midia?, nota?, fav?} ] }

   Mídia é um link colado por você (GIF/imagem ou vídeo do YouTube). O plano
   gratuito do Firebase não tem armazenamento de arquivos, e o link deixa a
   escolha da fonte com você.
   ============================================ */

import { fs, LOCAL_MODE, ref, lsRead, lsWrite, isId, isText } from './store.js';
import { GRUPOS, EQUIPAMENTOS } from './exercicios-data.js';

export const LIMITES = { proprios: 100, nota: 1000, midia: 500, passos: 12, passo: 300, nome: 60 };
const GRUPO_IDS = new Set(GRUPOS.map(g => g.id));

/* ---------- Mídia ---------- */

/**
 * Classifica um link colado. Só https.
 * @returns {{tipo:'imagem'|'youtube'|'link', url:string, id?:string}|null}
 */
export function midiaDe(texto) {
  const s = typeof texto === 'string' ? texto.trim().slice(0, LIMITES.midia) : '';
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let yt = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1);
  else if (host === 'youtube.com') yt = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/) || [])[1];
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { tipo: 'youtube', url: u.href, id: yt };
  if (/\.(gif|webp|png|jpe?g|avif)$/i.test(u.pathname)) return { tipo: 'imagem', url: u.href };
  return { tipo: 'link', url: u.href };
}

/* ---------- Validação ---------- */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeExtra(e) {
  if (!e || typeof e !== 'object') return null;
  const out = {};
  const m = midiaDe(e.midia);
  if (m) out.midia = m.url;
  const nota = str(e.nota, LIMITES.nota);
  if (nota) out.nota = nota;
  if (e.fav === true) out.fav = true;
  return Object.keys(out).length ? out : null;
}

function sanitizeProprio(p) {
  if (!p || !isId(p.id) || !isText(p.nome, LIMITES.nome) || !GRUPO_IDS.has(p.grupo)) return null;
  return {
    id: p.id,
    nome: p.nome.trim(),
    grupo: p.grupo,
    equipamento: EQUIPAMENTOS.includes(p.equipamento) ? p.equipamento : 'Peso corporal',
    passos: Array.isArray(p.passos) ? p.passos.map(x => str(x, LIMITES.passo)).filter(Boolean).slice(0, LIMITES.passos) : [],
    ...sanitizeExtra(p)
  };
}

export function sanitizeDados(raw) {
  const extras = {};
  for (const [id, e] of Object.entries(raw?.extras || {})) {
    const c = isId(id) && sanitizeExtra(e);
    if (c) extras[id] = c;
  }
  return {
    extras,
    proprios: Array.isArray(raw?.proprios) ? raw.proprios.map(sanitizeProprio).filter(Boolean).slice(0, LIMITES.proprios) : []
  };
}

/* ---------- API ---------- */

export async function fetchDados(uid) {
  const raw = LOCAL_MODE
    ? lsRead('settings/exercicios')
    : await fs.getDoc(ref(uid, 'settings', 'exercicios')).then(s => (s.exists() ? s.data() : null));
  return sanitizeDados(raw);
}

export async function saveDados(uid, dados) {
  const clean = sanitizeDados(dados);
  if (LOCAL_MODE) return lsWrite('settings/exercicios', clean);
  await fs.setDoc(ref(uid, 'settings', 'exercicios'), clean);
}

/* ---------- Backup ---------- */

export const exportExercicios = fetchDados;
export const parseExercicios = json => (json && typeof json === 'object' ? sanitizeDados(json) : null);
/** Mescla: extras do backup preenchem exercícios sem extras; próprios com id novo entram. */
export async function importExercicios(uid, parsed) {
  const atual = await fetchDados(uid);
  const ids = new Set(atual.proprios.map(p => p.id));
  const novos = parsed.proprios.filter(p => !ids.has(p.id));
  const extras = { ...parsed.extras, ...atual.extras };
  await saveDados(uid, { extras, proprios: [...atual.proprios, ...novos] });
  return novos.length;
}
