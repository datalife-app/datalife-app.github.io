/* ============================================
   DataLife — Lista de compras: persistência e corredores
   ============================================
   users/{uid}/compras/lista   um documento só:
     { itens: [ {id, nome, qtd, cat, feito, preco?} ],
       frequentes: [ {nome, cat, n} ] }   // o que você costuma comprar
   ============================================ */

import { fs, LOCAL_MODE, ref, lsRead, lsWrite, isId, isText, isCents } from './store.js';

export const LIMITES = { itens: 300, frequentes: 150, nome: 60, qtd: 20 };

/** Corredores na ordem de um mercado comum (entrada -> caixa). */
export const CORREDORES = [
  { id: 'hortifruti', nome: 'Hortifrúti', palavras: 'alface tomate cebola alho batata cenoura banana maçã maca laranja limão limao mamão mamao uva abacate pepino abobrinha brócolis brocolis couve pimentão pimentao fruta verdura legume morango melancia melão melao manga mandioca aipim inhame cheiro-verde salsinha cebolinha rúcula rucula espinafre beterraba' },
  { id: 'padaria', nome: 'Padaria', palavras: 'pão pao pães paes bisnaguinha torrada bolo rosca croissant baguete broa' },
  { id: 'carnes', nome: 'Carnes e peixes', palavras: 'carne frango peito coxa sobrecoxa patinho alcatra picanha costela linguiça linguica salsicha bacon peixe tilápia tilapia salmão salmao atum camarão camarao moída moida acém acem músculo musculo hambúrguer hamburguer' },
  { id: 'frios', nome: 'Frios e laticínios', palavras: 'leite queijo presunto mussarela muçarela iogurte manteiga margarina requeijão requeijao creme nata ricota peito-de-peru mortadela salame ovo ovos' },
  { id: 'mercearia', nome: 'Mercearia', palavras: 'arroz feijão feijao macarrão macarrao massa farinha açúcar acucar sal óleo oleo azeite café cafe molho extrato milho ervilha atum sardinha aveia granola biscoito bolacha chocolate achocolatado fermento tempero vinagre maionese ketchup mostarda pipoca cereal' },
  { id: 'congelados', nome: 'Congelados', palavras: 'sorvete congelado lasanha pizza nuggets polpa batata-frita gelo' },
  { id: 'bebidas', nome: 'Bebidas', palavras: 'água agua refrigerante suco cerveja vinho energético energetico chá cha kombucha' },
  { id: 'limpeza', nome: 'Limpeza', palavras: 'detergente sabão sabao amaciante desinfetante água-sanitária sanitaria esponja vassoura rodo pano lustra-móveis multiuso alvejante saco-de-lixo lixo' },
  { id: 'higiene', nome: 'Higiene', palavras: 'papel-higiênico papel higiênico higienico sabonete shampoo xampu condicionador pasta escova fio-dental desodorante absorvente fralda lenço lenco algodão algodao cotonete' },
  { id: 'pet', nome: 'Pet', palavras: 'ração racao areia petisco' },
  { id: 'outros', nome: 'Outros', palavras: '' }
];
const CAT_IDS = new Set(CORREDORES.map(c => c.id));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Corredor provável pelo nome (primeira palavra que bate; "Outros" se nada bater). */
export function corredorDe(nome, frequentes = []) {
  const n = norm(nome);
  const conhecido = frequentes.find(f => norm(f.nome) === n);
  if (conhecido) return conhecido.cat;
  const palavras = n.split(/\s+/);
  for (const c of CORREDORES) {
    const lista = norm(c.palavras).split(/\s+/).filter(Boolean);
    if (lista.some(p => palavras.includes(p) || (p.includes('-') && n.includes(p.replace(/-/g, ' '))))) return c.id;
  }
  return 'outros';
}

/** "2 kg arroz" · "arroz 2kg" · "6 ovos" -> { qtd: "2 kg", nome: "arroz" } */
export function separarQtd(texto) {
  const t = texto.trim().replace(/\s+/g, ' ');
  const UN = '(kg|g|l|ml|un|und|cx|pct|pc|dz|lata|latas|garrafa|garrafas)';
  let m = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UN}?\\s+(?:de\\s+)?(.+)$`, 'i'));
  if (m) return { qtd: `${m[1]}${m[2] ? ` ${m[2].toLowerCase()}` : ''}`, nome: m[3] };
  m = t.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UN}?$`, 'i'));
  if (m) return { qtd: `${m[2]}${m[3] ? ` ${m[3].toLowerCase()}` : ''}`, nome: m[1] };
  return { qtd: '', nome: t };
}

/* ---------- Validação ---------- */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeItem(i) {
  if (!i || !isId(i.id) || !isText(i.nome, LIMITES.nome)) return null;
  const out = { id: i.id, nome: i.nome.trim(), qtd: str(i.qtd, LIMITES.qtd), cat: CAT_IDS.has(i.cat) ? i.cat : 'outros', feito: i.feito === true };
  if (isCents(i.preco) && i.preco > 0) out.preco = i.preco;
  return out;
}

function sanitizeFreq(f) {
  if (!f || !isText(f.nome, LIMITES.nome)) return null;
  return { nome: f.nome.trim(), cat: CAT_IDS.has(f.cat) ? f.cat : 'outros', n: Number.isInteger(f.n) && f.n > 0 ? Math.min(f.n, 9999) : 1 };
}

export function sanitizeLista(raw) {
  return {
    itens: Array.isArray(raw?.itens) ? raw.itens.map(sanitizeItem).filter(Boolean).slice(0, LIMITES.itens) : [],
    frequentes: Array.isArray(raw?.frequentes) ? raw.frequentes.map(sanitizeFreq).filter(Boolean).slice(0, LIMITES.frequentes) : []
  };
}

/** Itens comprados entram (ou somam) nos frequentes; os mais comprados ficam no topo. */
export function registrarComprados(frequentes, comprados) {
  const mapa = new Map(frequentes.map(f => [norm(f.nome), { ...f }]));
  for (const i of comprados) {
    const k = norm(i.nome);
    const f = mapa.get(k);
    if (f) { f.n += 1; f.cat = i.cat; } else mapa.set(k, { nome: i.nome, cat: i.cat, n: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n).slice(0, LIMITES.frequentes);
}

/* ---------- API ---------- */

export async function fetchLista(uid) {
  const raw = LOCAL_MODE
    ? lsRead('compras/lista')
    : await fs.getDoc(ref(uid, 'compras', 'lista')).then(s => (s.exists() ? s.data() : null));
  return sanitizeLista(raw);
}

export async function saveLista(uid, lista) {
  const clean = sanitizeLista(lista);
  if (LOCAL_MODE) return lsWrite('compras/lista', clean);
  await fs.setDoc(ref(uid, 'compras', 'lista'), clean);
}

/* ---------- Backup ---------- */

export const exportCompras = fetchLista;
export const parseCompras = json => (json && typeof json === 'object' ? sanitizeLista(json) : null);
/** Mescla: itens com id novo entram; frequentes somam. */
export async function importCompras(uid, parsed) {
  const atual = await fetchLista(uid);
  const ids = new Set(atual.itens.map(i => i.id));
  const novos = parsed.itens.filter(i => !ids.has(i.id));
  const frequentes = registrarComprados(atual.frequentes, parsed.frequentes.flatMap(f => Array(Math.min(f.n, 50)).fill(f)));
  await saveLista(uid, { itens: [...atual.itens, ...novos], frequentes });
  return novos.length;
}
