/* ============================================
   DataLife — Autenticação (Google Sign-In)
   ============================================
   ALLOWED_EMAILS aqui é só conveniência de UX: o controle de
   acesso real fica nas Security Rules (firestore.rules).
   ============================================ */

import { SDK, auth, provider } from './firebase-init.js';
import { ALLOWED_EMAILS, LOCAL_MODE } from './config.js';
import { clearLocalCache } from './db.js';
import { showToast } from './utils.js';

// Proteção contra clickjacking: CSP frame-ancestors não funciona via <meta> e o
// GitHub Pages não permite headers. Dentro de um iframe, a página não é exibida.
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  throw new Error('DataLife não pode ser exibido dentro de um iframe.');
}

const LOCAL_USER = { uid: 'local', nome: 'Modo local', email: 'local@datalife' };

let fb = null;
if (!LOCAL_MODE) fb = await import(`${SDK}/firebase-auth.js`);

const NEGADO_KEY = 'datalife:acesso-negado';

/** Guarda o e-mail recusado para a tela de login explicar o que aconteceu (sobrevive ao redirecionamento). */
function marcarNegado(email) {
  try { sessionStorage.setItem(NEGADO_KEY, email); } catch { /* ok */ }
}

/** E-mail recusado na última tentativa (lido uma vez só). */
export function lerNegado() {
  try {
    const e = sessionStorage.getItem(NEGADO_KEY);
    sessionStorage.removeItem(NEGADO_KEY);
    return e;
  } catch {
    return null;
  }
}

function isEmailAllowed(email) {
  const e = String(email).toLowerCase();
  return ALLOWED_EMAILS.length === 0 || ALLOWED_EMAILS.some(a => a.toLowerCase() === e);
}

function toUser(u) {
  return { uid: u.uid, nome: u.displayName || u.email.split('@')[0], email: u.email };
}

/**
 * Resolve com o usuário atual (ou null) assim que o Firebase Auth estiver pronto.
 * @returns {Promise<Object|null>}
 */
export function waitForAuth() {
  if (LOCAL_MODE) return Promise.resolve(LOCAL_USER);
  return new Promise(resolve => {
    const unsub = fb.onAuthStateChanged(auth, async user => {
      unsub();
      if (user && !isEmailAllowed(user.email)) {
        // Sessão de uma conta que saiu da lista: sai e avisa no login (antes era silencioso)
        marcarNegado(user.email);
        await fb.signOut(auth);
        return resolve(null);
      }
      resolve(user ? toUser(user) : null);
    });
  });
}

export async function doLogin() {
  if (LOCAL_MODE) {
    window.location.href = 'hub.html';
    return;
  }
  try {
    const { user } = await fb.signInWithPopup(auth, provider);
    if (!isEmailAllowed(user.email)) {
      await fb.signOut(auth);
      window.dispatchEvent(new CustomEvent('datalife:negado', { detail: user.email }));
      return;
    }
    window.location.href = 'hub.html';
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return;
    console.error('Erro no login:', error);
    showToast(error.code === 'auth/popup-blocked'
      ? 'O navegador bloqueou o pop-up de login. Libere pop-ups para este site.'
      : 'Erro ao fazer login. Tente novamente.', 'error', 5000);
  }
}

export async function doLogout() {
  // Chave do cadeado do Diário lembrada neste aparelho
  try { indexedDB.deleteDatabase('datalife-cofre'); } catch { /* ok */ }
  // Cache da sessão (avisos com nomes de contas e títulos de datas)
  try { Object.keys(sessionStorage).filter(k => k.startsWith('datalife:')).forEach(k => sessionStorage.removeItem(k)); } catch { /* ok */ }
  if (!LOCAL_MODE) {
    await fb.signOut(auth);
    try {
      await clearLocalCache();
    } catch (e) {
      console.warn('Não foi possível limpar o cache offline:', e);
    }
  }
  window.location.href = 'index.html';
}

/**
 * Protege uma página: redireciona para o login se não houver sessão.
 * Nunca resolve nesse caso, para o código da página não seguir sem usuário.
 * @returns {Promise<Object>}
 */
export async function requireAuth() {
  const user = await waitForAuth();
  if (!user) {
    window.location.replace('index.html');
    return new Promise(() => {});
  }
  document.body.classList.remove('is-loading');
  const nameEl = document.querySelector('.user-name');
  if (nameEl) nameEl.textContent = user.nome;
  return user;
}

// Sem onclick inline (bloqueado pela CSP): liga os botões aqui
document.getElementById('btn-login')?.addEventListener('click', doLogin);
document.getElementById('btn-logout')?.addEventListener('click', doLogout);
