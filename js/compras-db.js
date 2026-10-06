/* ============================================
   DataLife — Lista de compras: persistência e corredores
   ============================================
   users/{uid}/compras/lista          configuração
     { frequentes: [ {nome, cat, n} ],   // o que você costuma comprar
       alimentacao: centavos }          // VR/VA ou quanto separa para o mercado, por mês
   users/{uid}/compras/{YYYY-MM-DD}   a lista de um dia
     { itens: [ {id, nome, qtd, cat, feito, preco?} ],
       gasto: centavos }                // compras já concluídas neste dia

   Antes, os itens ficavam em compras/lista: na primeira leitura, eles
   passam para a lista de hoje (fetchConfig devolve `legado`).
   ============================================ */

import { fs, LOCAL_MODE, ref, col, lsRead, lsWrite, lsList, isId, isText, isCents, DAY_RE, commitInBatches } from './store.js';

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

const itensDe = raw => (Array.isArray(raw?.itens) ? raw.itens.map(sanitizeItem).filter(Boolean).slice(0, LIMITES.itens) : []);

export function sanitizeConfig(raw) {
  return {
    frequentes: Array.isArray(raw?.frequentes) ? raw.frequentes.map(sanitizeFreq).filter(Boolean).slice(0, LIMITES.frequentes) : [],
    alimentacao: isCents(raw?.alimentacao) ? raw.alimentacao : 0
  };
}

export function sanitizeDia(raw) {
  return { itens: itensDe(raw), gasto: isCents(raw?.gasto) ? raw.gasto : 0 };
}

/* ---------- Semana e orçamento ---------- */

const pad = n => String(n).padStart(2, '0');
const chave = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Domingo a sábado da semana de um dia. */
export function semanaDe(dia) {
  const [y, m, d] = dia.split('-').map(Number);
  const ini = new Date(y, m - 1, d - new Date(y, m - 1, d).getDay());
  return Array.from({ length: 7 }, (_, i) => chave(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i)));
}

/** Semanas do mês do dia (dias do mês ÷ 7: 4,0 a 4,4). */
export function semanasNoMes(dia) {
  const [y, m] = dia.split('-').map(Number);
  return new Date(y, m, 0).getDate() / 7;
}

/** Quanto foi gasto num dia: compras concluídas + itens com preço já no carrinho. */
export const gastoDoDia = d => d.gasto + d.itens.filter(i => i.feito && i.preco).reduce((a, i) => a + i.preco, 0);

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

/** Configuração (+ itens do formato antigo, a migrar para hoje). */
export async function fetchConfig(uid) {
  const raw = LOCAL_MODE
    ? lsRead('compras/lista')
    : await fs.getDoc(ref(uid, 'compras', 'lista')).then(s => (s.exists() ? s.data() : null));
  return { ...sanitizeConfig(raw), legado: itensDe(raw) };
}

export async function saveConfig(uid, config) {
  const clean = sanitizeConfig(config);
  if (LOCAL_MODE) return lsWrite('compras/lista', clean);
  await fs.setDoc(ref(uid, 'compras', 'lista'), clean); // sem `itens`: o formato antigo sai aqui
}

export async function fetchDia(uid, dia) {
  if (!DAY_RE.test(dia)) throw new Error('Dia inválido');
  const raw = LOCAL_MODE
    ? lsRead(`compras/${dia}`)
    : await fs.getDoc(ref(uid, 'compras', dia)).then(s => (s.exists() ? s.data() : null));
  return sanitizeDia(raw);
}

/** Dias com lista entre duas datas: Map(dia -> {itens, gasto}). Uma consulta. */
export async function fetchDias(uid, de, ate) {
  const entries = LOCAL_MODE
    ? lsList('compras').filter(([k]) => DAY_RE.test(k) && k >= de && k <= ate)
    : (await fs.getDocs(fs.query(col(uid, 'compras'), fs.where(fs.documentId(), '>=', de), fs.where(fs.documentId(), '<=', ate))))
      .docs.map(d => [d.id, d.data()]).filter(([k]) => DAY_RE.test(k));
  return new Map(entries.map(([k, raw]) => [k, sanitizeDia(raw)]));
}

export async function saveDia(uid, dia, dados) {
  if (!DAY_RE.test(dia)) throw new Error('Dia inválido');
  const clean = sanitizeDia(dados);
  if (LOCAL_MODE) return lsWrite(`compras/${dia}`, clean);
  await fs.setDoc(ref(uid, 'compras', dia), clean);
}

/* ---------- Backup ---------- */

export async function exportCompras(uid) {
  const [cfg, docs] = await Promise.all([
    fetchConfig(uid),
    LOCAL_MODE ? lsList('compras') : fs.getDocs(col(uid, 'compras')).then(q => q.docs.map(d => [d.id, d.data()]))
  ]);
  const dias = docs.filter(([k]) => DAY_RE.test(k)).map(([key, raw]) => ({ key, ...sanitizeDia(raw) })).filter(d => d.itens.length || d.gasto);
  return { frequentes: cfg.frequentes, alimentacao: cfg.alimentacao, dias };
}

/** Aceita o formato novo e o antigo ({itens, frequentes}: os itens vão para hoje). */
export function parseCompras(json) {
  if (!json || typeof json !== 'object') return null;
  const cfg = sanitizeConfig(json);
  const dias = Array.isArray(json.dias) ? json.dias.filter(d => DAY_RE.test(d?.key)).map(d => ({ key: d.key, ...sanitizeDia(d) })) : [];
  const legado = itensDe(json);
  if (legado.length) dias.push({ key: chave(new Date()), itens: legado, gasto: 0 });
  return { ...cfg, itens: dias.flatMap(d => d.itens), dias };
}

/** Mescla: itens com id novo entram em cada dia; frequentes somam; a alimentação só entra se não houver. */
export async function importCompras(uid, parsed) {
  const atual = await fetchConfig(uid);
  const frequentes = registrarComprados(atual.frequentes, parsed.frequentes.flatMap(f => Array(Math.min(f.n, 50)).fill(f)));
  await saveConfig(uid, { frequentes, alimentacao: atual.alimentacao || parsed.alimentacao });
  let novos = 0;
  const ops = [];
  for (const d of parsed.dias) {
    const cur = await fetchDia(uid, d.key);
    const ids = new Set(cur.itens.map(i => i.id));
    const add = d.itens.filter(i => !ids.has(i.id));
    if (!add.length && !d.gasto) continue;
    novos += add.length;
    const dados = { itens: [...cur.itens, ...add].slice(0, LIMITES.itens), gasto: Math.max(cur.gasto, d.gasto) };
    if (LOCAL_MODE) lsWrite(`compras/${d.key}`, dados);
    else ops.push([ref(uid, 'compras', d.key), dados]);
  }
  if (ops.length) await commitInBatches(ops);
  return novos;
}
