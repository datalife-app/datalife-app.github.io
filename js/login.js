/* ============================================
   DataLife — Página de login
   ============================================ */

import { waitForAuth, lerNegado, cachePendente, limparCachePendente } from './auth.js';
import { LOCAL_MODE } from './config.js';
import { registrarSW, showToast } from './utils.js';

registrarSW();

/** Aviso fixo (não some sozinho) quando uma conta fora da lista tenta entrar. */
function mostrarNegado(email) {
  const box = document.getElementById('login-alert');
  box.hidden = false;
  box.querySelector('[data-email]').textContent = email;
  document.getElementById('btn-login-text').textContent = 'Entrar com outra conta';
  box.focus();
}

/** Logout que não conseguiu apagar o cache offline: tenta de novo e, se não der, avisa até conseguir. */
async function conferirCache() {
  if (!cachePendente() || await limparCachePendente()) return;
  const box = document.getElementById('cache-alert');
  const btn = document.getElementById('cache-retry');
  box.hidden = false;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (await limparCachePendente()) {
      box.hidden = true;
      showToast('Dados offline apagados deste navegador.');
    } else {
      showToast('Ainda há uma aba do DataLife aberta. Feche-a e tente de novo.', 'error', 5000);
    }
    btn.disabled = false;
  });
}

window.addEventListener('datalife:negado', e => mostrarNegado(e.detail));
const negado = lerNegado();
if (negado) mostrarNegado(negado);

if (!LOCAL_MODE) await conferirCache();

if (LOCAL_MODE) {
  document.getElementById('login-note').textContent = 'Modo local: Firebase não configurado, os dados ficam neste navegador.';
  document.getElementById('btn-login-text').textContent = 'Entrar (modo local)';
} else if (await waitForAuth()) {
  window.location.replace('hub.html');
}
