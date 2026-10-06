/* ============================================
   DataLife — Base das páginas de ferramenta
   ============================================
   O que toda ferramenta faz igual: aviso de modo local, ícones do
   cabeçalho e a gravação otimista com desfazer em caso de erro.
   ============================================ */

import { LOCAL_MODE } from './config.js';
import { icon, showToast, registrarSW, initSetasRadio } from './utils.js';
import { initValidacao } from './validacao.js';
import { initTemaPicker } from './tema-picker.js';
import { initAlertas } from './alertas.js';

/** Aviso de modo local, ícone de sair, setas dos links "voltar", avisos de validação, seletor de tema e teclado nos grupos de opções. */
export function initPagina() {
  aguardarDados();
  registrarSW();
  initValidacao();
  initTemaPicker();
  initAlertas(); // faixa de contas a vencer e datas do Planejador
  initSetasRadio(); // setas do teclado em todos os grupos de opções
  if (LOCAL_MODE) {
    document.getElementById('local-banner').innerHTML =
      '<div class="local-banner"><b>Modo local</b> · os dados ficam salvos só neste navegador</div>';
  }
  document.getElementById('btn-logout').innerHTML = icon('logout');
  document.querySelectorAll('[data-back], [data-back-list]')
    .forEach(a => a.insertAdjacentHTML('afterbegin', icon('chevronLeft', 15)));
}

/**
 * Até os dados da página chegarem, o conteúdo não aceita foco nem clique
 * (`inert`). Sem isso, o que fosse digitado nesse meio-tempo partiria de um
 * estado vazio e, nas ferramentas que gravam o documento inteiro (lista de
 * compras, contas fixas, entrada do Diário…), sobrescreveria o que já existe.
 * Cada página chama dadosProntos() depois de ler; a tela do cadeado fica de fora.
 */
const areas = () => document.querySelectorAll('main:not(.cofre-tela)');
function aguardarDados() {
  for (const m of areas()) { m.inert = true; m.setAttribute('aria-busy', 'true'); }
}
export function dadosProntos() {
  for (const m of areas()) { m.inert = false; m.removeAttribute('aria-busy'); }
}

/**
 * Espera uma escrita; se falhar, desfaz a mudança otimista (rollback) e avisa.
 * @returns {Promise<boolean>} true se gravou
 */
export async function persist(promise, rollback, msg = 'Não foi possível salvar. Verifique sua conexão.') {
  try {
    await promise;
    return true;
  } catch (e) {
    console.error(e);
    rollback?.();
    showToast(e?.code === 'permission-denied'
      ? 'Sem permissão para salvar: confira o e-mail e publique as regras do Firestore.'
      : msg, 'error', 5000);
    return false;
  }
}
