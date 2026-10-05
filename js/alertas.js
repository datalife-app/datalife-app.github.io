/* ============================================
   DataLife — Avisos globais
   ============================================
   Uma faixa abaixo do cabeçalho, em todas as páginas, com:
   - contas do Pagamentos vencidas ou perto do vencimento (pela antecedência
     de cada conta, inclusive as do mês seguinte);
   - datas do Planejador a 30, 15, 7, 3, 1 dia(s) e no próprio dia.
   Para não gastar leituras do Firestore a cada página, o resultado fica em
   cache na sessão por 10 minutos (as próprias ferramentas limpam o cache
   quando algo muda). "Dispensar" esconde o que está na faixa até o dia
   seguinte; um aviso novo (outra conta, outro marco) aparece mesmo assim.
   ============================================ */

import { waitForAuth } from './auth.js';
import { fetchContas, fetchPagas, situacao, quando } from './pagamentos-db.js';
import { fetchEventos, proximosAvisos } from './planejador-db.js';
import { icon, escapeHtml, dayKey, monthKey, shiftMonth } from './utils.js';

const CACHE = 'datalife:alertas';
const DISPENSA = 'datalife:alertas-dispensados';
const TTL = 10 * 60_000;

export function limparCacheAlertas() {
  try { sessionStorage.removeItem(CACHE); } catch { /* ok */ }
}

async function calcular(uid, hoje) {
  const mes = monthKey(new Date());
  const seguinte = shiftMonth(mes, 1);
  const [contas, pagas, pagasSeg, eventos] = await Promise.all([
    fetchContas(uid), fetchPagas(uid, mes), fetchPagas(uid, seguinte), fetchEventos(uid)
  ]);
  const itens = [];
  for (const c of contas) {
    for (const [m, p] of [[mes, pagas], [seguinte, pagasSeg]]) {
      const s = situacao(c, m, p, hoje);
      // mês seguinte: só o que já entrou na janela de aviso (fim de mês)
      if (s.status === 'vencida' && m === mes || s.status === 'proxima') {
        itens.push({ chave: `conta:${c.id}:${m}`, tipo: 'conta', ordem: s.dias, texto: `${c.nome} ${quando(s.dias)}`, href: 'bills.html', atencao: s.status === 'vencida' });
      }
    }
  }
  for (const a of proximosAvisos(eventos, hoje)) {
    itens.push({ chave: `evento:${a.id}:${a.ocorre}:${a.marco}`, tipo: 'evento', ordem: a.dias, texto: a.texto, href: 'planner.html', atencao: false });
  }
  return itens.sort((a, b) => a.ordem - b.ordem);
}

/* Dispensa: contas voltam no dia seguinte; datas só voltam no próximo marco
   (a chave do aviso já inclui o marco: 30, 15, 7, 3, 1, 0). */
const DISPENSA_EV = 'datalife:eventos-dispensados';

function dispensados(hoje) {
  const out = new Set();
  try {
    const d = JSON.parse(localStorage.getItem(DISPENSA));
    if (d?.dia === hoje) d.chaves.forEach(k => out.add(k));
  } catch { /* ok */ }
  try {
    (JSON.parse(localStorage.getItem(DISPENSA_EV)) || []).forEach(k => out.add(k));
  } catch { /* ok */ }
  return out;
}

function dispensar(itens, hoje) {
  const contas = itens.filter(i => i.tipo === 'conta').map(i => i.chave);
  const eventos = itens.filter(i => i.tipo === 'evento').map(i => i.chave);
  try {
    const d = JSON.parse(localStorage.getItem(DISPENSA));
    const antes = d?.dia === hoje ? d.chaves : [];
    localStorage.setItem(DISPENSA, JSON.stringify({ dia: hoje, chaves: [...new Set([...antes, ...contas])] }));
    // Mantém só datas que ainda vão acontecer (a chave termina em :AAAA-MM-DD:marco)
    const ev = (JSON.parse(localStorage.getItem(DISPENSA_EV)) || []).filter(k => (k.split(':')[2] || '') >= hoje);
    localStorage.setItem(DISPENSA_EV, JSON.stringify([...new Set([...ev, ...eventos])].slice(-300)));
  } catch { /* ok */ }
}

function render(itens, hoje) {
  const fora = dispensados(hoje);
  const vis = itens.filter(i => !fora.has(i.chave));
  let bar = document.getElementById('alerta-bar');
  if (!vis.length) return bar?.remove();
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'alerta-bar';
    bar.className = 'alerta-bar';
    bar.setAttribute('role', 'status');
    // Logo abaixo do cabeçalho (o aviso de modo local fica acima dele)
    (document.querySelector('.topbar') || document.getElementById('local-banner'))?.after(bar);
  }
  const mostrar = vis.slice(0, 3);
  bar.innerHTML = `
    <div class="container alerta-inner">
      <span class="alerta-icon" aria-hidden="true">${icon('bell', 16)}</span>
      <ul class="alerta-list">
        ${mostrar.map(i => `<li class="${i.atencao ? 'is-atencao' : ''}"><a href="${i.href}">${icon(i.tipo === 'conta' ? 'receipt' : 'calendarClock', 13)}${escapeHtml(i.texto)}</a></li>`).join('')}
        ${vis.length > 3 ? `<li class="alerta-mais">e mais ${vis.length - 3}</li>` : ''}
      </ul>
      <button type="button" class="icon-btn alerta-x" aria-label="Dispensar avisos de hoje" title="Dispensar (contas voltam amanhã; datas, no próximo aviso)">${icon('x', 15)}</button>
    </div>`;
  bar.querySelector('.alerta-x').addEventListener('click', () => {
    dispensar(vis, hoje);
    bar.classList.add('is-leaving');
    setTimeout(() => bar.remove(), 160);
  });
}

/** Mostra a faixa de avisos (chamado por initPagina em todas as ferramentas). */
export async function initAlertas() {
  const hoje = dayKey(new Date());
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE));
    if (c && c.dia === hoje && Date.now() - c.em < TTL) return render(c.itens, hoje);
  } catch { /* sem cache */ }
  try {
    const user = await waitForAuth();
    if (!user) return;
    const itens = await calcular(user.uid, hoje);
    try { sessionStorage.setItem(CACHE, JSON.stringify({ dia: hoje, em: Date.now(), itens })); } catch { /* ok */ }
    render(itens, hoje);
  } catch (e) {
    console.warn('Avisos indisponíveis agora:', e); // extra: a página segue normal sem a faixa
  }
}

/** As ferramentas chamam quando algo mudou (pagou, criou uma data...): refaz a faixa em seguida. */
let refazer = 0;
export function avisarMudanca() {
  limparCacheAlertas();
  clearTimeout(refazer);
  refazer = setTimeout(initAlertas, 1200); // espera a gravação terminar
}
