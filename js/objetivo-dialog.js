/* ============================================
   DataLife — Objetivos: criar / editar
   ============================================
   Enquanto o formulário é preenchido, mostra quanto guardar por mês
   para cumprir o prazo e, com o valor mensal informado, quando o
   objetivo será alcançado. "Usar este valor" copia o necessário.
   ============================================ */

import { ICONES, ICONE_NOMES, LIMITES } from './objetivos-db.js';
import { aporteNecessario, mesesAte, mesesEntre, somaMeses, taxaMensal, totais, mesCurto, folgaLabel } from './objetivos-calc.js';
import { icon, formatBRL, formatBRLRaw, parseBRL, bindCurrencyInput, monthKey, MESES } from './utils.js';
import { enhanceSelect } from './selectpicker.js';

const $ = id => document.getElementById(id);
const HORIZONTE_ANOS = 60;

let ctx = null;   // { onSave(dados, { novo, inicial }) }
let atual = null; // objetivo em edição (null = novo)

/** "10,5" -> 1050 pontos-base; inválido -> null */
function parseTaxa(text) {
  const t = String(text).trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n * 100 > LIMITES.taxa) return null;
  return Math.round(n * 100);
}
const formatTaxa = bps => (bps ? (bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');

function ler() {
  const f = $('obj-form');
  return {
    nome: f.nome.value.trim(),
    icone: f.querySelector('[name="icone"]:checked')?.value || ICONES[0],
    alvo: parseBRL(f.alvo.value),
    prazo: `${f.prazoAno.value}-${f.prazoMes.value}`,
    mensal: parseBRL(f.mensal.value),
    taxa: parseTaxa(f.taxa.value),
    inicial: parseBRL(f.inicial.value)
  };
}

function preview() {
  const d = ler();
  const hoje = monthKey(new Date());
  const btn = $('usar-necessario');
  const el = $('obj-preview');
  btn.hidden = true;
  if (!d.alvo || d.taxa === null) {
    el.innerHTML = d.taxa === null ? '<span class="text-danger">Rentabilidade entre 0% e 50% ao ano.</span>' : '';
    return;
  }
  const saldo = atual ? Math.max(0, totais(atual.movimentos).saldo) : d.inicial;
  if (saldo >= d.alvo) {
    el.innerHTML = 'Com o que já está guardado, este objetivo já está <strong>concluído</strong>.';
    return;
  }
  const r = taxaMensal(d.taxa);
  const diff = mesesEntre(hoje, d.prazo);
  const meses = Math.max(0, diff);
  const parts = [];
  if (diff < 0) {
    parts.push('<span class="text-danger">O prazo já passou.</span> Escolha um mês a partir deste.');
  } else {
    const nec = aporteNecessario(saldo, d.alvo, meses, r);
    parts.push(meses
      ? `Para chegar em <strong>${mesCurto(d.prazo)}</strong>: <strong class="num">${formatBRL(nec)}</strong> por mês, nos próximos ${meses} ${meses === 1 ? 'mês' : 'meses'}.`
      : `Prazo neste mês: faltam <strong class="num">${formatBRL(nec)}</strong>.`);
    if (nec !== d.mensal) {
      btn.hidden = false;
      btn.textContent = 'Usar este valor';
      btn.dataset.valor = nec;
    }
  }
  if (d.mensal > 0) {
    const n = mesesAte(saldo, d.alvo, d.mensal, r);
    if (Number.isFinite(n)) {
      const quando = somaMeses(hoje, n);
      const folga = mesesEntre(quando, d.prazo);
      parts.push(`Guardando ${formatBRL(d.mensal)} por mês, você chega lá em <strong>${mesCurto(quando)}</strong>${diff >= 0 ? ` (${folgaLabel(folga)})` : ''}.`);
    } else {
      parts.push(`Guardando ${formatBRL(d.mensal)} por mês, levaria mais de 100 anos.`);
    }
  }
  el.innerHTML = parts.join('<br>');
}

function fillPrazo(prazo) {
  const f = $('obj-form');
  const ano = new Date().getFullYear();
  const [py, pm] = prazo.split('-');
  const ultimo = Math.max(ano + HORIZONTE_ANOS, Number(py));
  const primeiro = Math.min(ano, Number(py));
  f.prazoMes.innerHTML = MESES.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  f.prazoAno.innerHTML = Array.from({ length: ultimo - primeiro + 1 }, (_, i) => `<option>${primeiro + i}</option>`).join('');
  f.prazoMes.value = pm;
  f.prazoAno.value = py;
}

/** @param {Object|null} obj objetivo para editar, ou null para criar */
export function openObjetivoDialog(obj = null) {
  atual = obj;
  const f = $('obj-form');
  f.reset();
  const novo = !obj;
  $('obj-dialog-title').textContent = novo ? 'Novo objetivo' : 'Editar objetivo';
  $('obj-dialog-sub').textContent = novo ? 'Dê um nome, um valor e um prazo. O resto é com a gente.' : obj.nome;
  $('obj-submit').textContent = novo ? 'Criar objetivo' : 'Salvar';
  $('field-inicial').hidden = !novo;

  const icone = obj?.icone || ICONES[0];
  $('icon-pick').innerHTML = ICONES.map(i => `
    <label class="icon-opt" title="${ICONE_NOMES[i]}">
      <input type="radio" name="icone" value="${i}" ${i === icone ? 'checked' : ''} aria-label="${ICONE_NOMES[i]}">
      <span>${icon(i, 18)}</span>
    </label>`).join('');

  f.nome.value = obj?.nome || '';
  f.alvo.value = obj ? formatBRLRaw(obj.alvo) : '';
  f.mensal.value = obj?.mensal ? formatBRLRaw(obj.mensal) : '';
  f.taxa.value = formatTaxa(obj?.taxa || 0);
  fillPrazo(obj?.prazo || somaMeses(monthKey(new Date()), 24));
  preview();
  $('obj-dialog').showModal();
  if (novo) f.nome.focus();
}

export function initObjetivoDialog(options) {
  ctx = options;
  const dialog = $('obj-dialog');
  const f = $('obj-form');
  dialog.querySelector('.dialog-head [data-close]').innerHTML = icon('x', 18);
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  ['alvo', 'mensal', 'inicial'].forEach(n => bindCurrencyInput(f[n], preview));
  enhanceSelect(f.prazoMes);
  enhanceSelect(f.prazoAno);
  f.addEventListener('input', preview);
  f.addEventListener('change', preview);

  $('usar-necessario').addEventListener('click', () => {
    f.mensal.value = formatBRLRaw(Number($('usar-necessario').dataset.valor));
    preview();
  });

  f.addEventListener('submit', e => {
    e.preventDefault();
    const d = ler();
    const erro = !d.nome ? [f.nome, 'Dê um nome ao objetivo.']
      : !d.alvo ? [f.alvo, 'Informe quanto quer juntar.']
      : d.taxa === null ? [f.taxa, 'Use uma rentabilidade entre 0 e 50% ao ano.']
      : !atual && mesesEntre(monthKey(new Date()), d.prazo) < 0 ? [f.prazoMes, 'O prazo precisa ser deste mês em diante.']
      : null;
    if (erro) {
      erro[0].setCustomValidity(erro[1]);
      erro[0].reportValidity();
      erro[0].addEventListener('input', () => erro[0].setCustomValidity(''), { once: true });
      erro[0].addEventListener('change', () => erro[0].setCustomValidity(''), { once: true });
      return;
    }
    const { inicial, ...dados } = d;
    dialog.close();
    ctx.onSave(atual ? { ...atual, ...dados } : dados, { novo: !atual, inicial });
  });
}
