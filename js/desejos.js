/* ============================================
   DataLife — Compras conscientes
   ============================================
   Referências de rastreadores de preço (Keepa, CamelCamelCamel, histórico
   de preços dos comparadores brasileiros): gráfico do histórico, menor e
   maior preço, alerta de "preço-alvo". Próprio do DataLife: veredito da
   Black Friday ("metade do dobro") quando o histórico cobre a data.
   ============================================ */

import { requireAuth } from './auth.js';
import { initPagina, persist, dadosProntos } from './pagina.js';
import {
  fetchDesejos, saveDesejo, deleteDesejo, analisar, analisarBlackFriday, linkSeguro, LIMITES
} from './desejos-db.js';
import { enhanceDateInput } from './datepicker.js';
import {
  icon, escapeHtml, showToast, uid, dayKey, formatBRL, formatBRLRaw, formatPct, parseBRL, bindCurrencyInput, bindPrivacyToggle
} from './utils.js';

const $ = id => document.getElementById(id);
const user = await requireAuth();

const state = { desejos: [], hoje: dayKey(new Date()), editando: null, aberto: null };
const fmtData = k => k.split('-').reverse().join('/');

const STATUS = {
  menor: { nome: 'Menor preço já visto', cls: 'is-ok' },
  abaixo: { nome: 'Abaixo do normal', cls: 'is-ok' },
  normal: { nome: 'Preço normal', cls: '' },
  acima: { nome: 'Acima do normal', cls: 'is-warn' },
  pouco: { nome: 'Anote mais preços', cls: 'is-idle' }
};

/* ---------- Gráfico (linha com pontos, normal e alvo) ---------- */

function grafico(d, { w = 280, h = 64, eixos = false } = {}) {
  const r = d.registros;
  if (r.length < 2) return `<div class="spark-vazio" style="height:${h}px">${r.length ? 'Mais um preço e o gráfico aparece' : 'Sem preços ainda'}</div>`;
  const a = analisar(d);
  const vals = r.map(x => x.valor);
  const lo = Math.min(...vals, d.alvo || Infinity) * 0.97, hi = Math.max(...vals) * 1.03;
  const t0 = Date.parse(r[0].data), t1 = Date.parse(r[r.length - 1].data) || t0 + 1;
  const pl = eixos ? 56 : 4, pr = 6, pt = 8, pb = eixos ? 22 : 6;
  const x = k => pl + ((Date.parse(k) - t0) / Math.max(1, t1 - t0)) * (w - pl - pr);
  const y = v => pt + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - pt - pb);
  const pts = r.map(p => `${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`);
  const ln = (v, cls, label) => `<line x1="${pl}" x2="${w - pr}" y1="${y(v)}" y2="${y(v)}" class="${cls}"/>${eixos ? `<text x="${pl - 6}" y="${y(v)}" class="sp-lbl" text-anchor="end" dominant-baseline="middle">${label}</text>` : ''}`;
  return `
    <svg class="spark" viewBox="0 0 ${w} ${h}" role="img"
      aria-label="Histórico: de ${formatBRL(a.menor.valor)} a ${formatBRL(a.maior.valor)}, normal ${formatBRL(a.normal)}">
      ${ln(a.normal, 'sp-normal', 'normal')}
      ${d.alvo ? ln(d.alvo, 'sp-alvo', 'alvo') : ''}
      <polyline points="${pts.join(' ')}" class="sp-linha"/>
      ${r.map(p => `<circle cx="${x(p.data)}" cy="${y(p.valor)}" r="${p === a.ultimo ? 4 : 2.5}" class="sp-pt ${p === a.ultimo ? 'is-ult' : ''} ${p === a.menor ? 'is-min' : ''}"><title>${fmtData(p.data)}: ${formatBRL(p.valor)}${p.loja ? ` (${escapeHtml(p.loja)})` : ''}</title></circle>`).join('')}
      ${eixos ? `<text x="${pl}" y="${h - 4}" class="sp-lbl">${fmtData(r[0].data)}</text><text x="${w - pr}" y="${h - 4}" class="sp-lbl" text-anchor="end">${fmtData(r[r.length - 1].data)}</text>` : ''}
    </svg>`;
}

/* ---------- Lista ---------- */

function cartao(d) {
  const a = analisar(d);
  const st = d.comprado ? { nome: `Comprado em ${fmtData(d.comprado.data)}`, cls: 'is-idle' } : a.alvoOk ? { nome: 'Chegou no seu preço', cls: 'is-ok' } : STATUS[a.status];
  return `
    <li>
      <button type="button" class="des-card ${d.comprado ? 'is-comprado' : ''}" data-id="${escapeHtml(d.id)}">
        <span class="des-head"><strong>${escapeHtml(d.nome)}</strong><span class="chip ${st.cls}">${st.nome}</span></span>
        <span class="des-preco">
          <strong class="num">${a.n ? formatBRL(a.ultimo.valor) : '—'}</strong>
          ${a.n >= 3 && !d.comprado ? `<span class="des-var ${a.variacao < 0 ? 'is-down' : a.variacao > 0 ? 'is-up' : ''}">${a.variacao < 0 ? '−' : '+'}${formatPct(Math.abs(a.variacao) * 100, 0)} do normal</span>` : ''}
        </span>
        ${grafico(d)}
        <span class="des-foot">${a.n ? `${a.n} ${a.n === 1 ? 'preço' : 'preços'} desde ${fmtData(d.registros[0].data)}` : 'Sem preços ainda'}${d.alvo ? ` · alvo ${formatBRL(d.alvo)}` : ''}</span>
      </button>
    </li>`;
}

function render() {
  const ativos = state.desejos.filter(d => !d.comprado).sort((a, b) => (b.registros.at(-1)?.data || '').localeCompare(a.registros.at(-1)?.data || ''));
  const comprados = state.desejos.filter(d => d.comprado);
  if (!state.desejos.length) {
    $('desejos-body').innerHTML = `
      <section class="vazio">
        <span class="vazio-icon">${icon('tag', 24)}</span>
        <h2>Antes de comprar por impulso, anote o preço</h2>
        <p>Cadastre o que você quer e registre o preço cada vez que olhar. Com o histórico, o DataLife mostra o preço normal, o menor já visto e se a Black Friday teve desconto de verdade.</p>
        <button class="btn btn-primary" type="button" data-novo>${icon('plus', 15)} Quero comprar</button>
      </section>`;
    return;
  }
  $('desejos-body').innerHTML = `
    <ul class="des-grid">${ativos.map(cartao).join('')}</ul>
    ${comprados.length ? `<h2 class="sub-title">Comprados</h2><ul class="des-grid">${comprados.map(cartao).join('')}</ul>` : ''}
    <aside class="dica">${icon('info', 16)}<p>O Código de Defesa do Consumidor (art. 37) considera enganosa a publicidade que induz ao erro sobre o preço, como um "de R$ X" que nunca foi praticado. Se o histórico mostrar o preço subindo nas semanas antes da Black Friday, o desconto não é real (a "metade do dobro").</p></aside>`;
}

/* ---------- Detalhe ---------- */

function renderDetalhe() {
  const d = state.desejos.find(x => x.id === state.aberto);
  if (!d) return $('det-dialog').close();
  const a = analisar(d);
  const bf = analisarBlackFriday(d);
  $('det-title').textContent = d.nome;
  $('det-sub').innerHTML = [d.loja && escapeHtml(d.loja), d.link && `<a class="link-btn" href="${escapeHtml(d.link)}" target="_blank" rel="noopener noreferrer">${icon('externalLink', 13)} Abrir a página do produto</a>`].filter(Boolean).join(' · ');
  const stat = (k, v, s = '') => `<div><dt>${k}</dt><dd class="num">${v}</dd>${s ? `<span>${s}</span>` : ''}</div>`;
  $('det-body').innerHTML = `
    ${a.n ? `<dl class="det-stats">
      ${stat('Último', formatBRL(a.ultimo.valor), fmtData(a.ultimo.data))}
      ${stat('Normal', formatBRL(a.normal), 'mediana')}
      ${stat('Menor', formatBRL(a.menor.valor), fmtData(a.menor.data))}
      ${stat('Maior', formatBRL(a.maior.valor), fmtData(a.maior.data))}
    </dl>` : ''}
    <div class="det-chart">${grafico(d, { w: 640, h: 200, eixos: true })}</div>
    ${a.alvoOk && !d.comprado ? `<p class="det-ok">${icon('check', 15)} O último preço (${formatBRL(a.ultimo.valor)}) está dentro do que você aceita pagar (${formatBRL(d.alvo)}).</p>` : ''}
    ${bf.map(x => `<p class="bf bf-${x.veredito}">${icon(x.veredito === 'real' ? 'check' : 'info', 15)} ${escapeHtml(x.texto)}</p>`).join('')}
    ${d.comprado ? '' : `
    <form class="reg-form" id="reg-form" autocomplete="off">
      <label class="field"><span class="field-label">Preço</span><input class="input num" name="valor" inputmode="numeric" placeholder="R$ 0,00" maxlength="22" required></label>
      <label class="field"><span class="field-label">Data</span><input class="input" name="data" type="date" value="${state.hoje}" max="${state.hoje}" required></label>
      <label class="field grow"><span class="field-label">Loja (opcional)</span><input class="input" name="loja" maxlength="40" value="${escapeHtml(d.loja)}"></label>
      <button class="btn btn-primary" type="submit">Anotar preço</button>
    </form>`}
    <ul class="reg-list">
      ${[...d.registros].reverse().map(r => `
        <li data-reg="${escapeHtml(r.id)}">
          <span class="num">${fmtData(r.data)}</span><span>${escapeHtml(r.loja || '')}</span>
          <strong class="num">${formatBRL(r.valor)}</strong>
          <button class="icon-btn danger" type="button" data-del-reg aria-label="Apagar preço">${icon('trash', 14)}</button>
        </li>`).join('')}
    </ul>`;
  $('det-comprei').hidden = !!d.comprado;
  const f = $('reg-form');
  if (f) { bindCurrencyInput(f.valor); enhanceDateInput(f.data); }
}

/* ---------- Gravação ---------- */

function salvar(d, prev) {
  state.desejos = prev ? state.desejos.map(x => (x.id === d.id ? d : x)) : [...state.desejos, d];
  render();
  if (state.aberto === d.id) renderDetalhe();
  return persist(saveDesejo(user.uid, d), () => {
    state.desejos = prev ? state.desejos.map(x => (x.id === d.id ? prev : x)) : state.desejos.filter(x => x.id !== d.id);
    render();
  });
}

function bind() {
  $('btn-novo').innerHTML = `${icon('plus', 16)} Quero comprar`;
  bindPrivacyToggle($('btn-privacy'));
  window.addEventListener('datalife:privacy', () => { render(); if (state.aberto) renderDetalhe(); });
  const f = $('des-form');
  bindCurrencyInput(f.preco);
  bindCurrencyInput(f.alvo);
  for (const id of ['des-dialog', 'det-dialog']) {
    $(id).querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
    $(id).querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(id).close()));
  }
  $('det-dialog').addEventListener('close', () => { state.aberto = null; });

  const abrirForm = d => {
    state.editando = d;
    f.reset();
    $('des-title').textContent = d ? 'Editar' : 'Quero comprar';
    $('field-preco').hidden = !!d;
    f.nome.value = d?.nome || '';
    f.link.value = d?.link || '';
    f.loja.value = d?.loja || '';
    f.alvo.value = d?.alvo ? formatBRLRaw(d.alvo) : '';
    $('des-dialog').showModal();
  };
  $('btn-novo').addEventListener('click', () => abrirForm(null));
  $('desejos-body').addEventListener('click', e => {
    if (e.target.closest('[data-novo]')) return abrirForm(null);
    const c = e.target.closest('[data-id]');
    if (!c) return;
    state.aberto = c.dataset.id;
    renderDetalhe();
    $('det-dialog').showModal();
  });

  f.addEventListener('submit', e => {
    e.preventDefault();
    const nome = f.nome.value.trim();
    if (!nome) return f.nome.reportValidity();
    if (f.link.value.trim() && !linkSeguro(f.link.value)) {
      f.link.setCustomValidity('Use um endereço que comece com https://');
      f.link.reportValidity();
      f.link.addEventListener('input', () => f.link.setCustomValidity(''), { once: true });
      return;
    }
    const prev = state.editando;
    const preco = parseBRL(f.preco.value);
    const d = {
      ...(prev || { id: uid(), criado: Date.now(), registros: [] }),
      nome: nome.slice(0, LIMITES.nome),
      link: linkSeguro(f.link.value),
      loja: f.loja.value.trim(),
      alvo: parseBRL(f.alvo.value)
    };
    if (!prev && preco) d.registros = [{ id: uid(), data: state.hoje, valor: preco, ...(d.loja ? { loja: d.loja } : {}) }];
    $('des-dialog').close();
    salvar(d, prev).then(ok => ok && showToast(prev ? 'Salvo.' : `${d.nome} na lista.`));
  });

  $('det-body').addEventListener('submit', e => {
    e.preventDefault();
    const rf = e.target;
    const d = state.desejos.find(x => x.id === state.aberto);
    const valor = parseBRL(rf.valor.value);
    if (!valor) return rf.valor.reportValidity();
    if (d.registros.length >= LIMITES.registros) return showToast('Limite de preços para este item.', 'error');
    const loja = rf.loja.value.trim();
    const next = { ...d, registros: [...d.registros, { id: uid(), data: rf.data.value, valor, ...(loja ? { loja } : {}) }].sort((a, b) => a.data.localeCompare(b.data)) };
    salvar(next, d).then(ok => {
      if (!ok) return;
      const a = analisar(next);
      showToast(a.alvoOk ? 'Chegou no seu preço!' : a.status === 'menor' ? 'Menor preço já visto.' : 'Preço anotado.');
    });
  });
  $('det-body').addEventListener('click', e => {
    const b = e.target.closest('[data-del-reg]');
    if (!b) return;
    const d = state.desejos.find(x => x.id === state.aberto);
    const id = b.closest('[data-reg]').dataset.reg;
    const r = d.registros.find(x => x.id === id);
    salvar({ ...d, registros: d.registros.filter(x => x.id !== id) }, d);
    showToast(`Preço de ${fmtData(r.data)} apagado.`, 'success', 6000, {
      label: 'Desfazer',
      onClick: () => { const cur = state.desejos.find(x => x.id === d.id); if (cur) salvar({ ...cur, registros: [...cur.registros, r].sort((a, c) => a.data.localeCompare(c.data)) }, cur); }
    });
  });

  $('det-editar').addEventListener('click', () => {
    const d = state.desejos.find(x => x.id === state.aberto);
    $('det-dialog').close();
    abrirForm(d);
  });
  $('det-comprei').addEventListener('click', () => {
    const d = state.desejos.find(x => x.id === state.aberto);
    const ult = d.registros.at(-1);
    salvar({ ...d, comprado: { data: state.hoje, valor: ult?.valor || 0 } }, d).then(ok => ok && showToast(`${d.nome}: comprado.`, 'success', 6000, {
      label: 'Desfazer', onClick: () => { const cur = state.desejos.find(x => x.id === d.id); const { comprado, ...rest } = cur; salvar(rest, cur); }
    }));
    $('det-dialog').close();
  });
  $('det-excluir').addEventListener('click', () => {
    const d = state.desejos.find(x => x.id === state.aberto);
    $('det-dialog').close();
    state.desejos = state.desejos.filter(x => x.id !== d.id);
    render();
    persist(deleteDesejo(user.uid, d.id), () => { state.desejos.push(d); render(); });
    showToast(`${d.nome} excluído.`, 'success', 8000, { label: 'Desfazer', onClick: () => salvar(d, null) });
  });
}

initPagina();
bind();
try {
  state.desejos = await fetchDesejos(user.uid);
} catch (e) {
  console.error(e);
  showToast('Não foi possível carregar a lista. Verifique a conexão.', 'error', 6000);
}
render();
dadosProntos(); // um documento por item: sem risco de sobrescrever
