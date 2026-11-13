/*
 * main-world.js — roda no MESMO contexto JavaScript do YouTube ("world": "MAIN").
 *
 * Ideia: quando o YouTube pede tela cheia (botão, tecla F, duplo clique),
 * ele chama element.requestFullscreen(). Nós substituímos essa função:
 * em vez de ocupar o monitor inteiro, adicionamos uma classe CSS que faz
 * o elemento preencher 100% da JANELA, e "mentimos" para o YouTube que
 * ele está em tela cheia (document.fullscreenElement + evento
 * fullscreenchange). Assim o YouTube troca para o layout de tela cheia
 * normalmente, só que dentro da janela.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const FS_CLASS = 'ytwf-fullscreen';
  const ACTIVE_CLASS = 'ytwf-active';

  let fakeEl = null;       // elemento em "tela cheia na janela"
  let shiftHeld = false;   // Shift pressionado => usar tela cheia real

  // O content script (mundo isolado) escreve a configuração neste atributo.
  const isEnabled = () => root.dataset.ytwfEnabled !== 'false';

  // ---------- guarda as implementações originais ----------
  const EP = Element.prototype;
  const DP = Document.prototype;
  const origRequest = EP.requestFullscreen;
  const origWebkitRequest = EP.webkitRequestFullscreen;
  const origExit = DP.exitFullscreen;
  const origWebkitExit = DP.webkitExitFullscreen;
  const desc = (name) => Object.getOwnPropertyDescriptor(DP, name);
  const original = {
    fullscreenElement: desc('fullscreenElement'),
    webkitFullscreenElement: desc('webkitFullscreenElement'),
    webkitCurrentFullScreenElement: desc('webkitCurrentFullScreenElement'),
    webkitIsFullScreen: desc('webkitIsFullScreen'),
    fullscreen: desc('fullscreen'),
  };

  // ---------- entrar / sair ----------
  function notify(target) {
    for (const type of ['fullscreenchange', 'webkitfullscreenchange']) {
      target.dispatchEvent(new Event(type, { bubbles: true }));
    }
    // O player do YouTube recalcula o tamanho do vídeo no evento resize.
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
  }

  function enter(el) {
    if (fakeEl === el) return;
    if (fakeEl) exit(true);
    fakeEl = el;
    el.classList.add(FS_CLASS);
    root.classList.add(ACTIVE_CLASS);
    notify(el);
  }

  function exit(silent = false) {
    if (!fakeEl) return;
    const el = fakeEl;
    fakeEl = null;
    el.classList.remove(FS_CLASS);
    root.classList.remove(ACTIVE_CLASS);
    if (!silent) notify(el.isConnected ? el : document);
  }

  const useWindowed = () => isEnabled() && !shiftHeld;

  // ---------- substitui a API de Fullscreen ----------
  EP.requestFullscreen = function (...args) {
    if (!useWindowed()) return origRequest.apply(this, args);
    enter(this);
    return Promise.resolve();
  };

  if (origWebkitRequest) {
    EP.webkitRequestFullscreen = function (...args) {
      if (!useWindowed()) return origWebkitRequest.apply(this, args);
      enter(this);
    };
  }

  DP.exitFullscreen = function (...args) {
    if (fakeEl) { exit(); return Promise.resolve(); }
    return origExit.apply(this, args);
  };

  if (origWebkitExit) {
    DP.webkitExitFullscreen = function (...args) {
      if (fakeEl) { exit(); return; }
      return origWebkitExit.apply(this, args);
    };
  }

  function fakeGetter(name, fakeValue) {
    const d = original[name];
    if (!d || !d.get) return;
    Object.defineProperty(DP, name, {
      configurable: true,
      enumerable: d.enumerable,
      get() { return fakeEl ? fakeValue() : d.get.call(this); },
    });
  }
  fakeGetter('fullscreenElement', () => fakeEl);
  fakeGetter('webkitFullscreenElement', () => fakeEl);
  fakeGetter('webkitCurrentFullScreenElement', () => fakeEl);
  fakeGetter('webkitIsFullScreen', () => true);
  fakeGetter('fullscreen', () => true);

  // ---------- teclas e eventos auxiliares ----------
  // Shift segurado no momento do clique/tecla => tela cheia real do monitor.
  const trackShift = (e) => { shiftHeld = !!e.shiftKey; };
  window.addEventListener('keydown', trackShift, true);
  window.addEventListener('keyup', trackShift, true);
  window.addEventListener('pointerdown', trackShift, true);
  window.addEventListener('mousedown', trackShift, true);

  // Esc sai do modo (a tela cheia real faz isso sozinha; a falsa não).
  window.addEventListener('keydown', (e) => {
    if (fakeEl && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      exit();
    }
  }, true);

  // Ao trocar de página dentro do YouTube (SPA), sai do modo.
  document.addEventListener('yt-navigate-start', () => exit());

  // O content script pede para sair (ex.: usuário desativou no popup).
  document.addEventListener('ytwf:exit', () => exit());
})();
