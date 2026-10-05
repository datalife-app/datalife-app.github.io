/* ============================================
   DataLife — Cadeado do Diário (telas)
   ============================================
   Tela de senha quando trancado e o diálogo para ligar, trocar a senha,
   trancar agora ou desligar. A criptografia em si está em cripto.js.
   ============================================ */

import {
  iniciarCofre, situacao, destrancar, trancar, criarCofre, trocarSenha, prepararDesligar, cancelarDesligar, desligarCofre
} from './cripto.js';
import { fetchEntradas, regravarDiario } from './diario-db.js';
import { fetchVicios, regravarVicios } from './vicios-db.js';
import { icon, showToast } from './utils.js';

const $ = id => document.getElementById(id);
const MIN = 10;
let user = null;

function iconeBotao() {
  const s = situacao();
  $('btn-cofre').innerHTML = icon(s === 'desligado' ? 'unlock' : 'lock');
  $('btn-cofre').title = s === 'desligado' ? 'Cadeado do Diário: desligado' : 'Cadeado do Diário: ligado';
}

/** Mostra a tela de senha até destrancar. Resolve quando o conteúdo pode ser lido. */
export async function exigirCofre(u) {
  user = u;
  $('cofre-tela').querySelector('.cofre-icon').innerHTML = icon('lock', 26);
  let s;
  try {
    s = await iniciarCofre(user.uid);
  } catch (e) {
    console.error(e);
    s = 'desligado'; // sem rede e sem cache: as leituras seguintes avisam
  }
  iconeBotao();
  bindDialog();
  if (s !== 'trancado') return;
  $('cofre-tela').hidden = false;
  const abas = document.querySelector('.topbar .tabs');
  if (abas) abas.style.visibility = 'hidden';
  const f = $('cofre-abrir');
  f.senha.focus();
  await new Promise(resolve => {
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Abrindo…';
      $('cofre-erro').hidden = true;
      try {
        await destrancar(f.senha.value, { lembrarAparelho: f.lembrar.checked });
        f.reset();
        $('cofre-tela').hidden = true;
        if (abas) abas.style.visibility = '';
        iconeBotao();
        resolve();
      } catch (err) {
        $('cofre-erro').textContent = err.message === 'senha' ? 'Senha incorreta.' : 'Não foi possível abrir. Tente de novo.';
        $('cofre-erro').hidden = false;
        f.senha.select();
      } finally {
        btn.disabled = false;
        btn.textContent = 'Destrancar';
      }
    });
  });
}

/* ---------- Diálogo ---------- */

const campoSenha = (name, label, auto = 'new-password') => `
  <label class="field"><span class="field-label">${label}</span>
    <input class="input" type="password" name="${name}" required autocomplete="${auto}" maxlength="200"></label>`;

function render() {
  const s = situacao();
  $('cofre-sub').textContent = s === 'desligado' ? 'Desligado' : 'Ligado: Diário e Vícios cifrados neste navegador';
  const body = $('cofre-body');
  if (s === 'desligado') {
    body.innerHTML = `
      <div class="cofre-info">
        <p>Com o cadeado, as entradas do Diário e os Vícios são <strong>cifrados no seu aparelho</strong> antes de ir para o banco de dados. Nem o Google nem quem conseguisse acesso ao banco leria o conteúdo.</p>
        <ul>
          <li>${icon('lock', 14)}<span>AES-256 com uma chave derivada da sua senha (PBKDF2, 600 mil rodadas).</span></li>
          <li>${icon('info', 14)}<span><strong>Sem a senha, não há recuperação.</strong> Anote-a num gerenciador de senhas.</span></li>
          <li>${icon('smartphone', 14)}<span>Cada aparelho pede a senha uma vez por visita, ou fica lembrado até você sair.</span></li>
        </ul>
      </div>
      <form id="cofre-ligar" autocomplete="off" class="form-body cofre-form">
        <input type="text" name="username" autocomplete="username" value="DataLife: cadeado do Diário" hidden>
        ${campoSenha('senha', `Senha (mínimo ${MIN} caracteres; uma frase é ótima)`)}
        ${campoSenha('confirma', 'Repita a senha')}
        <label class="check-row"><input type="checkbox" name="lembrar"> <span>Lembrar neste aparelho</span></label>
        <label class="check-row"><input type="checkbox" name="ciente" required> <span>Entendo que, se esquecer a senha, o Diário não pode ser recuperado.</span></label>
        <button class="btn btn-primary" type="submit">Ligar o cadeado</button>
      </form>`;
    return;
  }
  body.innerHTML = `
    <button class="btn btn-ghost cofre-acao" type="button" data-acao="trancar">${icon('lock', 16)} Trancar agora</button>
    <details class="cofre-sec">
      <summary>Trocar a senha</summary>
      <form id="cofre-trocar" autocomplete="off" class="form-body cofre-form">
        <input type="text" name="username" autocomplete="username" value="DataLife: cadeado do Diário" hidden>
        ${campoSenha('atual', 'Senha atual', 'current-password')}
        ${campoSenha('senha', `Senha nova (mínimo ${MIN})`)}
        ${campoSenha('confirma', 'Repita a senha nova')}
        <button class="btn btn-primary btn-sm" type="submit">Trocar senha</button>
      </form>
    </details>
    <details class="cofre-sec">
      <summary>Desligar o cadeado</summary>
      <form id="cofre-desligar" autocomplete="off" class="form-body cofre-form">
        <p class="text-muted">Tudo volta a ser gravado sem cifra (ainda protegido pelas regras do banco e pelo seu login).</p>
        <input type="text" name="username" autocomplete="username" value="DataLife: cadeado do Diário" hidden>
        ${campoSenha('senha', 'Senha do Diário', 'current-password')}
        <button class="btn btn-ghost btn-sm danger-btn" type="submit">Desligar</button>
      </form>
    </details>`;
}

function validarNova(f) {
  f.confirma.setCustomValidity('');
  f.senha.setCustomValidity('');
  if (f.senha.value.length < MIN) f.senha.setCustomValidity(`Use pelo menos ${MIN} caracteres.`);
  else if (f.senha.value !== f.confirma.value) f.confirma.setCustomValidity('As senhas não são iguais.');
  return f.reportValidity();
}

async function ocupado(f, texto, fn) {
  const btn = f.querySelector('[type="submit"]');
  const antes = btn.textContent;
  btn.disabled = true;
  btn.textContent = texto;
  try { await fn(); } finally { btn.disabled = false; btn.textContent = antes; }
}

let ligado = false;
function bindDialog() {
  if (ligado) return;
  ligado = true;
  const dlg = $('cofre-dialog');
  dlg.querySelector('[data-close]').innerHTML = icon('x', 18);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  $('btn-cofre').addEventListener('click', () => {
    if (situacao() === 'trancado') return $('cofre-abrir').senha.focus();
    render();
    dlg.showModal();
  });

  $('cofre-body').addEventListener('click', async e => {
    if (e.target.closest('[data-acao="trancar"]')) {
      await trancar();
      location.reload();
    }
  });
  $('cofre-body').addEventListener('input', e => e.target.setCustomValidity?.(''));

  $('cofre-body').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.id === 'cofre-ligar') {
        if (!validarNova(f)) return;
        await ocupado(f, 'Cifrando…', async () => {
          // Lê tudo em claro antes; depois de criar o cofre, regrava cifrado
          const [entradas, vicios] = await Promise.all([fetchEntradas(user.uid), fetchVicios(user.uid)]);
          await criarCofre(user.uid, f.senha.value, { lembrarAparelho: f.lembrar.checked });
          await regravarDiario(user.uid, entradas);
          await regravarVicios(user.uid, vicios);
          showToast(`Cadeado ligado: ${entradas.size} ${entradas.size === 1 ? 'entrada cifrada' : 'entradas cifradas'}.`);
        });
      } else if (f.id === 'cofre-trocar') {
        if (!validarNova(f)) return;
        await ocupado(f, 'Trocando…', async () => {
          await trocarSenha(f.atual.value, f.senha.value);
          showToast('Senha trocada. Outros aparelhos vão pedir a senha nova.');
        });
      } else if (f.id === 'cofre-desligar') {
        await ocupado(f, 'Decifrando…', async () => {
          await prepararDesligar(f.senha.value);
          try {
            const [entradas, vicios] = await Promise.all([fetchEntradas(user.uid), fetchVicios(user.uid)]);
            await regravarDiario(user.uid, entradas);
            await regravarVicios(user.uid, vicios);
          } catch (err) {
            cancelarDesligar();
            throw err;
          }
          await desligarCofre(user.uid);
          showToast('Cadeado desligado.');
        });
      }
      $('cofre-dialog').close();
      iconeBotao();
    } catch (err) {
      console.error(err);
      if (err.message === 'senha') {
        const campo = f.atual || f.senha;
        campo.setCustomValidity('Senha incorreta.');
        campo.reportValidity();
      } else {
        showToast(`Não foi possível concluir: ${err.code || err.message || 'erro'}. Nada foi perdido; tente de novo.`, 'error', 6000);
      }
    }
  });
}
