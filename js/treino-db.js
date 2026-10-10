/* ============================================
   DataLife — Treino: plano e histórico de cargas
   ============================================
   users/{uid}/treino/plano
     { perfil: {nivel, genero, peso, divisao},
       dias: [ {id: 'A', nome, itens: [ {ex, series, reps, descanso, carga} ]} ] }
   users/{uid}/treino/h_{idDoExercicio}      histórico de um exercício
     { regs: [ {id, data: 'YYYY-MM-DD', carga: kg, series, reps, ajustes?, nota?} ] }
   reps = repetições feitas na série mais fraca (ou segundos, nos de tempo).
   ajustes = regulagens do aparelho (banco, assento, pino...): o último
   registro vira o "ajuste atual" e já vem preenchido no próximo.
   ============================================ */

import { fs, LOCAL_MODE, ref, col, lsRead, lsWrite, lsList, isId, DAY_RE, commitInBatches } from './store.js';
import { NIVEIS, GENEROS, DIVISOES } from './treino-data.js';

export const LIMITES = { regs: 500, dias: 6, itens: 12, ajustes: 120, nota: 200, carga: 1000 };
const NIVEL_IDS = new Set(NIVEIS.map(n => n.id));
const GENERO_IDS = new Set(GENEROS.map(g => g.id));
const DIVISAO_IDS = new Set(DIVISOES.map(d => d.id));

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const kg = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= LIMITES.carga ? Math.round(v * 10) / 10 : 0);
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

/* ---------- Validação ---------- */

function sanitizePerfil(p) {
  if (!p || !NIVEL_IDS.has(p.nivel) || !GENERO_IDS.has(p.genero) || !DIVISAO_IDS.has(p.divisao)) return null;
  return { nivel: p.nivel, genero: p.genero, divisao: p.divisao, peso: int(p.peso, 30, 300) || 70 };
}

function sanitizeItem(i) {
  if (!i || !isId(i.ex)) return null;
  return {
    ex: i.ex,
    series: int(i.series, 1, 10) || 3,
    reps: /^\d{1,3}(-\d{1,3})?s?$/.test(i.reps) ? i.reps : '10-12',
    descanso: int(i.descanso, 0, 600) ?? 60,
    carga: kg(i.carga)
  };
}

function sanitizeDia(d) {
  if (!d || !/^[A-F]$/.test(d.id)) return null;
  return {
    id: d.id,
    nome: str(d.nome, 40) || `Treino ${d.id}`,
    itens: Array.isArray(d.itens) ? d.itens.map(sanitizeItem).filter(Boolean).slice(0, LIMITES.itens) : []
  };
}

export function sanitizePlano(raw) {
  const perfil = sanitizePerfil(raw?.perfil);
  if (!perfil) return null;
  const dias = Array.isArray(raw?.dias) ? raw.dias.map(sanitizeDia).filter(Boolean).slice(0, LIMITES.dias) : [];
  return dias.length ? { perfil, dias } : null;
}

export function sanitizeReg(r) {
  if (!r || !isId(r.id) || !DAY_RE.test(r.data)) return null;
  const reps = int(r.reps, 0, 999);
  if (reps === null) return null;
  const out = { id: r.id, data: r.data, carga: kg(r.carga), series: int(r.series, 1, 20) || 1, reps };
  const ajustes = str(r.ajustes, LIMITES.ajustes);
  if (ajustes) out.ajustes = ajustes;
  const nota = str(r.nota, LIMITES.nota);
  if (nota) out.nota = nota;
  return out;
}

/** Mais novo primeiro (data, e na mesma data a ordem de registro). */
export const sanitizeRegs = raw => (Array.isArray(raw?.regs) ? raw.regs.map(sanitizeReg).filter(Boolean) : [])
  .sort((a, b) => b.data.localeCompare(a.data)).slice(0, LIMITES.regs);

/* ---------- API ---------- */

const HIST = 'h_';

/** Plano + histórico de todos os exercícios: uma leitura da coleção. */
export async function fetchTreino(uid) {
  const entries = LOCAL_MODE
    ? lsList('treino')
    : (await fs.getDocs(col(uid, 'treino'))).docs.map(d => [d.id, d.data()]);
  let plano = null;
  const hist = {};
  for (const [k, raw] of entries) {
    if (k === 'plano') plano = sanitizePlano(raw);
    else if (k.startsWith(HIST) && isId(k.slice(HIST.length))) {
      const regs = sanitizeRegs(raw);
      if (regs.length) hist[k.slice(HIST.length)] = regs;
    }
  }
  return { plano, hist };
}

export async function savePlano(uid, plano) {
  const clean = sanitizePlano(plano);
  if (!clean) throw new Error('Plano inválido');
  if (LOCAL_MODE) return lsWrite('treino/plano', clean);
  await fs.setDoc(ref(uid, 'treino', 'plano'), clean);
}

/* Registros entram e saem com arrayUnion/arrayRemove (como os gastos do
   Orçamento): o celular na academia e o computador em casa não apagam o
   registro um do outro. O registro precisa vir de sanitizeReg (o mesmo
   objeto gravado), porque arrayRemove compara o objeto inteiro. */

export async function addReg(uid, exId, reg) {
  const clean = sanitizeReg(reg);
  if (!isId(exId) || !clean) throw new Error('Registro inválido');
  if (LOCAL_MODE) {
    const regs = sanitizeRegs(lsRead(`treino/${HIST}${exId}`));
    return lsWrite(`treino/${HIST}${exId}`, { regs: sanitizeRegs({ regs: [clean, ...regs.filter(r => r.id !== clean.id)] }) });
  }
  await fs.setDoc(ref(uid, 'treino', HIST + exId), { regs: fs.arrayUnion(clean) }, { merge: true });
}

export async function removeReg(uid, exId, reg) {
  if (!isId(exId)) throw new Error('Exercício inválido');
  if (LOCAL_MODE) {
    const regs = sanitizeRegs(lsRead(`treino/${HIST}${exId}`)).filter(r => r.id !== reg.id);
    return lsWrite(`treino/${HIST}${exId}`, { regs });
  }
  await fs.updateDoc(ref(uid, 'treino', HIST + exId), { regs: fs.arrayRemove(reg) });
}

/* ---------- Backup ---------- */

export const exportTreino = fetchTreino;

export function parseTreino(json) {
  if (!json || typeof json !== 'object') return null;
  const hist = {};
  for (const [id, regs] of Object.entries(json.hist || {})) {
    const r = isId(id) && sanitizeRegs({ regs });
    if (r?.length) hist[id] = r;
  }
  return { plano: sanitizePlano(json.plano), hist };
}

/** Mescla: registros com id novo entram no histórico; o plano só entra se não houver um. */
export async function importTreino(uid, parsed) {
  const atual = await fetchTreino(uid);
  let novos = 0;
  const ops = [];
  for (const [id, regs] of Object.entries(parsed.hist)) {
    const cur = atual.hist[id] || [];
    const ids = new Set(cur.map(r => r.id));
    const add = regs.filter(r => !ids.has(r.id));
    if (!add.length) continue;
    novos += add.length;
    const dados = { regs: sanitizeRegs({ regs: [...cur, ...add] }) };
    if (LOCAL_MODE) lsWrite(`treino/${HIST}${id}`, dados);
    else ops.push([ref(uid, 'treino', HIST + id), dados]);
  }
  if (parsed.plano && !atual.plano) {
    if (LOCAL_MODE) lsWrite('treino/plano', parsed.plano);
    else ops.push([ref(uid, 'treino', 'plano'), parsed.plano]);
  }
  if (ops.length) await commitInBatches(ops);
  return novos;
}

export const contarTreino = p => Object.values(p?.hist || {}).reduce((a, r) => a + r.length, 0);
