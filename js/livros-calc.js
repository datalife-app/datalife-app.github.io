/* ============================================
   DataLife — Livros: cálculos e importação
   ============================================
   Funções puras (sem DOM nem banco): ritmo de leitura, desafio do ano,
   estatísticas e leitura do CSV exportado pelo Notion.
   ============================================ */

const DIA = 86_400_000;
const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Dias entre duas datas ISO, contando os dois extremos (começou e terminou no mesmo dia = 1). */
export const diasEntre = (de, ate) => Math.round((toDate(ate) - toDate(de)) / DIA) + 1;

/* ---------- Lendo agora ---------- */

/**
 * Ritmo de quem está lendo: páginas por dia desde o início e previsão de término.
 * @returns {{pct:number|null, porDia:number|null, termina:string|null, dias:number|null}}
 */
export function ritmo(livro, hoje) {
  const pct = livro.paginas ? Math.min(100, ((livro.pagina || 0) / livro.paginas) * 100) : null;
  if (!livro.inicio || livro.inicio > hoje) return { pct, porDia: null, termina: null, dias: null };
  const dias = diasEntre(livro.inicio, hoje);
  const porDia = livro.pagina ? livro.pagina / dias : null;
  let termina = null;
  if (porDia && livro.paginas && livro.pagina < livro.paginas) {
    const d = toDate(hoje);
    d.setDate(d.getDate() + Math.ceil((livro.paginas - livro.pagina) / porDia));
    termina = toIso(d);
  }
  return { pct, porDia, termina, dias };
}

/* ---------- Desafio do ano ---------- */

export const lidosNoAno = (livros, ano) => livros.filter(l => l.status === 'lido' && l.fim?.startsWith(`${ano}-`));

/**
 * @returns {{lidos:number, meta:number, esperado:number, status:'sem-meta'|'concluido'|'adiantado'|'no-ritmo'|'atrasado', falta:number}}
 *   esperado: quantos já deveriam estar lidos hoje para bater a meta num ritmo constante
 */
export function desafio(livros, ano, meta, hoje) {
  const lidos = lidosNoAno(livros, ano).length;
  if (!meta) return { lidos, meta: 0, esperado: 0, status: 'sem-meta', falta: 0 };
  const inicio = new Date(ano, 0, 1), fim = new Date(ano + 1, 0, 1);
  const agora = Math.min(Math.max(toDate(hoje), inicio), fim);
  const fracao = (agora - inicio) / (fim - inicio);
  const esperado = Math.floor(meta * fracao);
  let status;
  if (lidos >= meta) status = 'concluido';
  else if (lidos > esperado) status = 'adiantado';
  else if (lidos === esperado) status = 'no-ritmo';
  else status = 'atrasado';
  return { lidos, meta, esperado, status, falta: Math.max(0, meta - lidos) };
}

/* ---------- Estatísticas ---------- */

export function estatisticas(livros, ano) {
  const lidos = lidosNoAno(livros, ano);
  const porMes = Array(12).fill(0);
  for (const l of lidos) porMes[Number(l.fim.slice(5, 7)) - 1]++;
  const paginas = lidos.reduce((a, l) => a + (l.paginas || 0), 0);
  const notas = lidos.filter(l => l.avaliacao);
  const duracoes = lidos.filter(l => l.inicio).map(l => diasEntre(l.inicio, l.fim));
  const contar = arr => [...arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    total: lidos.length,
    paginas,
    media: notas.length ? notas.reduce((a, l) => a + l.avaliacao, 0) / notas.length : 0,
    diasPorLivro: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : 0,
    porMes,
    autores: contar(lidos.map(l => l.autor).filter(Boolean)),
    leitores: contar(lidos.flatMap(l => l.leitores)),
    generos: contar(lidos.map(l => l.genero).filter(Boolean)),
    favorito: [...notas].sort((a, b) => b.avaliacao - a.avaliacao || (b.fim || '').localeCompare(a.fim || ''))[0] || null
  };
}

/* ---------- Lombada (estante) ---------- */

/** Altura e largura da lombada pelo número de páginas; sem páginas, um tamanho médio estável por título. */
export function lombada(livro) {
  let h = 0;
  for (const c of livro.titulo) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const p = livro.paginas || 180 + (h % 220);
  return {
    largura: Math.round(Math.min(46, Math.max(20, 14 + p / 18))),
    altura: Math.round(Math.min(176, Math.max(128, 126 + (h % 5) * 10 + Math.min(p, 900) / 30))),
    seed: h
  };
}

/* ---------- Importação do Notion (CSV) ---------- */

/** CSV com aspas (RFC 4180), separador "," ou ";" detectado na primeira linha. */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0];
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim()));
}

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const COLUNAS = {
  titulo: ['titulo', 'title', 'name', 'nome', 'livro'],
  autor: ['autor', 'author', 'autores', 'authors'],
  leitores: ['leitor', 'leitores', 'reader', 'readers', 'quem leu'],
  inicio: ['inicio da leitura', 'inicio', 'start', 'started', 'date started', 'comecei'],
  fim: ['fim da leitura', 'fim', 'end', 'finished', 'date finished', 'terminei', 'date read'],
  avaliacao: ['avaliacao', 'nota', 'rating', 'my rating', 'estrelas'],
  comentario: ['comentarios', 'comentario', 'comments', 'notes', 'notas', 'review', 'resenha'],
  paginas: ['paginas', 'pages', 'number of pages', 'num paginas'],
  genero: ['genero', 'genre', 'categoria', 'tags'],
  status: ['status', 'estado', 'situacao', 'exclusive shelf']
};

const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MESES_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "01/10/2026" · "2026-10-01" · "October 1, 2026" · "1 de outubro de 2026" · "2026/10/01" -> ISO; senão null. */
export function parseData(text) {
  const t = norm(String(text || '')).replace(/\s*\(.*\)$/, '').replace(/\s+\d{1,2}:\d{2}.*$/, '');
  if (!t) return null;
  let y, m, d, r;
  if ((r = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) [, y, m, d] = r;
  else if ((r = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) [, d, m, y] = r;
  else if ((r = t.match(/^([a-z]+)\.? (\d{1,2}),? (\d{4})/))) { m = MESES_EN.findIndex(x => x.startsWith(r[1].slice(0, 3))) + 1; d = r[2]; y = r[3]; }
  else if ((r = t.match(/^(\d{1,2}) de ([a-z]+) de (\d{4})/))) { m = MESES_PT.indexOf(r[2]) + 1; d = r[1]; y = r[3]; }
  else return null;
  [y, m, d] = [y, m, d].map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? toIso(dt) : null;
}

/** "⭐⭐⭐⭐" · "4" · "4/5" · "8/10" · "★★★☆☆" -> 0–5 */
export function parseNota(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const estrelas = (t.match(/⭐|★/g) || []).length;
  if (estrelas) return Math.min(5, estrelas);
  const r = t.replace(',', '.').match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/);
  if (!r) return 0;
  const n = Number(r[1]), de = Number(r[2] || (Number(r[1]) > 5 ? 10 : 5));
  return Math.max(0, Math.min(5, Math.round((n / de) * 5)));
}

function parseStatus(text, inicio, fim) {
  const t = norm(text || '');
  if (/abandon|dnf|desist/.test(t)) return 'abandonado';
  if (/^(lido|read|conclu|termin|finished)/.test(t)) return 'lido';
  if (/(lendo|reading|andamento|progress)/.test(t)) return 'lendo';
  if (/(quero|to-read|want|fila|proximo)/.test(t)) return 'quero';
  return fim ? 'lido' : inicio ? 'lendo' : 'quero';
}

/**
 * Converte o CSV do Notion (ou similar) em livros prontos para salvar (sem id).
 * @returns {{livros:Array, colunas:Object, ignoradas:number}}
 */
export function livrosDoCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('O arquivo não tem linhas de livros.');
  const header = rows[0].map(norm);
  const colunas = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) {
    const i = header.findIndex(h => nomes.includes(h));
    if (i >= 0) colunas[campo] = i;
  }
  if (colunas.titulo === undefined) throw new Error('Não achei a coluna de título (Título, Title ou Name).');
  let ignoradas = 0;
  const livros = [];
  for (const r of rows.slice(1)) {
    const get = campo => (colunas[campo] === undefined ? '' : (r[colunas[campo]] || '').trim());
    const titulo = get('titulo');
    if (!titulo) { ignoradas++; continue; }
    const inicio = parseData(get('inicio'));
    const fim = parseData(get('fim'));
    const paginas = parseInt(get('paginas').replace(/\D/g, ''), 10);
    const livro = {
      titulo,
      autor: get('autor'),
      // Notion exporta multi-seleção separada por vírgula
      leitores: get('leitores').split(/\s*[,;]\s*/).filter(Boolean),
      status: parseStatus(get('status'), inicio, fim),
      avaliacao: parseNota(get('avaliacao')),
      citacoes: []
    };
    if (inicio) livro.inicio = inicio;
    if (fim) livro.fim = fim;
    if (paginas > 0) livro.paginas = paginas;
    if (livro.status === 'lido' && livro.paginas) livro.pagina = livro.paginas;
    if (get('comentario')) livro.comentario = get('comentario');
    if (get('genero')) livro.genero = get('genero').split(/\s*,\s*/)[0];
    livros.push(livro);
  }
  return { livros, colunas, ignoradas };
}

/** Chave para achar duplicados: título + autor, sem acento nem caixa. */
export const chaveLivro = l => `${norm(l.titulo)}|${norm(l.autor || '')}`;
