/* ============================================
   DataLife — Tema (script comum, não-módulo)
   ============================================
   Carregado no <head>, antes do CSS, para aplicar o tema salvo antes da
   primeira pintura (sem "piscar" o tema padrão). Arquivo do próprio site:
   permitido pela CSP (script-src 'self'), sem JavaScript inline.
   A escolha fica neste aparelho (como o modo privacidade).
   ============================================ */
(function () {
  var KEY = 'datalife:tema';
  // bg = cor da barra do navegador (meta theme-color); cores = amostra do seletor
  var TEMAS = [
    { id: 'lavanda', nome: 'Lavanda', grupo: 'Escuros', desc: 'O original do DataLife', bg: '#110c17', cores: ['#dabfff', '#b48ce6', '#623a8c'] },
    { id: 'floresta', nome: 'Floresta', grupo: 'Escuros', desc: 'Verde profundo', bg: '#0c1310', cores: ['#c8ecd8', '#8fd1ae', '#3c7a5c'] },
    { id: 'oceano', nome: 'Oceano', grupo: 'Escuros', desc: 'Azul-marinho', bg: '#0a0f17', cores: ['#cfe3ff', '#8ab8f5', '#3a66a8'] },
    { id: 'grafite', nome: 'Grafite', grupo: 'Escuros', desc: 'Neutro com âmbar', bg: '#111111', cores: ['#ffe2b0', '#f2b65a', '#8f5f1f'] },
    { id: 'semdistracao', nome: 'Sem distração', grupo: 'Escuros', desc: 'Quase preto, sálvia e mel', bg: '#0d0e10', cores: ['#8fa67e', '#d9b65a', '#d58fa8'] },
    { id: 'noturno', nome: 'Noturno', grupo: 'Escuros', desc: 'Ardósia com ação em coral', bg: '#0b1120', cores: ['#6aa8f8', '#334155', '#ff8a73'] },
    { id: 'musgo', nome: 'Musgo', grupo: 'Escuros', desc: 'Sálvia com ação em terracota', bg: '#121715', cores: ['#a3c4aa', '#36443d', '#e8896d'] },
    { id: 'lousa', nome: 'Lousa', grupo: 'Escuros', desc: 'Quadro-negro e giz amarelo', bg: '#1b201d', cores: ['#eeede6', '#434d46', '#ffd166'] },
    { id: 'clareza', nome: 'Clareza', grupo: 'Claros', desc: 'Foco e eficiência', bg: '#f8f9fa', cores: ['#2563eb', '#e2e8f0', '#d42a45'] },
    { id: 'salvia', nome: 'Sálvia', grupo: 'Claros', desc: 'Calma, para o Diário', bg: '#faf9f6', cores: ['#84a98c', '#cad2c5', '#e07a5f'] },
    { id: 'caderno', nome: 'Caderno', grupo: 'Claros', desc: 'Papel, grafite e marca-texto', bg: '#fdfbf7', cores: ['#4a4a4a', '#e6e1d8', '#ffd166'] },
    { id: 'papel', nome: 'Papel', grupo: 'Claros', desc: 'Papel quente e terracota', bg: '#f5f1ea', cores: ['#7c2d12', '#b4492a', '#e7a688'] },
    { id: 'dracula', nome: 'Dracula', grupo: 'Clássicos de IDE', desc: 'Roxo, rosa e verde', bg: '#282a36', cores: ['#bd93f9', '#ff79c6', '#50fa7b'] },
    { id: 'monokai', nome: 'Monokai', grupo: 'Clássicos de IDE', desc: 'Ciano, magenta e lima', bg: '#272822', cores: ['#66d9ef', '#fc4483', '#a6e22e'] },
    { id: 'onedark', nome: 'One Dark', grupo: 'Clássicos de IDE', desc: 'O tema do Atom', bg: '#282c34', cores: ['#61afef', '#c678dd', '#98c379'] },
    { id: 'nord', nome: 'Nord', grupo: 'Clássicos de IDE', desc: 'Ártico, azul gelo', bg: '#2e3440', cores: ['#88c0d0', '#d08770', '#a3be8c'] },
    { id: 'solarized', nome: 'Solarized Dark', grupo: 'Clássicos de IDE', desc: 'Azul-petróleo e amarelo', bg: '#002b36', cores: ['#5aaee8', '#b58900', '#a3b53a'] },
    { id: 'gruvbox', nome: 'Gruvbox', grupo: 'Clássicos de IDE', desc: 'Retrô e quente', bg: '#282828', cores: ['#83a598', '#fabd2f', '#fe8019'] },
    { id: 'tokyonight', nome: 'Tokyo Night', grupo: 'Clássicos de IDE', desc: 'Neon noturno', bg: '#1a1b26', cores: ['#7aa2f7', '#bb9af7', '#9ece6a'] },
    { id: 'catppuccin', nome: 'Catppuccin Mocha', grupo: 'Clássicos de IDE', desc: 'Pastel suave', bg: '#1e1e2e', cores: ['#cba6f7', '#fab387', '#a6e3a1'] },
    { id: 'github', nome: 'GitHub Dark', grupo: 'Clássicos de IDE', desc: 'Azul com ação em verde', bg: '#0d1117', cores: ['#4493f8', '#238636', '#3fb950'] }
  ];

  function achar(id) {
    for (var i = 0; i < TEMAS.length; i++) if (TEMAS[i].id === id) return TEMAS[i];
    return TEMAS[0];
  }

  // Favicon com as cores do tema (o mesmo anel da marca): fundo do tema + 3 tons da rampa
  var ARCOS = {
    lavanda: ['#dabfff', '#b48ce6', '#7d52b8'], floresta: ['#c8ecd8', '#8fd1ae', '#4f9474'],
    oceano: ['#cfe3ff', '#8ab8f5', '#4a7cc4'], grafite: ['#ffe2b0', '#f2b65a', '#b07a2c'],
    clareza: ['#1e3a8a', '#2563eb', '#60a5fa'], salvia: ['#2f3e46', '#52796f', '#84a98c'],
    caderno: ['#4a4a4a', '#8a6200', '#ffd166'], papel: ['#7c2d12', '#b4492a', '#d06d47'],
    semdistracao: ['#aec198', '#8fa67e', '#d9b65a'],
    noturno: ['#dbe8fe', '#6aa8f8', '#ff8a73'], musgo: ['#dbe7dc', '#a3c4aa', '#e8896d'],
    lousa: ['#eeede6', '#9c9f95', '#ffd166'], dracula: ['#bd93f9', '#ff79c6', '#50fa7b'],
    monokai: ['#66d9ef', '#fc4483', '#a6e22e'], onedark: ['#61afef', '#c678dd', '#98c379'],
    nord: ['#88c0d0', '#81a1c1', '#d08770'], solarized: ['#5aaee8', '#2aa198', '#b58900'],
    gruvbox: ['#83a598', '#fe8019', '#fabd2f'], tokyonight: ['#7aa2f7', '#bb9af7', '#7dcfff'],
    catppuccin: ['#cba6f7', '#f5c2e7', '#fab387'], github: ['#4493f8', '#a5d6ff', '#3fb950']
  };
  function favicon(t) {
    var c = ARCOS[t.id] || ARCOS.lavanda;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="' + t.bg + '"/>' +
      '<g fill="none" stroke-width="10"><path d="M33.19 15.04A17 17 0 0 1 33.19 48.96" stroke="' + c[0] + '"/>' +
      '<path d="M30.81 48.96A17 17 0 0 1 15.01 31.41" stroke="' + c[1] + '"/><path d="M15.26 29.05A17 17 0 0 1 30.81 15.04" stroke="' + c[2] + '"/></g></svg>';
    var href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    var links = document.querySelectorAll('link[rel="icon"]');
    for (var i = 0; i < links.length; i++) {
      // O PNG fixo (lavanda) sai: o navegador usaria ele em vez do SVG do tema
      if (links[i].type === 'image/svg+xml') links[i].href = href;
      else links[i].parentNode.removeChild(links[i]);
    }
  }

  function aplicar(id) {
    var t = achar(id);
    var root = document.documentElement;
    if (t.id === 'lavanda') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t.id);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    favicon(t);
    return t;
  }

  var salvo = null;
  try { salvo = localStorage.getItem(KEY); } catch (e) { /* storage indisponível */ }
  var atual = aplicar(salvo).id;

  window.DataLifeTema = {
    lista: TEMAS,
    atual: function () { return atual; },
    definir: function (id) {
      atual = achar(id).id;
      try { localStorage.setItem(KEY, atual); } catch (e) { /* ok */ }
      var root = document.documentElement;
      // Transição curta só durante a troca (não deixa "transition" ligada no resto do uso)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('tema-mudando');
        setTimeout(function () { root.classList.remove('tema-mudando'); }, 260);
      }
      aplicar(atual);
      window.dispatchEvent(new CustomEvent('datalife:tema', { detail: atual }));
    }
  };
})();

/* Convite de instalação (PWA): chega cedo, antes dos módulos; o Hub mostra o botão */
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__dlInstalar = e;
  window.dispatchEvent(new Event('datalife:instalavel'));
});
