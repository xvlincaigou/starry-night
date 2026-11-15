'use strict';

(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const wrap = $('#canvas-wrap');
  const plaque = $('#plaque');
  const scr = {
    load: $('#screen-loading'),
    start: $('#screen-start'),
    pause: $('#screen-pause'),
    end: $('#screen-end'),
  };
  const fill = $('#energy-fill');
  const meter = $('.meter');
  const needMark = $('#need-mark');
  const pipsEl = $('#star-pips');
  const hintEl = $('#hint');
  const quoteEl = $('#quote');
  const quoteText = $('#quote .q-text');
  const palette = $('#palette');
  const btnSound = $('#btn-sound');

  const show = (el) => el.classList.remove('hidden');
  const hide = (el) => el.classList.add('hidden');
  const isShown = (el) => !el.classList.contains('hidden');

  // ---------------------------------------------------------------- layout

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const m = Math.min(vw, vh);
    const fw = m < 560 ? Math.max(6, m * 0.02) : clamp(m * 0.03, 14, 34);
    document.documentElement.style.setProperty('--fw', fw + 'px');
    const showPlaque = vh > 640 && vw > 700;
    plaque.style.display = showPlaque ? '' : 'none';
    const margin = m < 560 ? 6 : Math.min(48, vh * 0.045);
    const availW = vw - 2 * margin - 2 * fw;
    const availH = vh - 2 * margin - 2 * fw - (showPlaque ? 64 : 0);
    const s = Math.max(0.1, Math.min(availW / W, availH / H));
    wrap.style.width = Math.floor(W * s) + 'px';
    wrap.style.height = Math.floor(H * s) + 'px';
    return s;
  }

  const scale = fit();
  window.addEventListener('resize', fit);

  for (let i = 0; i < Scene.stars.length; i++) {
    const s = document.createElement('span');
    s.className = 'pip';
    s.textContent = '✦';
    pipsEl.appendChild(s);
  }

  // ---------------------------------------------------------------- hooks

  let hintTimer = 0, quoteTimer = 0;
  Game.hooks.hint = (text, dur = 4) => {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('show'), dur * 1000);
  };
  Game.hooks.quote = (text) => {
    quoteText.textContent = '“' + text + '”';
    quoteEl.classList.add('show');
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(() => quoteEl.classList.remove('show'), 7000);
  };
  Game.hooks.star = (n) => {
    const pip = pipsEl.children[n - 1];
    if (pip) pip.classList.add('lit');
  };
  Game.hooks.state = (st) => {
    document.body.classList.toggle('in-game', st === 'playing' || st === 'ending' || st === 'free');
    document.body.classList.toggle('free-mode', st === 'free');
    if (st === 'free') show(palette);
    else hide(palette);
  };
  Game.hooks.end = (stats) => {
    const t = Math.round(stats.time);
    $('#st-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('#st-motes').textContent = stats.motes;
    $('#st-fades').textContent = stats.fades;
    document.body.classList.remove('in-game');
    show(scr.end);
  };

  // ---------------------------------------------------------------- actions

  function startGame() {
    Sound.init();
    hide(scr.start);
    hide(scr.end);
    for (const p of pipsEl.children) p.classList.remove('lit');
    quoteEl.classList.remove('show');
    Game.start();
  }

  function togglePause(force) {
    const S = Game.S;
    if (!['playing', 'ending', 'free'].includes(S.state)) return;
    S.paused = force !== undefined ? force : !S.paused;
    if (S.paused) show(scr.pause);
    else hide(scr.pause);
  }

  function toggleSound() {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    btnSound.classList.toggle('muted', Sound.muted);
  }

  const swatches = [...palette.querySelectorAll('button')];
  function setBrush(i) {
    const b = swatches[i];
    if (!b) return;
    swatches.forEach((s) => s.classList.toggle('active', s === b));
    Game.setBrush(b.dataset.c);
  }
  swatches.forEach((b, i) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    setBrush(i);
  }));
  setBrush(0);

  $('#btn-start').addEventListener('click', startGame);
  $('#btn-again').addEventListener('click', startGame);
  $('#btn-free').addEventListener('click', () => {
    hide(scr.end);
    Game.startFree();
  });
  $('#btn-save').addEventListener('click', () => Game.save());
  $('#btn-save2').addEventListener('click', () => Game.save());
  btnSound.addEventListener('click', toggleSound);
  scr.pause.addEventListener('click', () => togglePause(false));

  // ---------------------------------------------------------------- input

  let touchDown = false;
  let touchStart = null;
  let mouseDown = false;
  let spaceDown = false;

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && !touchDown) return;
    const [x, y] = toLogical(e);
    if (Math.abs(x - Input.px) + Math.abs(y - Input.py) > 3) Input.usingKeys = false;
    Input.px = x;
    Input.py = y;
    if (e.pointerType === 'mouse') Input.pointerActive = true;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toLogical(e);
    Input.px = x;
    Input.py = y;
    Input.usingKeys = false;
    Input.pointerActive = true;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      mouseDown = true;
      Input.dash = { x, y };
    } else {
      touchDown = true;
      touchStart = { t: performance.now(), x, y };
      canvas.setPointerCapture?.(e.pointerId);
    }
    Input.painting = true;
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') {
      mouseDown = false;
    } else {
      touchDown = false;
      Input.pointerActive = false;
      if (touchStart && performance.now() - touchStart.t < 220) {
        const [x, y] = toLogical(e);
        if (Math.hypot(x - touchStart.x, y - touchStart.y) < 14) Input.dash = { x, y };
      }
      touchStart = null;
    }
    Input.painting = mouseDown || spaceDown || touchDown;
  });

  document.addEventListener('mouseleave', () => {
    Input.pointerActive = false;
  });

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
  };

  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) {
      Input.keys[k] = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      if (!e.repeat) Input.dash = true;
      if (e.code === 'Space') {
        spaceDown = true;
        Input.painting = true;
      }
      return;
    }
    if (e.code === 'Enter') {
      if (isShown(scr.start)) startGame();
      return;
    }
    if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'KeyC') Game.save();
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (/^Digit[1-7]$/.test(e.code)) setBrush(+e.code.slice(5) - 1);
  });

  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) Input.keys[k] = false;
    if (e.code === 'Space') {
      spaceDown = false;
      Input.painting = mouseDown || touchDown;
    }
  });

  window.addEventListener('blur', () => {
    for (const k in Input.keys) Input.keys[k] = false;
    if (Game.S.state === 'playing') togglePause(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.S.state === 'playing') togglePause(true);
  });

  // ---------------------------------------------------------------- loop

  let lastE = -1, lastNeed = -1;
  function updateHUD() {
    const S = Game.S, p = S.player;
    if (!p) return;
    const e = Math.round(p.energy * 2) / 2;
    if (e !== lastE) {
      fill.style.width = e + '%';
      meter.classList.toggle('low', S.state === 'playing' && e < 20);
      lastE = e;
    }
    const need = S.state === 'playing' ? Math.round(S.need) : 0;
    if (need !== lastNeed) {
      needMark.style.left = Math.min(need, 100) + '%';
      needMark.classList.toggle('show', need > 0);
      lastNeed = need;
    }
    needMark.classList.toggle('short', need > 0 && p.energy < need);
  }

  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!Game.S.paused) Game.update(dt);
    Game.render();
    updateHUD();
    requestAnimationFrame(loop);
  }

  function boot() {
    const q = clamp((window.devicePixelRatio || 1) * scale, 1, 1.5);
    Game.init(canvas, q);
    hide(scr.load);
    show(scr.start);
    last = performance.now();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(() => setTimeout(boot, 40));
})();
