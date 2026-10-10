/* ============================================
   DataLife — Treino: divisões prontas e progressão de carga
   ============================================
   Divisões e exercícios por dia a partir de exemplos publicados
   (hipertrofia.org: ABC push/pull/legs e ficha feminina; Tua Saúde:
   ABCDE; Arvo: ABCD em 4 dias). Séries e repetições por experiência
   seguem a faixa de 8–12 para hipertrofia do ACSM, com compostos mais
   pesados (faixas baixas) e isolados mais leves (faixas altas).
   Progressão dupla: sobe as repetições dentro da faixa; quando fecha o
   topo da faixa em todas as séries, sobe a carga (ACSM: 2–10%).
   Cargas iniciais são estimativas pelo peso corporal, para errar para
   menos: a primeira semana serve para achar a carga real.
   Orientação geral; não substitui um profissional de educação física.
   ============================================ */

export const NIVEIS = [
  { id: 'iniciante', nome: 'Iniciante', desc: 'Menos de 6 meses treinando' },
  { id: 'intermediario', nome: 'Intermediário', desc: '6 meses a 2 anos' },
  { id: 'avancado', nome: 'Avançado', desc: 'Mais de 2 anos, com constância' }
];

export const GENEROS = [{ id: 'f', nome: 'Feminino' }, { id: 'm', nome: 'Masculino' }];

export const DIVISOES = [
  { id: 'FB', nome: 'Full body', freq: '3x por semana', desc: 'O corpo todo em cada treino, com um dia de descanso entre eles.', para: ['iniciante'] },
  { id: 'AB', nome: 'AB', freq: '4x por semana', desc: 'A: parte de cima · B: pernas e glúteos. Repete AB AB.', para: ['iniciante', 'intermediario'] },
  { id: 'ABC', nome: 'ABC', freq: '3 a 6x por semana', desc: 'A: empurrar (peito, ombros, tríceps) · B: puxar (costas, bíceps) · C: pernas.', para: ['intermediario'] },
  { id: 'ABCD', nome: 'ABCD', freq: '4x por semana', desc: 'A: costas e bíceps · B: peito e tríceps · C: pernas · D: ombros e abdômen.', para: ['intermediario', 'avancado'] },
  { id: 'ABCDE', nome: 'ABCDE', freq: '5x por semana', desc: 'Um grupo grande por dia. Mais volume por músculo, menos frequência.', para: ['avancado'] }
];

/** Exercícios que movem várias articulações: faixa mais baixa, mais descanso. */
const COMPOSTOS = new Set([
  'supino-reto', 'supino-inclinado-halteres', 'flexao', 'puxada-frente', 'remada-curvada', 'remada-unilateral', 'barra-fixa',
  'desenvolvimento-halteres', 'supino-fechado', 'mergulho-banco', 'agachamento-livre', 'leg-press', 'afundo', 'stiff',
  'elevacao-pelvica', 'agachamento-sumo', 'good-morning'
]);
/** Sem carga externa: progride em repetições (ou tempo, na prancha). */
const SEM_CARGA = new Set(['flexao', 'barra-fixa', 'mergulho-banco', 'prancha', 'abdominal-supra', 'elevacao-pernas', 'ponte-gluteo', 'suspensao-barra', 'pular-corda']);
const POR_TEMPO = new Set(['prancha', 'suspensao-barra', 'pular-corda', 'farmer-walk']);
const PERNAS = new Set(['quadriceps', 'posteriores', 'gluteos', 'panturrilhas']);

/**
 * Carga inicial (~12 repetições com folga) em fração do peso corporal,
 * para um homem intermediário. Halteres: cada halter. Máquina/polia: a placa.
 * Barra: barra + anilhas.
 */
const FATOR = {
  'supino-reto': 0.45, 'supino-inclinado-halteres': 0.13, 'crucifixo-polia': 0.08, 'puxada-frente': 0.5, 'remada-curvada': 0.4,
  'remada-unilateral': 0.2, 'desenvolvimento-halteres': 0.11, 'elevacao-lateral': 0.05, 'crucifixo-inverso': 0.05, 'face-pull': 0.18,
  'rosca-direta': 0.22, 'rosca-alternada': 0.09, 'rosca-martelo': 0.1, 'rosca-scott': 0.15, 'triceps-corda': 0.2, 'triceps-frances': 0.13,
  'supino-fechado': 0.35, 'rosca-punho': 0.15, 'rosca-punho-inversa': 0.08, 'farmer-walk': 0.25, 'pallof-press': 0.1,
  'agachamento-livre': 0.5, 'leg-press': 1.1, 'cadeira-extensora': 0.35, 'afundo': 0.1, 'stiff': 0.45, 'mesa-flexora': 0.25,
  'cadeira-flexora': 0.3, 'good-morning': 0.25, 'elevacao-pelvica': 0.6, 'agachamento-sumo': 0.2, 'abducao-maquina': 0.4,
  'panturrilha-pe': 0.5, 'panturrilha-sentado': 0.3, 'panturrilha-unilateral': 0.1
};
const NIVEL_X = { iniciante: 0.7, intermediario: 1, avancado: 1.3 };
// Diferença média de força relativa (estimativa conservadora)
const GENERO_X = { m: { cima: 1, pernas: 1 }, f: { cima: 0.55, pernas: 0.8 } };

/* ---------- Divisões ---------- */

const DIA = (id, nome, ex) => ({ id, nome, ex });
const MODELOS = {
  FB: [
    DIA('A', 'Corpo todo', ['leg-press', 'supino-reto', 'puxada-frente', 'desenvolvimento-halteres', 'mesa-flexora', 'remada-unilateral', 'triceps-corda', 'rosca-alternada', 'prancha'])
  ],
  AB: [
    DIA('A', 'Parte de cima', ['supino-reto', 'puxada-frente', 'supino-inclinado-halteres', 'remada-unilateral', 'desenvolvimento-halteres', 'elevacao-lateral', 'rosca-alternada', 'triceps-corda']),
    DIA('B', 'Pernas e abdômen', ['agachamento-livre', 'leg-press', 'stiff', 'cadeira-extensora', 'mesa-flexora', 'panturrilha-pe', 'abdominal-supra', 'prancha'])
  ],
  ABC: [
    DIA('A', 'Peito, ombros e tríceps', ['supino-reto', 'supino-inclinado-halteres', 'desenvolvimento-halteres', 'crucifixo-polia', 'elevacao-lateral', 'triceps-corda', 'triceps-frances']),
    DIA('B', 'Costas e bíceps', ['puxada-frente', 'remada-curvada', 'remada-unilateral', 'face-pull', 'rosca-direta', 'rosca-martelo', 'barra-fixa']),
    DIA('C', 'Pernas e abdômen', ['agachamento-livre', 'leg-press', 'stiff', 'cadeira-extensora', 'mesa-flexora', 'panturrilha-pe', 'prancha', 'elevacao-pernas'])
  ],
  ABCD: [
    DIA('A', 'Costas e bíceps', ['puxada-frente', 'remada-curvada', 'remada-unilateral', 'barra-fixa', 'rosca-direta', 'rosca-martelo', 'rosca-scott']),
    DIA('B', 'Peito e tríceps', ['supino-reto', 'supino-inclinado-halteres', 'crucifixo-polia', 'flexao', 'triceps-corda', 'triceps-frances', 'supino-fechado']),
    DIA('C', 'Pernas', ['agachamento-livre', 'leg-press', 'stiff', 'cadeira-extensora', 'mesa-flexora', 'elevacao-pelvica', 'panturrilha-pe', 'panturrilha-sentado']),
    DIA('D', 'Ombros e abdômen', ['desenvolvimento-halteres', 'elevacao-lateral', 'crucifixo-inverso', 'face-pull', 'abdominal-supra', 'elevacao-pernas', 'prancha', 'pallof-press'])
  ],
  ABCDE: [
    DIA('A', 'Peito e abdômen', ['supino-reto', 'supino-inclinado-halteres', 'crucifixo-polia', 'flexao', 'abdominal-supra', 'elevacao-pernas', 'prancha']),
    DIA('B', 'Costas', ['puxada-frente', 'barra-fixa', 'remada-curvada', 'remada-unilateral', 'face-pull', 'suspensao-barra']),
    DIA('C', 'Pernas', ['agachamento-livre', 'leg-press', 'cadeira-extensora', 'stiff', 'mesa-flexora', 'cadeira-flexora', 'panturrilha-pe', 'panturrilha-sentado']),
    DIA('D', 'Ombros', ['desenvolvimento-halteres', 'elevacao-lateral', 'crucifixo-inverso', 'face-pull', 'pallof-press']),
    DIA('E', 'Braços', ['rosca-direta', 'triceps-corda', 'rosca-alternada', 'triceps-frances', 'rosca-martelo', 'supino-fechado', 'rosca-punho'])
  ]
};

// Treino feminino (ficha feminina do hipertrofia.org): mais glúteos e posteriores nos dias de perna
const EXTRA_F = ['elevacao-pelvica', 'abducao-maquina', 'agachamento-sumo'];
// Iniciante: troca o que pede mais técnica ou força relativa
const TROCA_INICIANTE = { 'barra-fixa': 'puxada-frente', 'agachamento-livre': 'agachamento-sumo', 'good-morning': 'mesa-flexora', 'supino-fechado': 'triceps-corda' };
const MAX_POR_DIA = { iniciante: 6, intermediario: 7, avancado: 8 };

/** Séries, faixa de repetições e descanso por experiência e tipo de exercício. */
export function prescricao(exId, nivel) {
  if (POR_TEMPO.has(exId)) return { series: nivel === 'avancado' ? 4 : 3, reps: exId === 'pular-corda' ? '60s' : '30-45s', descanso: 60 };
  const comp = COMPOSTOS.has(exId);
  if (nivel === 'iniciante') return { series: 3, reps: comp ? '10-12' : '12-15', descanso: comp ? 90 : 60 };
  if (nivel === 'intermediario') return { series: comp ? 4 : 3, reps: comp ? '8-12' : '10-15', descanso: comp ? 90 : 60 };
  return { series: comp ? 4 : 3, reps: comp ? '6-10' : '10-12', descanso: comp ? 120 : 75 };
}

const arred = (kg, passo) => Math.max(passo, Math.round(kg / passo) * passo);

/** Carga inicial sugerida (kg) ou 0 quando o exercício é sem carga. */
export function cargaInicial(ex, perfil) {
  const f = FATOR[ex.id];
  if (!f || SEM_CARGA.has(ex.id) || !perfil.peso) return 0;
  const g = GENERO_X[perfil.genero] || GENERO_X.m;
  let kg = perfil.peso * f * (NIVEL_X[perfil.nivel] || 1) * (PERNAS.has(ex.grupo) ? g.pernas : g.cima);
  if (ex.equipamento === 'Barra') kg = Math.max(kg, 10); // a barra vazia já pesa
  return arred(kg, passoDe(ex));
}

/** Menor salto de carga prático: halteres de 1 em 1 kg (2 kg acima de 10), barra 2 kg (1 de cada lado), placas 2,5 kg; leg press 5 kg. */
export function passoDe(ex = {}) {
  if (ex.id === 'leg-press') return 5;
  if (ex.equipamento === 'Halteres' || ex.equipamento === 'Kettlebell') return 1;
  if (ex.equipamento === 'Barra') return 2;
  return 2.5;
}

/**
 * Monta o plano: dias da divisão, exercícios ajustados por experiência e
 * gênero, prescrição e carga inicial de cada um.
 * @param {{nivel, genero, peso, divisao}} perfil
 * @param {(id:string)=>object} acharEx exercício da biblioteca pelo id
 */
export function gerarPlano(perfil, acharEx) {
  const max = MAX_POR_DIA[perfil.nivel] || 7;
  return (MODELOS[perfil.divisao] || MODELOS.ABC).map(d => {
    let ids = d.ex.map(id => (perfil.nivel === 'iniciante' && TROCA_INICIANTE[id]) || id);
    const diaDePerna = ids.some(id => ['quadriceps', 'gluteos', 'posteriores'].includes(acharEx(id)?.grupo));
    if (perfil.genero === 'f' && diaDePerna) {
      // glúteos logo depois do primeiro composto; sai uma panturrilha/abdômen do fim para caber
      const novos = EXTRA_F.filter(id => !ids.includes(id));
      ids = [ids[0], ...novos.slice(0, 2), ...ids.slice(1)];
    }
    ids = [...new Set(ids)].filter(id => acharEx(id)).slice(0, max);
    return {
      id: d.id,
      nome: d.nome,
      itens: ids.map(id => ({ ex: id, ...prescricao(id, perfil.nivel), carga: cargaInicial(acharEx(id), perfil) }))
    };
  });
}

/** Divisão indicada para a experiência (as outras de `para` aparecem como "também serve"). */
const INDICADA = { iniciante: 'FB', intermediario: 'ABC', avancado: 'ABCD' };
export const divisaoIndicada = nivel => INDICADA[nivel] || 'ABC';

/* ---------- Progressão ---------- */

/** "8-12" -> {min: 8, max: 12}; "30-45s" -> por tempo. */
export function faixa(reps) {
  const m = String(reps || '').match(/^(\d+)(?:\s*-\s*(\d+))?(s?)$/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2] || m[1]), tempo: !!m[3] };
}

const fmtKg = kg => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

/**
 * O que fazer no próximo treino, pela progressão dupla.
 * @param {Array} regs registros do exercício, do mais novo para o mais antigo
 * @param {{reps:string}} item prescrição do plano (se houver)
 * @returns {{tipo:'subir'|'manter'|'reduzir'|'comecar', texto:string, carga?:number}|null}
 */
export function proximaCarga(regs, item, ex) {
  const ult = regs[0];
  const fx = faixa(item?.reps) || { min: 8, max: 12, tempo: false };
  if (!ult) {
    return item?.carga
      ? { tipo: 'comecar', carga: item.carga, texto: `Comece com uns ${fmtKg(item.carga)} e ajuste: a última repetição deve sair difícil, mas com técnica.` }
      : null;
  }
  const semCarga = !ult.carga;
  if (ult.reps >= fx.max) {
    if (semCarga || fx.tempo) return { tipo: 'subir', texto: fx.tempo ? 'Fechou o tempo: aumente 5 a 10 segundos.' : `Fechou ${fx.max} repetições: some 1 a 2 repetições ou acrescente carga.` };
    const passo = passoDe(ex);
    // ACSM: 2–10%. Na prática, ~5% arredondado para o peso que existe na academia.
    const nova = Math.max(ult.carga + passo, arred(ult.carga * 1.05, passo));
    return { tipo: 'subir', carga: nova, texto: `Você fechou ${fx.max} repetições com ${fmtKg(ult.carga)}. Suba para ${fmtKg(nova)} e volte a buscar ${fx.min}.` };
  }
  if (ult.reps < fx.min) {
    if (semCarga || fx.tempo) return { tipo: 'manter', texto: 'Abaixo da faixa: mantenha e tente somar uma repetição por treino.' };
    // Dois treinos seguidos abaixo da faixa: reduz ~10%
    const deNovo = !!regs[1] && regs[1].reps < fx.min && regs[1].carga === ult.carga;
    const nova = arred(ult.carga * 0.9, passoDe(ex));
    return deNovo
      ? { tipo: 'reduzir', carga: nova, texto: `Dois treinos abaixo de ${fx.min} repetições: reduza para ${fmtKg(nova)} e reconstrua.` }
      : { tipo: 'manter', carga: ult.carga, texto: `Abaixo de ${fx.min} repetições: mantenha ${fmtKg(ult.carga)} e tente chegar na faixa.` };
  }
  return { tipo: 'manter', carga: ult.carga || undefined, texto: `Mantenha${ult.carga ? ` ${fmtKg(ult.carga)}` : ''} e tente uma repetição a mais até chegar a ${fx.max}.` };
}

export { fmtKg };
