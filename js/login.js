/* ============================================
   DataLife — Página de login
   ============================================ */

import { waitForAuth, lerNegado } from './auth.js';
import { LOCAL_MODE } from './config.js';
import { registrarSW } from './utils.js';

registrarSW();

/** Aviso fixo (não some sozinho) quando uma conta fora da lista tenta entrar. */
function mostrarNegado(email) {
  const box = document.getElementById('login-alert');
  box.hidden = false;
  box.querySelector('[data-email]').textContent = email;
  document.getElementById('btn-login-text').textContent = 'Entrar com outra conta';
  box.focus();
}

window.addEventListener('datalife:negado', e => mostrarNegado(e.detail));
const negado = lerNegado();
if (negado) mostrarNegado(negado);

if (LOCAL_MODE) {
  document.getElementById('login-note').textContent = 'Modo local: Firebase não configurado, os dados ficam neste navegador.';
  document.getElementById('btn-login-text').textContent = 'Entrar (modo local)';
} else if (await waitForAuth()) {
  window.location.replace('hub.html');
}
