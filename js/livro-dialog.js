/* ============================================
   DataLife — Livros: ficha do livro (criar / editar)
   ============================================
   Trabalha numa cópia: só grava ao Salvar. Mudar a situação preenche
   as datas óbvias (começou a ler = hoje; terminou = hoje) sem apagar
   o que já estiver preenchido.
   ============================================ */

import { STATUS, LIMITES } from './livros-db.js';
import { enhanceDateInput } from './datepicker.js';
import { enhanceSuggest } from './selectpicker.js';
import { icon, escapeHtml, dayKey, showToast, uid } from './utils.js';

const $ = id => document.getElementById(id);

let ctx = null;     // { onSave(livro, novosLeitores), onDelete(livro), corDe(nome) }
let atual = null;   // livro em edição (null = novo)
let draft = null;   // { leitores:Set, status, avaliacao, citacoes:[] }
let conhecidos = []; // nomes de leitores cadastrados + criados nesta ficha
let sugestoes = { autores: [], generos: [] };

function renderLeitores() {
  $('leitores-pick').innerHTML = conhecidos.map(n => `
    <button type="button" class="leitor-chip ${draft.leitores.has(n) ? 'is-on' : ''}" data-leitor="${escapeHtml(n)}"
      aria-pressed="${draft.leitores.has(n)}" style="--c:${ctx.corDe(n)}"><i></i>${escapeHtml(n)}</button>`).join('') + `
    <input class="input leitor-novo" id="leitor-novo" maxlength="${LIMITES.leitor}" placeholder="+ Leitor" aria-label="Adicionar leitor">`;
}

function renderStatus() {
  $('status-pick').innerHTML = Object.entries(STATUS).map(([k, s]) =>
    `<button type="button" role="radio" data-status="${k}" aria-checked="${draft.status === k}">${s.nome}</button>`).join('');
  $('field-pagina').hidden = draft.status !== 'lendo';
  $('field-fim').hidden = !['lido', 'abandonado'].includes(draft.status);
  $('field-fim').querySelector('.field-label').textContent = draft.status === 'abandonado' ? 'Parei em' : 'Fim da leitura';
}

function renderStars(preview = null) {
  const n = preview ?? draft.avaliacao;
  $('stars-pick').innerHTML = [1, 2, 3, 4, 5].map(i => `
    <button type="button" role="radio" class="star ${i <= n ? 'is-on' : ''}" data-star="${i}" aria-checked="${draft.avaliacao === i}"
      aria-label="${i} ${i === 1 ? 'estrela' : 'estrelas'}">${icon('star', 22)}</button>`).join('') +
    `<span class="stars-label">${draft.avaliacao ? `${draft.avaliacao} de 5` : 'Sem nota'}</span>`;
}

function renderCitacoes() {
  $('cit-list').innerHTML = draft.citacoes.map(c => `
    <li data-cit="${escapeHtml(c.id)}">
      <blockquote>${escapeHtml(c.texto)}</blockquote>
      ${c.pagina ? `<span class="cit-pag num">p. ${c.pagina}</span>` : '<span></span>'}
      <button class="icon-btn danger" type="button" data-cit-remove aria-label="Apagar citação">${icon('trash', 14)}</button>
    </li>`).join('');
  $('cit-add').disabled = draft.citacoes.length >= LIMITES.citacoes;
}

function setStatus(status) {
  const f = $('livro-form');
  const hoje = dayKey(new Date());
  draft.status = status;
  if (['lendo', 'lido', 'abandonado'].includes(status) && !f.inicio.value) f.inicio.value = hoje;
  if (['lido', 'abandonado'].includes(status) && !f.fim.value) f.fim.value = hoje;
  if (status === 'lendo' || status === 'quero') f.fim.value = '';
  if (status === 'quero') f.inicio.value = '';
  renderStatus();
}

/**
 * @param {Object|null} livro
 * @param {{leitores:string[], autores:string[], generos:string[], status?:string}} opts
 */
export function openLivroDialog(livro, opts) {
  atual = livro;
  const f = $('livro-form');
  f.reset();
  conhecidos = [...opts.leitores];
  for (const n of livro?.leitores || []) if (!conhecidos.includes(n)) conhecidos.push(n);
  draft = {
    leitores: new Set(livro?.leitores || (conhecidos.length === 1 ? conhecidos : [])),
    status: livro?.status || opts.status || 'quero',
    avaliacao: livro?.avaliacao || 0,
    citacoes: (livro?.citacoes || []).map(c => ({ ...c }))
  };
  $('livro-title').textContent = livro ? 'Ficha do livro' : 'Novo livro';
  $('livro-sub').textContent = livro ? livro.titulo : 'Só o título é obrigatório.';
  $('livro-excluir').hidden = !livro;
  f.titulo.value = livro?.titulo || '';
  f.autor.value = livro?.autor || '';
  f.genero.value = livro?.genero || '';
  f.inicio.value = livro?.inicio || '';
  f.fim.value = livro?.fim || '';
  f.paginas.value = livro?.paginas || '';
  f.pagina.value = livro?.pagina ?? '';
  f.comentario.value = livro?.comentario || '';
  sugestoes = { autores: opts.autores, generos: opts.generos };
  renderLeitores();
  if (!livro && opts.status) setStatus(opts.status);
  else renderStatus();
  renderStars();
  renderCitacoes();
  $('livro-dialog').showModal();
  if (!livro) f.titulo.focus();
}

function addLeitor(input) {
  const nome = input.value.trim().slice(0, LIMITES.leitor);
  if (!nome) return;
  const existente = conhecidos.find(n => n.toLowerCase() === nome.toLowerCase());
  const n = existente || nome;
  if (!existente) conhecidos.push(n);
  draft.leitores.add(n);
  renderLeitores();
  $('leitor-novo').focus();
}

function addCitacao() {
  const texto = $('cit-texto').value.trim();
  if (!texto) return $('cit-texto').focus();
  const pagina = parseInt($('cit-pagina').value, 10);
  draft.citacoes.push({ id: uid(), texto, ...(pagina > 0 ? { pagina } : {}) });
  $('cit-texto').value = '';
  $('cit-pagina').value = '';
  renderCitacoes();
  $('cit-texto').focus();
}

export function initLivroDialog(options) {
  ctx = options;
  const dialog = $('livro-dialog');
  const f = $('livro-form');
  dialog.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  enhanceDateInput(f.inicio);
  enhanceDateInput(f.fim);
  enhanceSuggest(f.autor, () => sugestoes.autores);
  enhanceSuggest(f.genero, () => sugestoes.generos);

  $('leitores-pick').addEventListener('click', e => {
    const b = e.target.closest('[data-leitor]');
    if (!b) return;
    const n = b.dataset.leitor;
    if (draft.leitores.has(n)) draft.leitores.delete(n);
    else draft.leitores.add(n);
    renderLeitores();
    $('leitores-pick').querySelector(`[data-leitor="${CSS.escape(n)}"]`)?.focus();
  });
  $('leitores-pick').addEventListener('keydown', e => {
    if (e.target.id === 'leitor-novo' && e.key === 'Enter') {
      e.preventDefault();
      addLeitor(e.target);
    }
  });
  $('leitores-pick').addEventListener('focusout', e => {
    if (e.target.id === 'leitor-novo' && e.target.value.trim()) addLeitor(e.target);
  });

  $('status-pick').addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (b) setStatus(b.dataset.status);
  });

  const stars = $('stars-pick');
  stars.addEventListener('click', e => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    const n = Number(b.dataset.star);
    draft.avaliacao = draft.avaliacao === n ? 0 : n; // clicar na mesma estrela tira a nota
    renderStars();
    stars.querySelector(`[data-star="${n}"]`)?.focus();
  });
  // Prévia ao passar o mouse (só com ponteiro fino)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stars.addEventListener('pointerover', e => {
      const b = e.target.closest('[data-star]');
      if (b) stars.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('is-preview', Number(s.dataset.star) <= Number(b.dataset.star)));
    });
    stars.addEventListener('pointerleave', () => stars.querySelectorAll('.is-preview').forEach(s => s.classList.remove('is-preview')));
  }

  $('cit-add').addEventListener('click', addCitacao);
  $('cit-texto').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addCitacao(); }
  });
  $('cit-list').addEventListener('click', e => {
    const li = e.target.closest('[data-cit]');
    if (!li || !e.target.closest('[data-cit-remove]')) return;
    draft.citacoes = draft.citacoes.filter(c => c.id !== li.dataset.cit);
    renderCitacoes();
  });

  $('livro-excluir').addEventListener('click', () => {
    dialog.close();
    ctx.onDelete(atual);
  });

  f.addEventListener('submit', e => {
    e.preventDefault();
    const titulo = f.titulo.value.trim();
    if (!titulo) return f.titulo.reportValidity();
    const int = el => { const n = parseInt(el.value, 10); return Number.isFinite(n) && n > 0 ? n : undefined; };
    const paginas = int(f.paginas);
    let pagina = draft.status === 'lendo' ? int(f.pagina) : draft.status === 'lido' && paginas ? paginas : atual?.pagina;
    if (paginas && pagina > paginas) pagina = paginas;
    if (f.inicio.value && f.fim.value && f.fim.value < f.inicio.value) {
      showToast('O fim da leitura vem antes do início.', 'error');
      return;
    }
    // Citação digitada e não guardada: guarda junto
    if ($('cit-texto').value.trim()) addCitacao();
    const livro = {
      id: atual?.id || uid(),
      criado: atual?.criado || Date.now(),
      titulo,
      autor: f.autor.value.trim(),
      genero: f.genero.value.trim() || undefined,
      leitores: conhecidos.filter(n => draft.leitores.has(n)),
      status: draft.status,
      inicio: f.inicio.value || undefined,
      fim: ['lido', 'abandonado'].includes(draft.status) ? f.fim.value || undefined : undefined,
      paginas,
      pagina,
      avaliacao: draft.avaliacao,
      comentario: f.comentario.value.trim() || undefined,
      citacoes: draft.citacoes
    };
    Object.keys(livro).forEach(k => livro[k] === undefined && delete livro[k]);
    dialog.close();
    ctx.onSave(livro, conhecidos.filter(n => !ctx.cadastrados().includes(n) && draft.leitores.has(n)), !atual);
  });
}
