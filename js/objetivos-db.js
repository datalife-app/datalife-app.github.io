/* ============================================
   DataLife — Objetivos: persistência
   ============================================
   users/{uid}/objetivos/{id}
     { nome, icone, alvo,            // centavos
       prazo: "YYYY-MM",
       mensal,                       // quanto pretende guardar por mês (centavos)
       taxa,                         // rentabilidade esperada, pontos-base ao ano (1000 = 10% a.a.)
       criado: "YYYY-MM-DD", arquivado,
       movimentos: [ {id, tipo: aporte|resgate|rendimento, valor, data, nota?, inicial?} ] }
   inicial = saldo que já existia ao criar o objetivo (fica fora do "ritmo real").

   Movimentos entram e saem com arrayUnion/arrayRemove (como os gastos):
   dois aparelhos lançando ao mesmo tempo não apagam um ao outro.
   ============================================ */

import {
  fs, LOCAL_MODE, ref, col, commitInBatches, lsRead, lsWrite, lsRemove, lsList, isCents, isId, isText, MONTH_RE, DAY_RE
} from './store.js';

export const ICONE_NOMES = {
  shield: 'Reserva', home: 'Casa', plane: 'Viagem', car: 'Carro', cap: 'Estudos',
  umbrella: 'Aposentadoria', heart: 'Família', gift: 'Presente', briefcase: 'Negócio', mountain: 'Sonho',
  trending: 'Investimento'
};
export const ICONES = Object.keys(ICONE_NOMES);
export const TIPOS = {
  aporte: { nome: 'Aporte', verbo: 'Guardei' },
  resgate: { nome: 'Resgate', verbo: 'Retirei' },
  rendimento: { nome: 'Rendimento', verbo: 'Rendeu' }
};
export const LIMITES = { nome: 60, nota: 80, movimentos: 2000, taxa: 5000 };

/* ---------- Validação ---------- */

function sanitizeMov(m) {
  if (!m || typeof m !== 'object') return null;
  const { id, tipo, valor, data, nota } = m;
  if (!isId(id) || !TIPOS[tipo] || !isCents(valor) || valor === 0 || !DAY_RE.test(data)) return null;
  const clean = { id, tipo, valor, data };
  if (isText(nota, LIMITES.nota)) clean.nota = nota;
  if (m.inicial === true && tipo === 'aporte') clean.inicial = true; // saldo que já existia ao criar
  return clean;
}

function sanitizeObjetivo(id, raw) {
  if (!isId(id) || !raw || typeof raw !== 'object') return null;
  const { nome, icone, alvo, prazo, mensal, taxa, criado, arquivado, movimentos } = raw;
  if (!isText(nome, LIMITES.nome) || !isCents(alvo) || alvo === 0 || !MONTH_RE.test(prazo)) return null;
  return {
    id,
    nome,
    icone: ICONES.includes(icone) ? icone : ICONES[0],
    alvo,
    prazo,
    mensal: isCents(mensal) ? mensal : 0,
    taxa: Number.isInteger(taxa) && taxa >= 0 && taxa <= LIMITES.taxa ? taxa : 0,
    criado: DAY_RE.test(criado) ? criado : `${prazo}-01`,
    arquivado: arquivado === true,
    movimentos: Array.isArray(movimentos) ? movimentos.map(sanitizeMov).filter(Boolean).slice(0, LIMITES.movimentos) : []
  };
}

/** Campos editáveis (tudo menos id e movimentos). */
function cleanMeta(o) {
  const c = sanitizeObjetivo(o.id, { ...o, movimentos: [] });
  if (!c) throw new Error('Objetivo inválido');
  const { id, movimentos, ...meta } = c;
  return meta;
}

/* ---------- API ---------- */

export async function fetchObjetivos(uid) {
  const entries = LOCAL_MODE
    ? lsList('objetivos')
    : (await fs.getDocs(col(uid, 'objetivos'))).docs.map(d => [d.id, d.data()]);
  return entries
    .map(([id, raw]) => sanitizeObjetivo(id, raw))
    .filter(Boolean)
    .sort((a, b) => a.prazo.localeCompare(b.prazo) || a.nome.localeCompare(b.nome));
}

/** Cria (com movimentos iniciais) ou atualiza os dados de um objetivo, sem mexer nos movimentos existentes. */
export async function saveObjetivo(uid, obj, { novo = false } = {}) {
  if (!isId(obj.id)) throw new Error('Objetivo inválido');
  const meta = cleanMeta(obj);
  if (novo) {
    const movimentos = (obj.movimentos || []).map(sanitizeMov);
    if (movimentos.some(m => !m)) throw new Error('Movimento inválido');
    if (LOCAL_MODE) return lsWrite(`objetivos/${obj.id}`, { ...meta, movimentos });
    return fs.setDoc(ref(uid, 'objetivos', obj.id), { ...meta, movimentos });
  }
  if (LOCAL_MODE) {
    const cur = lsRead(`objetivos/${obj.id}`) || {};
    return lsWrite(`objetivos/${obj.id}`, { ...cur, ...meta });
  }
  await fs.setDoc(ref(uid, 'objetivos', obj.id), meta, { merge: true });
}

export async function deleteObjetivo(uid, id) {
  if (!isId(id)) throw new Error('Objetivo inválido');
  if (LOCAL_MODE) return lsRemove(`objetivos/${id}`);
  await fs.deleteDoc(ref(uid, 'objetivos', id));
}

export async function addMovimento(uid, objId, mov) {
  const clean = sanitizeMov(mov);
  if (!clean || !isId(objId)) throw new Error('Movimento inválido');
  if (LOCAL_MODE) {
    const cur = lsRead(`objetivos/${objId}`);
    return lsWrite(`objetivos/${objId}`, { ...cur, movimentos: [...(cur?.movimentos || []), clean] });
  }
  await fs.updateDoc(ref(uid, 'objetivos', objId), { movimentos: fs.arrayUnion(clean) });
}

export async function removeMovimento(uid, objId, mov) {
  if (!isId(objId)) throw new Error('Objetivo inválido');
  if (LOCAL_MODE) {
    const cur = lsRead(`objetivos/${objId}`);
    return lsWrite(`objetivos/${objId}`, { ...cur, movimentos: (cur?.movimentos || []).filter(m => m.id !== mov.id) });
  }
  // arrayRemove compara o objeto inteiro; os movimentos já chegam sanitizados
  await fs.updateDoc(ref(uid, 'objetivos', objId), { movimentos: fs.arrayRemove(mov) });
}

/* ---------- Backup ---------- */

export const exportObjetivos = fetchObjetivos;

export function parseObjetivos(list) {
  return Array.isArray(list) ? list.map(o => sanitizeObjetivo(o?.id, o)).filter(Boolean) : [];
}

/** Mescla: objetivos novos entram inteiros; nos existentes, só entram movimentos com id novo. */
export async function importObjetivos(uid, parsed) {
  const atuais = new Map((await fetchObjetivos(uid)).map(o => [o.id, o]));
  const writes = [];
  for (const o of parsed) {
    const cur = atuais.get(o.id);
    if (!cur) {
      writes.push([o.id, o, false]);
      continue;
    }
    const ids = new Set(cur.movimentos.map(m => m.id));
    const novos = o.movimentos.filter(m => !ids.has(m.id));
    if (novos.length) writes.push([o.id, novos, true]);
  }

  if (LOCAL_MODE) {
    for (const [id, data, merge] of writes) {
      const { id: _, ...doc } = merge ? { ...atuais.get(id), movimentos: [...atuais.get(id).movimentos, ...data] } : data;
      lsWrite(`objetivos/${id}`, doc);
    }
    return writes.length;
  }
  await commitInBatches(writes.map(([id, data, merge]) => {
    if (merge) return [ref(uid, 'objetivos', id), { movimentos: fs.arrayUnion(...data) }, { merge: true }];
    const { id: _, ...doc } = data;
    return [ref(uid, 'objetivos', id), doc];
  }));
  return writes.length;
}
