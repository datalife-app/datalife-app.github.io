/* ============================================
   DataLife — Foco: histórico do mês
   ============================================
   Visão macro: um quadradinho por dia para água, alimentação, exercício,
   tarefas e focos (como os rastreadores de hábito: Loop, Streaks, o
   "habit tracker" dos bullet journals), os totais do mês e o que ficou
   pendente nos dias que já passaram, com "Trazer para hoje".
   Usa o mesmo cache do calendário (uma consulta por mês).
   ============================================ */

import { icon, escapeHtml, shiftMonth, MESES, fromDayKey } from './utils.js';
import { planoAgua, COPO_ML } from './foco-saude.js';
import { REFEICOES } from './foco-db.js';

const $ = id => document.getElementById(id);
let ctx = null;
let mes = null;

const pad = n => String(n).padStart(2, '0');
const diasDoMes = m => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate(); };
const fmt = k => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

/** Situação de cada hábito num dia: 'ok' | 'parcial' | 'nada' | null (sem como medir). */
function avaliar(d, copos) {
  const marcados = d.agua.filter(Boolean).length;
  const refeicoes = REFEICOES.filter(r => d.refeicoes[r.id]).length;
  const feitas = d.tarefas.filter(t => t.feita).length;
  return {
    agua: copos ? (marcados >= copos ? 'ok' : marcados ? 'parcial' : 'nada') : null,
    comida: refeicoes === REFEICOES.length ? 'ok' : refeicoes ? 'parcial' : 'nada',
    exercicio: d.exercicio ? 'ok' : 'nada',
    tarefas: !d.tarefas.length ? 'vazio' : feitas === d.tarefas.length ? 'ok' : feitas ? 'parcial' : 'nada',
    focos: d.pomodoros >= 4 ? 'ok' : d.pomodoros ? 'parcial' : 'nada',
    _: { marcados, refeicoes, feitas, total: d.tarefas.length, pomodoros: d.pomodoros }
  };
}

const LINHAS = [
  { id: 'agua', nome: 'Água', icone: 'droplet', dica: (a, c) => `${a._.marcados} de ${c} copos` },
  { id: 'comida', nome: 'Alimentação', icone: 'utensils', dica: a => `${a._.refeicoes} de ${REFEICOES.length} refeições` },
  { id: 'exercicio', nome: 'Exercício', icone: 'activity', dica: a => (a.exercicio === 'ok' ? 'fez' : 'não fez') },
  { id: 'tarefas', nome: 'Tarefas', icone: 'check', dica: a => (a._.total ? `${a._.feitas} de ${a._.total} feitas` : 'sem tarefas') },
  { id: 'focos', nome: 'Focos', icone: 'timer', dica: a => `${a._.pomodoros} ${a._.pomodoros === 1 ? 'foco' : 'focos'}` }
];

export function render() {
  if (!ctx || $('view-historico').hidden) return;
  const hoje = ctx.today();
  mes ||= hoje.slice(0, 7);
  const n = diasDoMes(mes);
  const [y, m] = mes.split('-').map(Number);
  const cfg = ctx.config();
  const copos = cfg?.agua ? planoAgua(cfg.agua).copos : 0;
  const dias = Array.from({ length: n }, (_, i) => `${mes}-${pad(i + 1)}`);
  const passados = dias.filter(k => k <= hoje);
  const dados = new Map(dias.map(k => [k, ctx.dia(k)]));
  const carregado = dias.every(k => k > hoje || dados.get(k));

  $('hist-mes').textContent = `${MESES[m - 1]} ${y}`;
  $('hist-next').disabled = mes >= hoje.slice(0, 7);
  if (!carregado) {
    $('hist-body').innerHTML = '<div class="hist-carregando" aria-busy="true"></div>';
    ctx.carregar(mes).then(() => render(), e => {
      console.error(e);
      $('hist-body').innerHTML = '<p class="hist-vazio">Não foi possível ler este mês. Verifique a conexão.</p>';
    });
    return;
  }

  const av = new Map(passados.map(k => [k, avaliar(dados.get(k), copos)]));
  const conta = (id, v = 'ok') => passados.filter(k => av.get(k)[id] === v).length;
  const totTarefas = passados.reduce((a, k) => a + av.get(k)._.total, 0);
  const totFeitas = passados.reduce((a, k) => a + av.get(k)._.feitas, 0);
  const totFocos = passados.reduce((a, k) => a + av.get(k)._.pomodoros, 0);
  const base = passados.length;

  const kpi = (rotulo, valor, sub, pct) => `
    <div class="hist-kpi">
      <span class="hist-kpi-label">${rotulo}</span>
      <strong class="num">${valor}</strong>
      <span class="hist-kpi-sub">${sub}</span>
      ${pct != null ? `<div class="hist-bar"><i style="transform:scaleX(${Math.min(1, pct)})"></i></div>` : ''}
    </div>`;

  const grade = `
    <div class="hist-grade-wrap">
      <div class="hist-grade" style="--n:${n}">
        <span class="hist-corner"></span>
        ${dias.map(k => { const dd = fromDayKey(k); return `<span class="hist-dia ${dd.getDay() === 0 ? 'is-dom' : ''} ${k === hoje ? 'is-hoje' : ''}">${dd.getDate()}</span>`; }).join('')}
        ${LINHAS.map(l => `
          <span class="hist-linha">${icon(l.icone, 14)}${l.nome}</span>
          ${dias.map(k => {
            if (k > hoje) return '<i class="hist-cel is-futuro"></i>';
            const a = av.get(k), v = a[l.id];
            if (v === null) return '<i class="hist-cel is-sem"></i>';
            return `<button type="button" class="hist-cel is-${v}" data-dia="${k}" title="${fmt(k)}: ${l.dica(a, copos)}" aria-label="${fmt(k)}, ${l.nome}: ${l.dica(a, copos)}"></button>`;
          }).join('')}`).join('')}
      </div>
    </div>
    <ul class="hist-legenda" aria-label="Legenda">
      <li><i class="hist-cel is-ok"></i>Completo</li><li><i class="hist-cel is-parcial"></i>Em parte</li><li><i class="hist-cel is-nada"></i>Não fez</li>
      ${copos ? '' : '<li class="hist-aviso">Informe o peso nos Ajustes para medir a água.</li>'}
    </ul>`;

  // Pendências: tarefas não feitas dos dias que já passaram (as mais recentes primeiro)
  const pend = passados.filter(k => k < hoje).reverse()
    .flatMap(k => dados.get(k).tarefas.filter(t => !t.feita).map(t => ({ k, t })));

  // Focos por dia: uma barra por dia, com a quantidade escrita em cima
  const META_FOCOS = 4; // o mesmo corte do "completo" da grade
  const focosDia = passados.map(k => av.get(k)._.pomodoros);
  const diasComFoco = focosDia.filter(Boolean).length;
  const recorde = Math.max(0, ...focosDia);
  const escala = Math.max(META_FOCOS + 1, recorde);
  const focosGrafico = `
    <section class="hist-sec" aria-labelledby="hist-focos-title">
      <div class="hist-focos-head">
        <h2 class="card-title" id="hist-focos-title">Focos no mês</h2>
        <p class="hist-focos-resumo">
          <span><strong class="num">${totFocos}</strong> ${totFocos === 1 ? 'foco' : 'focos'}</span>
          <span><strong class="num">${diasComFoco}</strong> ${diasComFoco === 1 ? 'dia' : 'dias'} com foco</span>
          ${recorde ? `<span>recorde <strong class="num">${recorde}</strong></span>` : ''}
        </p>
      </div>
      ${totFocos ? `
      <div class="hist-grade-wrap">
        <div class="hist-focos" style="--n:${n}; --meta:${META_FOCOS / escala}">
          <span class="hist-focos-meta" aria-hidden="true"><b>${META_FOCOS}</b></span>
          ${dias.map(k => {
            const dd = fromDayKey(k).getDate();
            if (k > hoje) return `<span class="hist-focos-col is-futuro"><span class="hist-focos-barra"></span><span class="hist-focos-dia">${dd}</span></span>`;
            const v = av.get(k)._.pomodoros;
            const txt = `${fmt(k)}: ${v} ${v === 1 ? 'foco' : 'focos'}`;
            return `<button type="button" class="hist-focos-col ${k === hoje ? 'is-hoje' : ''}" data-dia="${k}" title="${txt}" aria-label="${txt}">
              <span class="hist-focos-barra">${v ? `<span class="hist-focos-n num">${v}</span><i class="${v >= META_FOCOS ? 'is-ok' : ''}" style="height:${(v / escala) * 100}%"></i>` : ''}</span>
              <span class="hist-focos-dia">${dd}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
      <p class="hist-focos-nota">Linha tracejada: meta de ${META_FOCOS} focos no dia (o ciclo até a pausa longa).</p>`
      : `<p class="hist-vazio">Nenhum foco concluído neste mês ainda. Cada Pomodoro terminado aparece aqui.</p>`}
    </section>`;

  $('hist-body').innerHTML = `
    <div class="hist-kpis">
      ${kpi('Água em dia', copos ? `${conta('agua')} <span>de ${base}</span>` : '—', copos ? `${plural(conta('agua'), 'dia')} com os ${copos} copos (${(copos * COPO_ML / 1000).toLocaleString('pt-BR')} L)` : 'informe o peso nos Ajustes', copos ? conta('agua') / base : null)}
      ${kpi('Comeu direito', `${conta('comida')} <span>de ${base}</span>`, `dias com as ${REFEICOES.length} refeições`, conta('comida') / base)}
      ${kpi('Exercício', `${conta('exercicio')} <span>de ${base}</span>`, 'dias com treino', conta('exercicio') / base)}
      ${kpi('Tarefas feitas', `${totFeitas} <span>de ${totTarefas}</span>`, totTarefas ? `${Math.round((totFeitas / totTarefas) * 100)}% concluídas` : 'nenhuma no mês', totTarefas ? totFeitas / totTarefas : null)}
      ${kpi('Focos', `${totFocos}`, `${Math.round(totFocos * (cfg?.pomodoro?.foco || 25) / 60)} h de foco no mês`, null)}
    </div>
    ${focosGrafico}
    <section class="hist-sec" aria-labelledby="hist-grade-title">
      <h2 class="card-title" id="hist-grade-title">Dia a dia</h2>
      ${grade}
    </section>
    <section class="hist-sec" aria-labelledby="hist-pend-title">
      <h2 class="card-title" id="hist-pend-title">Ficou pendente <span class="card-count num">${pend.length || ''}</span></h2>
      ${pend.length ? `<ul class="hist-pend">${pend.slice(0, 60).map(({ k, t }) => `
        <li data-dia="${k}" data-id="${escapeHtml(t.id)}">
          <span class="hist-pend-dia num">${fmt(k)}</span>
          <span class="hist-pend-texto">${escapeHtml(t.texto)}</span>
          <button class="btn btn-ghost btn-sm" type="button" data-trazer>${icon('arrowRight', 14)} Trazer para hoje</button>
        </li>`).join('')}</ul>`
        : `<p class="hist-vazio">${passados.length > 1 ? 'Nada pendente nos dias que passaram.' : 'Os dias que passarem aparecem aqui.'}</p>`}
    </section>`;
}

const plural = (n, s) => `${n} ${n === 1 ? s : `${s}s`}`;

export function initHistorico(options) {
  ctx = options;
  $('hist-prev').innerHTML = icon('chevronLeft', 16);
  $('hist-next').innerHTML = icon('chevronRight', 16);
  $('hist-prev').addEventListener('click', () => { mes = shiftMonth(mes, -1); render(); });
  $('hist-next').addEventListener('click', () => { mes = shiftMonth(mes, 1); render(); });
  $('hist-body').addEventListener('click', e => {
    const tr = e.target.closest('[data-trazer]');
    if (tr) {
      const li = tr.closest('[data-id]');
      return ctx.trazer(li.dataset.dia, li.dataset.id);
    }
    const cel = e.target.closest('.hist-cel[data-dia], .hist-focos-col[data-dia]');
    if (cel) ctx.abrirDia(cel.dataset.dia);
  });
}
