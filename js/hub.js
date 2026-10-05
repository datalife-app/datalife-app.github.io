/* ============================================
   DataLife — Hub de ferramentas
   ============================================
   Para adicionar uma ferramenta, inclua um item em TOOLS.
   Sem href = aparece como "Em breve".
   ============================================ */

import { requireAuth } from './auth.js';
import { icon } from './utils.js';
import { initPagina, dadosProntos } from './pagina.js';
import { initBackup } from './backup.js';

// Agrupadas por assunto; dentro do grupo, na ordem de uso
const TOOLS = [
  { grupo: 'Dinheiro', nome: 'Orçamento doméstico', desc: 'Quanto entra, quanto sai e se cada parte da renda está dentro do combinado.', icon: 'wallet', href: 'budget.html' },
  { grupo: 'Dinheiro', nome: 'Pagamentos', desc: 'As contas fixas do mês, o que já foi pago e um aviso antes de cada vencimento.', icon: 'receipt', href: 'bills.html' },
  { grupo: 'Dinheiro', nome: 'Objetivos', desc: 'Quanto guardar por mês para chegar lá no prazo, e se isso cabe no orçamento.', icon: 'flag', href: 'goals.html' },
  { grupo: 'Dinheiro', nome: 'Compras conscientes', desc: 'Anote o preço do que você quer comprar e descubra quando a oferta é real.', icon: 'tag', href: 'wishlist.html' },
  { grupo: 'Dinheiro', nome: 'Conselhos', desc: 'Guias curtos para organizar o dinheiro, montar a reserva e fugir de juros e golpes.', icon: 'lightbulb', href: 'advice.html' },
  { grupo: 'Rotina', nome: 'Foco', desc: 'Um dia de cada vez: tarefas, notas, pomodoro, água e o quadro do que está andando.', icon: 'timer', href: 'focus.html' },
  { grupo: 'Rotina', nome: 'Planejador', desc: 'Datas que não podem passar, com aviso um mês antes, na semana e no próprio dia.', icon: 'calendarClock', href: 'planner.html' },
  { grupo: 'Rotina', nome: 'Lista de compras', desc: 'A lista do mercado já separada por corredor, com o que você sempre compra.', icon: 'cart', href: 'groceries.html' },
  { grupo: 'Rotina', nome: 'Exercícios', desc: 'Escolha o músculo no corpo e veja como executar cada exercício do jeito certo.', icon: 'dumbbell', href: 'workouts.html' },
  { grupo: 'Você', nome: 'Livros', desc: 'O que você está lendo, o que já leu e o desafio do ano, numa estante sua.', icon: 'book', href: 'books.html' },
  { grupo: 'Você', nome: 'Diário', desc: 'Um lugar só seu para o dia, o humor e os hábitos que você está deixando para trás.', icon: 'pencil', href: 'journal.html' }
];

const user = await requireAuth();
initBackup(user.uid);

initPagina();
dadosProntos(); // o Hub não lê dados (só os avisos, que não gravam nada)

const grupos = [...new Set(TOOLS.map(t => t.grupo))];
document.getElementById('tool-list').innerHTML = grupos.map(g => `
  <li class="tool-group">
    <h2 class="tool-group-title">${g}</h2>
    <ul class="tool-grid">
      ${TOOLS.filter(t => t.grupo === g).map(t => `
        <li>
          <a class="tool-card" href="${t.href}">
            <span class="tool-icon">${icon(t.icon, 20)}</span>
            <span class="tool-text"><strong>${t.nome}</strong><span>${t.desc}</span></span>
            <span class="tool-go">${icon('arrowRight', 18)}</span>
          </a>
        </li>`).join('')}
    </ul>
  </li>`).join('');

/* ---------- Instalar como app (PWA) ---------- */
// Só em celular e tablet. Android/Chrome/Edge: o navegador oferece o convite (beforeinstallprompt).
// iPhone/iPad: não há convite; o caminho é Compartilhar → Adicionar à Tela de Início.
const OCULTO = 'datalife:instalar-oculto';
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Só no celular/tablet: no computador, o convite não aparece
const movel = ios || navigator.userAgentData?.mobile === true || /android|mobi/i.test(navigator.userAgent);

function renderInstalar() {
  const box = document.getElementById('instalar');
  let oculto = false;
  try { oculto = localStorage.getItem(OCULTO) === '1'; } catch { /* ok */ }
  const convite = window.__dlInstalar;
  if (!movel || instalado() || oculto || (!convite && !ios)) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <span class="instalar-icon">${icon('smartphone', 20)}</span>
    <div class="instalar-txt">
      <strong>DataLife como app</strong>
      <span>${convite
        ? 'Ícone na tela inicial, abre em tela cheia e funciona mesmo com a conexão instável.'
        : 'No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.'}</span>
    </div>
    <div class="instalar-acoes">
      ${convite ? '<button class="btn btn-primary btn-sm" type="button" data-instalar>Instalar</button>' : ''}
      <button class="icon-btn" type="button" data-ocultar aria-label="Não mostrar de novo">${icon('x', 16)}</button>
    </div>`;
}

document.getElementById('instalar').addEventListener('click', async e => {
  if (e.target.closest('[data-ocultar]')) {
    try { localStorage.setItem(OCULTO, '1'); } catch { /* ok */ }
    return renderInstalar();
  }
  if (e.target.closest('[data-instalar]') && window.__dlInstalar) {
    const convite = window.__dlInstalar;
    window.__dlInstalar = null;
    convite.prompt();
    await convite.userChoice.catch(() => null);
    renderInstalar();
  }
});
window.addEventListener('datalife:instalavel', renderInstalar);
window.addEventListener('appinstalled', renderInstalar);
renderInstalar();
