/* ============================================
   DataLife — Calculadoras: Aposentadoria
   ============================================ */

import { $, COR, INFLACAO, brl, pct, mesAno, tempo, campoBRL, campoNum, kpi, hero, legenda, cardGrafico, insights, cenarios, tabela, vazio, grande, aviso, link } from './calculadoras-ui.js';
import { evoluir, mesesAte, aporteNecessario, retiradaQueZera, valorPresente, mensalDeAnual, grandeDemais } from './calculadoras-calc.js';
import { renderLinhas } from './calc-chart.js';

function fases(v, taxa) {
  const r = mensalDeAnual(taxa / 100);
  const n1 = Math.max(0, Math.round((v.idadeApos - v.idade) * 12));
  const n2 = Math.max(0, Math.round((v.idadeFim - v.idadeApos) * 12));
  const aporte = (v.renda * v.pctRenda) / 100;
  const acc = evoluir({ inicial: v.investido, aporte, r, meses: n1 });
  const p = acc.saldo[n1];
  const dd = evoluir({ inicial: p, retirada: v.gasto, r, meses: n2 });
  return {
    r, n1, n2, aporte, acc, dd, p,
    saldo: [...acc.saldo, ...dd.saldo.slice(1)],
    heranca: dd.saldo[n2],
    // Zerar exatamente no fim do plano não é "acabar": só conta se faltar dinheiro antes
    acabou: dd.acabou != null && dd.acabou < n2 ? dd.acabou : null
  };
}

function calcAposentadoria(v) {
  if (!v.idade || !v.idadeApos) return { html: vazio('Informe a sua idade e a idade em que quer se aposentar.') };
  if (v.idadeApos <= v.idade) return { html: vazio('A idade de aposentadoria precisa ser maior que a idade atual.') };
  const fimInformado = v.idadeFim;
  const ajustouFim = !v.idadeFim || v.idadeFim <= v.idadeApos;
  if (ajustouFim) v.idadeFim = Math.max(v.idadeApos + 1, 90);
  const b = fases(v, v.taxa);
  const { r, n1, n2, aporte, p } = b;
  const n = n1 + n2;
  const anosAte = n1 / 12;
  const mMeta = v.meta ? mesesAte(v.investido, v.meta, aporte, r) : null;
  const aporteMeta = v.meta ? aporteNecessario(v.investido, v.meta, n1, r) : 0;
  const rendaPassiva = p * r;
  const viverDeJuros = r ? v.gasto / r : Infinity;
  const zerarNoFim = valorPresente(v.gasto, n2, r);
  const aporteJuros = Number.isFinite(viverDeJuros) ? aporteNecessario(v.investido, viverDeJuros, n1, r) : Infinity;
  const pess = fases(v, Math.max(0, v.taxa - 2));
  const otim = fases(v, v.taxa + 2);
  if (grandeDemais(Math.max(...otim.saldo))) return { html: grande() };
  const idadeEm = i => v.idade + i / 12;
  const idadeTxt = i => `${Math.floor(idadeEm(i))} anos`;
  const batemeta = v.meta ? p >= v.meta : null;
  const dura = b.acabou ? idadeTxt(n1 + b.acabou) : null;

  const frase = b.acabou
    ? `Gastando ${brl(v.gasto)} por mês, o dinheiro <strong>acaba aos ${dura}</strong>. ${batemeta === false ? `E fica ${brl(v.meta - p)} abaixo da meta.` : ''}`
    : `Gastando ${brl(v.gasto)} por mês, o dinheiro dura até os ${v.idadeFim} anos e ainda <strong>deixa ${brl(b.heranca)} de herança</strong>.`;

  const html = `
    ${ajustouFim ? aviso(fimInformado ? `"Planejar até" (${fimInformado} anos) precisa ser depois da aposentadoria: a conta usa ${v.idadeFim} anos.` : `Sem "planejar até", a conta vai até os ${v.idadeFim} anos.`) : ''}
    ${hero(`Patrimônio aos ${v.idadeApos} anos`, brl(p), frase,
      v.meta ? `<div class="calc-hero-prog ${batemeta ? 'is-ok' : ''}" title="${pct(Math.min(100, (p / v.meta) * 100), 0)} da meta"><i style="transform:scaleX(${Math.min(1, p / v.meta)})"></i></div>
        <span class="calc-hero-sub">${batemeta ? `Meta de ${brl(v.meta)} batida${Number.isFinite(mMeta) ? ` aos ${idadeTxt(mMeta)}` : ''}` : `${pct((p / v.meta) * 100, 0)} da meta de ${brl(v.meta)}`}</span>` : '')}
    <div class="kpis">
      ${kpi('Você investe por mês', brl(aporte), `${pct(v.pctRenda, 0)} de ${brl(v.renda)}`)}
      ${kpi('Investimento necessário', v.meta ? brl(aporteMeta) : '—', !v.meta ? 'informe a meta' : aporteMeta ? `por mês, para ${brl(v.meta)} aos ${v.idadeApos}` : 'o que você já tem chega lá sozinho', v.meta && aporteMeta > aporte ? 'is-over' : v.meta ? 'is-ok' : '')}
      ${kpi('Renda passiva aposentado', brl(rendaPassiva), `só os juros, por mês · ${pct(v.gasto ? (rendaPassiva / v.gasto) * 100 : 0, 0)} do gasto`)}
      ${kpi(b.acabou ? 'O dinheiro acaba' : `Herança aos ${v.idadeFim}`, b.acabou ? `aos ${dura}` : brl(b.heranca), b.acabou ? `${tempo(b.acabou)} depois de parar` : 'o que sobra no fim', b.acabou ? 'is-over' : 'is-ok')}
    </div>
    ${cardGrafico('ch-apos', 'Sua vida financeira', `Acumulando até os ${v.idadeApos} e vivendo do patrimônio até os ${v.idadeFim}. As linhas tracejadas mostram 2 pontos a menos e a mais de rentabilidade.`,
      legenda([['Patrimônio', COR.saldo], [`${pct(Math.max(0, v.taxa - 2))} a.a.`, COR.pessimista, true], [`${pct(v.taxa + 2)} a.a.`, COR.otimista, true]]))}
    ${cenarios('Na aposentadoria: renda × gasto', 'Quanto o patrimônio paga por mês só com juros, comparado ao que você quer gastar.', [
      { nome: 'O que você quer gastar', v: v.gasto, atual: true },
      { nome: `Juros do patrimônio (${pct(v.taxa)} a.a.)`, v: rendaPassiva, sub: rendaPassiva >= v.gasto ? 'cobre o gasto' : `faltam ${brl(v.gasto - rendaPassiva)}` },
      { nome: `Cenário pessimista (${pct(Math.max(0, v.taxa - 2))} a.a.)`, v: pess.p * pess.r, sub: pess.p * pess.r >= v.gasto ? 'cobre o gasto' : `faltam ${brl(v.gasto - pess.p * pess.r)}` },
      { nome: 'Sua renda de hoje', v: v.renda }
    ])}
    ${cenarios('De quanto você precisa', `Patrimônio necessário aos ${v.idadeApos} anos para gastar ${brl(v.gasto)} por mês.`, [
      { nome: 'Viver só dos juros (nunca acaba)', v: viverDeJuros, sub: Number.isFinite(aporteJuros) ? `${brl(aporteJuros)}/mês a partir de hoje` : '' },
      { nome: `Gastar tudo até os ${v.idadeFim}`, v: zerarNoFim, sub: `${brl(aporteNecessario(v.investido, zerarNoFim, n1, r))}/mês a partir de hoje` },
      v.meta ? { nome: 'Sua meta', v: v.meta } : null,
      { nome: 'Você vai ter', v: p, atual: true }
    ].filter(Boolean))}
    ${insights([
      v.meta && Number.isFinite(mMeta) && { tom: mMeta <= n1 ? 'ok' : 'alerta', titulo: mMeta <= n1 ? `A meta chega aos ${idadeTxt(mMeta)}` : `A meta só chega aos ${idadeTxt(mMeta)}`,
        texto: mMeta <= n1 ? `Investindo ${brl(aporte)} por mês, você bate ${brl(v.meta)} ${tempo(n1 - mMeta)} antes do planejado. Dá para pensar em parar mais cedo.`
          : `Para chegar aos ${v.idadeApos} anos, o aporte precisaria subir para <strong>${brl(aporteMeta)}</strong> por mês (${pct(v.renda ? (aporteMeta / v.renda) * 100 : 0, 0)} da renda).` },
      v.meta && !Number.isFinite(mMeta) && { tom: 'alerta', titulo: 'A meta não chega', texto: `Com ${brl(aporte)} por mês, ${brl(v.meta)} não chega em 100 anos.` },
      { tom: rendaPassiva >= v.gasto ? 'ok' : 'dica', titulo: rendaPassiva >= v.gasto ? 'Dá para viver só de renda' : 'Os juros não cobrem o gasto',
        texto: rendaPassiva >= v.gasto ? `Os juros do patrimônio (${brl(rendaPassiva)} por mês) pagam o gasto sem consumir o principal.`
          : `Os juros pagam ${brl(rendaPassiva)} por mês; o resto (${brl(v.gasto - rendaPassiva)}) sai do patrimônio. ${Number.isFinite(viverDeJuros) ? `Para viver só dos juros, você precisaria de ${brl(viverDeJuros)}.` : 'Com rentabilidade de 0%, não existe viver de juros: todo gasto sai do patrimônio.'}` },
      b.acabou && { tom: 'alerta', titulo: `O dinheiro acaba aos ${dura}`, texto: `Para durar até os ${v.idadeFim}, o gasto mensal teria de ser no máximo <strong>${brl(retiradaQueZera(p, n2, r))}</strong>, ou o patrimônio aos ${v.idadeApos} teria de chegar a ${brl(zerarNoFim)}.` },
      { tom: 'dica', titulo: 'Cada ano a mais trabalhando', texto: (() => {
        const mais = fases({ ...v, idadeApos: v.idadeApos + 1, idadeFim: Math.max(v.idadeFim, v.idadeApos + 2) }, v.taxa);
        return `Aposentar aos ${v.idadeApos + 1} em vez de ${v.idadeApos} soma <strong>${brl(mais.p - p)}</strong> ao patrimônio: um ano a mais de aportes e de juros, e um ano a menos de gastos.`;
      })() },
      { tom: 'dica', titulo: 'Os 2 pontos que fazem diferença', texto: `Com ${pct(Math.max(0, v.taxa - 2))} ao ano, você se aposentaria com ${brl(pess.p)}; com ${pct(v.taxa + 2)}, com ${brl(otim.p)}. Taxas e custos baixos importam tanto quanto o aporte.` },
      v.gasto > v.renda && { tom: 'alerta', titulo: 'Gasto acima da renda atual', texto: `Você planeja gastar ${brl(v.gasto)} por mês, mais do que ganha hoje (${brl(v.renda)}). Se a rentabilidade for nominal, lembre que a inflação também sobe o custo de vida.` },
      v.taxa > 8 && { tom: 'alerta', titulo: 'Rentabilidade nominal ou real?', texto: `${pct(v.taxa)} ao ano parece incluir a inflação. Nesse caso, o patrimônio aos ${v.idadeApos} vale, em dinheiro de hoje, cerca de ${brl(p / Math.pow(1 + INFLACAO, anosAte))}. Para ver tudo em valores de hoje, use a rentabilidade acima da inflação (4% a 6% é uma conta prudente).` }
    ])}
    <p class="calc-acoes">${link(`#renda?inicial=${Math.round(p)}&retirada=${v.gasto}&tempo=${v.idadeFim - v.idadeApos}`, 'Simular as retiradas na aposentadoria')}</p>
    ${tabela('Tabela por idade', ['Idade', 'Aportes no ano', 'Retirado no ano', 'Juros no ano', 'Patrimônio'],
      (() => {
        // Acumulados na linha do tempo inteira (as duas fases emendadas)
        const jurosAte = i => (i <= n1 ? b.acc.juros[i] : b.acc.juros[n1] + b.dd.juros[i - n1]);
        const retiradoAte = i => (i <= n1 ? 0 : b.dd.retirado[i - n1]);
        const linhas = [];
        for (let a = 1; a * 12 <= n; a++) {
          const fim = a * 12, ini = fim - 12;
          const aportes = Math.max(0, Math.min(fim, n1) - ini) * aporte;
          const ret = retiradoAte(fim) - retiradoAte(ini);
          const juros = jurosAte(fim) - jurosAte(ini);
          linhas.push([`${Math.floor(idadeEm(fim))} anos${fim === n1 ? ' · aposenta' : ''}`, brl(aportes), brl(ret), brl(juros), `<strong>${brl(b.saldo[fim])}</strong>`]);
        }
        return linhas;
      })())}`;

  const depois = () => renderLinhas($('ch-apos'), {
    n,
    altura: 300,
    inicioX: Math.round(v.idade * 12),
    series: [
      { nome: 'Patrimônio', cor: COR.saldo, v: b.saldo, area: true },
      { nome: 'Pessimista', cor: COR.pessimista, v: pess.saldo, tracejada: true, foraDaEscala: true, rotulo: `${pct(Math.max(0, v.taxa - 2))}` },
      { nome: 'Otimista', cor: COR.otimista, v: otim.saldo, tracejada: true, foraDaEscala: true, rotulo: `${pct(v.taxa + 2)}` }
    ],
    refY: v.meta && v.meta <= Math.max(...b.saldo) * 1.5 ? [{ v: v.meta, rotulo: 'Meta' }] : [],
    refX: [{ i: n1, rotulo: `Aposentadoria (${v.idadeApos})` }],
    marcos: [
      ...(v.meta && Number.isFinite(mMeta) && mMeta > 0 && mMeta <= n1 ? [{ i: mMeta, v: b.saldo[mMeta], rotulo: `Meta aos ${Math.floor(idadeEm(mMeta))}`, cor: 'var(--text)' }] : []),
      ...(b.acabou ? [{ i: n1 + b.acabou, v: 0, rotulo: `Acaba aos ${Math.floor(idadeEm(n1 + b.acabou))}`, cor: 'var(--danger)' }] : [])
    ],
    rotuloX: i => String(Math.round(idadeEm(i))),
    tituloTip: i => `${idadeTxt(i)} · ${mesAno(i)}${i <= n1 ? '' : ' · aposentado'}`,
    linhasTip: i => [
      { cor: COR.saldo, nome: 'Patrimônio', valor: brl(b.saldo[i]) },
      { cor: COR.otimista, nome: `Com ${pct(v.taxa + 2)} a.a.`, valor: brl(otim.saldo[i]) },
      { cor: COR.pessimista, nome: `Com ${pct(Math.max(0, v.taxa - 2))} a.a.`, valor: brl(pess.saldo[i]) }
    ],
    aria: `Patrimônio chega a ${brl(p)} aos ${v.idadeApos} anos e termina em ${brl(b.heranca)} aos ${v.idadeFim}.`
  });
  return { html, depois };
}

export default {
  id: 'aposentadoria',
  nome: 'Aposentadoria',
  icone: 'hourglass',
  desc: 'Quanto investir por mês, com quanto você se aposenta, quanto tempo dura e a herança que fica.',
  resumo: 'Duas fases: até a aposentadoria você investe parte da renda; depois, vive do patrimônio. Use a rentabilidade acima da inflação para ver tudo em dinheiro de hoje.',
  exemplo: { renda: 500000, investido: 5000000, meta: 100000000, pctRenda: 20, idade: 30, idadeApos: 65, taxa: 10, gasto: 1000000, idadeFim: 90 },
  campos: () => `
    ${campoBRL('renda', 'Quanto você ganha por mês?')}
    ${campoBRL('investido', 'Quanto você já tem investido?')}
    ${campoBRL('meta', 'Com quanto de patrimônio você quer se aposentar?')}
    ${campoNum('pctRenda', 'Quantos % da sua renda você investe?', { sufixo: '%', max: 100 })}
    ${campoNum('idade', 'Qual sua idade atual?', { sufixo: 'anos', max: 110 })}
    ${campoNum('idadeApos', 'Com quantos anos deseja se aposentar?', { sufixo: 'anos', max: 110 })}
    ${campoNum('taxa', 'Sua rentabilidade total anual projetada', { sufixo: '% ao ano', max: 100 })}
    ${campoBRL('gasto', 'Quanto pretende gastar por mês aposentado?')}
    ${campoNum('idadeFim', 'Planejar até que idade?', { sufixo: 'anos', max: 120, dica: 'O que sobrar nessa idade é a herança.' })}`,
  calc: calcAposentadoria
};
