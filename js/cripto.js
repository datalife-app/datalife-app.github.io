/* ============================================
   DataLife — Cadeado do Diário (criptografia ponta a ponta)
   ============================================
   Opcional. Com o cadeado ligado, o Diário e os Vícios são cifrados no
   seu navegador antes de ir para o Firestore: nem o Google, nem quem
   tiver acesso ao banco, nem o código público do site leem o conteúdo
   sem a sua senha.

   Esquema (Web Crypto, nada de biblioteca externa):
   - Chave dos dados (DEK): AES-GCM 256, aleatória, criada uma vez.
   - Chave da senha (KEK): PBKDF2-SHA256, 600 mil iterações (OWASP 2023),
     sal aleatório de 16 bytes.
   - users/{uid}/settings/cripto = { v, id, sal, iter, chave: DEK embrulhada
     pela KEK (AES-GCM) }. A senha e a DEK em claro nunca saem do aparelho.
     `id` identifica a DEK (não muda ao trocar a senha): o backup leva a
     config junto, e a importação sabe se as entradas cifradas são deste cadeado.
   - Cada documento cifrado: { c: "v1.<base64(iv 12 bytes + texto cifrado)>" }.
     O GCM autentica: senha errada ou dado adulterado falham na abertura.
   - Trocar a senha só reembrulha a DEK (não reescreve as entradas).

   Sem a senha não há recuperação: é o preço de ninguém mais ler.
   ============================================ */

import { fs, LOCAL_MODE, ref, lsRead, lsWrite, lsRemove } from './store.js';

const ITER = 600000;
const PREFIXO = 'v1.';
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const estado = { config: undefined, chave: null, uid: null, desligando: false };

/* ---------- Config (Firestore / modo local) ---------- */

/** Config válida (ou null). Também valida a que vem de um backup. */
export function limparConfig(raw) {
  if (!raw || raw.v !== 1 || typeof raw.sal !== 'string' || raw.sal.length > 64 || typeof raw.chave !== 'string' || raw.chave.length > 256
    || !Number.isInteger(raw.iter) || raw.iter < 100000 || raw.iter > 5000000 || typeof raw.id !== 'string' || !/^[\w-]{8,64}$/.test(raw.id)) return null;
  return { v: 1, id: raw.id, sal: raw.sal, iter: raw.iter, chave: raw.chave, criado: Number.isSafeInteger(raw.criado) ? raw.criado : 0 };
}

export async function lerConfig(uid) {
  const raw = LOCAL_MODE
    ? lsRead('settings/cripto')
    : await fs.getDoc(ref(uid, 'settings', 'cripto')).then(s => (s.exists() ? s.data() : null));
  return limparConfig(raw);
}

async function gravarConfig(uid, cfg) {
  if (LOCAL_MODE) return lsWrite('settings/cripto', cfg);
  await fs.setDoc(ref(uid, 'settings', 'cripto'), cfg);
}

async function apagarConfig(uid) {
  if (LOCAL_MODE) return lsRemove('settings/cripto');
  await fs.deleteDoc(ref(uid, 'settings', 'cripto'));
}

/* ---------- Chaves ---------- */

async function kekDe(senha, sal, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(senha.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']
  );
}

async function embrulhar(dek, kek) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const w = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv });
  return b64(new Uint8Array([...iv, ...new Uint8Array(w)]));
}

async function desembrulhar(chave, kek, extraivel = false) {
  const bytes = deB64(chave);
  return crypto.subtle.unwrapKey(
    'raw', bytes.slice(12), kek, { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    { name: 'AES-GCM', length: 256 }, extraivel, ['encrypt', 'decrypt']
  );
}

/* ---------- "Lembrar neste aparelho" (IndexedDB) ----------
   A CryptoKey é guardada como objeto NÃO extraível: o navegador a usa,
   mas nenhum script consegue ler os bytes dela. Sair da conta apaga. */

const IDB = 'datalife-cofre';
function idb(modo, fn) {
  return new Promise((res, rej) => {
    const open = indexedDB.open(IDB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('chaves');
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('chaves', modo);
      const req = fn(tx.objectStore('chaves'));
      tx.oncomplete = () => { open.result.close(); res(req?.result); };
      tx.onerror = () => { open.result.close(); rej(tx.error); };
    };
  });
}
// Guardada junto da config que a criou: trocar a senha ou recriar o cadeado invalida
const lembrar = (uid, chave) => idb('readwrite', s => s.put({ chave, de: estado.config.chave }, uid)).catch(() => {});
const lembrada = uid => idb('readonly', s => s.get(uid)).catch(() => null);
export const esquecerAparelho = () => new Promise(res => {
  try { const r = indexedDB.deleteDatabase(IDB); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch { res(); }
});

/* ---------- API ---------- */

/**
 * Estado do cadeado para esta conta. Tenta a chave lembrada no aparelho.
 * @returns {Promise<'desligado'|'aberto'|'trancado'>}
 */
export async function iniciarCofre(uid) {
  if (estado.uid === uid && estado.config !== undefined) return situacao();
  estado.uid = uid;
  estado.config = await lerConfig(uid);
  if (estado.config && !estado.chave) {
    const k = await lembrada(uid);
    if (k?.chave && k.de === estado.config.chave) estado.chave = k.chave;
    else if (k) await esquecerAparelho();
  }
  return situacao();
}

export function situacao() {
  if (!estado.config) return 'desligado';
  return estado.chave ? 'aberto' : 'trancado';
}
export const ativo = () => !!estado.config;
export const aberto = () => !ativo() || !!estado.chave;

/** Abre o cadeado com a senha. Lança Error('senha') se estiver errada. */
export async function destrancar(senha, { lembrarAparelho = false } = {}) {
  const cfg = estado.config;
  if (!cfg) return;
  const kek = await kekDe(senha, deB64(cfg.sal), cfg.iter);
  try {
    estado.chave = await desembrulhar(cfg.chave, kek);
  } catch {
    throw new Error('senha');
  }
  if (lembrarAparelho) await lembrar(estado.uid, estado.chave);
}

/** Tranca agora (esquece a chave da memória e do aparelho). */
export async function trancar() {
  estado.chave = null;
  await esquecerAparelho();
}

/**
 * Liga o cadeado: cria a DEK, embrulha com a senha e grava a config.
 * Quem chama cifra os documentos existentes logo depois (migrar).
 */
export async function criarCofre(uid, senha, { lembrarAparelho = false } = {}) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const dekExp = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const kek = await kekDe(senha, sal, ITER);
  const id = b64(crypto.getRandomValues(new Uint8Array(12))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  const cfg = { v: 1, id, sal: b64(sal), iter: ITER, chave: await embrulhar(dekExp, kek), criado: Date.now() };
  // Em uso: a mesma chave, agora não extraível
  const dek = await desembrulhar(cfg.chave, kek);
  estado.config = cfg;
  estado.chave = dek;
  estado.uid = uid;
  await gravarConfig(uid, cfg);
  if (lembrarAparelho) await lembrar(uid, dek);
}

/** Troca a senha: reembrulha a mesma DEK (as entradas não mudam). */
export async function trocarSenha(atual, nova) {
  const cfg = estado.config;
  const dekExp = await desembrulhar(cfg.chave, await kekDe(atual, deB64(cfg.sal), cfg.iter), true).catch(() => { throw new Error('senha'); });
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const next = { ...cfg, sal: b64(sal), iter: ITER, chave: await embrulhar(dekExp, await kekDe(nova, sal, ITER)) };
  await gravarConfig(estado.uid, next);
  estado.config = next;
  await esquecerAparelho(); // aparelhos lembrados pedem a senha nova
}

/**
 * Desligar em duas etapas, sem risco de perder dados:
 * 1. prepararDesligar(senha): confere a senha; daqui em diante grava em claro
 *    (a config continua, então o que ainda estiver cifrado segue legível);
 * 2. quem chama regrava tudo em claro e então chama desligarCofre().
 */
export async function prepararDesligar(senha) {
  const cfg = estado.config;
  await desembrulhar(cfg.chave, await kekDe(senha, deB64(cfg.sal), cfg.iter)).catch(() => { throw new Error('senha'); });
  estado.desligando = true;
}
export const cancelarDesligar = () => { estado.desligando = false; };

export async function desligarCofre(uid) {
  await apagarConfig(uid);
  estado.config = null;
  estado.chave = null;
  estado.desligando = false;
  await esquecerAparelho();
}

/**
 * Backup: restaura a config de outro banco quando este ainda não tem cadeado
 * (as entradas cifradas do arquivo passam a abrir com a senha antiga).
 * @returns {'restaurado'|'mesmo'|'outro'} 'outro' = cadeado diferente; cifradas não servem
 */
export async function adotarConfig(uid, cfg) {
  const atual = await lerConfig(uid);
  if (!atual) {
    await gravarConfig(uid, cfg);
    estado.uid = uid;
    estado.config = cfg;
    estado.chave = null;
    return 'restaurado';
  }
  return atual.id === cfg.id ? 'mesmo' : 'outro';
}

/* ---------- Cifrar / decifrar ---------- */

async function fecharTexto(texto, chave) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(texto));
  return PREFIXO + b64(new Uint8Array([...iv, ...new Uint8Array(ct)]));
}

async function abrirTexto(s, chave) {
  if (typeof s !== 'string' || !s.startsWith(PREFIXO)) throw new Error('formato');
  const bytes = deB64(s.slice(PREFIXO.length));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, chave, bytes.slice(12));
  return dec.decode(pt);
}

export const cifrado = raw => !!raw && typeof raw === 'object' && typeof raw.c === 'string';

/**
 * Documento para gravar: cifrado se o cadeado estiver ligado.
 * `claros` são campos mantidos fora da cifra (ex.: `atualizado`, `criado`).
 */
export async function selar(obj, claros = []) {
  // Sem saber se o cadeado está ligado, não grava (evita gravar em claro por engano)
  if (estado.config === undefined) throw new Error('cofre não iniciado');
  if (!ativo() || estado.desligando) return obj;
  if (!estado.chave) throw new Error('trancado');
  const fora = {}, dentro = {};
  for (const [k, v] of Object.entries(obj)) (claros.includes(k) ? fora : dentro)[k] = v;
  return { ...fora, c: await fecharTexto(JSON.stringify(dentro), estado.chave) };
}

/** Documento lido: decifra se vier cifrado; em claro passa direto. */
export async function abrir(raw) {
  if (!cifrado(raw)) return raw;
  if (!estado.chave) throw new Error('trancado');
  const { c, ...fora } = raw;
  return { ...JSON.parse(await abrirTexto(c, estado.chave)), ...fora };
}
