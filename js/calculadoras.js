/* ============================================
   DataLife — Calculadoras e simuladores
   ============================================
   Referência: as calculadoras do Investidor Sardinha. Cinco simuladores
   que recalculam enquanto você digita (nada é salvo): Primeiro milhão, Tempo até a meta,
   Juros compostos, Renda (retiradas) e Aposentadoria. Cada um mostra os
   números principais, gráficos com dica ao passar o mouse, insights e a
   tabela ano a ano.
   Rotas: #milhao, #meta, #juros, #renda, #aposentadoria. Valores podem vir na
   rota (#renda?inicial=100000000, em centavos), para um simulador
   continuar de onde o outro parou.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, dadosProntos } from './pagina.js';
import { fetchMonth } from './db.js';
import { icon, bindCurrencyInput, bindPrivacyToggle, monthKey, debounce } from './utils.js';
import { $, lerForm, preencher, marcarSeg } from './calculadoras-ui.js';
import milhao from './calculadora-milhao.js';
import meta from './calculadora-meta.js';
import juros from './calculadora-juros.js';
import renda from './calculadora-renda.js';
import aposentadoria from './calculadora-aposentadoria.js';

const user = await requireAuth();
const CALCS = [milhao, meta, juros, renda, aposentadoria];

/* ============================================
   Páginas e rotas
   ============================================ */

// `vez` muda a cada troca de tela: uma leitura que termina depois de você sair não pinta nada
const state = { calc: null, depois: null, renda: null, vez: 0 };

function renderIndice() {
  state.vez++;
  document.title = 'Calculadoras · DataLife';
  $('titulo').textContent = 'Calculadoras e simuladores';
  $('subtitulo').hidden = false;
  const voltar = $('voltar');
  voltar.href = 'hub.html';
  voltar.lastChild.textContent = 'Hub';
  state.calc = null;
  state.depois = null;
  $('calc-body').innerHTML = `
    <ul class="calc-indice">${CALCS.map(c => `
      <li><a class="calc-item" href="#${c.id}">
        <span class="calc-item-icon">${icon(c.icone, 22)}</span>
        <span class="calc-item-txt"><strong>${c.nome}</strong><span>${c.desc}</span></span>
        <span class="calc-item-go">${icon('arrowRight', 18)}</span>
      </a></li>`).join('')}</ul>
    <p class="calc-aviso">${icon('info', 15)}Simulações educativas, com taxa constante e sem impostos nem taxas. Não são recomendação de investimento. Nada do que você digita aqui é salvo.</p>`;
}

/** Valores da rota (#renda?inicial=…): só os campos que o simulador tem; números viram número. */
function parametros(qs, c) {
  const p = {};
  new URLSearchParams(qs).forEach((val, k) => {
    if (Object.hasOwn(c.exemplo, k)) p[k] = /^\d+(\.\d+)?$/.test(val) ? Number(val) : val;
  });
  return p;
}

async function renderCalc(c, qs) {
  const vez = ++state.vez;
  const daRota = parametros(qs, c);
  // Aposentadoria: a renda vem do Orçamento do mês. Lê antes de montar o formulário,
  // para não sobrescrever o que você começar a digitar enquanto a leitura não volta.
  const renda = c.id === 'aposentadoria' && !('renda' in daRota) ? await rendaDoMes() : 0;
  if (vez !== state.vez) return; // trocou de tela enquanto lia

  document.title = `${c.nome} · Calculadoras · DataLife`;
  $('titulo').textContent = c.nome;
  $('subtitulo').hidden = true;
  const voltar = $('voltar');
  voltar.href = '#';
  voltar.lastChild.textContent = 'Calculadoras';
  state.calc = c;
  $('calc-body').innerHTML = `
    <nav class="calc-tabs" aria-label="Simuladores">${CALCS.map(x => `<a href="#${x.id}" ${x === c ? 'aria-current="page"' : ''}>${icon(x.icone, 15)}<span>${x.nome}</span></a>`).join('')}</nav>
    <form class="card calc-form" id="calc-form" autocomplete="off" novalidate>
      <p class="calc-resumo">${c.resumo}</p>
      <div class="calc-campos">${c.campos()}</div>
      <p class="calc-fonte" id="calc-fonte" ${renda ? '' : 'hidden'}>A renda veio do Orçamento deste mês. Ajuste se quiser.</p>
      <div class="calc-form-foot">
        <span class="calc-ao-vivo">${icon('activity', 14)} Calcula enquanto você digita · nada é salvo</span>
        <div class="calc-form-acoes">
          <button type="button" class="btn btn-ghost btn-sm" data-exemplo>Exemplo</button>
          <button type="button" class="btn btn-ghost btn-sm" data-limpar>Limpar</button>
        </div>
      </div>
    </form>
    <p class="sr-only" id="calc-anuncio" aria-live="polite"></p>
    <div class="calc-out" id="calc-out"></div>`;
  const f = $('calc-form');
  preencher(f, { ...c.exemplo, ...(renda ? { renda } : {}), ...daRota });
  f.querySelectorAll('[data-brl]').forEach(i => bindCurrencyInput(i));
  // Digitando: espera uma pausa curta para não redesenhar tudo a cada tecla
  const aoDigitar = debounce(recalcular, 120);
  f.addEventListener('input', aoDigitar);
  f.addEventListener('submit', e => e.preventDefault());
  const escolher = b => { marcarSeg(b.closest('[data-seg]'), b.dataset.v); recalcular(); };
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b) return escolher(b);
    if (e.target.closest('[data-limpar]')) {
      f.querySelectorAll('input').forEach(i => { i.value = ''; });
      $('calc-fonte').hidden = true;
      recalcular();
      f.querySelector('input').focus();
    }
    if (e.target.closest('[data-exemplo]')) {
      preencher(f, c.exemplo);
      $('calc-fonte').hidden = true;
      recalcular();
    }
  });
  recalcular();
}

async function rendaDoMes() {
  if (state.renda != null) return state.renda;
  try {
    state.renda = (await fetchMonth(user.uid, monthKey(new Date()))).renda || 0;
  } catch (e) {
    console.error(e);
    state.renda = 0;
  }
  return state.renda;
}

// Leitor de tela: anuncia só a frase principal, e só depois de uma pausa na digitação
const anunciar = debounce(() => {
  const h = document.querySelector('#calc-out .calc-hero, #calc-out .calc-vazio');
  const alvo = $('calc-anuncio');
  if (alvo) alvo.textContent = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
}, 900);

function recalcular() {
  const c = state.calc;
  const out = $('calc-out');
  if (!c || !out) return;
  // A tabela aberta continua aberta (e no mesmo ponto da rolagem) depois de recalcular
  const tab = out.querySelector('.calc-tabela');
  const aberta = tab?.open, rolagem = tab?.querySelector('.table-wrap')?.scrollTop || 0;
  const { html, depois } = c.calc(lerForm($('calc-form')));
  out.innerHTML = html;
  const nova = out.querySelector('.calc-tabela');
  if (nova && aberta) {
    nova.open = true;
    nova.querySelector('.table-wrap').scrollTop = rolagem;
  }
  state.depois = depois || null;
  state.depois?.();
  anunciar();
}

function route() {
  const [hash, qs = ''] = location.hash.slice(1).split('?');
  const c = CALCS.find(x => x.id === hash);
  if (c) renderCalc(c, qs); else renderIndice();
  window.scrollTo(0, 0);
}

initPagina();
bindPrivacyToggle($('btn-privacy'));
window.addEventListener('datalife:privacy', recalcular);
window.addEventListener('hashchange', route);
// Os gráficos se redesenham quando a largura muda (girar o celular, redimensionar a janela).
// A primeira medida só registra a largura: o gráfico acabou de ser desenhado.
let largura = 0;
new ResizeObserver(debounce(([e]) => {
  const w = Math.round(e.contentRect.width);
  if (largura && w !== largura) state.depois?.();
  largura = w;
}, 150)).observe($('calc-body'));
dadosProntos(); // nada a carregar antes: a renda do Orçamento é lida só na Aposentadoria
route();
