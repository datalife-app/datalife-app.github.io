/* ============================================
   DataLife — Firebase Init
   ============================================ */

import { FIREBASE_CONFIG, LOCAL_MODE } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

let auth = null, db = null, provider = null;

if (!LOCAL_MODE) {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const { getAuth, GoogleAuthProvider } = await import(`${SDK}/firebase-auth.js`);
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
    await import(`${SDK}/firebase-firestore.js`);

  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  // Cache offline compartilhado entre abas: leituras repetidas não consomem cota do plano gratuito
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
}

export { SDK, auth, db, provider };
