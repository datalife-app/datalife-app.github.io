/* ============================================
   DataLife — Lista de compras
   ============================================
   Referências (Listonic, Bring!, AnyList): itens agrupados por corredor
   na ordem do mercado, categoria automática ao digitar, sugestões pelo
   histórico, "de sempre" a um toque, preço opcional com total estimado.
   Feito para o celular: linhas grandes, toque marca "no carrinho".
   Uma lista por dia (o dia da compra) e o orçamento da semana: o valor
   mensal de alimentação (VR/VA) ÷ semanas do mês, contra o que já foi
   gasto de domingo a sábado.
   O VA vem do Orçamento doméstico (renda do mês) quando ele estiver lá.
   Ao concluir, o valor pago vira um gasto do Orçamento em Custos fixos:
   pago com o VA (desconta do saldo dele) ou com o salário.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import {
  fetchConfig, saveConfig, fetchDia, fetchDias, saveDia, semanaDe, semanasNoMes, gastoDoDia,
  CORREDORES, corredorDe, separarQtd, registrarComprados, LIMITES
} from './compras-db.js';
import { fetchMonth, addGasto, removeGasto } from './db.js';
import { enhanceSuggest, enhanceSelect } from './selectpicker.js';
import { icon, escapeHtml, showToast, uid, formatBRL, formatBRLRaw, parseBRL, bindCurrencyInput, debounce, dayKey, shiftDay, fromDayKey, MESES } from './utils.js';

const $ = id => document.getElementById(id);
const user = await requireAuth();

const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const hoje = () => dayKey(new Date());
let dia = hoje();
// `lista` = a lista do dia aberto + os frequentes (configuração), como antes
let lista = { itens: [], gasto: 0, frequentes: [] };
let config = { frequentes: [], alimentacao: 0 };
const dias = new Map(); // cache: dia -> {itens, gasto} (semana do orçamento)
let editando = null;
let novoId = null;
let editandoOrc = false;
// Mês do Orçamento doméstico do dia aberto: { key, va, gastoVA } (null = não lido)
let mes = null;

/* ---------- Gravação ---------- */

// Lista do dia: um documento por dia, com debounce
let anterior = null;
const gravar = debounce(() => {
  const d = dia, snap = { itens: structuredClone(lista.itens), gasto: lista.gasto };
  const volta = anterior;
  anterior = null;
  dias.set(d, snap);
  persist(saveDia(user.uid, d, snap), () => { if (volta && d === dia) { lista = { ...lista, ...volta }; render(); } });
}, 400);

function mudar(fn) {
  anterior ??= { itens: structuredClone(lista.itens), gasto: lista.gasto };
  fn();
  dias.set(dia, { itens: lista.itens, gasto: lista.gasto });
  render();
  gravar();
}

/** Frequentes e alimentação (configuração). */
function salvarConfig(next) {
  const prev = config;
  config = { ...config, ...next };
  lista.frequentes = config.frequentes;
  render();
  return persist(saveConfig(user.uid, config), () => { config = prev; lista.frequentes = prev.frequentes; render(); });
}

/* ---------- Tela ---------- */

const nomes = () => new Set(lista.itens.map(i => i.nome.toLowerCase()));

function linha(i) {
  return `
    <li class="item ${i.feito ? 'is-feito' : ''} ${i.id === novoId ? 'is-novo' : ''}" data-id="${escapeHtml(i.id)}">
      <button type="button" class="item-check" data-toggle aria-pressed="${i.feito}" aria-label="${i.feito ? 'Tirar do carrinho' : 'Pôr no carrinho'}: ${escapeHtml(i.nome)}">
        <span class="caixa" aria-hidden="true">${icon('check', 15)}</span>
        <span class="item-texto">
          ${i.qtd ? `<span class="item-qtd">${escapeHtml(i.qtd)}</span>` : ''}
          <span class="item-nome">${escapeHtml(i.nome)}</span>
        </span>
      </button>
      ${i.preco ? `<span class="item-preco num">${formatBRL(i.preco)}</span>` : ''}
      <button type="button" class="icon-btn" data-editar aria-label="Editar ${escapeHtml(i.nome)}">${icon('pencil', 15)}</button>
    </li>`;
}

const fmtDia = k => { const d = fromDayKey(k); return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; };

function renderDia() {
  const h = hoje();
  $('dia-label').textContent = fmtDia(dia);
  $('dia-sub').textContent = dia === h ? `Hoje, ${SEMANA[fromDayKey(dia).getDay()]}` : dia === shiftDay(h, 1) ? 'Amanhã' : dia === shiftDay(h, -1) ? 'Ontem' : SEMANA[fromDayKey(dia).getDay()];
  $('dia-hoje').hidden = dia === h;
}

/** VA do Orçamento doméstico (mês do dia aberto), se houver; senão, o valor separado aqui. */
const vaDoMes = () => mes?.va || 0;
const alimentacao = () => vaDoMes() || config.alimentacao;

/** Orçamento da semana: alimentação do mês ÷ semanas do mês, contra o gasto de domingo a sábado. */
function renderOrcamento() {
  const el = $('orc-semana');
  const semana = semanaDe(dia);
  const nSem = semanasNoMes(dia);
  const doOrc = vaDoMes() > 0;
  const mensal = alimentacao();
  if (!mensal || (editandoOrc && !doOrc)) {
    el.innerHTML = `
      <form class="orc-form" id="orc-form" autocomplete="off">
        <label class="field">
          <span class="field-label">Quanto você separa do salário para o mercado por mês?</span>
          <input class="input num" name="valor" inputmode="numeric" placeholder="R$ 0,00" maxlength="22" value="${config.alimentacao ? formatBRLRaw(config.alimentacao) : ''}">
        </label>
        <button class="btn btn-primary" type="submit">Calcular a semana</button>
        ${config.alimentacao ? '<button class="btn btn-ghost" type="button" data-orc-cancelar>Cancelar</button>' : ''}
        <p class="orc-form-dica">Recebe VA/VR? Informe na <a href="budget.html#monthly">renda do Orçamento doméstico</a> e ele aparece aqui.
          <button class="link-btn" type="button" data-registrar>Registrar valor gasto</button></p>
      </form>`;
    bindCurrencyInput($('orc-form').valor);
    return;
  }
  const limite = Math.round(mensal / nSem);
  const lida = semana.every(k => dias.has(k));
  const gasto = semana.reduce((a, k) => a + (dias.has(k) ? gastoDoDia(dias.get(k)) : 0), 0);
  const resta = limite - gasto;
  const pct = limite ? Math.min(1, gasto / limite) : 0;
  const ini = fromDayKey(semana[0]), fim = fromDayKey(semana[6]);
  el.innerHTML = `
    <div class="orc-card ${resta < 0 ? 'is-acima' : ''}">
      <div class="orc-topo">
        <div>
          <span class="orc-rotulo">Pode gastar nesta semana</span>
          <strong class="orc-valor num">${formatBRL(limite)}</strong>
          <span class="orc-sub">${doOrc ? 'VA de ' : ''}${formatBRL(mensal)} no mês ÷ ${nSem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} semanas · ${ini.getDate()}/${ini.getMonth() + 1} a ${fim.getDate()}/${fim.getMonth() + 1}</span>
        </div>
        ${doOrc
          ? '<a class="link-btn" href="budget.html#monthly" title="O VA vem da renda do Orçamento doméstico">Mudar no orçamento</a>'
          : '<button class="link-btn" type="button" data-orc-editar>Mudar valor</button>'}
      </div>
      <div class="orc-bar" role="img" aria-label="Gasto ${formatBRL(gasto)} de ${formatBRL(limite)}"><i style="transform:scaleX(${pct})"></i></div>
      <div class="orc-linha">
        <span>Gasto na semana <strong class="num">${lida ? formatBRL(gasto) : '…'}</strong></span>
        <span>${resta >= 0 ? 'Ainda pode' : 'Passou'} <strong class="num">${formatBRL(Math.abs(resta))}</strong></span>
      </div>
      ${doOrc ? `<div class="orc-linha orc-va ${mes.va - mes.gastoVA < 0 ? 'is-acima' : ''}">
        <span>Saldo do VA no mês <strong class="num">${formatBRL(mes.va - mes.gastoVA)}</strong></span>
      </div>` : ''}
      <div class="orc-pe">
        <p class="orc-dica">Conta as compras concluídas e os itens com preço no carrinho.</p>
        <button class="link-btn" type="button" data-registrar>Registrar valor gasto</button>
      </div>
    </div>`;
}

function render() {
  renderDia();
  renderOrcamento();
  const pendentes = lista.itens.filter(i => !i.feito);
  const feitos = lista.itens.filter(i => i.feito);
  const ja = nomes();
  const sempre = lista.frequentes.filter(f => !ja.has(f.nome.toLowerCase())).slice(0, 14);
  $('sempre').hidden = !sempre.length;
  $('sempre-list').innerHTML = sempre.map(f => `<button type="button" class="sempre-chip" data-sempre="${escapeHtml(f.nome)}">${icon('plus', 13)}${escapeHtml(f.nome)}</button>`).join('');

  // Linhas em branco no fim: a folha nunca fica "curta"
  const pauta = n => '<div class="pauta" aria-hidden="true"></div>'.repeat(Math.max(0, n));
  if (!lista.itens.length) {
    $('lista').innerHTML = `
      <p class="lista-vazia"><strong>Lista vazia.</strong> Escreva acima: o item vai sozinho para o corredor certo.${lista.frequentes.length ? ' Ou toque nos itens de sempre.' : ''}</p>
      ${pauta(5)}`;
  } else {
    const grupos = CORREDORES.map(c => ({ c, its: pendentes.filter(i => i.cat === c.id) })).filter(g => g.its.length);
    $('lista').innerHTML = grupos.map(({ c, its }) => `
      <section class="corredor">
        <h3 class="corredor-title">${c.nome} <span class="num">${its.length}</span></h3>
        <ul class="itens">${its.map(linha).join('')}</ul>
      </section>`).join('') + (pendentes.length ? '' : '<p class="tudo-ok">Tudo no carrinho.</p>') + (feitos.length ? `
      <section class="corredor carrinho">
        <h3 class="corredor-title">${icon('cart', 14)} No carrinho <span class="num">${feitos.length}</span></h3>
        <ul class="itens">${feitos.map(linha).join('')}</ul>
      </section>` : '') + pauta(3 - Math.floor(lista.itens.length / 4));
  }
  novoId = null;
  $('folha-conta').textContent = lista.itens.length ? `${feitos.length} de ${lista.itens.length} no carrinho` : '';

  const comPreco = lista.itens.filter(i => i.preco);
  const somaPreco = its => formatBRL(its.reduce((a, i) => a + i.preco, 0));
  const totalLinha = (rotulo, valor) => `<div class="total-linha"><span>${rotulo}</span><i aria-hidden="true"></i><strong class="num">${valor}</strong></div>`;
  $('totais').hidden = !comPreco.length;
  $('totais').innerHTML = comPreco.length
    ? totalLinha('Estimado', somaPreco(comPreco)) + totalLinha('No carrinho', somaPreco(comPreco.filter(i => i.feito)))
    : '';
  const btn = $('btn-limpar');
  btn.disabled = !feitos.length;
  btn.innerHTML = `${icon('check', 15)} Concluir compra${feitos.length ? ` (${feitos.length})` : ''}`;
}

/* ---------- Ações ---------- */

function adicionar(texto) {
  const { qtd, nome } = separarQtd(texto);
  if (!nome) return;
  if (lista.itens.length >= LIMITES.itens) return showToast(`Até ${LIMITES.itens} itens.`, 'error');
  const existente = lista.itens.find(i => i.nome.toLowerCase() === nome.toLowerCase());
  if (existente) {
    mudar(() => { existente.feito = false; if (qtd) existente.qtd = qtd; });
    return showToast(`${existente.nome} já estava na lista.`);
  }
  const item = { id: uid(), nome: nome.slice(0, LIMITES.nome), qtd: qtd.slice(0, LIMITES.qtd), cat: corredorDe(nome, lista.frequentes), feito: false };
  novoId = item.id;
  mudar(() => lista.itens.push(item));
}

/* ---------- Valor pago -> Orçamento doméstico ---------- */

/** Lança a compra no Orçamento (Custos fixos), pago com o VA ou com o salário. Devolve como desfazer. */
function lancarNoOrcamento(valor, comVA) {
  const key = dia.slice(0, 7);
  const gasto = { id: uid(), cat: 'custosFixos', desc: 'Mercado', valor, data: dia };
  if (comVA) gasto.va = true;
  const contaVA = d => { if (comVA && mes?.key === key) { mes.gastoVA += d; renderOrcamento(); } };
  contaVA(valor);
  persist(addGasto(user.uid, key, gasto), () => contaVA(-valor));
  return () => { contaVA(-valor); persist(removeGasto(user.uid, key, gasto), () => contaVA(valor)); };
}

let pagaComVA = true;
function marcarPagamento(va) {
  pagaComVA = va;
  $('compra-pag').querySelectorAll('[data-pag]').forEach(b => b.setAttribute('aria-checked', String((b.dataset.pag === 'va') === va)));
  $('compra-dica').textContent = va
    ? `Entra no Orçamento doméstico em Custos fixos e desconta do saldo do VA (${formatBRL(mes.va - mes.gastoVA)}).`
    : 'Entra no Orçamento doméstico em Custos fixos (sai do salário).';
}

/** Abre o "quanto deu?": ao concluir a compra do carrinho ou para registrar uma compra sem lista. */
function abrirCompra() {
  const feitos = lista.itens.filter(i => i.feito);
  const estimado = feitos.reduce((a, i) => a + (i.preco || 0), 0);
  const f = $('compra-form');
  $('compra-title').textContent = feitos.length ? 'Quanto deu a compra?' : 'Registrar valor gasto';
  $('compra-sub').textContent = feitos.length
    ? `${feitos.length} ${feitos.length === 1 ? 'item' : 'itens'} no carrinho${estimado ? ` · estimado ${formatBRL(estimado)}` : ''}`
    : `Compra de ${fmtDia(dia)} no mercado`;
  $('compra-valor-label').textContent = feitos.length ? 'Valor pago (opcional)' : 'Valor pago';
  f.valor.value = estimado ? formatBRLRaw(estimado) : '';
  f.valor.required = !feitos.length;
  $('compra-ok').textContent = feitos.length ? 'Concluir compra' : 'Registrar';
  const temVA = vaDoMes() > 0;
  $('compra-pag').hidden = !temVA;
  marcarPagamento(temVA);
  $('compra-dialog').showModal();
  f.valor.focus();
  f.valor.select();
}

/** "Concluir compra": tira o que está no carrinho, ensina os "de sempre" e lança o valor pago no Orçamento. */
function concluir(valor, comVA) {
  const feitos = lista.itens.filter(i => i.feito);
  if (!feitos.length && !valor) return;
  const antes = { itens: structuredClone(lista.itens), gasto: lista.gasto };
  const freqAntes = config.frequentes;
  // Sem valor pago, vale a soma dos preços (como antes); com valor, ele manda
  const total = valor || feitos.reduce((a, i) => a + (i.preco || 0), 0);
  mudar(() => {
    lista.itens = lista.itens.filter(i => !i.feito);
    lista.gasto += total; // o que custou fica no dia, para o orçamento da semana
  });
  if (feitos.length) salvarConfig({ frequentes: registrarComprados(config.frequentes, feitos) });
  const desfazLanc = valor ? lancarNoOrcamento(valor, comVA) : null;
  const msg = feitos.length
    ? `Compra concluída: ${feitos.length} ${feitos.length === 1 ? 'item' : 'itens'}${total ? `, ${formatBRL(total)}` : ''}.`
    : `Compra de ${formatBRL(total)} registrada.`;
  showToast(`${msg}${valor ? ` Lançada no orçamento${comVA ? ' (VA)' : ''}.` : ''}`, 'success', 6000, {
    label: 'Desfazer',
    onClick: () => {
      mudar(() => { lista.itens = antes.itens; lista.gasto = antes.gasto; });
      if (feitos.length) salvarConfig({ frequentes: freqAntes });
      desfazLanc?.();
    }
  });
}

function bind() {
  $('add-btn').innerHTML = `${icon('plus', 15)}<span class="add-txt">Adicionar</span>`;
  $('add-btn').setAttribute('aria-label', 'Adicionar');
  enhanceSuggest($('add-item'), () => lista.frequentes.map(f => f.nome).filter(n => !nomes().has(n.toLowerCase())));
  $('add-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('add-item').value;
    if (!v.trim()) return;
    adicionar(v);
    $('add-item').value = '';
    $('add-item').focus();
  });
  $('sempre-list').addEventListener('click', e => {
    const b = e.target.closest('[data-sempre]');
    if (b) adicionar(b.dataset.sempre);
  });
  $('btn-limpar').addEventListener('click', abrirCompra);
  $('dia-prev').innerHTML = icon('chevronLeft');
  $('dia-next').innerHTML = icon('chevronRight');
  $('dia-prev').addEventListener('click', () => abrirDia(shiftDay(dia, -1)));
  $('dia-next').addEventListener('click', () => abrirDia(shiftDay(dia, 1)));
  $('dia-hoje').addEventListener('click', () => abrirDia(hoje()));
  $('orc-semana').addEventListener('submit', e => {
    e.preventDefault();
    const v = parseBRL(e.target.valor.value);
    if (!v) return e.target.valor.focus();
    editandoOrc = false;
    salvarConfig({ alimentacao: v });
  });
  $('orc-semana').addEventListener('click', e => {
    if (e.target.closest('[data-orc-editar]')) { editandoOrc = true; renderOrcamento(); $('orc-form').valor.focus(); }
    if (e.target.closest('[data-orc-cancelar]')) { editandoOrc = false; renderOrcamento(); }
    if (e.target.closest('[data-registrar]')) abrirCompra();
  });

  const cf = $('compra-form');
  const cdlg = $('compra-dialog');
  bindCurrencyInput(cf.valor);
  cdlg.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  cdlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => cdlg.close()));
  $('compra-pag').addEventListener('click', e => {
    const b = e.target.closest('[data-pag]');
    if (b) marcarPagamento(b.dataset.pag === 'va');
  });
  cf.addEventListener('submit', e => {
    e.preventDefault();
    const valor = parseBRL(cf.valor.value);
    if (cf.valor.required && !valor) return cf.valor.focus();
    cdlg.close();
    concluir(valor, pagaComVA && vaDoMes() > 0);
  });

  $('lista').addEventListener('click', e => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const item = lista.itens.find(i => i.id === li.dataset.id);
    if (e.target.closest('[data-toggle]')) {
      mudar(() => { item.feito = !item.feito; });
      // o foco segue o item, que muda de seção
      $('lista').querySelector(`[data-id="${CSS.escape(item.id)}"] [data-toggle]`)?.focus({ preventScroll: true });
    } else if (e.target.closest('[data-editar]')) abrir(item);
  });

  const f = $('item-form');
  f.cat.innerHTML = CORREDORES.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  enhanceSelect(f.cat);
  bindCurrencyInput(f.preco);
  const dlg = $('item-dialog');
  dlg.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const nome = f.nome.value.trim();
    if (!nome) return f.nome.reportValidity();
    dlg.close();
    mudar(() => Object.assign(editando, {
      nome: nome.slice(0, LIMITES.nome), qtd: f.qtd.value.trim().slice(0, LIMITES.qtd), cat: f.cat.value, preco: parseBRL(f.preco.value) || undefined
    }));
  });
  $('item-excluir').addEventListener('click', () => {
    const item = editando;
    const at = lista.itens.indexOf(item);
    dlg.close();
    mudar(() => { lista.itens = lista.itens.filter(i => i !== item); });
    showToast(`${item.nome} removido.`, 'success', 6000, { label: 'Desfazer', onClick: () => mudar(() => lista.itens.splice(at, 0, item)) });
  });
  window.addEventListener('pagehide', () => gravar.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) gravar.flush(); });
}

function abrir(item) {
  editando = item;
  const f = $('item-form');
  $('item-title').textContent = item.nome;
  f.nome.value = item.nome;
  f.qtd.value = item.qtd;
  f.preco.value = item.preco ? formatBRLRaw(item.preco) : '';
  f.cat.value = item.cat;
  $('item-dialog').showModal();
}

/** VA e quanto dele já foi gasto, no mês do Orçamento doméstico de um dia. Falhar não trava a lista. */
async function lerMes(k) {
  const key = k.slice(0, 7);
  if (mes?.key === key && !mes.erro) return mes;
  try {
    const m = await fetchMonth(user.uid, key);
    return { key, va: m.va, gastoVA: m.gastos.reduce((a, g) => a + (g.va ? g.valor : 0), 0) };
  } catch (e) {
    console.error(e);
    return { key, va: 0, gastoVA: 0, erro: true }; // a próxima abertura tenta de novo
  }
}

/** Abre a lista de outro dia (e lê a semana dele para o orçamento). */
let seqDia = 0;
async function abrirDia(k) {
  gravar.flush();
  const seq = ++seqDia;
  const main = $('view-compras');
  const travada = main.inert; // na abertura, a trava geral (pagina.js) ainda está ligada
  main.inert = true;
  try {
    const semana = semanaDe(k);
    const faltam = semana.filter(x => !dias.has(x));
    if (faltam.length) {
      const lidos = await fetchDias(user.uid, semana[0], semana[6]);
      for (const x of semana) if (!dias.has(x)) dias.set(x, lidos.get(x) || { itens: [], gasto: 0 });
    }
    if (!dias.has(k)) dias.set(k, await fetchDia(user.uid, k));
    const m = await lerMes(k);
    if (seq !== seqDia) return;
    mes = m;
    dia = k;
    const d = dias.get(k);
    lista = { itens: structuredClone(d.itens), gasto: d.gasto, frequentes: config.frequentes };
    render();
    main.inert = travada;
    return true;
  } catch (e) {
    console.error(e);
    showToast('Não foi possível abrir esse dia. Verifique a conexão.', 'error', 5000);
    // Continua na lista que já estava na tela (a do dia anterior, intacta);
    // na abertura, segue travada: a lista vazia gravaria por cima da real
    main.inert = travada;
    return false;
  }
}

initPagina();
bind();
try {
  const cfg = await fetchConfig(user.uid);
  config = { frequentes: cfg.frequentes, alimentacao: cfg.alimentacao };
  if (!(await abrirDia(dia))) throw new Error('lista do dia não lida');
  // Formato antigo: os itens de compras/lista passam para a lista de hoje (uma vez)
  if (cfg.legado.length) {
    const ids = new Set(lista.itens.map(i => i.id));
    lista.itens = [...lista.itens, ...cfg.legado.filter(i => !ids.has(i.id))].slice(0, LIMITES.itens);
    // Primeiro grava os itens no dia; só depois tira do formato antigo (sem risco de perder)
    await saveDia(user.uid, dia, { itens: lista.itens, gasto: lista.gasto });
    dias.set(dia, { itens: lista.itens, gasto: lista.gasto });
    await saveConfig(user.uid, config);
  }
  dadosProntos();
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar a lista. Verifique a conexão.', 'error', 6000);
}
render();
