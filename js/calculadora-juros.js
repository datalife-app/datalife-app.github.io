/* ============================================
   DataLife — Calculadoras: Juros compostos
   ============================================ */

import { $, COR, brl, pct, mesAno, tempo, plural, campoBRL, campoUnidade, UN_TAXA, UN_TEMPO, kpi, hero, composicao, legenda, cardGrafico, insights, cenarios, tabela, vazio, grande, link, tituloTempo } from './calculadoras-ui.js';
import { evoluir, mesesParaDobrar, pontoDeVirada, porAno, mensalDeAnual, anualDeMensal, LIMITE_MESES, grandeDemais } from './calculadoras-calc.js';
import { renderLinhas, renderColunas } from './calc-chart.js';

function calcJuros(v) {
  const n = Math.round(v.periodoUn === 'm' ? v.periodo : v.periodo * 12);
  if (!n) return { html: vazio('Informe o período.') };
  if (n > LIMITE_MESES) return { html: vazio('O período máximo é de 100 anos (1.200 meses).') };
  if (!v.inicial && !v.mensal) return { html: vazio('Informe o valor inicial ou o valor mensal.') };
  const r = v.taxaUn === 'm' ? v.taxa / 100 : mensalDeAnual(v.taxa / 100);
  const anual = anualDeMensal(r) * 100;
  const ev = evoluir({ inicial: v.inicial, aporte: v.mensal, r, meses: n });
  const final = ev.saldo[n], inv = ev.investido[n], juros = ev.juros[n];
  if (grandeDemais(final)) return { html: grande() };
  const virada = pontoDeVirada(ev.jurosMes, v.mensal);
  const dobra = mesesParaDobrar(r);
  const mult = inv ? final / inv : 0;
  const anos = porAno(ev, n);
  const porMes = n < 24;
  const periodoTxt = v.periodoUn === 'm' ? plural(n, 'mês', 'meses') : plural(v.periodo, 'ano', 'anos');
  const adiar = n > 12 ? evoluir({ inicial: v.inicial, aporte: v.mensal, r, meses: n - 12 }).saldo[n - 12] : null;
  const anoVirada = anos.find(a => a.juros > a.aportes && a.aportes > 0);

  const html = `
    ${hero(`Valor total em ${periodoTxt}`, brl(final),
      juros > inv ? `Os juros renderam <strong>mais do que você investiu</strong>: cada R$ 1 colocado virou R$ ${mult.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}.`
        : `Cada R$ 1 investido virou R$ ${mult.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}. Com mais tempo, os juros passam a pesar mais que os aportes.`)}
    <div class="kpis">
      ${kpi('Valor total final', brl(final), mesAno(n))}
      ${kpi('Valor total investido', brl(inv))}
      ${kpi('Total em juros', brl(juros), `${pct(final ? (juros / final) * 100 : 0, 0)} do total`, 'is-ok')}
      ${kpi('Taxa equivalente', v.taxaUn === 'm' ? `${pct(anual, 2)} a.a.` : `${pct(r * 100, 3)} a.m.`, v.taxaUn === 'm' ? `${pct(v.taxa, 2)} ao mês` : `${pct(v.taxa, 2)} ao ano`)}
    </div>
    <div class="calc-dupla">
      ${composicao([{ nome: 'Valor investido', v: inv, cor: COR.investido }, { nome: 'Juros', v: juros, cor: COR.juros }])}
    </div>
    ${cardGrafico('ch-juros', 'Evolução do patrimônio', porMes ? 'Mês a mês.' : 'Ano a ano: a parte de cima de cada coluna é juros.',
      legenda([['Valor investido', COR.investido], ['Juros', COR.juros]]))}
    ${porMes ? '' : cardGrafico('ch-entradas', 'Quanto entrou em cada ano', 'Seus aportes do ano comparados aos juros que o patrimônio rendeu no mesmo ano.',
      legenda([['Aportes do ano', COR.investido], ['Juros do ano', COR.juros]]),
      anoVirada ? `A partir do ${anoVirada.ano}º ano, os juros do ano passam dos seus aportes.` : '')}
    ${insights([
      Number.isFinite(dobra) && { tom: 'dica', titulo: 'Tempo para dobrar', texto: `A ${pct(anual, 2)} ao ano, um valor parado dobra em <strong>${tempo(Math.ceil(dobra))}</strong> (a "regra do 72": 72 ÷ ${pct(anual, 1).replace('%', '')} ≈ ${(72 / anual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos).` },
      virada ? { tom: 'marco', titulo: 'Ponto de virada', texto: `A partir de ${mesAno(virada)} (${tempo(virada)}), os juros de um mês passam do seu aporte de ${brl(v.mensal)}.` }
        : v.mensal ? { tom: 'dica', titulo: 'Ponto de virada ainda longe', texto: `Os juros do último mês (${brl(ev.jurosMes[n])}) ainda são menores que o aporte de ${brl(v.mensal)}. Com o mesmo ritmo, isso muda em ${tempo(pontoDeVirada(evoluir({ inicial: v.inicial, aporte: v.mensal, r, meses: LIMITE_MESES }).jurosMes, v.mensal) ?? Infinity)}.` } : null,
      { tom: 'dica', titulo: 'Juros do último mês', texto: `No fim do período, o patrimônio rende <strong>${brl(ev.jurosMes[n])} por mês</strong> sozinho${v.mensal ? `, ${pct((ev.jurosMes[n] / v.mensal) * 100, 0)} do seu aporte` : ''}.` },
      adiar != null && { tom: 'alerta', titulo: 'O custo de adiar 1 ano', texto: `Começar 12 meses depois, terminando na mesma data, deixa <strong>${brl(final - adiar)} a menos</strong> no fim (${pct(((final - adiar) / final) * 100, 0)} do total).` },
      v.taxaUn === 'a' && v.taxa >= 20 && { tom: 'alerta', titulo: 'Taxa alta', texto: 'Mais de 20% ao ano é raro de sustentar por muito tempo. Confira se a taxa não é ao mês.' },
      v.taxaUn === 'm' && v.taxa >= 2 && { tom: 'alerta', titulo: 'Taxa mensal alta', texto: `${pct(v.taxa, 2)} ao mês são ${pct(anual, 0)} ao ano. Confira se a taxa não é ao ano.` }
    ])}
    ${cenarios('E se a taxa fosse outra?', 'Valor final com a mesma rotina de aportes.', [-2, -1, 0, 1, 2].filter(d => d >= 0 || anual + d > 0).map(d => {
      const ta = anual + d;
      const f = evoluir({ inicial: v.inicial, aporte: v.mensal, r: mensalDeAnual(ta / 100), meses: n }).saldo[n];
      return { nome: d ? `${pct(ta, 1)} ao ano` : `Seu cenário (${pct(anual, 1)} a.a.)`, v: f, atual: !d, sub: d ? `${f >= final ? '+' : '−'}${brl(Math.abs(f - final))}` : '' };
    }))}
    <p class="calc-acoes">${link(`#renda?inicial=${Math.round(final)}`, 'Simular retiradas mensais')}${link(`#milhao?inicial=${v.inicial}&mensal=${v.mensal}`, 'Ver no Primeiro milhão')}</p>
    ${tabela(porMes ? 'Tabela mês a mês' : 'Tabela ano a ano', [porMes ? 'Mês' : 'Ano', 'Juros no período', 'Total investido', 'Total em juros', 'Total acumulado'],
      porMes ? ev.saldo.slice(1).map((s, k) => [`${k + 1}º · ${mesAno(k + 1)}`, brl(ev.jurosMes[k + 1]), brl(ev.investido[k + 1]), brl(ev.juros[k + 1]), `<strong>${brl(s)}</strong>`])
        : anos.map(a => [`${a.ano}º · ${mesAno(a.fim)}`, brl(a.juros), brl(a.investido), brl(a.jurosAcum), `<strong>${brl(a.saldo)}</strong>`]))}`;

  const depois = () => {
    if (porMes) {
      renderLinhas($('ch-juros'), {
        n,
        series: [
          { nome: 'Investido', cor: COR.investido, v: ev.investido, area: true },
          { nome: 'Total', cor: COR.juros, v: ev.saldo, area: true, de: 0 }
        ],
        rotuloX: i => `${i}m`,
        tituloTip: tituloTempo,
        linhasTip: i => [
          { cor: COR.juros, nome: 'Juros', valor: brl(ev.juros[i]) },
          { cor: COR.investido, nome: 'Investido', valor: brl(ev.investido[i]) },
          { nome: 'Total', valor: brl(ev.saldo[i]), forte: true }
        ],
        aria: `Total de ${brl(final)} em ${periodoTxt}.`
      });
      return;
    }
    renderColunas($('ch-juros'), {
      fmt: brl,
      grupos: anos.map(a => ({
        rotulo: String(a.ano), titulo: `${a.ano}º ano · ${mesAno(a.fim)}`,
        partes: [{ nome: 'Valor investido', cor: COR.investido, v: a.investido }, { nome: 'Juros', cor: COR.juros, v: a.jurosAcum }],
        total: { nome: 'Total', valor: brl(a.saldo) }
      })),
      aria: `Patrimônio de ${brl(final)} ao fim de ${periodoTxt}, sendo ${brl(juros)} de juros.`
    });
    renderColunas($('ch-entradas'), {
      fmt: brl,
      altura: 220,
      grupos: anos.map(a => ({
        rotulo: String(a.ano), titulo: `${a.ano}º ano`,
        partes: [{ nome: 'Aportes do ano', cor: COR.investido, v: a.aportes }, { nome: 'Juros do ano', cor: COR.juros, v: a.juros }],
        total: { nome: 'Entrou no ano', valor: brl(a.aportes + a.juros) }
      })),
      aria: `No último ano, os juros somaram ${brl(anos[anos.length - 1].juros)}.`
    });
  };
  return { html, depois };
}

export default {
  id: 'juros',
  nome: 'Juros compostos',
  icone: 'percent',
  desc: 'Juros sobre juros: quanto o dinheiro rende com aportes, e quanto disso veio de você.',
  resumo: 'Quanto vira o seu dinheiro com aportes todo mês. Cuidado com a unidade: 12% ao ano equivalem a 0,95% ao mês, e 1% ao mês a 12,68% ao ano.',
  exemplo: { inicial: 100000, mensal: 100000, taxa: 8, taxaUn: 'a', periodo: 20, periodoUn: 'a' },
  campos: () => `
    ${campoBRL('inicial', 'Valor inicial')}
    ${campoBRL('mensal', 'Valor mensal')}
    ${campoUnidade('taxa', 'Taxa de juros (%)', 'taxaUn', UN_TAXA, { max: 100 })}
    ${campoUnidade('periodo', 'Período', 'periodoUn', UN_TEMPO, { max: 1200 })}`,
  calc: calcJuros
};
