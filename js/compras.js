/* ============================================
   DataLife — Lista de compras
   ============================================
   Referências (Listonic, Bring!, AnyList): itens agrupados por corredor
   na ordem do mercado, categoria automática ao digitar, sugestões pelo
   histórico, "de sempre" a um toque, preço opcional com total estimado.
   Feito para o celular: linhas grandes, toque marca "no carrinho".
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import { fetchLista, saveLista, CORREDORES, corredorDe, separarQtd, registrarComprados, LIMITES } from './compras-db.js';
import { enhanceSuggest, enhanceSelect } from './selectpicker.js';
import { icon, escapeHtml, showToast, uid, formatBRL, formatBRLRaw, parseBRL, bindCurrencyInput, debounce } from './utils.js';

const $ = id => document.getElementById(id);
const user = await requireAuth();

let lista = { itens: [], frequentes: [] };
let editando = null;
let novoId = null;

/* ---------- Gravação (lista pequena, um documento) ---------- */

let anterior = null;
const gravar = debounce(() => {
  const snap = structuredClone(lista);
  const volta = anterior;
  anterior = null;
  persist(saveLista(user.uid, snap), () => { if (volta) { lista = volta; render(); } });
}, 400);

function mudar(fn) {
  anterior ??= structuredClone(lista);
  fn();
  render();
  gravar();
}

/* ---------- Tela ---------- */

const nomes = () => new Set(lista.itens.map(i => i.nome.toLowerCase()));

function linha(i) {
  return `
    <li class="item ${i.feito ? 'is-feito' : ''} ${i.id === novoId ? 'is-novo' : ''}" data-id="${escapeHtml(i.id)}">
      <button type="button" class="item-check" data-toggle aria-pressed="${i.feito}" aria-label="${i.feito ? 'Tirar do carrinho' : 'Pôr no carrinho'}: ${escapeHtml(i.nome)}">
        <span class="bolinha" aria-hidden="true">${icon('check', 14)}</span>
        <span class="item-nome">${escapeHtml(i.nome)}</span>
        ${i.qtd ? `<span class="item-qtd">${escapeHtml(i.qtd)}</span>` : ''}
      </button>
      ${i.preco ? `<span class="item-preco num">${formatBRL(i.preco)}</span>` : ''}
      <button type="button" class="icon-btn" data-editar aria-label="Editar ${escapeHtml(i.nome)}">${icon('pencil', 15)}</button>
    </li>`;
}

function render() {
  const pendentes = lista.itens.filter(i => !i.feito);
  const feitos = lista.itens.filter(i => i.feito);
  const ja = nomes();
  const sempre = lista.frequentes.filter(f => !ja.has(f.nome.toLowerCase())).slice(0, 14);
  $('sempre').hidden = !sempre.length;
  $('sempre-list').innerHTML = sempre.map(f => `<button type="button" class="sempre-chip" data-sempre="${escapeHtml(f.nome)}">${icon('plus', 13)}${escapeHtml(f.nome)}</button>`).join('');

  if (!lista.itens.length) {
    $('lista').innerHTML = `
      <section class="lista-vazia">
        <span class="vazio-icon">${icon('cart', 24)}</span>
        <p><strong>Lista vazia.</strong> Escreva acima: o item vai sozinho para o corredor certo.</p>
        ${lista.frequentes.length ? '<p class="text-muted">Ou toque nos itens de sempre.</p>' : ''}
      </section>`;
  } else {
    const grupos = CORREDORES.map(c => ({ c, its: pendentes.filter(i => i.cat === c.id) })).filter(g => g.its.length);
    $('lista').innerHTML = grupos.map(({ c, its }) => `
      <section class="corredor">
        <h2 class="corredor-title">${c.nome} <span class="num">${its.length}</span></h2>
        <ul class="itens">${its.map(linha).join('')}</ul>
      </section>`).join('') + (pendentes.length ? '' : '<p class="tudo-ok">Tudo no carrinho.</p>') + (feitos.length ? `
      <section class="corredor carrinho">
        <h2 class="corredor-title">${icon('cart', 15)} No carrinho <span class="num">${feitos.length}</span></h2>
        <ul class="itens">${feitos.map(linha).join('')}</ul>
      </section>` : '');
  }
  novoId = null;

  const comPreco = lista.itens.filter(i => i.preco);
  $('totais').hidden = !comPreco.length;
  $('totais').innerHTML = comPreco.length ? `
    <span>Estimado <strong class="num">${formatBRL(comPreco.reduce((a, i) => a + i.preco, 0))}</strong></span>
    <span>No carrinho <strong class="num">${formatBRL(comPreco.filter(i => i.feito).reduce((a, i) => a + i.preco, 0))}</strong></span>` : '';
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

/** "Concluir compra": tira o que está no carrinho e ensina os "de sempre". */
function concluir() {
  const feitos = lista.itens.filter(i => i.feito);
  if (!feitos.length) return;
  const antes = structuredClone(lista);
  mudar(() => {
    lista.itens = lista.itens.filter(i => !i.feito);
    lista.frequentes = registrarComprados(lista.frequentes, feitos);
  });
  showToast(`Compra concluída: ${feitos.length} ${feitos.length === 1 ? 'item' : 'itens'}.`, 'success', 6000, {
    label: 'Desfazer',
    onClick: () => mudar(() => { lista = antes; })
  });
}

function bind() {
  $('add-btn').innerHTML = `${icon('plus', 16)}<span class="add-txt">Adicionar</span>`;
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
  $('btn-limpar').addEventListener('click', concluir);

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

initPagina();
bind();
try {
  lista = await fetchLista(user.uid);
  dadosProntos();
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar a lista. Verifique a conexão.', 'error', 6000);
}
render();
