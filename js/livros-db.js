/* ============================================
   DataLife — Livros: persistência
   ============================================
   users/{uid}/livros/{id}
     { titulo, autor, leitores: ["Jordano", ...],
       status: lendo | lido | quero | abandonado,
       inicio?: "YYYY-MM-DD", fim?: "YYYY-MM-DD",
       avaliacao: 0–5 (0 = sem nota), paginas?: total, pagina?: onde parou,
       genero?, comentario?, citacoes: [ {id, texto, pagina?} ], criado: ms }
   users/{uid}/settings/livros
     { leitores: [ {nome, cor} ], metas: { "2026": 24 } }

   "Leitor" é uma etiqueta dentro da sua lista (quem leu), não outra conta.
   Um documento por livro; editar grava o livro inteiro (é um registro pequeno).
   ============================================ */

import { fs, LOCAL_MODE, ref, col, commitInBatches, lsRead, lsWrite, lsRemove, lsList, isId, DAY_RE } from './store.js';

export const STATUS = {
  lendo: { nome: 'Lendo' },
  lido: { nome: 'Lido' },
  quero: { nome: 'Quero ler' },
  abandonado: { nome: 'Abandonei' }
};
export const LIMITES = { titulo: 200, autor: 120, leitor: 40, leitores: 10, genero: 40, comentario: 4000, citacao: 1000, citacoes: 100, paginas: 20000, cadastro: 30 };
// Cores das lombadas/leitores: rampa da paleta + dois tons de apoio
export const CORES = ['#b48ce6', '#dabfff', '#8a63b8', '#623a8c', '#d4b4ff', '#7d52b8', '#f0e4ff', '#4b2a6d'];

/* ---------- Validação ---------- */

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeCitacao(c) {
  if (!c || !isId(c.id)) return null;
  const texto = str(c.texto, LIMITES.citacao);
  if (!texto) return null;
  const clean = { id: c.id, texto };
  if (isInt(c.pagina, 1, LIMITES.paginas)) clean.pagina = c.pagina;
  return clean;
}

function sanitizeLivro(id, raw) {
  if (!isId(id) || !raw || typeof raw !== 'object') return null;
  const titulo = str(raw.titulo, LIMITES.titulo);
  if (!titulo) return null;
  const livro = {
    id,
    titulo,
    autor: str(raw.autor, LIMITES.autor),
    leitores: Array.isArray(raw.leitores)
      ? [...new Set(raw.leitores.map(l => str(l, LIMITES.leitor)).filter(Boolean))].slice(0, LIMITES.leitores)
      : [],
    status: STATUS[raw.status] ? raw.status : 'quero',
    avaliacao: isInt(raw.avaliacao, 0, 5) ? raw.avaliacao : 0,
    citacoes: Array.isArray(raw.citacoes) ? raw.citacoes.map(sanitizeCitacao).filter(Boolean).slice(0, LIMITES.citacoes) : [],
    criado: Number.isSafeInteger(raw.criado) && raw.criado > 0 ? raw.criado : Date.now()
  };
  if (DAY_RE.test(raw.inicio)) livro.inicio = raw.inicio;
  if (DAY_RE.test(raw.fim)) livro.fim = raw.fim;
  if (livro.inicio && livro.fim && livro.fim < livro.inicio) delete livro.fim;
  if (isInt(raw.paginas, 1, LIMITES.paginas)) livro.paginas = raw.paginas;
  if (isInt(raw.pagina, 0, LIMITES.paginas)) livro.pagina = livro.paginas ? Math.min(raw.pagina, livro.paginas) : raw.pagina;
  const genero = str(raw.genero, LIMITES.genero);
  if (genero) livro.genero = genero;
  const comentario = str(raw.comentario, LIMITES.comentario);
  if (comentario) livro.comentario = comentario;
  return livro;
}

function sanitizeConfig(raw) {
  const leitores = Array.isArray(raw?.leitores)
    ? raw.leitores
      .map(l => ({ nome: str(l?.nome, LIMITES.leitor), cor: CORES.includes(l?.cor) ? l.cor : CORES[0] }))
      .filter(l => l.nome)
      .filter((l, i, a) => a.findIndex(x => x.nome.toLowerCase() === l.nome.toLowerCase()) === i)
      .slice(0, LIMITES.cadastro)
    : [];
  const metas = {};
  for (const [ano, n] of Object.entries(raw?.metas || {})) {
    if (/^\d{4}$/.test(ano) && isInt(n, 1, 1000)) metas[ano] = n;
  }
  return { leitores, metas };
}

const toDoc = ({ id, ...doc }) => doc;

/* ---------- API ---------- */

export async function fetchLivros(uid) {
  const entries = LOCAL_MODE
    ? lsList('livros')
    : (await fs.getDocs(col(uid, 'livros'))).docs.map(d => [d.id, d.data()]);
  return entries.map(([id, raw]) => sanitizeLivro(id, raw)).filter(Boolean);
}

/** Só os livros em leitura (o Foco cria a tarefa de leitura do dia). Lê poucos documentos. */
export async function fetchLendo(uid) {
  const entries = LOCAL_MODE
    ? lsList('livros').filter(([, raw]) => raw?.status === 'lendo')
    : (await fs.getDocs(fs.query(col(uid, 'livros'), fs.where('status', '==', 'lendo')))).docs.map(d => [d.id, d.data()]);
  return entries.map(([id, raw]) => sanitizeLivro(id, raw)).filter(l => l && l.status === 'lendo');
}

export async function saveLivro(uid, livro) {
  const clean = sanitizeLivro(livro.id, livro);
  if (!clean) throw new Error('Livro inválido');
  if (LOCAL_MODE) return lsWrite(`livros/${clean.id}`, toDoc(clean));
  await fs.setDoc(ref(uid, 'livros', clean.id), toDoc(clean));
}

export async function deleteLivro(uid, id) {
  if (!isId(id)) throw new Error('Livro inválido');
  if (LOCAL_MODE) return lsRemove(`livros/${id}`);
  await fs.deleteDoc(ref(uid, 'livros', id));
}

/** Vários livros de uma vez (importação do Notion). */
export async function saveLivros(uid, livros) {
  const clean = livros.map(l => sanitizeLivro(l.id, l));
  if (clean.some(l => !l)) throw new Error('Livro inválido');
  if (LOCAL_MODE) return clean.forEach(l => lsWrite(`livros/${l.id}`, toDoc(l)));
  await commitInBatches(clean.map(l => [ref(uid, 'livros', l.id), toDoc(l)]));
}

export async function fetchConfig(uid) {
  if (LOCAL_MODE) return sanitizeConfig(lsRead('settings/livros'));
  const snap = await fs.getDoc(ref(uid, 'settings', 'livros'));
  return sanitizeConfig(snap.exists() ? snap.data() : null);
}

export async function saveConfig(uid, config) {
  const clean = sanitizeConfig(config);
  if (LOCAL_MODE) return lsWrite('settings/livros', clean);
  await fs.setDoc(ref(uid, 'settings', 'livros'), clean);
}

/* ---------- Backup ---------- */

export async function exportLivros(uid) {
  const [livros, config] = await Promise.all([fetchLivros(uid), fetchConfig(uid)]);
  return { config, livros };
}

export function parseLivros(json) {
  if (!json || typeof json !== 'object') return null;
  return {
    config: sanitizeConfig(json.config),
    livros: Array.isArray(json.livros) ? json.livros.map(l => sanitizeLivro(l?.id, l)).filter(Boolean) : []
  };
}

/**
 * Mescla: livros com id novo entram; os existentes ficam como estão.
 * Leitores do backup que faltam no cadastro são acrescentados; metas do backup preenchem anos sem meta.
 */
export async function importLivros(uid, parsed) {
  const [atuais, cfg] = await Promise.all([fetchLivros(uid), fetchConfig(uid)]);
  const ids = new Set(atuais.map(l => l.id));
  const novos = parsed.livros.filter(l => !ids.has(l.id));
  const nomes = new Set(cfg.leitores.map(l => l.nome.toLowerCase()));
  const config = {
    leitores: [...cfg.leitores, ...parsed.config.leitores.filter(l => !nomes.has(l.nome.toLowerCase()))],
    metas: { ...parsed.config.metas, ...cfg.metas }
  };
  if (novos.length) await saveLivros(uid, novos);
  await saveConfig(uid, config);
  return novos.length;
}
