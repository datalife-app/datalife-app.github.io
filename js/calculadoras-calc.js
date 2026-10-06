/* ============================================
   DataLife — Calculadoras: cálculos
   ============================================
   Funções puras (sem DOM nem banco). Valores em centavos (float por
   dentro; arredonda-se só na hora de mostrar).

   Convenções
   - Taxa anual -> mensal equivalente: (1 + a)^(1/12) − 1 (12% a.a. =
     0,95% a.m.), a mesma dos Objetivos.
   - Mês a mês: primeiro rende, depois entra o aporte e sai a retirada
     (os dois no fim do mês). O mês 0 é hoje, antes de qualquer aporte.
   - Retirada corrigida pela inflação: reajustada uma vez por ano.
   ============================================ */

import { mesesAte, aporteNecessario } from './objetivos-calc.js';

// Mesmas contas dos Objetivos (aporte necessário arredondado para cima, em centavos)
export { mesesAte, aporteNecessario };

export const LIMITE_MESES = 1200; // 100 anos
/** Acima de R$ 1 quatrilhão a conta deixa de fazer sentido (e logo estoura o float). */
export const LIMITE_VALOR = 1e17;
export const grandeDemais = c => !Number.isFinite(c) || c > LIMITE_VALOR;

export const mensalDeAnual = a => (a ? Math.pow(1 + a, 1 / 12) - 1 : 0);
export const anualDeMensal = m => (m ? Math.pow(1 + m, 12) - 1 : 0);

/**
 * Evolução mês a mês.
 * @returns {{saldo:number[], investido:number[], juros:number[], jurosMes:number[], retirado:number[], acabou:number|null}}
 *   arrays de 0..meses (acumulados, exceto jurosMes); `acabou` = mês em que o saldo zerou.
 */
export function evoluir({ inicial = 0, aporte = 0, retirada = 0, r = 0, meses, inflacaoAnual = 0 }) {
  const saldo = [inicial], investido = [inicial], juros = [0], jurosMes = [0], retirado = [0];
  let s = inicial, inv = inicial, j = 0, ret = 0, acabou = null;
  for (let m = 1; m <= meses; m++) {
    const jm = s > 0 ? s * r : 0;
    s += jm + aporte;
    j += jm;
    inv += aporte;
    if (retirada > 0 && s > 0) {
      const quer = retirada * Math.pow(1 + inflacaoAnual, Math.floor((m - 1) / 12));
      const pago = Math.min(quer, s);
      s -= pago;
      ret += pago;
      if (pago < quer || s < 1) { s = 0; acabou ??= m; }
    }
    saldo.push(s); investido.push(inv); juros.push(j); jurosMes.push(jm); retirado.push(ret);
  }
  return { saldo, investido, juros, jurosMes, retirado, acabou };
}

/** Valor futuro de `p` com `a` por mês por `n` meses (fórmula fechada; o mesmo que evoluir). */
export const valorFuturo = (p, a, r, n) => (r ? p * Math.pow(1 + r, n) + (a * (Math.pow(1 + r, n) - 1)) / r : p + a * n);

/** Taxa mensal real: o que sobra da taxa anual depois da inflação anual. */
export const mensalReal = (anual, inflacao) => mensalDeAnual((1 + anual) / (1 + inflacao) - 1);

/** Retirada mensal que zera `p` em exatamente `n` meses. */
export function retiradaQueZera(p, n, r) {
  if (n <= 0) return p;
  if (!r) return p / n;
  return (p * r) / (1 - Math.pow(1 + r, -n));
}

/** Quanto é preciso ter hoje para retirar `w` por `n` meses e zerar no fim. */
export function valorPresente(w, n, r) {
  if (!r) return w * n;
  return (w * (1 - Math.pow(1 + r, -n))) / r;
}

/** Meses para o dinheiro dobrar sem aportes. */
export const mesesParaDobrar = r => (r > 0 ? Math.log(2) / Math.log(1 + r) : Infinity);

/** Primeiro mês em que os juros do mês passam do aporte (null se não acontece). */
export function pontoDeVirada(jurosMes, aporte) {
  if (aporte <= 0) return null;
  const i = jurosMes.findIndex((j, m) => m > 0 && j >= aporte);
  return i > 0 ? i : null;
}

/** Totais por ano (índice 1 = 1º ano) a partir de uma evolução. */
export function porAno(ev, meses) {
  const anos = [];
  for (let a = 1; a * 12 <= meses + 11; a++) {
    const fim = Math.min(a * 12, meses), ini = (a - 1) * 12;
    anos.push({
      ano: a,
      fim,
      aportes: ev.investido[fim] - ev.investido[ini],
      juros: ev.juros[fim] - ev.juros[ini],
      retirado: ev.retirado[fim] - ev.retirado[ini],
      investido: ev.investido[fim],
      jurosAcum: ev.juros[fim],
      saldo: ev.saldo[fim]
    });
  }
  return anos;
}
