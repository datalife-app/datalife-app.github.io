/* ============================================
   DataLife — Diário: cálculos
   ============================================
   Funções puras (sem DOM nem banco). Datas como "YYYY-MM-DD".
   ============================================ */

const pad = n => String(n).padStart(2, '0');
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };

/**
 * Sequência de dias seguidos com entrada, terminando hoje (ou ontem: o dia
 * de hoje ainda pode ser escrito sem "quebrar" a sequência).
 * @param {Set<string>|Map} dias
 */
export function sequencia(dias, hoje) {
  let k = dias.has(hoje) ? hoje : shift(hoje, -1);
  let n = 0;
  while (dias.has(k)) { n++; k = shift(k, -1); }
  return n;
}

/** Maior sequência já feita. */
export function maiorSequencia(dias) {
  const ord = [...dias.keys ? dias.keys() : dias].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of ord) {
    cur = prev && shift(prev, 1) === k ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}

/**
 * "Neste dia": a mesma data em anos anteriores, e o mesmo dia do mês passado.
 * @returns {Array<{key:string, rotulo:string}>} só datas que têm entrada
 */
export function nesteDia(entradas, dia) {
  const d = fromKey(dia);
  const out = [];
  for (let a = 1; a <= 10; a++) {
    const k = `${d.getFullYear() - a}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (entradas.has(k)) out.push({ key: k, rotulo: a === 1 ? 'Há 1 ano' : `Há ${a} anos` });
  }
  const mes = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  // 31/03 -> "um mês atrás" não existe em fevereiro: pula
  if (mes.getDate() === d.getDate()) {
    const k = toKey(mes);
    if (entradas.has(k)) out.unshift({ key: k, rotulo: 'Há 1 mês' });
  }
  return out;
}

/* ---------- Perguntas do dia ---------- */

export const PERGUNTAS = [
  'Como foi o seu dia, em três frases?',
  'O que te deixou orgulhoso hoje?',
  'O que você aprendeu hoje?',
  'Qual foi o melhor momento do dia?',
  'O que você faria diferente hoje?',
  'Com quem você conversou hoje, e o que ficou dessa conversa?',
  'O que está ocupando a sua cabeça agora?',
  'O que te deu energia hoje? E o que tirou?',
  'Que pequena coisa deixou o dia melhor?',
  'O que você quer lembrar deste dia daqui a um ano?',
  'Qual decisão de hoje fez diferença?',
  'Como você cuidou de si hoje?',
  'O que te surpreendeu hoje?',
  'O que você está esperando para amanhã?'
];

/** Pergunta estável para cada dia (muda de dia para dia, não a cada recarga). */
export function perguntaDoDia(dia, deslocamento = 0) {
  const [y, m, d] = dia.split('-').map(Number);
  const seed = y * 372 + m * 31 + d;
  return PERGUNTAS[(seed + deslocamento) % PERGUNTAS.length];
}

/* ---------- Busca ---------- */

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Busca no texto, nas gratidões e nas atividades (sem acento, sem caixa).
 * @returns {Array<{key, trecho}>} mais recentes primeiro
 */
export function buscar(entradas, termo, max = 30) {
  const q = norm(termo.trim());
  if (q.length < 2) return [];
  const out = [];
  for (const [key, e] of [...entradas].sort(([a], [b]) => b.localeCompare(a))) {
    const campos = [e.texto, ...e.gratidao, e.tags.join(' ')];
    const alvo = campos.find(c => norm(c).includes(q));
    if (!alvo) continue;
    const i = norm(alvo).indexOf(q);
    const ini = Math.max(0, i - 40);
    const trecho = (ini ? '…' : '') + alvo.slice(ini, i + q.length + 60).replace(/\s+/g, ' ').trim() + (i + q.length + 60 < alvo.length ? '…' : '');
    out.push({ key, trecho });
    if (out.length >= max) break;
  }
  return out;
}

/** Atividades mais marcadas e humor médio quando aparecem (correlação simples, como no Daylio). */
export function atividades(entradas, ano) {
  const m = new Map();
  for (const [key, e] of entradas) {
    if (ano && !key.startsWith(`${ano}-`)) continue;
    for (const t of e.tags) {
      const cur = m.get(t) || { n: 0, soma: 0, comHumor: 0 };
      cur.n++;
      if (e.humor) { cur.soma += e.humor; cur.comHumor++; }
      m.set(t, cur);
    }
  }
  return [...m].map(([tag, v]) => ({ tag, n: v.n, humor: v.comHumor ? v.soma / v.comHumor : 0 }))
    .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

export const contarPalavras = s => (s.trim() ? s.trim().split(/\s+/).length : 0);
