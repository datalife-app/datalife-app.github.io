/* ============================================
   DataLife — Planejador: persistência e avisos
   ============================================
   users/{uid}/eventos/{id}
     { titulo, data: "YYYY-MM-DD", hora: "HH:MM" | "", tipo, anual, nota, criado }
     anual: repete todo ano (aniversários, datas comemorativas)

   Avisos: a 30, 15, 7, 3 e 1 dia(s) e no dia. Entre um marco e outro o
   aviso continua o mesmo; dispensado, só volta no marco seguinte.
   ============================================ */

import { fs, LOCAL_MODE, ref, col, commitInBatches, lsWrite, lsRemove, lsList, isId, isText, DAY_RE } from './store.js';

export const MARCOS = [30, 15, 7, 3, 1, 0];
export const TIPOS = {
  compromisso: { nome: 'Compromisso', icon: 'calendarClock' },
  aniversario: { nome: 'Aniversário', icon: 'gift' },
  prazo: { nome: 'Prazo', icon: 'flag' },
  saude: { nome: 'Saúde', icon: 'heart' },
  viagem: { nome: 'Viagem', icon: 'plane' },
  outro: { nome: 'Outro', icon: 'bell' }
};
export const LIMITES = { titulo: 80, nota: 500 };
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function sanitizeEvento(id, raw) {
  if (!isId(id) || !raw || !isText(raw.titulo, LIMITES.titulo) || !DAY_RE.test(raw.data)) return null;
  return {
    id,
    titulo: raw.titulo.trim(),
    data: raw.data,
    hora: HORA_RE.test(raw.hora) ? raw.hora : '',
    tipo: TIPOS[raw.tipo] ? raw.tipo : 'compromisso',
    anual: raw.anual === true,
    nota: typeof raw.nota === 'string' ? raw.nota.slice(0, LIMITES.nota) : '',
    criado: Number.isSafeInteger(raw.criado) ? raw.criado : 0
  };
}
const toDoc = ({ id, ...d }) => d;

/* ---------- Datas (puras) ---------- */

const pad = n => String(n).padStart(2, '0');
const utc = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diasAte = (de, ate) => Math.round((utc(ate) - utc(de)) / 86_400_000);

/** Próxima data do evento a partir de hoje (anual: o próximo aniversário; 29/02 cai em 28/02 nos anos comuns). */
export function proximaOcorrencia(ev, hoje) {
  if (!ev.anual) return ev.data;
  const [, m, d] = ev.data.split('-').map(Number);
  const em = ano => {
    const ultimo = new Date(ano, m, 0).getDate();
    return `${ano}-${pad(m)}-${pad(Math.min(d, ultimo))}`;
  };
  const y = Number(hoje.slice(0, 4));
  const k = em(y);
  return k >= hoje ? k : em(y + 1);
}

/** Texto curto da distância: "hoje às 14:30", "amanhã", "em 12 dias". */
export function quando(dias, hora = '') {
  if (dias === 0) return hora ? `hoje às ${hora}` : 'hoje';
  if (dias === 1) return hora ? `amanhã às ${hora}` : 'amanhã';
  if (dias < 0) return dias === -1 ? 'ontem' : `há ${-dias} dias`;
  return `em ${dias} dias`;
}

/** Marco de aviso em que a data está (o menor ≥ dias), ou null fora da janela de 30 dias. */
export const marcoDe = dias => (dias < 0 || dias > 30 ? null : [...MARCOS].reverse().find(m => m >= dias));

/** Avisos ativos hoje, mais próximos primeiro. */
export function proximosAvisos(eventos, hoje) {
  return eventos
    .map(ev => {
      const ocorre = proximaOcorrencia(ev, hoje);
      const dias = diasAte(hoje, ocorre);
      const marco = marcoDe(dias);
      return marco === null ? null : { id: ev.id, ocorre, dias, marco, texto: `${ev.titulo} ${quando(dias, ev.hora)}` };
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias);
}

/* ---------- API ---------- */

export async function fetchEventos(uid) {
  const entries = LOCAL_MODE
    ? lsList('eventos')
    : (await fs.getDocs(col(uid, 'eventos'))).docs.map(d => [d.id, d.data()]);
  return entries.map(([id, raw]) => sanitizeEvento(id, raw)).filter(Boolean);
}

export async function saveEvento(uid, ev) {
  const clean = sanitizeEvento(ev.id, ev);
  if (!clean) throw new Error('Data inválida');
  if (LOCAL_MODE) return lsWrite(`eventos/${clean.id}`, toDoc(clean));
  await fs.setDoc(ref(uid, 'eventos', clean.id), toDoc(clean));
}

export async function deleteEvento(uid, id) {
  if (!isId(id)) throw new Error('Data inválida');
  if (LOCAL_MODE) return lsRemove(`eventos/${id}`);
  await fs.deleteDoc(ref(uid, 'eventos', id));
}

/* ---------- Backup ---------- */

export const exportEventos = fetchEventos;
export const parseEventos = list => (Array.isArray(list) ? list.map(e => sanitizeEvento(e?.id, e)).filter(Boolean) : []);
export async function importEventos(uid, parsed) {
  const ids = new Set((await fetchEventos(uid)).map(e => e.id));
  const novos = parsed.filter(e => !ids.has(e.id));
  if (LOCAL_MODE) novos.forEach(e => lsWrite(`eventos/${e.id}`, toDoc(e)));
  else await commitInBatches(novos.map(e => [ref(uid, 'eventos', e.id), toDoc(e)]));
  return novos.length;
}
