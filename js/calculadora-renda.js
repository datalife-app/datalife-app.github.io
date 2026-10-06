/* ============================================
   DataLife — Calculadoras: Renda (retiradas)
   ============================================ */

import { $, COR, INFLACAO, brl, pct, mesAno, tempo, plural, campoBRL, campoNum, campoUnidade, UN_TAXA, UN_TEMPO, kpi, hero, composicao, legenda, cardGrafico, insights, cenarios, tabela, vazio, grande, link, rotuloTempo, tituloTempo } from './calculadoras-ui.js';
import { evoluir, retiradaQueZera, porAno, mensalDeAnual, anualDeMensal, mensalReal, grandeDemais, LIMITE_MESES } from './calculadoras-calc.js';
import { renderLinhas } from './calc-chart.js';

function calcRenda(v) {
  const n = Math.round(v.tempoUn === 'm' ? v.tempo : v.tempo * 12);
  if (!v.inicial) return { html: vazio('Informe o valor inicial.') };
  if (!v.retirada) return { html: vazio('Informe quanto pretende retirar por mês.') };
  if (!n) return { html: vazio('Informe o tempo de retirada.') };
  if (n > LIMITE_MESES) return { html: vazio('O tempo máximo é de 100 anos (1.200 meses).') };
  const r = v.taxaUn === 'm' ? v.taxa / 100 : mensalDeAnual(v.taxa / 100);
  const anual = anualDeMensal(r) * 100;
  const infl = v.inflacao / 100;
  const ev = evoluir({ inicial: v.inicial, retirada: v.retirada, r, meses: n, inflacaoAnual: infl });
  const final = ev.saldo[n], retirado = ev.retirado[n], juros = ev.juros[n];
  if (grandeDemais(final)) return { html: grande() };
  // Zerar no último mês é o plano (ex.: "retirada que zera no prazo"), não "acabou antes"
  const antes = ev.acabou != null && ev.acabou < n;
  const noFim = ev.acabou === n;
  const perpetua = v.inicial * r;
  // Com reajuste, "para sempre" é retirar só o rendimento acima da inflação
  const rReal = infl ? mensalReal(anual / 100, infl) : r;
  const perpetuaReal = Math.max(0, v.inicial * rReal);
  const zera = retiradaQueZera(v.inicial, n, r);
  const precisaria = rReal > 0 ? v.retirada / rReal : Infinity;
  const taxaRet = ((v.retirada * 12) / v.inicial) * 100;
  // Duração sem limite de prazo (até 100 anos), para dizer quando acabaria
  const longo = evoluir({ inicial: v.inicial, retirada: v.retirada, r, meses: LIMITE_MESES, inflacaoAnual: infl });
  const dura = longo.acabou ?? Infinity;
  const tempoTxt = v.tempoUn === 'm' ? plural(n, 'mês', 'meses') : plural(v.tempo, 'ano', 'anos');
  const cobre = perpetua / v.retirada;

  const frase = antes
    ? `O dinheiro <strong>acaba em ${tempo(ev.acabou)}</strong> (${mesAno(ev.acabou)}), antes do fim do prazo.`
    : noFim
      ? `O dinheiro <strong>zera exatamente no fim do prazo</strong>, em ${mesAno(n)}: você retira tudo, como planejado.`
      : final >= v.inicial
      ? `Mesmo retirando todo mês, você termina com <strong>mais do que começou</strong>: a retirada cabe nos juros.`
      : `Sobram ${brl(final)} no fim. Nesse ritmo, o dinheiro dura ${Number.isFinite(dura) ? tempo(dura) : 'mais de 100 anos'}.`;

  const html = `
    ${hero(`Saldo depois de ${tempoTxt}`, brl(final), frase)}
    <div class="kpis">
      ${kpi('Valor final', brl(final), antes ? `zerou em ${mesAno(ev.acabou)}` : noFim ? 'zerou no último mês' : mesAno(n), antes ? 'is-over' : '')}
      ${kpi('Total retirado', brl(retirado), infl ? `retirada reajustada ${pct(v.inflacao)} ao ano` : `${plural(ev.acabou || n, 'retirada', 'retiradas')}`)}
      ${kpi('Juros recebidos', brl(juros), `${pct(retirado ? (juros / retirado) * 100 : 0, 0)} do que você retirou`, 'is-ok')}
      ${kpi('O dinheiro dura', Number.isFinite(dura) ? tempo(dura) : 'Para sempre', Number.isFinite(dura) ? `até ${mesAno(dura)}` : 'os juros cobrem a retirada', Number.isFinite(dura) && dura < n ? 'is-over' : '')}
    </div>
    <div class="calc-dupla">
      ${composicao([{ nome: 'Saiu do seu dinheiro', v: Math.max(0, retirado - juros), cor: COR.retirado }, { nome: 'Pago pelos juros', v: Math.min(juros, retirado), cor: COR.juros }])}
    </div>
    ${cardGrafico('ch-renda', 'Saldo enquanto você retira', 'Quanto fica investido mês a mês e quanto você já retirou.',
      legenda([['Saldo investido', COR.saldo], ['Total retirado', COR.retirado, true]]))}
    ${cenarios('Quanto dá para retirar por mês', `Com ${brl(v.inicial)} a ${pct(anual, 1)} ao ano.`, [
      infl
        ? { nome: 'Para sempre, mantendo o poder de compra', v: perpetuaReal, sub: rReal > 0 ? 'só os juros acima da inflação' : 'a inflação passa do rendimento' }
        : { nome: 'Para sempre, sem tocar no valor inicial', v: perpetua, sub: 'só os juros' },
      { nome: 'A sua retirada', v: v.retirada, atual: true, sub: `${pct(taxaRet, 1)} ao ano do patrimônio` },
      { nome: `Para zerar em ${tempoTxt}`, v: zera, sub: 'gasta tudo até o fim' },
      { nome: 'Regra dos 4% ao ano', v: (v.inicial * 0.04) / 12, sub: 'referência clássica' }
    ])}
    ${insights([
      // "Cobre" olha a duração inteira (com o reajuste), não só o primeiro mês
      !Number.isFinite(dura)
        ? { tom: 'ok', titulo: 'Os juros pagam a sua retirada', texto: infl
          ? `Mesmo com o reajuste de ${pct(v.inflacao)} ao ano, os juros dão conta da retirada por pelo menos 100 anos.`
          : `No primeiro mês, os juros (${brl(perpetua)}) cobrem toda a retirada de ${brl(v.retirada)}. O valor inicial fica intacto.` }
        : cobre >= 1
          ? { tom: 'alerta', titulo: 'O reajuste come o patrimônio', texto: `No começo, os juros (${brl(perpetua)}) cobrem a retirada. Mas, subindo ${pct(v.inflacao)} por ano, ela passa dos juros e o dinheiro acaba em <strong>${tempo(dura)}</strong>. Para manter o poder de compra para sempre, a retirada inicial seria de no máximo ${brl(perpetuaReal)}.` }
          : { tom: 'alerta', titulo: 'A retirada come o patrimônio', texto: `No primeiro mês, os juros (${brl(perpetua)}) pagam ${pct(cobre * 100, 0)} da retirada; os outros ${brl(v.retirada - perpetua)} saem do patrimônio, e a conta piora a cada mês.` },
      Number.isFinite(precisaria) && precisaria > v.inicial && { tom: 'marco', titulo: 'Para viver só dos juros', texto: `Para retirar ${brl(v.retirada)} por mês para sempre${infl ? ', com reajuste pela inflação' : ''}, seriam necessários <strong>${brl(precisaria)}</strong> investidos, ${brl(precisaria - v.inicial)} a mais.` },
      { tom: taxaRet <= 4 ? 'ok' : taxaRet <= 6 ? 'dica' : 'alerta', titulo: `Você retira ${pct(taxaRet, 1)} ao ano`,
        texto: `A "regra dos 4%" diz que retirar até 4% do patrimônio por ano tende a durar 30 anos ou mais. ${taxaRet <= 4 ? 'Você está dentro.' : `Com 4%, a retirada seria de ${brl((v.inicial * 0.04) / 12)} por mês.`}` },
      !infl && { tom: 'alerta', titulo: 'E a inflação?', texto: `Sem reajuste, ${brl(v.retirada)} daqui a ${tempoTxt} compram o que ${brl(v.retirada / Math.pow(1 + INFLACAO, n / 12))} compram hoje (inflação de ${pct(INFLACAO * 100, 0)} ao ano). Preencha o reajuste para simular uma retirada que mantém o poder de compra.` },
      infl && { tom: 'dica', titulo: 'Retirada reajustada', texto: `Com ${pct(v.inflacao)} de reajuste por ano, a última retirada é de ${brl(v.retirada * Math.pow(1 + infl, Math.floor((n - 1) / 12)))}.` },
      v.taxaUn === 'a' && v.taxa >= 20 && { tom: 'alerta', titulo: 'Taxa alta', texto: 'Mais de 20% ao ano é raro de sustentar. Confira se a taxa não é ao mês.' }
    ])}
    <p class="calc-acoes">${link(`#juros?inicial=${v.inicial}`, 'Simular aportes mensais')}</p>
    ${tabela('Tabela ano a ano', ['Ano', 'Retirado no ano', 'Juros no ano', 'Total retirado', 'Saldo'],
      porAno(ev, n).map(a => [`${a.ano}º · ${mesAno(a.fim)}`, brl(a.retirado), brl(a.juros), brl(ev.retirado[a.fim]), `<strong>${brl(a.saldo)}</strong>`]))}`;

  const depois = () => renderLinhas($('ch-renda'), {
    n,
    series: [
      { nome: 'Saldo', cor: COR.saldo, v: ev.saldo, area: true },
      { nome: 'Retirado', cor: COR.retirado, v: ev.retirado, tracejada: true }
    ],
    refY: [{ v: v.inicial, rotulo: 'Valor inicial' }],
    marcos: antes ? [{ i: ev.acabou, v: 0, rotulo: 'Acabou', cor: 'var(--danger)' }] : [],
    rotuloX: rotuloTempo,
    tituloTip: tituloTempo,
    linhasTip: i => [
      { cor: COR.saldo, nome: 'Saldo', valor: brl(ev.saldo[i]) },
      { cor: COR.retirado, nome: 'Total retirado', valor: brl(ev.retirado[i]) },
      { nome: 'Juros recebidos', valor: brl(ev.juros[i]) }
    ],
    aria: `Saldo vai de ${brl(v.inicial)} para ${brl(final)} em ${tempoTxt}, com ${brl(retirado)} retirados.`
  });
  return { html, depois };
}

export default {
  id: 'renda',
  nome: 'Renda',
  icone: 'coins',
  desc: 'Retirando um valor todo mês: quanto sobra, quanto tempo o dinheiro dura e o que dá para tirar para sempre.',
  resumo: 'Simule viver de renda: o dinheiro continua rendendo enquanto você retira um valor todo mês.',
  exemplo: { inicial: 100000000, retirada: 1000000, taxa: 10, taxaUn: 'a', tempo: 10, tempoUn: 'a', inflacao: '' },
  campos: () => `
    ${campoBRL('inicial', 'Valor inicial')}
    ${campoBRL('retirada', 'Valor de retirada mensal')}
    ${campoUnidade('taxa', 'Taxa de juros (%)', 'taxaUn', UN_TAXA, { max: 100 })}
    ${campoUnidade('tempo', 'Tempo de retirada', 'tempoUn', UN_TEMPO, { max: 1200 })}
    ${campoNum('inflacao', 'Reajustar a retirada pela inflação', { sufixo: '% ao ano', max: 50, dica: 'Opcional. A retirada sobe uma vez por ano.' })}`,
  calc: calcRenda
};
