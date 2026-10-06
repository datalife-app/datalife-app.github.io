/* ============================================
   DataLife — Conselhos
   ============================================
   Referência de design: as "trilhas" do Meu Bolso em Dia (Banco Central +
   Febraban): temas curtos, ações práticas e progresso. No DataLife, cada
   guia tem um resumo de 30 segundos, uma lista do que fazer (o progresso
   fica salvo) e ferramentas que usam os seus números do Orçamento e dos
   Objetivos. Rotas: #<tema> (ex.: #reserva).
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import { TOPICOS } from './conselhos-data.js';
import { CATEGORIAS } from './utils.js';
import { fetchMonth, fetchMetas } from './db.js';
import { fetchObjetivos } from './objetivos-db.js';
import { totais, mesesAte, taxaMensal, duracao } from './objetivos-calc.js';
import { fetchFeitos, saveFeitos } from './conselhos-db.js';
import {
  icon, escapeHtml, showToast, uid, formatBRL, formatBRLRaw, parseBRL, bindCurrencyInput, bindPrivacyToggle, monthKey, monthLabel
} from './utils.js';

const $ = id => document.getElementById(id);
const user = await requireAuth();

const state = { feitos: new Set(), dados: null, dividas: [{ id: uid(), nome: '', saldo: 0, juros: 0 }] };

/** Números do usuário para personalizar (lidos uma vez, sob demanda). */
async function dados() {
  if (state.dados) return state.dados;
  const mes = monthKey(new Date());
  try {
    const [m, metas, objetivos] = await Promise.all([fetchMonth(user.uid, mes), fetchMetas(user.uid), fetchObjetivos(user.uid)]);
    const fixosLancados = m.gastos.filter(g => g.cat === 'custosFixos').reduce((a, g) => a + g.valor, 0);
    const fixosMeta = Math.round((m.renda * (metas.custosFixos || 0)) / 100);
    const reserva = objetivos.find(o => !o.arquivado && (o.icone === 'shield' || /reserva/i.test(o.nome)));
    state.dados = {
      mes,
      renda: m.renda,
      metas,
      gastoMes: m.gastos.reduce((a, g) => a + g.valor, 0),
      fixos: fixosLancados || fixosMeta,
      fonteFixos: fixosLancados ? `custos fixos lançados em ${monthLabel(mes)}` : fixosMeta ? `meta de Custos fixos de ${monthLabel(mes)}` : '',
      reserva: reserva ? { nome: reserva.nome, saldo: Math.max(0, totais(reserva.movimentos).saldo), id: reserva.id } : null
    };
  } catch (e) {
    console.error(e);
    state.dados = { mes, renda: 0, metas: null, gastoMes: 0, fixos: 0, fonteFixos: '', reserva: null };
  }
  return state.dados;
}

/* ---------- Índice ---------- */

const progresso = t => t.fazer.filter(([id]) => state.feitos.has(id)).length;

function anel(feitos, total) {
  const R = 16, C = 2 * Math.PI * R, pct = total ? feitos / total : 0;
  return `<svg class="anel" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${R}" class="anel-trilho"/>
    <circle cx="20" cy="20" r="${R}" class="anel-feito ${feitos === total ? 'is-ok' : ''}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 20 20)"/></svg>`;
}

function renderIndice() {
  document.title = 'Conselhos · DataLife';
  $('titulo').textContent = 'Conselhos';
  $('subtitulo').hidden = false;
  const voltar = $('voltar');
  voltar.href = 'hub.html';
  voltar.lastChild.textContent = 'Hub';
  const total = TOPICOS.reduce((a, t) => a + t.fazer.length, 0);
  const feitos = TOPICOS.reduce((a, t) => a + progresso(t), 0);
  $('cons-body').innerHTML = `
    <p class="cons-geral">${feitos ? `Você concluiu <strong>${feitos} de ${total}</strong> ações recomendadas.` : 'Cada guia termina com uma lista do que fazer. Marque o que já fez e acompanhe aqui.'}</p>
    <ul class="topicos">
      ${TOPICOS.map(t => {
        const f = progresso(t);
        return `
        <li>
          <a class="topico" href="#${t.id}">
            <span class="topico-icon">${icon(t.icone, 20)}</span>
            <span class="topico-txt"><strong>${t.titulo}</strong><span>${t.resumo}</span></span>
            <span class="topico-prog" title="${f} de ${t.fazer.length} ações">${anel(f, t.fazer.length)}<span class="num">${f}/${t.fazer.length}</span></span>
          </a>
        </li>`;
      }).join('')}
    </ul>
    <p class="cons-aviso">${icon('info', 15)}Conteúdo educativo, com princípios gerais. Não é recomendação de investimento nem consultoria; para decisões grandes, compare propostas por escrito e, se precisar, procure um planejador financeiro.</p>`;
}

/* ---------- Guia ---------- */

async function renderTopico(t) {
  document.title = `${t.titulo} · Conselhos · DataLife`;
  $('titulo').textContent = t.titulo;
  $('subtitulo').hidden = true;
  const voltar = $('voltar');
  voltar.href = '#';
  voltar.lastChild.textContent = 'Conselhos';
  const f = progresso(t);
  $('cons-body').innerHTML = `
    <div class="guia">
      <nav class="guia-nav" aria-label="Neste guia">
        <ol>
          ${t.secoes.map((s, i) => `<li><a href="#${t.id}" data-ir="s${i}">${s.titulo}</a></li>`).join('')}
          <li><a href="#${t.id}" data-ir="fazer">O que fazer</a></li>
        </ol>
        <div class="guia-prog">${anel(f, t.fazer.length)}<span><strong class="num">${f} de ${t.fazer.length}</strong> ações</span></div>
      </nav>
      <article class="guia-texto">
        <aside class="resumo"><span class="resumo-tag">Em 30 segundos</span><p>${t.resumo}</p></aside>
        ${t.secoes.map((s, i) => `
          <section class="guia-sec" id="s${i}">
            <h2>${s.titulo}</h2>
            ${s.html}
            ${s.ferramenta ? `<div class="ferramenta" id="ferramenta-${s.ferramenta}"></div>` : ''}
          </section>`).join('')}
        <section class="guia-sec fazer" id="fazer">
          <h2>O que fazer</h2>
          <ul class="fazer-list">
            ${t.fazer.map(([id, txt]) => `
              <li><label class="fazer-item ${state.feitos.has(id) ? 'is-feito' : ''}"><input type="checkbox" data-fazer="${id}" ${state.feitos.has(id) ? 'checked' : ''}><span>${txt}</span></label></li>`).join('')}
          </ul>
        </section>
        <nav class="guia-prox">${(() => {
          const i = TOPICOS.indexOf(t);
          const prox = TOPICOS[(i + 1) % TOPICOS.length];
          return `<a class="link-btn" href="#">${icon('chevronLeft', 14)} Todos os guias</a><a class="link-btn" href="#${prox.id}">Próximo: ${prox.titulo} ${icon('chevronRight', 14)}</a>`;
        })()}</nav>
      </article>
    </div>`;
  for (const s of t.secoes) if (s.ferramenta) await FERRAMENTAS[s.ferramenta]($(`ferramenta-${s.ferramenta}`));
}

/* ---------- Ferramentas ---------- */

const campo = (name, label, valor = '', extra = '') => `
  <label class="field"><span class="field-label">${label}</span>
    <input class="input num" name="${name}" inputmode="decimal" value="${escapeHtml(String(valor))}" ${extra}></label>`;
const pctNum = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const fmtPct = n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

let observadorDivers = null; // ResizeObserver do gráfico de diversificação (um por vez)

const FERRAMENTAS = {
  async divisao(el) {
    const d = await dados();
    el.innerHTML = `
      <form class="tool" id="tool-divisao" autocomplete="off">
        <h3 class="tool-title">${icon('sliders', 16)} A sua divisão</h3>
        <div class="tool-grid">${campo('renda', 'Renda da casa por mês', d.renda ? formatBRLRaw(d.renda) : '', 'placeholder="R$ 0,00" maxlength="22"')}</div>
        <p class="tool-fonte">${d.renda ? `Preenchido com a renda de ${monthLabel(d.mes)} no Orçamento.` : 'Lance as rendas no Orçamento para vir preenchido.'}</p>
        <div class="tool-out" id="out-divisao"></div>
      </form>`;
    const f = $('tool-divisao');
    const calc = () => {
      const renda = parseBRL(f.renda.value);
      if (!renda) { $('out-divisao').innerHTML = '<p class="tool-fonte">Informe a renda para ver quanto vai para cada parte.</p>'; return; }
      const linhas = CATEGORIAS.map(c => {
        const sua = d.metas ? d.metas[c.id] || 0 : null;
        return `<tr>
          <td data-label="Parte"><strong>${c.nome}</strong></td>
          <td data-label="Sugestão" class="num">${c.meta}%</td>
          <td data-label="Por mês" class="num">${formatBRL(Math.round((renda * c.meta) / 100))}</td>
          <td data-label="Suas metas" class="num">${sua == null ? '—' : `${sua}%${sua !== c.meta ? ` <span class="cmp-obs">${sua > c.meta ? '+' : ''}${sua - c.meta} p.p.</span>` : ''}`}</td>
        </tr>`;
      }).join('');
      const pctFixos = d.fixos && renda ? (d.fixos / renda) * 100 : 0;
      const avisos = [
        pctFixos > 40 ? `Seus custos fixos de ${monthLabel(d.mes)} somam <strong>${fmtPct(pctFixos)}</strong> da renda: acima do limite de 40%. Vale rever moradia, carro e contas antes de qualquer outra coisa.` : '',
        pctFixos && pctFixos <= 40 ? `Seus custos fixos de ${monthLabel(d.mes)} estão em <strong>${fmtPct(pctFixos)}</strong> da renda, dentro do limite de 40%.` : '',
        renda > 5000000 ? 'Com renda acima de cerca de R$ 50 mil por mês, os custos fixos costumam pesar bem menos que 30%: leve a diferença para a liberdade financeira.' : ''
      ].filter(Boolean);
      $('out-divisao').innerHTML = `
        <div class="table-wrap"><table class="cmp cmp-div">
          <thead><tr><th>Parte</th><th>Sugestão</th><th>Por mês</th><th>Suas metas</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table></div>
        ${avisos.map(a => `<p class="tool-fonte">${a}</p>`).join('')}
        <p class="tool-cta"><a class="link-btn" href="budget.html#targets">Ajustar em Minhas metas</a></p>`;
    };
    bindCurrencyInput(f.renda, calc);
    calc();
  },

  async reserva(el) {
    const d = await dados();
    el.innerHTML = `
      <form class="tool" id="tool-reserva" autocomplete="off">
        <h3 class="tool-title">${icon('shield', 16)} A sua reserva</h3>
        <div class="tool-grid">${campo('fixos', 'Gastos fixos por mês', d.fixos ? formatBRLRaw(d.fixos) : '', 'placeholder="R$ 0,00" maxlength="22"')}</div>
        ${d.fonteFixos ? `<p class="tool-fonte">Preenchido com a ${d.fonteFixos}. Ajuste se quiser.</p>` : '<p class="tool-fonte">Lance os gastos fixos no Orçamento para vir preenchido.</p>'}
        <div class="tool-out" id="out-reserva"></div>
      </form>`;
    const f = $('tool-reserva');
    const calc = () => {
      const fixos = parseBRL(f.fixos.value);
      const r = d.reserva;
      const meses = fixos && r ? r.saldo / fixos : 0;
      $('out-reserva').innerHTML = fixos ? `
        <div class="tool-res"><span>Mínimo (6 meses)</span><strong class="num">${formatBRL(fixos * 6)}</strong></div>
        <div class="tool-res"><span>Ideal (12 meses)</span><strong class="num">${formatBRL(fixos * 12)}</strong></div>
        ${r ? `<div class="tool-res is-wide"><span>Você já tem em "${escapeHtml(r.nome)}"</span><strong class="num">${formatBRL(r.saldo)}</strong>
            <span class="tool-sub">${meses >= 12 ? 'Reserva completa: 12 meses ou mais.' : meses >= 6 ? `${meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses: já passou do mínimo.` : `${meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses de ${6}: faltam ${formatBRL(Math.max(0, fixos * 6 - r.saldo))} para o mínimo.`}</span>
            <div class="tool-bar"><i style="transform:scaleX(${Math.min(1, meses / 12)})"></i><b style="left:50%" title="6 meses"></b></div></div>`
          : `<p class="tool-cta">Ainda não há um objetivo de reserva. <a class="link-btn" href="goals.html">Criar em Objetivos</a> (a sugestão "Reserva de emergência" já vem com o valor de 6 meses).</p>`}` : '<p class="tool-fonte">Informe os gastos fixos para ver o tamanho da reserva.</p>';
    };
    bindCurrencyInput(f.fixos, calc);
    calc();
  },

  async compra(el) {
    el.innerHTML = `
      <form class="tool" id="tool-compra" autocomplete="off">
        <h3 class="tool-title">${icon('car', 16)} Compare as formas de comprar</h3>
        <div class="tool-grid">
          ${campo('valor', 'Valor do bem', formatBRLRaw(6000000), 'maxlength="22"')}
          ${campo('entrada', 'Entrada (financiamento)', formatBRLRaw(1200000), 'maxlength="22"')}
          ${campo('prazo', 'Prazo (meses)', 48, 'maxlength="3"')}
          ${campo('juros', 'Juros do financiamento (% ao mês)', '1,8', 'maxlength="6"')}
          ${campo('adm', 'Taxa de administração do consórcio (% total)', '18', 'maxlength="6"')}
          ${campo('rende', 'Rendimento do dinheiro investido (% ao ano)', '10', 'maxlength="6"')}
          ${campo('aluguel', 'Aluguel ou assinatura (por mês)', formatBRLRaw(250000), 'maxlength="22"')}
        </div>
        <div class="tool-out" id="out-compra"></div>
      </form>`;
    const f = $('tool-compra');
    const calc = () => {
      const valor = parseBRL(f.valor.value), entrada = Math.min(parseBRL(f.entrada.value), valor), aluguel = parseBRL(f.aluguel.value);
      const n = Math.max(1, Math.min(600, Math.round(pctNum(f.prazo.value))));
      const i = pctNum(f.juros.value) / 100, adm = pctNum(f.adm.value) / 100;
      const r = Math.pow(1 + pctNum(f.rende.value) / 100, 1 / 12) - 1;
      if (!valor) return void ($('out-compra').innerHTML = '<p class="tool-fonte">Informe o valor do bem.</p>');
      const fin = valor - entrada;
      const pmt = fin <= 0 ? 0 : i > 0 ? fin * i / (1 - Math.pow(1 + i, -n)) : fin / n;
      const consTotal = valor * (1 + adm);
      const poupar = r > 0 ? valor * r / (Math.pow(1 + r, n) - 1) : valor / n;
      const rendeValor = valor * (Math.pow(1 + r, n) - 1);
      const linhas = [
        { nome: 'À vista', parcela: '—', total: valor, quando: 'hoje', obs: `Deixa de render ${formatBRL(Math.round(rendeValor))} em ${n} meses (custo de oportunidade).` },
        { nome: 'Financiamento', parcela: Math.round(pmt), total: Math.round(entrada + pmt * n), quando: 'hoje', obs: `${formatBRL(entrada)} de entrada + ${n} parcelas.` },
        { nome: 'Consórcio', parcela: Math.round(consTotal / n), total: Math.round(consTotal), quando: 'quando for contemplado', obs: 'Por sorteio ou lance: pode ser no 1º ou no último mês. As parcelas costumam ser reajustadas.' },
        { nome: 'Juntar e comprar à vista', parcela: Math.round(poupar), total: Math.round(poupar * n), quando: `em ${duracao(n)}`, obs: 'O rendimento paga parte do bem.' },
        { nome: 'Alugar ou assinar', parcela: aluguel, total: aluguel * n, quando: 'nunca (não é seu)', obs: aluguel ? `Com o valor do bem investido, você ganharia ${formatBRL(Math.round(rendeValor))} no período: o custo líquido seria ${formatBRL(Math.round(aluguel * n - rendeValor))}.` : 'Informe o aluguel para comparar.' }
      ];
      const menor = Math.min(...linhas.filter(l => l.nome !== 'Alugar ou assinar').map(l => l.total));
      $('out-compra').innerHTML = `
        <div class="table-wrap"><table class="cmp">
          <thead><tr><th>Forma</th><th>Parcela</th><th>Total pago</th><th>Acima do valor</th><th>O bem é seu</th></tr></thead>
          <tbody>${linhas.map(l => `
            <tr class="${l.total === menor ? 'is-menor' : ''}">
              <td data-label="Forma"><strong>${l.nome}</strong><span class="cmp-obs">${l.obs}</span></td>
              <td data-label="Parcela" class="num">${typeof l.parcela === 'number' ? formatBRL(l.parcela) : l.parcela}</td>
              <td data-label="Total pago" class="num">${formatBRL(l.total)}</td>
              <td data-label="Acima do valor" class="num">${l.nome === 'Alugar ou assinar' ? '—' : l.total - valor > 0 ? `+${formatBRL(l.total - valor)}` : formatBRL(l.total - valor)}</td>
              <td data-label="O bem é seu">${l.quando}</td>
            </tr>`).join('')}</tbody>
        </table></div>
        <p class="tool-fonte">Simplificação para comparar: não inclui seguros, tarifas, IOF, reajuste do consórcio nem valorização ou desvalorização do bem. Peça sempre o CET da proposta.</p>`;
    };
    ['valor', 'entrada', 'aluguel'].forEach(k => bindCurrencyInput(f[k], calc));
    f.addEventListener('input', calc);
    calc();
  },

  async dividas(el) {
    el.innerHTML = `
      <div class="tool" id="tool-dividas">
        <h3 class="tool-title">${icon('listChecks', 16)} Por qual dívida começar</h3>
        <p class="tool-fonte">Fica só nesta tela: nada é salvo.</p>
        <div id="div-linhas"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="div-add">${icon('plus', 14)} Outra dívida</button>
        <div class="tool-out" id="out-dividas"></div>
      </div>`;
    const render = () => {
      $('div-linhas').innerHTML = state.dividas.map(d => `
        <div class="div-linha" data-id="${d.id}">
          <input class="input" name="nome" placeholder="Credor (ex.: Cartão X)" maxlength="40" value="${escapeHtml(d.nome)}" aria-label="Credor">
          <input class="input num" name="saldo" inputmode="numeric" placeholder="Saldo R$" maxlength="22" value="${d.saldo ? formatBRLRaw(d.saldo) : ''}" aria-label="Saldo">
          <input class="input num" name="juros" inputmode="decimal" placeholder="Juros % a.m." maxlength="6" value="${d.juros || ''}" aria-label="Juros ao mês">
          <button type="button" class="icon-btn danger" data-del aria-label="Remover">${icon('trash', 14)}</button>
        </div>`).join('');
      $('div-linhas').querySelectorAll('[name="saldo"]').forEach(inp => bindCurrencyInput(inp, () => { sync(); calc(); }));
      calc();
    };
    const sync = () => $('div-linhas').querySelectorAll('.div-linha').forEach(l => {
      const d = state.dividas.find(x => x.id === l.dataset.id);
      d.nome = l.querySelector('[name="nome"]').value;
      d.saldo = parseBRL(l.querySelector('[name="saldo"]').value);
      d.juros = l.querySelector('[name="juros"]').value;
    });
    const calc = () => {
      const ok = state.dividas.filter(d => d.saldo > 0);
      if (ok.length < 2) return void ($('out-dividas').innerHTML = '<p class="tool-fonte">Preencha pelo menos duas dívidas com saldo para comparar.</p>');
      const nome = d => escapeHtml(d.nome || 'Sem nome');
      const av = [...ok].sort((a, b) => pctNum(b.juros) - pctNum(a.juros));
      const bn = [...ok].sort((a, b) => a.saldo - b.saldo);
      const col = (titulo, sub, lista) => `<div class="ordem"><h4>${titulo}</h4><p>${sub}</p><ol>${lista.map(d => `<li><strong>${nome(d)}</strong><span class="num">${formatBRL(d.saldo)} · ${fmtPct(pctNum(d.juros))} a.m.</span></li>`).join('')}</ol></div>`;
      $('out-dividas').innerHTML = `<div class="ordens">${col('Avalanche', 'maior juro primeiro: paga menos juros', av)}${col('Bola de neve', 'menor saldo primeiro: vitórias rápidas', bn)}</div>`;
    };
    $('div-linhas').addEventListener('input', () => { sync(); calc(); });
    $('div-linhas').addEventListener('click', e => {
      if (!e.target.closest('[data-del]')) return;
      sync();
      state.dividas = state.dividas.filter(d => d.id !== e.target.closest('.div-linha').dataset.id);
      if (!state.dividas.length) state.dividas.push({ id: uid(), nome: '', saldo: 0, juros: 0 });
      render();
    });
    $('div-add').addEventListener('click', () => { sync(); state.dividas.push({ id: uid(), nome: '', saldo: 0, juros: 0 }); render(); $('div-linhas').lastElementChild.querySelector('input').focus(); });
    if (state.dividas.length === 1 && !state.dividas[0].saldo) state.dividas.push({ id: uid(), nome: '', saldo: 0, juros: 0 });
    render();
  },

  /* Risco de uma carteira com n investimentos de mesmo risco e peso, correlação ρ entre cada par:
     σp / σ = √(1/n + (1 − 1/n)·ρ). Com ρ = 0, 15 investimentos cortam ~74% do risco; 20, ~78%. */
  async diversificacao(el) {
    const CORRS = [0, 0.2, 0.4, 0.6];
    const COR = ['var(--p-100)', 'var(--p-200)', 'var(--p-300)', 'var(--p-400)']; // rampa: mais correlação, mais escuro
    const MAX_N = 25, H = 230, PL = 44, PR = 40, PT = 14, PB = 28;
    const risco = (n, rho) => Math.sqrt(1 / n + (1 - 1 / n) * rho);
    const fmtRho = c => c.toLocaleString('pt-BR');
    const st = { n: 15, rho: 0 };
    el.innerHTML = `
      <div class="tool" id="tool-divers">
        <h3 class="tool-title">${icon('activity', 16)} Quanto a diversificação corta o risco</h3>
        <div class="tool-grid divers-ctrl">
          <label class="field"><span class="field-label">Quantos investimentos: <strong class="num" id="divers-n-txt"></strong></span>
            <input type="range" class="range" id="divers-n" min="1" max="${MAX_N}" step="1" value="${st.n}"></label>
          <div class="field"><span class="field-label" id="divers-rho-label">Correlação entre eles</span>
            <div class="segmented" role="radiogroup" aria-labelledby="divers-rho-label" id="divers-rho">
              ${CORRS.map(c => `<button type="button" role="radio" data-rho="${c}" aria-checked="${c === st.rho}" tabindex="${c === st.rho ? 0 : -1}">${fmtRho(c)}</button>`).join('')}
            </div></div>
        </div>
        <div class="divers-chart" id="divers-chart"></div>
        <div class="tool-out" id="out-divers"></div>
        <p class="tool-fonte">Conta simplificada: todos os investimentos com o mesmo risco e o mesmo peso. Risco é o quanto a carteira oscila (desvio-padrão). O retorno esperado não muda; só o risco cai.</p>
      </div>`;

    // Desenho fixo (eixos e curvas) só muda com a largura; o marcador e o destaque mudam por atributo,
    // sem recriar o SVG (assim dá para arrastar o dedo no gráfico sem perder o toque)
    let geo = null;
    const desenhar = () => {
      const wrap = $('divers-chart');
      if (!wrap) return;
      const W = Math.max(wrap.clientWidth || 600, 280);
      const pw = W - PL - PR, ph = H - PT - PB;
      const x = n => PL + ((n - 1) / (MAX_N - 1)) * pw;
      const y = f => PT + (1 - f) * ph;
      geo = { W, pw, x, y };
      const ns = Array.from({ length: MAX_N }, (_, i) => i + 1);
      let svg = [0, 0.25, 0.5, 0.75, 1].map(t => `
        <line x1="${PL}" x2="${W - PR}" y1="${y(t)}" y2="${y(t)}" class="grid ${t === 0 ? 'base' : ''}"/>
        <text x="${PL - 8}" y="${y(t)}" class="tick" text-anchor="end" dominant-baseline="middle">${t * 100}%</text>`).join('');
      svg += [1, 5, 10, 15, 20, 25].map(n => `<text x="${x(n)}" y="${H - 8}" class="tick" text-anchor="middle">${n}</text>`).join('');
      svg += `<rect x="${x(15)}" y="${PT}" width="${x(20) - x(15)}" height="${ph}" class="divers-faixa"/>
        <text x="${(x(15) + x(20)) / 2}" y="${PT + 12}" class="divers-faixa-txt" text-anchor="middle">15 a 20</text>`;
      svg += CORRS.map((c, k) => `
        <path d="${ns.map((n, i) => `${i ? 'L' : 'M'}${x(n).toFixed(1)},${y(risco(n, c)).toFixed(1)}`).join('')}" class="divers-linha" data-k="${k}" style="stroke:${COR[k]}"/>
        <text x="${W - PR + 6}" y="${y(risco(MAX_N, c))}" class="divers-rot" data-k="${k}" dominant-baseline="middle">ρ ${fmtRho(c)}</text>`).join('');
      svg += `<line y1="${PT}" y2="${PT + ph}" class="cross-line" id="divers-cross"/>
        <circle r="5" class="cross-dot" id="divers-dot"/>
        <rect class="hit" x="${PL}" y="0" width="${pw}" height="${H}"/>`;
      wrap.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="svg-grafico divers-svg" role="img">${svg}</svg>
        <div class="chart-tip" role="status" hidden></div>`;
      const svgEl = wrap.querySelector('svg');
      const tip = wrap.querySelector('.chart-tip');
      const hit = svgEl.querySelector('.hit');
      const nDe = e => {
        const r = svgEl.getBoundingClientRect();
        const ux = (e.clientX - r.left) * (W / r.width); // pixels da tela -> unidades do SVG
        return Math.max(1, Math.min(MAX_N, Math.round(1 + ((ux - PL) / pw) * (MAX_N - 1))));
      };
      const dica = n => {
        const r = svgEl.getBoundingClientRect();
        tip.innerHTML = `<strong class="tip-title">${n} ${n === 1 ? 'investimento' : 'investimentos'}</strong>
          ${CORRS.map((c, i) => `<div class="tip-row"><i style="background:${COR[i]}"></i><span>Correlação ${fmtRho(c)}</span><b class="num">${Math.round(risco(n, c) * 100)}%</b></div>`).join('')}`;
        tip.hidden = false;
        const cx = x(n) * (r.width / W), tw = tip.offsetWidth;
        tip.style.transform = `translate(${Math.max(0, cx + 14 + tw > r.width ? cx - 14 - tw : cx + 14)}px, 8px)`;
      };
      let arrastando = false;
      const escolher = e => { st.n = nDe(e); $('divers-n').value = st.n; atualizar(); dica(st.n); };
      hit.addEventListener('pointerdown', e => { arrastando = true; hit.setPointerCapture?.(e.pointerId); escolher(e); });
      hit.addEventListener('pointermove', e => (arrastando ? escolher(e) : dica(nDe(e))));
      const soltar = () => { arrastando = false; tip.hidden = true; };
      hit.addEventListener('pointerup', soltar);
      hit.addEventListener('pointercancel', soltar);
      hit.addEventListener('pointerleave', () => { if (!arrastando) tip.hidden = true; });
      atualizar();
    };

    // Só o que depende de n e ρ: marcador, destaque da curva, textos
    function atualizar() {
      if (!geo || !$('divers-chart')) return;
      const { x, y } = geo;
      const k = CORRS.indexOf(st.rho), f = risco(st.n, st.rho);
      const svgEl = $('divers-chart').querySelector('svg');
      const cross = svgEl.querySelector('#divers-cross'), dot = svgEl.querySelector('#divers-dot');
      cross.setAttribute('x1', x(st.n));
      cross.setAttribute('x2', x(st.n));
      dot.setAttribute('cx', x(st.n));
      dot.setAttribute('cy', y(f));
      dot.style.fill = COR[k];
      svgEl.querySelectorAll('[data-k]').forEach(n => n.classList.toggle('is-on', Number(n.dataset.k) === k));
      svgEl.setAttribute('aria-label', `Com ${st.n} investimentos e correlação ${fmtRho(st.rho)}, o risco cai para ${Math.round(f * 100)}% do risco de um investimento só.`);
      const piso = Math.sqrt(st.rho); // risco que sobra mesmo com infinitos investimentos
      $('divers-n-txt').textContent = st.n;
      $('divers-n').style.setProperty('--p', `${((st.n - 1) / (MAX_N - 1)) * 100}%`);
      $('out-divers').innerHTML = `
        <div class="tool-res is-big"><span>Risco da carteira</span><strong class="num">${Math.round(f * 100)}%</strong>
          <span class="tool-sub">do risco de ter um investimento só: ${st.n === 1 ? 'sem diversificação' : `<strong>${Math.round((1 - f) * 100)}% a menos</strong>`}</span></div>
        <div class="tool-res"><span>Mesmo com infinitos investimentos</span><strong class="num">${Math.round(piso * 100)}%</strong>
          <span class="tool-sub">${st.rho ? `com correlação ${fmtRho(st.rho)}, esse risco nunca sai` : 'sem correlação, o risco tende a zero'}</span></div>
        <div class="tool-res"><span>Com 20 investimentos de correlação 0</span><strong class="num">${Math.round(risco(20, 0) * 100)}%</strong>
          <span class="tool-sub">o "Santo Graal": cerca de 80% a menos de risco</span></div>
        <p class="tool-fonte">${st.rho >= 0.4
          ? `Repare: com correlação ${fmtRho(st.rho)}, passar de 5 para 25 investimentos só tira mais ${Math.round((risco(5, st.rho) - risco(25, st.rho)) * 100)} pontos de risco. Mais do mesmo não diversifica; o que ajuda é algo diferente.`
          : `Os primeiros investimentos são os que mais ajudam: de 1 para 5 o risco cai ${Math.round((1 - risco(5, st.rho)) * 100)} pontos; de 20 para 25, só ${Math.round((risco(20, st.rho) - risco(25, st.rho)) * 100)}.`}</p>`;
    }

    const marcarRho = b => {
      st.rho = Number(b.dataset.rho);
      $('divers-rho').querySelectorAll('[data-rho]').forEach(x => {
        x.setAttribute('aria-checked', String(x === b));
        x.tabIndex = x === b ? 0 : -1;
      });
      atualizar();
    };
    $('divers-n').addEventListener('input', e => { st.n = Number(e.target.value); atualizar(); });
    $('divers-rho').addEventListener('click', e => { const b = e.target.closest('[data-rho]'); if (b) marcarRho(b); });

    // Redesenha quando a largura muda. Um observador por página: o do guia anterior é desligado.
    let largura = 0;
    observadorDivers?.disconnect();
    observadorDivers = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (largura && w !== largura) desenhar();
      largura = w;
    });
    observadorDivers.observe($('divers-chart'));
    desenhar();
  },

  async liberdade(el) {
    const d = await dados();
    el.innerHTML = `
      <form class="tool" id="tool-liberdade" autocomplete="off">
        <h3 class="tool-title">${icon('umbrella', 16)} O seu número</h3>
        <div class="tool-grid">
          ${campo('gasto', 'Custo de vida por mês', d.gastoMes ? formatBRLRaw(d.gastoMes) : '', 'placeholder="R$ 0,00" maxlength="22"')}
          ${campo('taxa', 'Retirada anual (%)', '4', 'maxlength="5"')}
          ${campo('patrimonio', 'Já investido para isso', '', 'placeholder="R$ 0,00" maxlength="22"')}
          ${campo('aporte', 'Quanto investe por mês', d.renda ? formatBRLRaw(Math.round(d.renda * 0.25)) : '', 'placeholder="R$ 0,00" maxlength="22"')}
          ${campo('real', 'Rentabilidade acima da inflação (% ao ano)', '4', 'maxlength="5"')}
        </div>
        ${d.gastoMes ? `<p class="tool-fonte">Custo de vida preenchido com os gastos lançados em ${monthLabel(d.mes)}.</p>` : ''}
        <div class="tool-out" id="out-liberdade"></div>
      </form>`;
    const f = $('tool-liberdade');
    const calc = () => {
      const gasto = parseBRL(f.gasto.value), taxa = pctNum(f.taxa.value);
      if (!gasto || !taxa) return void ($('out-liberdade').innerHTML = '<p class="tool-fonte">Informe o custo de vida e a retirada anual.</p>');
      const numero = Math.round((gasto * 12) / (taxa / 100));
      const meses = mesesAte(parseBRL(f.patrimonio.value), numero, parseBRL(f.aporte.value), taxaMensal(Math.round(pctNum(f.real.value) * 100)));
      $('out-liberdade').innerHTML = `
        <div class="tool-res is-big"><span>Número da liberdade</span><strong class="num">${formatBRL(numero)}</strong><span class="tool-sub">${Math.round(100 / taxa)} vezes o seu custo anual</span></div>
        <div class="tool-res"><span>Tempo até lá</span><strong>${Number.isFinite(meses) ? duracao(meses) : 'mais de 100 anos'}</strong><span class="tool-sub">no ritmo de hoje</span></div>`;
    };
    ['gasto', 'patrimonio', 'aporte'].forEach(k => bindCurrencyInput(f[k], calc));
    f.addEventListener('input', calc);
    calc();
  }
};

/* ---------- Rotas e eventos ---------- */

function route() {
  observadorDivers?.disconnect(); // o gráfico de diversificação some ao trocar de tela
  const t = TOPICOS.find(x => `#${x.id}` === location.hash);
  if (t) renderTopico(t); else renderIndice();
  window.scrollTo(0, 0);
}

function bind() {
  bindPrivacyToggle($('btn-privacy'));
  window.addEventListener('datalife:privacy', route);
  window.addEventListener('hashchange', route);
  $('cons-body').addEventListener('click', e => {
    const ir = e.target.closest('[data-ir]');
    if (ir) {
      e.preventDefault();
      $(ir.dataset.ir)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });
  $('cons-body').addEventListener('change', e => {
    const c = e.target.closest('[data-fazer]');
    if (!c) return;
    const id = c.dataset.fazer;
    if (c.checked) state.feitos.add(id); else state.feitos.delete(id);
    c.closest('.fazer-item').classList.toggle('is-feito', c.checked);
    const t = TOPICOS.find(x => x.fazer.some(([fid]) => fid === id));
    const f = progresso(t);
    document.querySelector('.guia-prog').innerHTML = `${anel(f, t.fazer.length)}<span><strong class="num">${f} de ${t.fazer.length}</strong> ações</span>`;
    persist(saveFeitos(user.uid, state.feitos), () => { if (c.checked) state.feitos.delete(id); else state.feitos.add(id); route(); })
      .then(ok => ok && f === t.fazer.length && c.checked && showToast(`Guia "${t.titulo}" completo.`));
  });
}

initPagina();
bind();
try {
  state.feitos = await fetchFeitos(user.uid);
  dadosProntos();
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar seu progresso. Verifique a conexão e recarregue a página.', 'error', 6000);
}
route();
