/* ============================================
   DataLife — Calculadoras: Tempo até a meta
   ============================================ */

import { $, COR, INFLACAO, brl, pct, mesAno, tempo, campoBRL, campoNum, kpi, hero, legenda, cardGrafico, insights, tabela, vazio, grande, link } from './calculadoras-ui.js';
import { mesesAte, aporteNecessario, mensalDeAnual, valorFuturo, grandeDemais } from './calculadoras-calc.js';
import { renderColunas } from './calc-chart.js';
import { compactBRL } from './escala.js';

const APORTES = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000]; // R$ 50 a R$ 50 mil
const HORIZONTES = [10, 15, 20, 25, 30, 35, 40];

const brlCurto = c => `R$ ${compactBRL(Math.round(c))}`; // "R$ 1,2 mi" (mascarado no modo privacidade)

function calcMeta(v) {
  if (!v.alvo) return { html: vazio('Informe o valor desejado.') };
  if (v.inicial >= v.alvo) return { html: vazio(`Você já tem o valor desejado: ${brl(v.inicial)} de ${brl(v.alvo)}.`) };
  const r = mensalDeAnual(v.taxa / 100);
  // O seu aporte entra na lista (se não for um dos valores prontos)
  const valores = [...new Set([...APORTES, ...(v.aporte > 0 ? [v.aporte] : [])])].sort((a, b) => a - b);
  if (grandeDemais(valorFuturo(v.inicial, valores[valores.length - 1], r, HORIZONTES[HORIZONTES.length - 1] * 12))) return { html: grande() };

  // Tempo para cada aporte (e, à parte, sem aporte nenhum)
  const linhas = valores.map(a => {
    const m = mesesAte(v.inicial, v.alvo, a, r);
    const ok = Number.isFinite(m);
    const investido = ok ? v.inicial + a * m : null;
    const saldo = ok ? valorFuturo(v.inicial, a, r, m) : null;
    return { a, m, ok, investido, juros: ok ? saldo - investido : null, saldo, seu: a === v.aporte };
  });
  const semAporte = mesesAte(v.inicial, v.alvo, 0, r);

  // Para cada horizonte: aporte necessário e quanto disso é investimento × juros
  const prazos = HORIZONTES.map(anos => {
    const n = anos * 12;
    const aporte = aporteNecessario(v.inicial, v.alvo, n, r);
    const investido = v.inicial + aporte * n;
    return { anos, n, aporte, investido, juros: Math.max(0, v.alvo - investido) };
  });

  const finitos = linhas.filter(l => l.ok);
  const maxM = Math.max(1, ...finitos.map(l => l.m));
  const p10 = prazos[0], p40 = prazos[prazos.length - 1];
  const a50mil = linhas.find(l => l.a === 5000000);
  const a500 = linhas.find(l => l.a === 50000), a5000 = linhas.find(l => l.a === 500000), a50 = linhas.find(l => l.a === 5000);
  const seu = linhas.find(l => l.seu);
  const hojeEm20 = v.alvo / Math.pow(1 + INFLACAO, 20);

  const tempoCel = l => (l.ok ? (l.m === 0 ? 'já chegou' : tempo(l.m)) : 'mais de 100 anos');
  const html = `
    ${(() => {
      const sozinho = Number.isFinite(semAporte) ? `Sem aportar nada, o valor inicial chegaria lá sozinho em <strong>${tempo(semAporte)}</strong>.` : 'Sem aportes, o valor inicial não chega lá em 100 anos.';
      // Com o seu aporte, o destaque é o seu tempo; sem ele, quanto aportar para chegar em 20 anos
      if (seu) {
        return hero(`Com ${brl(seu.a)} por mês, você chega a ${brl(v.alvo)} em`, seu.ok ? tempo(seu.m) : 'mais de 100 anos',
          seu.ok ? `Em ${mesAno(seu.m)}, a ${pct(v.taxa)} ao ano. Do total, ${brl(seu.investido)} saem do seu bolso e ${pct((seu.juros / seu.saldo) * 100, 0)} são juros.`
            : `Com esse aporte, a meta não chega em 100 anos. Para chegar em 20 anos, seriam ${brl(prazos[2].aporte)} por mês.`);
      }
      return hero(`Para chegar a ${brl(v.alvo)} em 20 anos`, `${brl(prazos[2].aporte)}/mês`,
        `É o aporte mensal a ${pct(v.taxa)} ao ano, partindo de ${brl(v.inicial)}. ${sozinho} Informe quanto você aporta hoje para ver o seu tempo.`);
    })()}
    <div class="kpis">
      ${kpi('Aporte para 10 anos', brl(p10.aporte), `por mês · investe ${brl(p10.investido)}`)}
      ${kpi('Aporte para 20 anos', brl(prazos[2].aporte), `por mês · investe ${brl(prazos[2].investido)}`)}
      ${kpi('Aporte para 40 anos', brl(p40.aporte), `por mês · investe ${brl(p40.investido)}`, 'is-ok')}
      ${kpi('Juros em 40 anos', pct((p40.juros / v.alvo) * 100, 0), `da meta vem dos juros`, 'is-ok')}
    </div>
    <section class="card calc-card"><div class="calc-card-head"><div><h3 class="calc-card-title">Quanto tempo você precisaria</h3><p class="calc-card-sub">Para cada valor de aporte mensal, o tempo até ${brl(v.alvo)} e quanto disso você colocou do bolso.</p></div>
      ${legenda([['Tempo até a meta', 'var(--p-400)']])}</div>
      <ul class="calc-cen calc-tempo">${linhas.map(l => `
        <li class="${l.seu ? 'is-atual' : ''}"><span class="calc-cen-nome"><b class="num">${brl(l.a)}</b> por mês${l.seu ? ' · o seu' : ''}</span>
          <span class="calc-cen-trilho"><i style="transform:scaleX(${l.ok ? Math.max(0.004, l.m / maxM) : 1})" class="${l.ok ? '' : 'is-nunca'}"></i></span>
          <span class="calc-cen-val"><b>${tempoCel(l)}</b>${l.ok && l.m ? `<em class="num">${mesAno(l.m)} · investe ${brl(l.investido)} · ${pct((l.juros / l.saldo) * 100, 0)} juros</em>` : ''}</span></li>`).join('')}</ul></section>
    ${cardGrafico('ch-meta', 'Fortuna × investimento em cada prazo', `Quanto aportar por mês para ter ${brl(v.alvo)} em cada prazo, e quanto desse valor vem de você e dos juros.`,
      legenda([['Você investe', COR.investido], ['Os juros pagam', COR.juros]]),
      `Em 10 anos você coloca ${pct((p10.investido / v.alvo) * 100, 0)} do valor do bolso; em 40 anos, só ${pct((p40.investido / v.alvo) * 100, 0)}.`)}
    <section class="card calc-card"><div class="calc-card-head"><div><h3 class="calc-card-title">Estimativas de 10 a 40 anos</h3><p class="calc-card-sub">Patrimônio estimado para cada aporte e prazo. Embaixo de cada valor, quanto você investiu. A barra embaixo de cada célula mostra quão perto da meta você está.</p></div>
      <ul class="calc-legenda"><li><i class="calc-mapa-key is-ok"></i>chega à meta</li><li><i class="calc-mapa-key is-barra"></i>caminho até a meta</li></ul></div>
      <div class="table-wrap calc-mapa-wrap"><table class="calc-mapa">
        <thead><tr><th>Aporte / mês</th>${HORIZONTES.map(a => `<th>${a} anos</th>`).join('')}</tr></thead>
        <tbody>${valores.map(a => `<tr class="${a === v.aporte ? 'is-seu' : ''}"><th class="num">${brl(a)}${a === v.aporte ? ' <em>o seu</em>' : ''}</th>${HORIZONTES.map(anos => {
          const n = anos * 12, f = valorFuturo(v.inicial, a, r, n), inv = v.inicial + a * n;
          const frac = Math.min(1, f / v.alvo);
          return `<td class="${f >= v.alvo ? 'is-ok' : ''}" style="--f:${frac.toFixed(3)}" title="${anos} anos com ${brl(a)}/mês: ${brl(f)} (investiu ${brl(inv)}, juros ${brl(f - inv)})"><b class="num">${brlCurto(f)}</b><em class="num">${brlCurto(inv)}</em></td>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table></div></section>
    ${insights([
      { tom: 'marco', titulo: 'Tempo é o aporte mais barato', texto: `Para ter ${brl(v.alvo)} em 10 anos você precisa de <strong>${brl(p10.aporte)} por mês</strong>. Em 40 anos, de ${brl(p40.aporte)}: ${p40.aporte > 0 ? `${(p10.aporte / p40.aporte).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes menos` : 'nada, o inicial já basta'}.` },
      a50.ok && a500.ok && a5000.ok && a50mil.ok && { tom: 'dica', titulo: 'Cada real a mais encurta menos', texto: `Passar de R$ 50 para R$ 500 por mês economiza ${tempo(a50.m - a500.m)}. Passar de R$ 5 mil para R$ 50 mil economiza ${tempo(a5000.m - a50mil.m)}. Dobrar o aporte nunca corta o tempo pela metade.` },
      !a50.ok && { tom: 'alerta', titulo: 'Aportes pequenos não chegam', texto: `Com ${brl(a50.a)} por mês, ${brl(v.alvo)} não chega em 100 anos. O primeiro aporte que chega lá em até 40 anos é ${(() => { const l = linhas.find(x => x.ok && x.m <= 480); return l ? `${brl(l.a)} (${tempo(l.m)})` : 'acima de R$ 50 mil'; })()}.` },
      Number.isFinite(semAporte) && { tom: 'ok', titulo: 'O valor inicial também trabalha', texto: `Mesmo sem aportar nada, ${brl(v.inicial)} a ${pct(v.taxa)} ao ano chegam a ${brl(v.alvo)} em ${tempo(semAporte)}. Cada aporte só antecipa esse dia.` },
      { tom: 'alerta', titulo: 'A meta em dinheiro de hoje', texto: `Com inflação de ${pct(INFLACAO * 100, 0)} ao ano, ${brl(v.alvo)} daqui a 20 anos compram o que ${brl(hojeEm20)} compram hoje. Para manter o poder de compra de ${brl(v.alvo)}, a meta em 20 anos seria <strong>${brl(v.alvo * Math.pow(1 + INFLACAO, 20))}</strong>.` },
      v.taxa >= 20 && { tom: 'alerta', titulo: 'Rendimento alto', texto: 'Mais de 20% ao ano é raro de sustentar por décadas. Refaça com 8% para uma conta pessimista.' }
    ])}
    <p class="calc-acoes">${link(`#juros?inicial=${v.inicial}&taxa=${v.taxa}&taxaUn=a`, 'Simular um aporte em Juros compostos')}${link(`#milhao?inicial=${v.inicial}&taxa=${v.taxa}`, 'Ver no Primeiro milhão')}</p>
    ${tabela('Tabela por prazo', ['Prazo', 'Aporte por mês', 'Total investido', 'Juros', '% de juros'],
      prazos.map(p => [`${p.anos} anos · ${mesAno(p.n)}`, `<strong>${brl(p.aporte)}</strong>`, brl(p.investido), brl(p.juros), pct((p.juros / v.alvo) * 100, 0)]))}`;

  const depois = () => renderColunas($('ch-meta'), {
    fmt: brl,
    grupos: prazos.map(p => ({
      rotulo: `${p.anos}a`, titulo: `${p.anos} anos · ${brl(p.aporte)} por mês`,
      partes: [{ nome: 'Você investe', cor: COR.investido, v: Math.min(p.investido, v.alvo) }, { nome: 'Os juros pagam', cor: COR.juros, v: p.juros }],
      total: { nome: 'Patrimônio', valor: brl(Math.max(v.alvo, p.investido)) }
    })),
    aria: `Para ${brl(v.alvo)}: ${prazos.map(p => `${p.anos} anos, ${brl(p.aporte)} por mês`).join('; ')}.`
  });
  return { html, depois };
}

export default {
  id: 'meta',
  nome: 'Tempo até a meta',
  icone: 'target',
  desc: 'Quanto tempo leva para chegar ao valor que você quer, aportando de R$ 50 a R$ 50 mil por mês.',
  resumo: 'Informe o rendimento, quanto já tem e aonde quer chegar. Veja o tempo para cada valor de aporte e quanto você teria em 10, 15, 20… 40 anos.',
  exemplo: { taxa: 8, inicial: 1000000, alvo: 100000000, aporte: 100000 },
  campos: () => `
    ${campoNum('taxa', 'Rendimento anual', { sufixo: '% ao ano', max: 100, dica: 'Pessimista: 8% ao ano.' })}
    ${campoBRL('inicial', 'Valor inicial', 'Quanto você já tem investido.')}
    ${campoBRL('alvo', 'Valor desejado', 'Aonde você quer chegar.')}
    ${campoBRL('aporte', 'Quanto você aporta por mês hoje', 'Opcional: destaca o seu tempo.')}`,
  calc: calcMeta
};
