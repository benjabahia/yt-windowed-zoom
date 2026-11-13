/*
 * content.js — roda no mundo isolado da extensão.
 * Responsável por: ler as configurações, zoom com scroll e pan (arrastar).
 *
 * Como o zoom funciona: aplicamos no <video> um
 *   transform: translate(x, y) scale(s)   com transform-origin: 0 0
 * Os controles do YouTube são irmãos do <video>, então NÃO são ampliados.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const DEFAULTS = {
    windowedFullscreen: true,
    zoomEnabled: true,
    zoomOnlyInFullscreen: true,
    zoomSpeed: 1,
    maxZoom: 8,
  };
  let settings = { ...DEFAULTS };

  // ---------- configurações ----------
  function applySettings() {
    root.dataset.ytwfEnabled = String(!!settings.windowedFullscreen);
    if (!settings.windowedFullscreen && root.classList.contains('ytwf-active')) {
      document.dispatchEvent(new CustomEvent('ytwf:exit'));
    }
    if (!settings.zoomEnabled || (settings.zoomOnlyInFullscreen && !isFullscreenLike())) {
      resetZoom(false);
    }
  }

  root.dataset.ytwfEnabled = 'true';
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    applySettings();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
    applySettings();
  });

  // ---------- estado do zoom ----------
  const state = { player: null, s: 1, x: 0, y: 0 };
  let drag = null;
  let suppressClickUntil = 0;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // document.fullscreenElement aqui (mundo isolado) é o ORIGINAL, então
  // detecta a tela cheia real; a classe detecta a tela cheia na janela.
  const isFullscreenLike = () =>
    root.classList.contains('ytwf-active') || !!document.fullscreenElement;

  const zoomAllowed = () =>
    settings.zoomEnabled && (!settings.zoomOnlyInFullscreen || isFullscreenLike());

  const getPlayer = (t) => (t instanceof Element ? t.closest('.html5-video-player') : null);
  const getVideo = (p) => p.querySelector('video.html5-main-video') || p.querySelector('video');

  // Áreas onde o scroll/arrasto NÃO deve mexer no zoom (controles, menus...).
  const EXCLUDED = [
    '.ytp-chrome-bottom', '.ytp-chrome-top', '.ytp-popup', '.ytp-settings-menu',
    '.ytp-ce-element', '.ytp-cards-teaser', '.ytp-ad-module', '.ytp-autonav-endscreen',
    '.ytp-videowall-still', 'button', 'a', 'input', 'textarea',
  ].join(',');
  const isExcluded = (t) => t instanceof Element && !!t.closest(EXCLUDED);

  function bindPlayer(player) {
    if (state.player !== player) {
      resetZoom(false);
      state.player = player;
    }
  }

  function render() {
    const p = state.player;
    if (!p) return;
    p.style.setProperty('--ytwf-s', String(state.s));
    p.style.setProperty('--ytwf-x', `${state.x}px`);
    p.style.setProperty('--ytwf-y', `${state.y}px`);
    p.classList.toggle('ytwf-zoomed', state.s > 1.001);
  }

  // Impede que a borda do vídeo "entre" na área dele (sem faixas pretas extras).
  // baseW/baseH = tamanho do vídeo SEM zoom.
  function clampPan(baseW, baseH) {
    if (state.s <= 1.001) {
      state.s = 1; state.x = 0; state.y = 0;
      return;
    }
    state.x = clamp(state.x, baseW * (1 - state.s), 0);
    state.y = clamp(state.y, baseH * (1 - state.s), 0);
  }

  function resetZoom(withBadge = true) {
    state.s = 1; state.x = 0; state.y = 0;
    render();
    if (withBadge && state.player) showBadge();
  }

  // ---------- indicador "2.0×" ----------
  let badgeTimer = 0;
  function showBadge() {
    const p = state.player;
    if (!p) return;
    let badge = p.querySelector(':scope > .ytwf-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ytwf-badge';
      p.appendChild(badge);
    }
    badge.textContent = `${state.s.toFixed(1)}×`;
    badge.classList.add('ytwf-visible');
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => badge.classList.remove('ytwf-visible'), 900);
  }

  // ---------- 2. ZOOM COM O SCROLL ----------
  document.addEventListener('wheel', (e) => {
    const player = getPlayer(e.target);
    if (!player || !zoomAllowed() || isExcluded(e.target) || e.ctrlKey) return;
    const video = getVideo(player);
    if (!video) return;

    e.preventDefault();
    e.stopPropagation();
    bindPlayer(player);

    const rect = video.getBoundingClientRect(); // já inclui o zoom atual
    const baseW = rect.width / state.s;
    const baseH = rect.height / state.s;

    // Normaliza o delta (linhas/páginas -> pixels)
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= rect.height;

    const factor = Math.exp(-dy * 0.0015 * (settings.zoomSpeed || 1));
    const newS = clamp(state.s * factor, 1, settings.maxZoom || 8);
    const ratio = newS / state.s;

    // Zoom centrado no cursor: o ponto sob o mouse fica parado.
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    state.x += px * (1 - ratio);
    state.y += py * (1 - ratio);
    state.s = newS;

    clampPan(baseW, baseH);
    render();
    showBadge();
  }, { passive: false, capture: true });

  // ---------- 3. PAN (CLICAR E ARRASTAR) ----------
  document.addEventListener('pointerdown', (e) => {
    const player = getPlayer(e.target);
    if (!player || player !== state.player || state.s <= 1.001 || isExcluded(e.target)) return;

    // Botão do meio = resetar zoom
    if (e.button === 1) {
      e.preventDefault();
      resetZoom();
      return;
    }
    if (e.button !== 0) return;

    drag = {
      id: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      x0: state.x, y0: state.y,
      moved: false,
    };
  }, true);

  // Evita o auto-scroll do Chrome no clique do meio sobre o vídeo com zoom.
  document.addEventListener('mousedown', (e) => {
    if (e.button === 1 && state.s > 1.001 && getPlayer(e.target) === state.player) {
      e.preventDefault();
    }
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !state.player) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return; // pequeno tremor = ainda é um clique
      drag.moved = true;
      state.player.classList.add('ytwf-dragging');
    }

    e.preventDefault();
    const video = getVideo(state.player);
    if (!video) return;
    const rect = video.getBoundingClientRect();
    state.x = drag.x0 + dx;
    state.y = drag.y0 + dy;
    clampPan(rect.width / state.s, rect.height / state.s);
    render();
  }, { capture: true, passive: false });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.moved) suppressClickUntil = performance.now() + 350;
    state.player && state.player.classList.remove('ytwf-dragging');
    drag = null;
  }
  window.addEventListener('pointerup', endDrag, true);
  window.addEventListener('pointercancel', endDrag, true);

  // Depois de arrastar, o "clique" não deve pausar o vídeo.
  document.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClickUntil = 0;
    }
  }, true);

  // ---------- resets automáticos ----------
  // Entrar/sair de tela cheia muda o tamanho do vídeo: recomeça sem zoom.
  const onFsChange = () => {
    resetZoom(false);
    if (!zoomAllowed()) state.player = null;
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('yt-navigate-finish', () => resetZoom(false));
  // Se a janela mudar de tamanho, só reajusta os limites do enquadramento.
  window.addEventListener('resize', () => {
    if (state.s <= 1.001 || !state.player) return;
    requestAnimationFrame(() => {
      const video = state.player && getVideo(state.player);
      if (!video) return;
      const rect = video.getBoundingClientRect();
      clampPan(rect.width / state.s, rect.height / state.s);
      render();
    });
  });
})();
