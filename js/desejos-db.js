/* ============================================
   DataLife — Compras conscientes: persistência e análise de preço
   ============================================
   users/{uid}/desejos/{id}
     { nome, link, loja, alvo,                 // alvo: preço que você aceita pagar
       criado, comprado?: {data, valor},
       registros: [ {id, data, valor, loja?} ] }

   Os preços são anotados por você (buscar sozinho em lojas exigiria um
   servidor, fora do plano gratuito). A análise compara o último preço com
   o "normal" (mediana: não se deixa levar por um valor fora da curva).
   ============================================ */

import { fs, LOCAL_MODE, ref, col, commitInBatches, lsWrite, lsRemove, lsList, isId, isText, isCents, DAY_RE } from './store.js';

export const LIMITES = { nome: 80, loja: 40, link: 500, registros: 500 };

/* ---------- Validação ---------- */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Só http(s): nada de "javascript:" num link que vira <a href>. */
export function linkSeguro(v) {
  const s = str(v, LIMITES.link);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

function sanitizeRegistro(r) {
  if (!r || !isId(r.id) || !DAY_RE.test(r.data) || !isCents(r.valor) || r.valor === 0) return null;
  const out = { id: r.id, data: r.data, valor: r.valor };
  const loja = str(r.loja, LIMITES.loja);
  if (loja) out.loja = loja;
  return out;
}

function sanitizeDesejo(id, raw) {
  if (!isId(id) || !raw || !isText(raw.nome, LIMITES.nome)) return null;
  const d = {
    id,
    nome: raw.nome.trim(),
    link: linkSeguro(raw.link),
    loja: str(raw.loja, LIMITES.loja),
    alvo: isCents(raw.alvo) ? raw.alvo : 0,
    criado: Number.isSafeInteger(raw.criado) ? raw.criado : 0,
    registros: Array.isArray(raw.registros)
      ? raw.registros.map(sanitizeRegistro).filter(Boolean).sort((a, b) => a.data.localeCompare(b.data)).slice(-LIMITES.registros)
      : []
  };
  if (raw.comprado && DAY_RE.test(raw.comprado.data) && isCents(raw.comprado.valor)) d.comprado = { data: raw.comprado.data, valor: raw.comprado.valor };
  return d;
}
const toDoc = ({ id, ...d }) => d;

/* ---------- Análise (pura) ---------- */

const utc = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dias = (a, b) => Math.round((utc(b) - utc(a)) / 86_400_000);
const shiftDia = (k, n) => new Date(utc(k) + n * 86_400_000).toISOString().slice(0, 10);

export function mediana(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Black Friday: a quarta sexta-feira de novembro. */
export function blackFriday(ano) {
  const d = new Date(Date.UTC(ano, 10, 1));
  const primeiraSexta = 1 + ((5 - d.getUTCDay() + 7) % 7);
  return `${ano}-11-${String(primeiraSexta + 21).padStart(2, '0')}`;
}

/**
 * @returns {{n, ultimo, menor, maior, normal, status, variacao, alvoOk}}
 *   status: 'menor' (menor já visto) | 'abaixo' | 'normal' | 'acima' | 'pouco' (menos de 3 registros)
 *   variacao: último em relação ao normal (-0,12 = 12% abaixo)
 */
export function analisar(d) {
  const r = d.registros;
  if (!r.length) return { n: 0, status: 'pouco' };
  const vals = r.map(x => x.valor);
  const ultimo = r[r.length - 1];
  const menor = r.reduce((a, x) => (x.valor < a.valor ? x : a));
  const maior = r.reduce((a, x) => (x.valor > a.valor ? x : a));
  const normal = mediana(vals);
  const variacao = normal ? (ultimo.valor - normal) / normal : 0;
  let status;
  if (r.length < 3) status = 'pouco';
  else if (ultimo.valor <= menor.valor && r.filter(x => x.valor === menor.valor).length === 1) status = 'menor';
  else if (variacao <= -0.05) status = 'abaixo';
  else if (variacao >= 0.05) status = 'acima';
  else status = 'normal';
  return { n: r.length, ultimo, menor, maior, normal, status, variacao, alvoOk: d.alvo > 0 && ultimo.valor <= d.alvo };
}

/**
 * Black Friday "pela metade do dobro": o preço sobe nas semanas antes e "cai"
 * de volta ao normal no dia. Precisa de registros antes e durante a data.
 * @returns {Array<{ano, veredito:'real'|'maquiada'|'sem-desconto', texto}>}
 */
export function analisarBlackFriday(d) {
  const r = d.registros;
  const anos = [...new Set(r.map(x => Number(x.data.slice(0, 4))))];
  const out = [];
  for (const ano of anos) {
    const bf = blackFriday(ano);
    const naData = r.filter(x => dias(bf, x.data) >= -2 && dias(bf, x.data) <= 3);
    const antes = r.filter(x => x.data < shiftDia(bf, -30));
    const vespera = r.filter(x => x.data >= shiftDia(bf, -30) && x.data < shiftDia(bf, -2));
    if (!naData.length || !antes.length) continue;
    const base = mediana(antes.map(x => x.valor));
    const preco = Math.min(...naData.map(x => x.valor));
    const pico = vespera.length ? Math.max(...vespera.map(x => x.valor)) : 0;
    const desc = (base - preco) / base;
    if (pico > base * 1.1 && desc < 0.05) {
      out.push({ ano, veredito: 'maquiada', texto: `Na Black Friday de ${ano} o preço subiu nas semanas anteriores e "caiu" de volta ao normal: o desconto anunciado não era real.` });
    } else if (desc >= 0.05) {
      out.push({ ano, veredito: 'real', texto: `Na Black Friday de ${ano} o preço ficou ${Math.round(desc * 100)}% abaixo do normal dos meses anteriores.` });
    } else {
      out.push({ ano, veredito: 'sem-desconto', texto: `Na Black Friday de ${ano} o preço ficou no mesmo patamar de antes.` });
    }
  }
  return out;
}

/* ---------- API ---------- */

export async function fetchDesejos(uid) {
  const entries = LOCAL_MODE
    ? lsList('desejos')
    : (await fs.getDocs(col(uid, 'desejos'))).docs.map(x => [x.id, x.data()]);
  return entries.map(([id, raw]) => sanitizeDesejo(id, raw)).filter(Boolean);
}

export async function saveDesejo(uid, d) {
  const clean = sanitizeDesejo(d.id, d);
  if (!clean) throw new Error('Item inválido');
  if (LOCAL_MODE) return lsWrite(`desejos/${clean.id}`, toDoc(clean));
  await fs.setDoc(ref(uid, 'desejos', clean.id), toDoc(clean));
}

export async function deleteDesejo(uid, id) {
  if (!isId(id)) throw new Error('Item inválido');
  if (LOCAL_MODE) return lsRemove(`desejos/${id}`);
  await fs.deleteDoc(ref(uid, 'desejos', id));
}

/* ---------- Backup ---------- */

export const exportDesejos = fetchDesejos;
export const parseDesejos = list => (Array.isArray(list) ? list.map(d => sanitizeDesejo(d?.id, d)).filter(Boolean) : []);
export async function importDesejos(uid, parsed) {
  const ids = new Set((await fetchDesejos(uid)).map(d => d.id));
  const novos = parsed.filter(d => !ids.has(d.id));
  if (LOCAL_MODE) novos.forEach(d => lsWrite(`desejos/${d.id}`, toDoc(d)));
  else await commitInBatches(novos.map(d => [ref(uid, 'desejos', d.id), toDoc(d)]));
  return novos.length;
}
