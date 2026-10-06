/* ============================================
   DataLife — Calculadoras: Primeiro milhão
   ============================================ */

import { $, COR, MILHAO, INFLACAO, brl, pct, mesAno, tempo, plural, campoBRL, campoNum, kpi, hero, composicao, legenda, cardGrafico, insights, cenarios, tabela, vazio, grande, link, rotuloTempo, tituloTempo } from './calculadoras-ui.js';
import { evoluir, mesesAte, aporteNecessario, pontoDeVirada, porAno, mensalDeAnual, grandeDemais } from './calculadoras-calc.js';
import { renderLinhas } from './calc-chart.js';
import { duracao } from './objetivos-calc.js';

function calcMilhao(v) {
  const n = Math.round(v.anos * 12);
  if (!n) return { html: vazio('Informe o período em anos.') };
  if (!v.inicial && !v.mensal) return { html: vazio('Informe o valor inicial ou o valor mensal.') };
  const r = mensalDeAnual(v.taxa / 100);
  const ev = evoluir({ inicial: v.inicial, aporte: v.mensal, r, meses: n });
  const final = ev.saldo[n], inv = ev.investido[n], juros = ev.juros[n];
  if (grandeDemais(final)) return { html: grande() };
  const jurosUlt = ev.jurosMes[n], renda = jurosUlt * 0.25;
  const mMilhao = mesesAte(v.inicial, MILHAO, v.mensal, r);
  const aporteMi = aporteNecessario(v.inicial, MILHAO, n, r);
  const virada = pontoDeVirada(ev.jurosMes, v.mensal);
  const hoje = final / Math.pow(1 + INFLACAO, n / 12);

  // Marcos do caminho até o milhão (e o tempo entre um e outro)
  const MARCOS = [[10_000_000, '100 mil'], [25_000_000, '250 mil'], [50_000_000, '500 mil'], [MILHAO, '1 milhão']];
  const marcos = MARCOS.map(([alvo, nome]) => ({ alvo, nome, m: mesesAte(v.inicial, alvo, v.mensal, r) }));
  const m900 = mesesAte(v.inicial, 90_000_000, v.mensal, r);
  const ultimoCem = Number.isFinite(mMilhao) && Number.isFinite(m900) ? mMilhao - m900 : null;

  const atingiu = final >= MILHAO;
  const frase = atingiu
    ? `Em ${plural(v.anos, 'ano', 'anos')} você passa do milhão: chega lá em <strong>${tempo(mMilhao)}</strong> (${mesAno(mMilhao)}).`
    : Number.isFinite(mMilhao)
      ? `Ainda não é o milhão. Nesse ritmo ele chega em <strong>${tempo(mMilhao)}</strong> (${mesAno(mMilhao)}).`
      : 'Nesse ritmo o milhão não chega em 100 anos: aumente o valor mensal ou a taxa.';

  const html = `
    ${hero(`Valor total em ${plural(v.anos, 'ano', 'anos')}`, brl(final), frase,
      `<div class="calc-hero-prog" title="${pct(Math.min(100, (final / MILHAO) * 100), 0)} do milhão"><i style="transform:scaleX(${Math.min(1, final / MILHAO)})"></i></div>
       <span class="calc-hero-sub">${atingiu ? `${pct((final / MILHAO) * 100, 0)} do primeiro milhão` : `${pct((final / MILHAO) * 100, 0)} do caminho até R$ 1 milhão`}</span>`)}
    <div class="kpis">
      ${kpi('Valor total final', brl(final), `${mesAno(n)}`)}
      ${kpi('Total investido', brl(inv), `${brl(v.inicial)} + ${plural(n, 'aporte', 'aportes')}`)}
      ${kpi('Total em juros', brl(juros), `${pct(final ? (juros / final) * 100 : 0, 0)} do valor final`, 'is-ok')}
      ${kpi('Renda mensal', brl(renda), '25% dos juros do último mês')}
    </div>
    <section class="card calc-renda">
      <div class="calc-renda-passos">
        <div><span>Juros do último mês</span><strong class="num">${brl(jurosUlt)}</strong></div>
        <span class="calc-renda-op">× 25% =</span>
        <div class="is-destaque"><span>Sua renda mensal</span><strong class="num">${brl(renda)}</strong></div>
      </div>
      <p>Os outros 75% (${brl(jurosUlt - renda)}) continuam investidos: protegem contra a inflação e os anos ruins e mantêm o patrimônio crescendo. Por isso esta é uma conta <strong>pessimista</strong>: o mesmo patrimônio rende ${brl(jurosUlt)} por mês, mas você só conta com um quarto disso.</p>
    </section>
    <div class="calc-dupla">
      ${composicao([{ nome: 'Você investiu', v: inv, cor: COR.investido }, { nome: 'Os juros renderam', v: juros, cor: COR.juros }])}
    </div>
    ${cardGrafico('ch-milhao', 'O caminho até o milhão', 'Patrimônio mês a mês: o que você colocou e o que os juros fizeram.',
      legenda([['Total investido', COR.investido], ['Juros acumulados', COR.juros]]))}
    ${cardGrafico('ch-virada', 'Quando o dinheiro trabalha mais que você', 'Juros que o patrimônio rende em cada mês, comparados ao seu aporte.',
      legenda([['Juros do mês', COR.juros], ['Renda (25% dos juros)', COR.retirado]]),
      virada ? `No ${duracao(virada)} (${mesAno(virada)}), os juros do mês passam do seu aporte de ${brl(v.mensal)}.` : '')}
    <section class="card calc-card"><div class="calc-card-head"><div><h3 class="calc-card-title">Marcos do caminho</h3><p class="calc-card-sub">Cada etapa leva menos tempo que a anterior: é o efeito dos juros compostos.</p></div></div>
      <ol class="calc-marcos">${marcos.map((m, k) => {
        const antes = k ? marcos[k - 1].m : 0;
        const ok = Number.isFinite(m.m);
        return `<li class="${ok && m.m <= n ? 'is-ok' : ''}"><span class="calc-marco-dot"></span>
          <div><strong>R$ ${m.nome}</strong><span>${ok ? `${m.m === 0 ? 'já tem' : `em ${tempo(m.m)} · ${mesAno(m.m)}`}` : 'não chega em 100 anos'}</span></div>
          <em class="num">${ok && k && Number.isFinite(antes) ? `+${tempo(m.m - antes)}` : ''}</em></li>`;
      }).join('')}</ol></section>
    ${insights([
      Number.isFinite(mMilhao) && {
        tom: atingiu ? 'ok' : 'marco', titulo: atingiu ? 'O milhão chega dentro do prazo' : 'Quando o milhão chega',
        texto: `Com ${brl(v.mensal)} por mês a ${pct(v.taxa)} ao ano, você chega a R$ 1 milhão em <strong>${tempo(mMilhao)}</strong>, em ${mesAno(mMilhao)}.`
      },
      aporteMi > 0 && {
        tom: aporteMi > v.mensal ? 'alerta' : 'ok', titulo: `Para ter o milhão em ${plural(v.anos, 'ano', 'anos')}`,
        texto: `Seriam necessários <strong>${brl(aporteMi)} por mês</strong>${aporteMi > v.mensal ? `: ${brl(aporteMi - v.mensal)} a mais do que você investe hoje.` : `. Você já investe ${brl(v.mensal - aporteMi)} a mais que isso.`}`
      },
      ultimoCem != null && marcos[0].m > 0 && {
        tom: 'dica', titulo: 'O primeiro 100 mil é o mais difícil',
        texto: `Os primeiros R$ 100 mil levam ${tempo(marcos[0].m)}. Os últimos R$ 100 mil (de 900 mil a 1 milhão) levam só <strong>${tempo(ultimoCem)}</strong>.`
      },
      virada && {
        tom: 'marco', titulo: 'Ponto de virada',
        texto: `A partir de ${mesAno(virada)} (${tempo(virada)}), os juros de cada mês passam a render mais que o seu próprio aporte.`
      },
      {
        tom: 'alerta', titulo: 'Em dinheiro de hoje',
        texto: `Com inflação de ${pct(INFLACAO * 100, 0)} ao ano, ${brl(final)} daqui a ${plural(v.anos, 'ano', 'anos')} compram o que <strong>${brl(hoje)}</strong> compram hoje. A renda de ${brl(renda)} equivale a ${brl(renda / Math.pow(1 + INFLACAO, n / 12))} de hoje.`
      },
      n > 60 && (() => {
        const tarde = evoluir({ inicial: v.inicial, aporte: v.mensal, r, meses: n - 60 }).saldo[n - 60];
        return { tom: 'dica', titulo: 'O custo de esperar 5 anos', texto: `Começando daqui a 5 anos, com o mesmo aporte e o mesmo prazo final, você teria ${brl(tarde)}: <strong>${brl(final - tarde)} a menos</strong>.` };
      })()
    ])}
    ${cenarios('E se…', 'O valor final em outros cenários, mantendo o resto igual.', [
      ...[-2, 0, 2].filter(d => d >= 0 || v.taxa + d > 0).map(d => {
        const t = v.taxa + d;
        const f = evoluir({ inicial: v.inicial, aporte: v.mensal, r: mensalDeAnual(t / 100), meses: n }).saldo[n];
        return { nome: d ? `Taxa de ${pct(t)} ao ano` : `Seu cenário (${pct(v.taxa)})`, v: f, atual: !d, sub: f >= MILHAO ? 'passa do milhão' : '' };
      }),
      (() => {
        const f = evoluir({ inicial: v.inicial, aporte: v.mensal * 2, r, meses: n }).saldo[n];
        return v.mensal ? { nome: `Aporte em dobro (${brl(v.mensal * 2)})`, v: f, sub: f >= MILHAO ? 'passa do milhão' : '' } : null;
      })()
    ].filter(Boolean))}
    <p class="calc-acoes">${link(`#renda?inicial=${Math.round(final)}&retirada=${Math.round(renda)}`, 'Simular retiradas com esse patrimônio')}</p>
    ${tabela('Tabela ano a ano', ['Ano', 'Investido no ano', 'Juros no ano', 'Total investido', 'Total em juros', 'Patrimônio'],
      porAno(ev, n).map(a => [`${a.ano}º · ${mesAno(a.fim)}`, brl(a.aportes), brl(a.juros), brl(a.investido), brl(a.jurosAcum), `<strong>${brl(a.saldo)}</strong>`]))}`;

  const depois = () => {
    const marcosNoGrafico = marcos.filter(m => m.m > 0 && m.m <= n).map(m => ({ i: m.m, v: ev.saldo[m.m], rotulo: m.nome, cor: 'var(--text)' }));
    renderLinhas($('ch-milhao'), {
      n,
      series: [
        { nome: 'Total investido', cor: COR.investido, v: ev.investido, area: true },
        { nome: 'Patrimônio', cor: COR.juros, v: ev.saldo, area: true, de: 0 }
      ],
      refY: final >= MILHAO * 0.4 ? [{ v: MILHAO, rotulo: 'R$ 1 milhão' }] : [],
      marcos: marcosNoGrafico,
      rotuloX: rotuloTempo,
      tituloTip: tituloTempo,
      linhasTip: i => [
        { cor: COR.juros, nome: 'Juros acumulados', valor: brl(ev.juros[i]) },
        { cor: COR.investido, nome: 'Investido', valor: brl(ev.investido[i]) },
        { nome: 'Patrimônio', valor: brl(ev.saldo[i]), forte: true }
      ],
      aria: `Patrimônio cresce de ${brl(v.inicial)} para ${brl(final)} em ${v.anos} anos; ${brl(juros)} são juros.`
    });
    renderLinhas($('ch-virada'), {
      n,
      altura: 220,
      series: [
        { nome: 'Juros do mês', cor: COR.juros, v: ev.jurosMes, area: true },
        { nome: 'Renda', cor: COR.retirado, v: ev.jurosMes.map(j => j * 0.25), tracejada: true }
      ],
      refY: v.mensal ? [{ v: v.mensal, rotulo: `Seu aporte: ${brl(v.mensal)}` }] : [],
      marcos: virada ? [{ i: virada, v: ev.jurosMes[virada], rotulo: 'Virada', cor: COR.juros }] : [],
      rotuloX: rotuloTempo,
      tituloTip: tituloTempo,
      linhasTip: i => [
        { cor: COR.juros, nome: 'Juros do mês', valor: brl(ev.jurosMes[i]) },
        { cor: COR.retirado, nome: 'Renda (25%)', valor: brl(ev.jurosMes[i] * 0.25) },
        { nome: 'Seu aporte', valor: brl(v.mensal) }
      ],
      aria: `Os juros mensais chegam a ${brl(jurosUlt)} no último mês.`
    });
  };
  return { html, depois };
}

export default {
  id: 'milhao',
  nome: 'Primeiro milhão',
  icone: 'trending',
  desc: 'Quanto você acumula, quando chega ao R$ 1 milhão e a renda que esse patrimônio paga.',
  resumo: 'Projeção pessimista (8% ao ano por padrão). A renda é 25% dos juros do último mês: os outros 75% ficam investidos como margem de segurança.',
  exemplo: { inicial: 500000, mensal: 150000, taxa: 8, anos: 25 },
  campos: () => `
    ${campoBRL('inicial', 'Valor inicial', 'Quanto você já tem investido.')}
    ${campoBRL('mensal', 'Valor mensal', 'Quanto vai investir todo mês.')}
    ${campoNum('taxa', 'Taxa de juros', { sufixo: '% ao ano', max: 100, dica: 'Pessimista: 8% ao ano.' })}
    ${campoNum('anos', 'Período', { sufixo: 'anos', max: 100 })}`,
  calc: calcMilhao
};
