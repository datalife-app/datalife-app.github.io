/* ============================================
   DataLife — Avisos de validação
   ============================================
   O balão nativo ("Preencha este campo") é do navegador: não aceita CSS e
   muda de idioma conforme o sistema. Interceptamos o evento 'invalid'
   (disparado por required/min/max e por setCustomValidity + reportValidity),
   cancelamos o balão nativo e mostramos o nosso, junto do campo.
   O envio continua bloqueado pelo navegador como antes.
   ============================================ */

import { placeFixed } from './utils.js';

let bubble = null;   // { el, anchor, pop, timer }
let lastAt = 0;

/** Mensagem em português pelo tipo de erro (a nativa vem no idioma do navegador). */
function mensagem(el) {
  const v = el.validity;
  if (v.customError) return el.validationMessage;
  if (v.valueMissing) return el.tagName === 'SELECT' ? 'Escolha uma opção.' : 'Preencha este campo.';
  if (v.rangeUnderflow) return `Use um valor a partir de ${el.min}.`;
  if (v.rangeOverflow) return `Use um valor até ${el.max}.`;
  if (v.stepMismatch) return 'Use um número inteiro.';
  if (v.tooLong) return `Use no máximo ${el.maxLength} caracteres.`;
  if (v.badInput || v.typeMismatch || v.patternMismatch) return 'Valor inválido.';
  return el.validationMessage || 'Confira este campo.';
}

function hide() {
  if (!bubble) return;
  const { pop, timer } = bubble;
  bubble = null;
  clearTimeout(timer);
  pop.classList.add('is-leaving');
  setTimeout(() => pop.remove(), 110);
  document.removeEventListener('pointerdown', hide, true);
  window.removeEventListener('scroll', hide, true);
  window.removeEventListener('resize', hide);
}

function show(el) {
  hide();
  // Campos com seletor próprio (data, lista) ficam escondidos: o aviso vai no botão visível
  const anchor = el.matches('.dp-native, .sp-native') ? el.nextElementSibling : el;
  anchor.focus({ preventScroll: true });
  anchor.scrollIntoView({ block: 'nearest' });

  const pop = document.createElement('div');
  pop.className = 'field-bubble';
  pop.setAttribute('role', 'alert');
  pop.textContent = mensagem(el);
  (anchor.closest('dialog') || document.body).append(pop);

  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const below = window.innerHeight - r.bottom >= h + 12;
  placeFixed(pop, Math.min(Math.max(8, r.left), window.innerWidth - w - 8), below ? r.bottom + 8 : r.top - h - 8);
  pop.classList.toggle('is-above', !below);
  pop.style.setProperty('--arrow-x', `${Math.min(24, r.width / 2)}px`);

  bubble = { el, anchor, pop, timer: setTimeout(hide, 5000) };
  // Fecha ao corrigir o campo, ao clicar fora ou ao rolar a página
  setTimeout(() => {
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  });
}

export function initValidacao() {
  document.addEventListener('invalid', e => {
    e.preventDefault(); // sem o balão do navegador
    const el = e.target;
    el.setAttribute('aria-invalid', 'true');
    const limpar = () => {
      el.removeAttribute('aria-invalid');
      if (bubble?.el === el) hide();
    };
    el.addEventListener('input', limpar, { once: true });
    el.addEventListener('change', limpar, { once: true });
    // Num envio com vários campos inválidos, só o primeiro ganha o balão
    const now = performance.now();
    if (now - lastAt < 50) return;
    lastAt = now;
    show(el);
  }, true);
}
