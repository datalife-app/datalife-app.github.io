/* ============================================
   DataLife — Exercícios
   ============================================
   Referências: MuscleWiki (mapa do corpo clicável para escolher o
   músculo) e Hevy (passo a passo, dicas e exercícios próprios).
   Próprio do DataLife: mídia é um link seu (GIF/imagem aparece direto;
   YouTube só carrega no clique, pelo youtube-nocookie), mais anotações
   de carga e ajustes por exercício.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import { GRUPOS, EQUIPAMENTOS, EXERCICIOS } from './exercicios-data.js';
import { fetchDados, saveDados, midiaDe, LIMITES } from './exercicios-db.js';
import { enhanceSelect } from './selectpicker.js';
import { icon, escapeHtml, showToast, uid, debounce } from './utils.js';

const $ = id => document.getElementById(id);
const user = await requireAuth();

const state = { dados: { extras: {}, proprios: [] }, grupo: '', eq: '', busca: '', favs: false, aberto: null, editando: null };
const NOME_GRUPO = Object.fromEntries(GRUPOS.map(g => [g.id, g.nome]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Mapa do corpo (SVG, frente e costas) ----------
   Desenhado só o lado esquerdo; o direito é o espelho (x -> 120 - x).
   Cada forma vira um músculo clicável (no teclado, os botões de grupo
   abaixo do mapa fazem o mesmo). */

const ESPELHO = 'matrix(-1 0 0 1 120 0)';
const SILHUETA = 'M60 31c-2.6 0-4.4-1-5.4-2.6l-.6 4.8c-.3 3-2.4 5.4-5.6 6.5L38 43.5c-6.2 2-10.6 6.6-11.8 12.6l-2.6 14c-1 6-2.2 13-3.6 21L16.6 112c-.9 5-1.8 11-2.3 17l-1.1 9.6c-.4 3.2-.8 6.4-.7 8.2.2 2.4 2 3.4 3.8 2.6 1.4-.6 2.2-2.4 2.6-4.6l1.4-8.4c.6-4 2-9.4 3.6-14.2l6-19.4c1.4-4.8 2.6-10.6 3.4-15.4l2-9.6 1.4 14.6c.6 7.4.4 14.2-.6 20.4l-1.8 12c-1.2 8-1.6 16.2-1 24.6l1.6 21.2c.6 7.2 1.2 13.2 2.6 18.6l1.2 6c-1.6 6.6-2 14-1.4 21.4l1.6 18.6c.2 2.4-.6 4.6-2.2 6.6-1.2 1.6-.4 3.4 1.6 3.6l8.4.4c1.8 0 2.8-1.2 2.4-3l-1-4.6c-.4-2.4-.2-5 .4-7.6l2.4-14.8c.8-6.2.6-12.2-.6-18.4l.6-4c1.6-7.4 2.4-15.6 2.6-24.4l.4-17.4c.2-2.6 1.4-4.2 3.4-4.4z';
const CABECA = '<ellipse cx="60" cy="17" rx="10.5" ry="13" class="corpo"/>';

const FRENTE = [
  ['ombros', 'M38.6 44.4c-6.6 1.8-11.2 6.4-12.2 12.8-.6 4-.2 8 1.2 11.6 2.8-5.4 6.4-10 10.6-13.6 1.8-1.6 2.6-4 2.2-6.4z'],
  ['peito', 'M58.6 46.4c-6.4-.8-12.6 0-17.6 2.6-2.4 1.4-3.2 4.2-2.4 7l1.6 5.6c1.6 5 5.6 8.6 10.4 9.4 2.8.4 5.4.2 8-.6z'],
  ['biceps', 'M27.6 72.4c-2.2 5.8-3.4 12.4-3.4 19 0 2.4 1.8 4.2 4 4 2.6-.2 4.2-2.4 4.8-5l2.2-11.4c.6-3.6-.4-6.8-2.8-8.6-1.8-1.2-4-.6-4.8 2z'],
  ['antebraco', 'M22.4 99.6c-2.6 7.4-4.4 15.4-5 23.4-.2 2.6 1.6 4.4 3.8 4.2 2-.2 3.2-1.8 3.8-3.8l4.8-17c.8-3-.2-5.8-2.6-7.4-1.8-1.2-4-.6-4.8.6z'],
  ['abdomen', 'M51.6 74.6h6.6c.6 0 1 .4 1 1v7.4c0 .6-.4 1-1 1h-6.4c-1 0-1.8-.8-1.8-1.8v-5.8c0-1 .8-1.8 1.6-1.8zM51 86.6h7.2c.6 0 1 .4 1 1v8c0 .6-.4 1-1 1H51c-.8 0-1.4-.6-1.4-1.4v-7.2c0-.8.6-1.4 1.4-1.4zM51 99.2h7.2c.6 0 1 .4 1 1v8.6c0 .6-.4 1-1 1H51.6c-1 0-1.8-.8-1.8-1.8v-7.4c0-.8.6-1.4 1.2-1.4zM50.4 112.2h7.8c.6 0 1 .4 1 1V128c0 1-1 1.6-1.8 1.2-3.8-2-6.2-6-7.2-10.2l-.6-5c0-1 .2-1.8.8-1.8z'],
  ['abdomen', 'M44.2 74.4c-1.6 5.4-2 11.2-1.2 17l1.6 11.2c.6 4.2 1.6 8.4 3.2 12.2.6 1.2 1.6.8 1.6-.4l.2-27.6c0-4.4-1.6-8.6-4.4-12.2-.4-.6-.8-.6-1 0z'],
  ['quadriceps', 'M44.6 134.6c-3.2 8-4.6 17-4 26l1.4 15.2c.4 4.8 2.4 9 6 11.8 2.6 2 6 1.6 7.6-1 1.6-2.6 2.4-5.8 2.4-9l-.2-22.6c-.2-6.6-2.8-12.6-7.4-17.4-1.8-1.8-4.8-1.4-5.8 1z'],
  ['panturrilhas', 'M44.6 199.6c-1.6 7-1.6 14.2.2 21.2l1.6 6.4c.6 2.4 2.4 3.6 4.4 3.2 2-.4 3.2-2.2 3.4-4.4l.8-12.6c.4-5-.8-9.6-3.4-13.4-1.8-2.6-6-2.6-7 .4z']
];
const COSTAS = [
  ['costas', 'M60 33.6c-1.8 3.6-5.2 6.4-9.6 8l-8.4 3.2c5.4 2.2 10 6 13.2 11l4.8 8z'],
  ['ombros', 'M38.6 44.4c-6.6 1.8-11.2 6.4-12.2 12.8-.6 4-.2 8 1.2 11.6 2.8-5.4 6.4-10 10.6-13.6 1.8-1.6 2.6-4 2.2-6.4z'],
  ['costas', 'M41.4 54.6c-1.4 7.6-1.2 15.4.8 23l2.4 9c1.6 6 5.2 11.2 10 14.8l5.4 3.8V68.8c-2.6-5.4-6.6-9.8-11.6-12.8-2.2-1.4-4.6-1.8-7-1.4z'],
  ['costas', 'M53.4 104.8c2 2.4 4.2 4.4 6.6 5.8v10c-3.4-.6-6.2-2.6-7.6-5.6-.8-1.8-1-4-.6-6z'],
  ['triceps', 'M27.6 72.4c-2.2 5.8-3.4 12.4-3.4 19 0 2.4 1.8 4.2 4 4 2.6-.2 4.2-2.4 4.8-5l2.2-11.4c.6-3.6-.4-6.8-2.8-8.6-1.8-1.2-4-.6-4.8 2z'],
  ['antebraco', 'M22.4 99.6c-2.6 7.4-4.4 15.4-5 23.4-.2 2.6 1.6 4.4 3.8 4.2 2-.2 3.2-1.8 3.8-3.8l4.8-17c.8-3-.2-5.8-2.6-7.4-1.8-1.2-4-.6-4.8.6z'],
  ['gluteos', 'M59.2 123.2c-6.8-1.4-13.2 1.2-16 6.8-2.2 4.4-1.6 9.8 1.6 13.4 3.4 3.8 9.2 4.8 13.6 2.2l.8-.6z'],
  ['posteriores', 'M44.2 151.4c-2.4 8-3 16.4-1.6 24.6l1.4 7.6c.8 4 3.6 7 7.4 7.4 2.8.2 5.2-1.8 5.6-4.6l.8-9.6c.6-8.2-.8-16.4-4.2-23.8-1.8-3.8-7.8-4.4-9.4-1.6z'],
  ['panturrilhas', 'M44 198.4c-2.4 5.4-2.8 11.6-1.2 17.4l1.6 5.6c.8 2.8 3 4.4 5.6 4.2 2.4-.2 4-2.2 4.2-4.6l.4-9.6c.2-4.8-1.4-9.4-4.4-12.8-1.6-1.8-5-1.8-6.2-.2z']
];

function figura(partes, rotulo) {
  const lado = t => partes.map(([g, d]) => `<path d="${d}" class="mus" data-grupo="${g}"${t ? ` transform="${t}"` : ''}/>`).join('');
  return `
    <figure class="fig">
      <svg viewBox="8 2 104 254" aria-hidden="true">
        ${CABECA}<path d="${SILHUETA}" class="corpo"/><path d="${SILHUETA}" class="corpo" transform="${ESPELHO}"/>
        ${lado('')}${lado(ESPELHO)}
      </svg>
      <figcaption>${rotulo}</figcaption>
    </figure>`;
}

function renderMapa() {
  $('mapa').innerHTML = figura(FRENTE, 'Frente') + figura(COSTAS, 'Costas');
  pintarMapa();
}

function pintarMapa() {
  $('mapa').querySelectorAll('.mus').forEach(m => m.classList.toggle('is-sel', m.dataset.grupo === state.grupo));
  const n = {};
  for (const e of todos()) n[e.grupo] = (n[e.grupo] || 0) + 1;
  $('grupos').innerHTML = GRUPOS.map(g => `<button type="button" role="radio" class="grupo-chip" data-grupo="${g.id}" aria-checked="${state.grupo === g.id}">${g.nome}<span class="num">${n[g.id] || 0}</span></button>`).join('');
  $('mapa-todos').hidden = !state.grupo;
}

/* ---------- Lista ---------- */

function todos() {
  const proprios = state.dados.proprios.map(p => ({ ...p, proprio: true, nivel: 'Meu', dicas: [], erros: [], secundarios: [] }));
  return [...EXERCICIOS, ...proprios].map(e => ({ ...e, extra: e.proprio ? e : state.dados.extras[e.id] || {} }));
}

function renderLista() {
  const q = norm(state.busca.trim());
  const lista = todos().filter(e =>
    (!state.grupo || e.grupo === state.grupo || e.secundarios.includes(state.grupo)) &&
    (!state.eq || e.equipamento === state.eq) &&
    (!state.favs || e.extra.fav) &&
    (!q || norm(e.nome).includes(q)))
    // principal antes de secundário; favoritos primeiro
    .sort((a, b) => Number(b.grupo === state.grupo) - Number(a.grupo === state.grupo) || Number(!!b.extra.fav) - Number(!!a.extra.fav) || a.nome.localeCompare(b.nome, 'pt-BR'));
  $('lista-title').textContent = `${state.grupo ? NOME_GRUPO[state.grupo] : 'Todos os exercícios'} · ${lista.length}`;
  $('ex-lista').innerHTML = lista.map(e => `
    <li>
      <button type="button" class="ex-card" data-id="${escapeHtml(e.id)}">
        <span class="ex-thumb ${e.extra.midia ? 'has-midia' : ''}" aria-hidden="true">${icon(e.extra.midia ? (midiaDe(e.extra.midia)?.tipo === 'youtube' ? 'play' : 'eye') : 'dumbbell', 18)}</span>
        <span class="ex-info">
          <strong>${escapeHtml(e.nome)}${e.extra.fav ? ` <span class="ex-fav" title="Favorito">${icon('star', 13)}</span>` : ''}</strong>
          <span class="ex-meta">${NOME_GRUPO[e.grupo]}${state.grupo && e.grupo !== state.grupo ? ' (secundário)' : ''} · ${e.equipamento} · ${e.nivel}</span>
        </span>
      </button>
    </li>`).join('') || '<li class="ex-vazio">Nenhum exercício com esses filtros.</li>';
  const fav = $('so-favs');
  fav.innerHTML = `${icon('star', 14)} Favoritos`;
  fav.setAttribute('aria-pressed', state.favs);
}

/* ---------- Detalhe ---------- */

function midiaHtml(url, nome) {
  const m = midiaDe(url);
  if (!m) return `<div class="midia-vazia">${icon('dumbbell', 22)}<p>Cole abaixo o link de um GIF, imagem ou vídeo do YouTube que mostre a execução.</p></div>`;
  if (m.tipo === 'imagem') return `<img class="midia-img" src="${escapeHtml(m.url)}" alt="Demonstração: ${escapeHtml(nome)}" loading="lazy" referrerpolicy="no-referrer">`;
  if (m.tipo === 'youtube') return `<button type="button" class="midia-yt" data-yt="${escapeHtml(m.id)}">${icon('play', 22)}<span><strong>Ver o vídeo</strong><small>Carrega o player do YouTube só agora</small></span></button>`;
  return `<a class="midia-link" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${icon('externalLink', 16)} Abrir demonstração</a>`;
}

function renderDetalhe() {
  const e = todos().find(x => x.id === state.aberto);
  if (!e) return $('ex-dialog').close();
  $('ex-title').textContent = e.nome;
  $('ex-sub').textContent = [NOME_GRUPO[e.grupo], e.equipamento, e.nivel !== 'Meu' ? e.nivel : 'Meu exercício'].join(' · ');
  const fav = $('ex-fav');
  fav.innerHTML = icon('star', 18);
  fav.classList.toggle('is-on', !!e.extra.fav);
  fav.setAttribute('aria-pressed', !!e.extra.fav);
  fav.setAttribute('aria-label', e.extra.fav ? 'Tirar dos favoritos' : 'Favoritar');
  $('ex-editar').hidden = !e.proprio;
  $('ex-excluir').hidden = !e.proprio;
  const lista = (titulo, itens, ordenada = false) => itens.length ? `<h3 class="ex-h">${titulo}</h3><${ordenada ? 'ol' : 'ul'} class="ex-ul">${itens.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</${ordenada ? 'ol' : 'ul'}>` : '';
  $('ex-body').innerHTML = `
    <div class="ex-cols">
      <div class="midia" id="midia">${midiaHtml(e.extra.midia, e.nome)}</div>
      <div class="ex-texto">
        ${lista('Como fazer', e.passos, true)}
        ${lista('Dicas', e.dicas)}
        ${lista('Erros comuns', e.erros)}
        ${e.secundarios.length ? `<p class="ex-sec">Também trabalha: ${e.secundarios.map(g => NOME_GRUPO[g]).join(', ')}.</p>` : ''}
      </div>
    </div>
    <form class="ex-meu" id="ex-meu" autocomplete="off">
      <label class="field"><span class="field-label">Link do GIF, imagem ou vídeo (https)</span>
        <input class="input" name="midia" type="url" maxlength="${LIMITES.midia}" value="${escapeHtml(e.extra.midia || '')}" placeholder="https://"></label>
      <label class="field"><span class="field-label">Minhas anotações (carga, ajustes do aparelho, como me sinto)</span>
        <textarea class="input" name="nota" rows="2" maxlength="${LIMITES.nota}">${escapeHtml(e.extra.nota || '')}</textarea></label>
      <div class="ex-meu-foot"><span class="ex-salvo" id="ex-salvo"></span><button class="btn btn-primary btn-sm" type="submit">Salvar</button></div>
    </form>`;
}

/* ---------- Gravação ---------- */

function gravar(mudar, msg) {
  const prev = structuredClone(state.dados);
  mudar(state.dados);
  renderLista();
  if (state.aberto) renderDetalhe();
  persist(saveDados(user.uid, state.dados), () => { state.dados = prev; renderLista(); if (state.aberto) renderDetalhe(); })
    .then(ok => ok && msg && showToast(msg));
}

function setExtra(id, patch) {
  gravar(d => {
    const p = d.proprios.find(x => x.id === id);
    const alvo = p || (d.extras[id] ||= {});
    Object.assign(alvo, patch);
    for (const k of Object.keys(patch)) if (!alvo[k]) delete alvo[k];
  });
}

function bind() {
  $('btn-proprio').innerHTML = `${icon('plus', 15)} Meu exercício`;
  document.querySelector('.search-icon').innerHTML = icon('search', 15);
  const eq = $('filtro-eq');
  eq.innerHTML = '<option value="">Todos os equipamentos</option>' + EQUIPAMENTOS.map(e => `<option>${e}</option>`).join('');
  enhanceSelect(eq);
  eq.addEventListener('change', () => { state.eq = eq.value; renderLista(); });
  $('busca').addEventListener('input', debounce(e => { state.busca = e.target.value; renderLista(); }, 120));
  $('so-favs').addEventListener('click', () => { state.favs = !state.favs; renderLista(); });

  const escolher = g => { state.grupo = state.grupo === g ? '' : g; pintarMapa(); renderLista(); };
  $('mapa').addEventListener('click', e => { const m = e.target.closest('[data-grupo]'); if (m) escolher(m.dataset.grupo); });
  $('mapa').addEventListener('pointerover', e => {
    const m = e.target.closest('[data-grupo]');
    $('mapa').querySelectorAll('.mus').forEach(x => x.classList.toggle('is-hover', !!m && x.dataset.grupo === m.dataset.grupo));
  });
  $('mapa').addEventListener('pointerleave', () => $('mapa').querySelectorAll('.is-hover').forEach(x => x.classList.remove('is-hover')));
  $('grupos').addEventListener('click', e => { const b = e.target.closest('[data-grupo]'); if (b) escolher(b.dataset.grupo); });
  $('mapa-todos').addEventListener('click', () => escolher(state.grupo));

  for (const id of ['ex-dialog', 'proprio-dialog']) {
    $(id).querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
    $(id).querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(id).close()));
  }
  $('ex-dialog').addEventListener('close', () => { state.aberto = null; });
  $('ex-lista').addEventListener('click', e => {
    const c = e.target.closest('[data-id]');
    if (!c) return;
    state.aberto = c.dataset.id;
    renderDetalhe();
    $('ex-dialog').showModal();
  });
  $('ex-fav').addEventListener('click', () => {
    const e = todos().find(x => x.id === state.aberto);
    setExtra(e.id, { fav: !e.extra.fav });
  });
  $('ex-body').addEventListener('click', e => {
    const yt = e.target.closest('[data-yt]');
    if (!yt) return;
    $('midia').innerHTML = `<div class="midia-frame"><iframe title="Vídeo do exercício" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.dataset.yt)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  });
  $('ex-body').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const url = f.midia.value.trim();
    if (url && !midiaDe(url)) {
      f.midia.setCustomValidity('Use um link que comece com https://');
      f.midia.reportValidity();
      f.midia.addEventListener('input', () => f.midia.setCustomValidity(''), { once: true });
      return;
    }
    setExtra(state.aberto, { midia: midiaDe(url)?.url || '', nota: f.nota.value.trim() });
    showToast('Salvo no exercício.');
  });

  // Exercício próprio
  const pf = $('proprio-form');
  pf.grupo.innerHTML = GRUPOS.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
  pf.equipamento.innerHTML = EQUIPAMENTOS.map(e => `<option>${e}</option>`).join('');
  enhanceSelect(pf.grupo);
  enhanceSelect(pf.equipamento);
  const abrirProprio = p => {
    state.editando = p;
    pf.reset();
    pf.nome.value = p?.nome || '';
    pf.grupo.value = p?.grupo || state.grupo || 'peito';
    pf.equipamento.value = p?.equipamento || 'Halteres';
    pf.passos.value = (p?.passos || []).join('\n');
    pf.midia.value = p?.midia || '';
    $('proprio-dialog').showModal();
  };
  $('btn-proprio').addEventListener('click', () => abrirProprio(null));
  $('ex-editar').addEventListener('click', () => {
    const p = state.dados.proprios.find(x => x.id === state.aberto);
    $('ex-dialog').close();
    abrirProprio(p);
  });
  pf.addEventListener('submit', e => {
    e.preventDefault();
    if (!pf.nome.value.trim()) return pf.nome.reportValidity();
    if (pf.midia.value.trim() && !midiaDe(pf.midia.value)) {
      pf.midia.setCustomValidity('Use um link que comece com https://');
      pf.midia.reportValidity();
      pf.midia.addEventListener('input', () => pf.midia.setCustomValidity(''), { once: true });
      return;
    }
    if (!state.editando && state.dados.proprios.length >= LIMITES.proprios) return showToast(`Até ${LIMITES.proprios} exercícios próprios.`, 'error');
    const dados = {
      id: state.editando?.id || uid(),
      nome: pf.nome.value.trim().slice(0, LIMITES.nome),
      grupo: pf.grupo.value,
      equipamento: pf.equipamento.value,
      passos: pf.passos.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, LIMITES.passos),
      midia: midiaDe(pf.midia.value)?.url || '',
      nota: state.editando?.nota || '',
      fav: state.editando?.fav || false
    };
    $('proprio-dialog').close();
    gravar(d => {
      const i = d.proprios.findIndex(x => x.id === dados.id);
      if (i >= 0) d.proprios[i] = dados; else d.proprios.push(dados);
    }, state.editando ? 'Exercício salvo.' : `${dados.nome} adicionado.`);
  });
  $('ex-excluir').addEventListener('click', () => {
    const p = state.dados.proprios.find(x => x.id === state.aberto);
    $('ex-dialog').close();
    gravar(d => { d.proprios = d.proprios.filter(x => x.id !== p.id); });
    showToast(`${p.nome} excluído.`, 'success', 8000, { label: 'Desfazer', onClick: () => gravar(d => { d.proprios.push(p); }) });
  });
}

initPagina();
bind();
renderMapa();
try {
  state.dados = await fetchDados(user.uid);
  dadosProntos();
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar suas anotações e favoritos. Verifique a conexão e recarregue a página.', 'error', 6000);
}
renderLista();
