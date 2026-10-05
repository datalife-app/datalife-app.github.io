/* ============================================
   DataLife — Objetivos: cálculos
   ============================================
   Funções puras (sem DOM nem banco). Valores em centavos.

   Convenções
   - Meses como "YYYY-MM". O saldo de hoje já inclui o que foi guardado
     neste mês; os aportes planejados são os dos meses seguintes, até o
     mês do prazo: com prazo em dezembro e hoje em outubro, sobram 2
     (nov, dez). Prazo no mês atual: o que falta precisa entrar agora.
   - Rendimento composto mensal a partir da taxa anual: (1 + a)^(1/12) − 1.
   - Saldo = aportes − resgates + rendimentos. "Investido" ignora rendimentos.
   ============================================ */

export const MARCOS = [25, 50, 75, 100];
const LIMITE_MESES = 1200; // 100 anos: além disso, "não chega"

/* ---------- Meses ---------- */

export const mesDe = iso => iso.slice(0, 7);

export function mesesEntre(de, ate) {
  const [y1, m1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function somaMeses(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 27 -> "2 anos e 3 meses" */
export function duracao(meses) {
  if (!Number.isFinite(meses)) return 'mais de 100 anos';
  if (meses <= 0) return 'este mês';
  const a = Math.floor(meses / 12), m = meses % 12;
  const pa = a ? `${a} ${a === 1 ? 'ano' : 'anos'}` : '';
  const pm = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  return [pa, pm].filter(Boolean).join(' e ');
}

/* ---------- Juros ---------- */

/** Taxa anual em pontos-base (1000 = 10% a.a.) -> taxa mensal decimal. */
export const taxaMensal = bps => (bps > 0 ? Math.pow(1 + bps / 10000, 1 / 12) - 1 : 0);

/** Quanto guardar por mês, por `n` meses, para ir de `saldo` a `alvo`. */
export function aporteNecessario(saldo, alvo, n, r) {
  if (saldo >= alvo) return 0;
  if (n <= 0) return alvo - saldo;
  if (r === 0) return Math.ceil((alvo - saldo) / n);
  const f = Math.pow(1 + r, n);
  return Math.max(0, Math.ceil(((alvo - saldo * f) * r) / (f - 1)));
}

/** Meses até `saldo` chegar em `alvo` guardando `mensal` por mês (Infinity se não chega). */
export function mesesAte(saldo, alvo, mensal, r) {
  if (saldo >= alvo) return 0;
  if (mensal <= 0 && (r === 0 || saldo <= 0)) return Infinity;
  let s = saldo;
  for (let m = 1; m <= LIMITE_MESES; m++) {
    s = s * (1 + r) + mensal;
    if (s >= alvo) return m;
  }
  return Infinity;
}

/* ---------- Movimentos ---------- */

export const sinal = tipo => (tipo === 'resgate' ? -1 : 1);

export function ordenar(movs) {
  return [...movs].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

export function totais(movs) {
  let aportes = 0, resgates = 0, rendimentos = 0;
  for (const m of movs) {
    if (m.tipo === 'aporte') aportes += m.valor;
    else if (m.tipo === 'resgate') resgates += m.valor;
    else rendimentos += m.valor;
  }
  return { aportes, resgates, rendimentos, investido: aportes - resgates, saldo: aportes - resgates + rendimentos };
}

/** Saldo no fim de cada mês, do primeiro movimento até `ate`: [{key, saldo, investido}]. */
export function serieMensal(movs, ate) {
  if (!movs.length) return [];
  const ord = ordenar(movs);
  const inicio = mesDe(ord[0].data);
  const fim = ate > inicio ? ate : inicio;
  const out = [];
  let i = 0, saldo = 0, investido = 0;
  for (let key = inicio; key <= fim; key = somaMeses(key, 1)) {
    while (i < ord.length && mesDe(ord[i].data) <= key) {
      const m = ord[i++];
      saldo += sinal(m.tipo) * m.valor;
      if (m.tipo !== 'rendimento') investido += sinal(m.tipo) * m.valor;
    }
    out.push({ key, saldo, investido });
  }
  return out;
}

/** Projeção do saldo a partir do mês seguinte a `de`: [{key, saldo}] por `n` meses. */
export function projetar(saldo, mensal, r, de, n) {
  const out = [];
  let s = saldo;
  for (let i = 1; i <= n; i++) {
    s = s * (1 + r) + mensal;
    out.push({ key: somaMeses(de, i), saldo: Math.round(s) });
  }
  return out;
}

/** Data (ISO) em que cada marco foi atingido pela primeira vez, ou null. */
export function marcosAtingidos(movs, alvo) {
  const datas = Object.fromEntries(MARCOS.map(p => [p, null]));
  let saldo = 0;
  for (const m of ordenar(movs)) {
    saldo += sinal(m.tipo) * m.valor;
    for (const p of MARCOS) {
      if (!datas[p] && saldo >= Math.ceil((alvo * p) / 100)) datas[p] = m.data;
    }
  }
  return datas;
}

/**
 * Aportes líquidos (aportes − resgates) por mês, média dos últimos `n` meses até `hoje` (inclusive).
 * O saldo que já existia ao criar o objetivo (`inicial`) não é ritmo: fica de fora.
 */
export function ritmoReal(movs, hoje, n = 3) {
  const desde = somaMeses(hoje, -(n - 1));
  const liquido = movs
    .filter(m => m.tipo !== 'rendimento' && !m.inicial && mesDe(m.data) >= desde && mesDe(m.data) <= hoje)
    .reduce((a, m) => a + sinal(m.tipo) * m.valor, 0);
  return Math.round(liquido / n);
}

/* ---------- Resumo de um objetivo ---------- */

/**
 * @param {{alvo:number, prazo:string, mensal:number, taxa:number, movimentos:Array}} obj
 * @param {string} hoje "YYYY-MM"
 * @returns {{
 *   saldo:number, investido:number, rendimentos:number, pct:number, falta:number,
 *   meses:number, necessario:number, previstoEm:number, previsto:string|null,
 *   status:'concluido'|'vencido'|'no-ritmo'|'atrasado'|'sem-plano', folga:number
 * }}
 *   meses: aportes que ainda cabem até o prazo (0 = prazo é este mês ou já passou)
 *   previstoEm: aportes a partir de hoje para chegar no alvo com o plano `mensal`
 *   folga: meses de sobra (+) ou de atraso (−) da previsão em relação ao prazo
 */
export function resumir(obj, hoje) {
  const t = totais(obj.movimentos);
  const r = taxaMensal(obj.taxa);
  const saldo = Math.max(0, t.saldo);
  const diff = mesesEntre(hoje, obj.prazo);
  const meses = Math.max(0, diff);
  const necessario = aporteNecessario(saldo, obj.alvo, meses, r);
  const previstoEm = mesesAte(saldo, obj.alvo, obj.mensal, r);
  const previsto = Number.isFinite(previstoEm) ? somaMeses(hoje, previstoEm) : null;
  const folga = previsto ? mesesEntre(previsto, obj.prazo) : -Infinity;

  let status;
  if (saldo >= obj.alvo) status = 'concluido';
  else if (diff < 0) status = 'vencido';
  else if (obj.mensal <= 0) status = 'sem-plano';
  else status = folga >= 0 ? 'no-ritmo' : 'atrasado';

  return {
    saldo,
    investido: t.investido,
    rendimentos: t.rendimentos,
    pct: obj.alvo ? Math.min(100, (saldo / obj.alvo) * 100) : 0,
    falta: Math.max(0, obj.alvo - saldo),
    meses,
    necessario,
    previstoEm,
    previsto: saldo >= obj.alvo ? null : previsto,
    status,
    folga
  };
}

/* ---------- Texto ---------- */

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2030-12" -> "dez/2030" */
export function mesCurto(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MES_CURTO[m - 1]}/${y}`;
}

/** Folga em relação ao prazo: "2 meses antes do prazo" | "no prazo" | "1 ano depois do prazo" */
export function folgaLabel(folga) {
  if (!Number.isFinite(folga)) return 'sem previsão';
  if (folga === 0) return 'bem no prazo';
  return `${duracao(Math.abs(folga))} ${folga > 0 ? 'antes' : 'depois'} do prazo`;
}
