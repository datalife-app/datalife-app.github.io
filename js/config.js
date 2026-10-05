/* ============================================
   DataLife — Configuração
   ============================================
   Cole aqui o config do seu projeto Firebase
   (Console > Configurações do projeto > Seus apps > Web).
   Enquanto apiKey estiver vazio, o app roda em
   MODO LOCAL (localStorage, sem login) — útil para testar.
   ============================================ */

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgmzj-4iBPpMOdQ0ryK0ydb7heHwIcnjo",
  authDomain: "datalife-3444e.firebaseapp.com",
  projectId: "datalife-3444e",
  storageBucket: "datalife-3444e.firebasestorage.app",
  messagingSenderId: "1030247884509",
  appId: "1:1030247884509:web:7690c7db7163bb3b029d34"
};

// Contas Google autorizadas a entrar (as mesmas de `emailsPermitidos()` em firestore.rules).
// Aqui é só a experiência na tela: quem não está na lista é deslogado com um aviso.
// A proteção real dos dados é a regra do Firestore. Vazio = qualquer conta Google (não recomendado).
export const ALLOWED_EMAILS = [
  'brenno.marron10@gmail.com',
];

export const LOCAL_MODE = !FIREBASE_CONFIG.apiKey;
