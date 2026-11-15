'use strict';

const Input = {
  keys: { left: false, right: false, up: false, down: false },
  px: W * 0.5,
  py: H * 0.4,
  pointerActive: false,
  usingKeys: false,
  dash: null,
  painting: false,
};

const Game = (() => {
  const MAX_SPEED = 245;
  const WIND = 0.85;
  const EMAX = 100;
  const DECAY = 0.85;
  const CROW_MAX = [0, 0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 0];

  const QUOTES = [
    '每个人心里都有一团火，路过的人只看到烟。',
    '伟大的事并非一时冲动，而是由一连串小事汇聚而成。',
    '我常常觉得，夜晚比白天更有生气，色彩更加丰富。',
    '为什么天上那些闪亮的光点，不能像法国地图上的黑点一样触手可及？',
    '我非常需要——我可以说出这个词吗——宗教。于是我在夜里出门，去画星星。',
    '如果你心里有个声音说“你不会画画”，那就一定要画，那个声音自会沉默。',
    '正如我们乘火车去塔拉斯孔或鲁昂，我们乘着死亡，去往一颗星星。',
    '我越想越觉得，没有什么比爱人更具艺术性。',
    '我想用画触动人们，让他们说：他感受得深沉，也感受得温柔。',
    '总有一天，人们会明白，我的画比画上的颜料更有价值。',
  ];
  const VENUS_QUOTE = '今晨日出前很久，我从窗口望着原野，除了晨星什么也没有，它看起来非常大。';

  const rng = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
  const tmp = { x: 0, y: 0 };
  const tmp2 = { x: 0, y: 0 };

  let canvas, ctx;
  let q = 1;
  let base, bctx, baseInit, baseData, BW, BH;
  let baseDirty = false;
  let overlay, moon, glowWarm, glowBlue, glowMoon, glowWhite;
  let cypress;
  let windows = [];

  // Flowing brushstrokes that make the sky move
  const NP = 1300;
  const fpX = new Float32Array(NP), fpY = new Float32Array(NP);
  const fpL = new Float32Array(NP), fpM = new Float32Array(NP);
  const fpW = new Float32Array(NP), fpLen = new Float32Array(NP);
  const fpX1 = new Float32Array(NP), fpY1 = new Float32Array(NP);
  const fpX2 = new Float32Array(NP), fpY2 = new Float32Array(NP);
  const fpC = new Array(NP);

  const S = {
    state: 'loading',
    paused: false,
    t: 0,
    playT: 0,
    player: null,
    motes: [],
    crows: [],
    sparks: [],
    rings: [],
    meteor: null,
    moteT: 0,
    crowT: 6,
    meteorT: 20,
    litCount: 0,
    quoteIdx: 0,
    shake: 0,
    flash: 0,
    endT: 0,
    glory: null,
    gloryIdx: 0,
    stats: { motes: 0, fades: 0, time: 0 },
    tut: {},
    lowWarnT: 0,
    chargeTickT: 0,
    pickupN: 0,
    need: 0,
    brush: '#f5c518',
  };

  const hooks = { hint() {}, quote() {}, star() {}, end() {}, state() {} };
  const hint = (text, dur) => hooks.hint(text, dur);

  // ---------------------------------------------------------------- setup

  function init(cv, quality) {
    canvas = cv;
    q = quality;
    BW = Math.round(W * q);
    BH = Math.round(H * q);
    canvas.width = BW;
    canvas.height = BH;
    ctx = canvas.getContext('2d', { alpha: false });

    base = makeCanvas(BW, BH);
    bctx = base.getContext('2d');
    bctx.setTransform(q, 0, 0, q, 0, 0);
    windows = Painter.renderBase(bctx).windows;
    baseInit = makeCanvas(BW, BH);
    baseInit.getContext('2d').drawImage(base, 0, 0);
    baseData = bctx.getImageData(0, 0, BW, BH).data;

    overlay = makeOverlay();
    moon = Painter.makeMoon(q);
    glowWarm = makeGlow(128, [[0, 'rgba(255,250,225,1)'], [0.15, 'rgba(255,236,150,0.85)'], [0.4, 'rgba(250,200,80,0.3)'], [1, 'rgba(240,170,40,0)']]);
    glowWhite = makeGlow(96, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,250,220,0.6)'], [1, 'rgba(255,240,200,0)']]);
    glowBlue = makeGlow(64, [[0, 'rgba(210,225,255,0.9)'], [0.35, 'rgba(150,180,230,0.3)'], [1, 'rgba(120,150,220,0)']]);
    glowMoon = makeGlow(256, [[0, 'rgba(255,220,120,0.9)'], [0.3, 'rgba(250,180,60,0.35)'], [1, 'rgba(240,140,30,0)']]);
    cypress = Painter.genCypress();

    for (let i = 0; i < NP; i++) spawnFP(i, true);
    resetState();
    S.state = 'title';
  }

  function makeOverlay() {
    const c = makeCanvas(BW, BH);
    const g = c.getContext('2d');
    g.setTransform(q, 0, 0, q, 0, 0);
    const grd = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, H * 0.98);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(5,4,12,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    const r = makeRng(99);
    for (let i = 0; i < 26000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,248,230,0.035)' : 'rgba(0,0,0,0.05)';
      g.fillRect(r() * W, r() * H, 1.2, 1.2);
    }
    g.fillStyle = 'rgba(0,0,0,0.028)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 0.8);
    for (let x = 0; x < W; x += 3) g.fillRect(x, 0, 0.8, H);
    return c;
  }

  function resetState() {
    for (const st of Scene.stars) {
      st.lit = false;
      st.charge = 0;
      st.litT = 0;
      st.emitT = 2 + rng() * 2;
    }
    Scene.setSwirlBoost(1);
    S.player = {
      x: Scene.moon.x - 70, y: Scene.moon.y + 70,
      vx: -40, vy: 0, bx: 0, by: 0,
      prevX: 0, prevY: 0,
      energy: 50, invuln: 0, dashCD: 0,
      dead: false, deadT: 0,
      hidden: false, inMoon: false, inLit: false, charging: null,
      trail: [],
    };
    S.motes.length = 0;
    S.crows.length = 0;
    S.sparks.length = 0;
    S.rings.length = 0;
    S.meteor = null;
    S.moteT = 0;
    S.crowT = 6;
    S.meteorT = 18 + rng() * 10;
    S.litCount = 0;
    S.quoteIdx = 0;
    S.shake = 0;
    S.flash = 0;
    S.endT = 0;
    S.glory = null;
    S.gloryIdx = 0;
    S.stats = { motes: 0, fades: 0, time: 0 };
    S.tut = {};
    S.lowWarnT = 0;
    S.playT = 0;
    S.need = 0;
    const wr = makeRng(11);
    for (const w of windows) {
      w.lit = wr() < 0.16;
      w.litAt = -10;
    }
    for (let i = 0; i < 16; i++) spawnMote();
  }

  function restoreBase() {
    if (!baseDirty) return;
    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(baseInit, 0, 0);
    bctx.restore();
    baseData = bctx.getImageData(0, 0, BW, BH).data;
    baseDirty = false;
  }

  function refreshColors(x0, y0, x1, y1) {
    const rx = clamp(Math.floor(x0 * q), 0, BW - 1);
    const ry = clamp(Math.floor(y0 * q), 0, BH - 1);
    const rw = clamp(Math.ceil(x1 * q), 0, BW) - rx;
    const rh = clamp(Math.ceil(y1 * q), 0, BH) - ry;
    if (rw <= 0 || rh <= 0) return;
    const img = bctx.getImageData(rx, ry, rw, rh).data;
    for (let row = 0; row < rh; row++) {
      baseData.set(img.subarray(row * rw * 4, (row + 1) * rw * 4), ((ry + row) * BW + rx) * 4);
    }
  }

  // Keep the color lookup in sync with free-mode painting without a GPU readback.
  function stampData(x0, y0, x1, y1, rgb, rad) {
    const minx = clamp(Math.floor((Math.min(x0, x1) - rad) * q), 0, BW - 1);
    const maxx = clamp(Math.ceil((Math.max(x0, x1) + rad) * q), 0, BW - 1);
    const miny = clamp(Math.floor((Math.min(y0, y1) - rad) * q), 0, BH - 1);
    const maxy = clamp(Math.ceil((Math.max(y0, y1) + rad) * q), 0, BH - 1);
    const dx = x1 - x0, dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1;
    for (let py = miny; py <= maxy; py++) {
      for (let px = minx; px <= maxx; px++) {
        const lx = (px + 0.5) / q, ly = (py + 0.5) / q;
        const t = clamp(((lx - x0) * dx + (ly - y0) * dy) / L2, 0, 1);
        const ex = lx - (x0 + dx * t), ey = ly - (y0 + dy * t);
        if (ex * ex + ey * ey > rad * rad) continue;
        const i = (py * BW + px) * 4;
        baseData[i] = lerp(baseData[i], rgb[0], 0.85);
        baseData[i + 1] = lerp(baseData[i + 1], rgb[1], 0.85);
        baseData[i + 2] = lerp(baseData[i + 2], rgb[2], 0.85);
      }
    }
  }

  // ---------------------------------------------------------------- flow strokes

  function spawnFP(i, initial) {
    let x = 0, y = 0;
    for (let k = 0; k < 8; k++) {
      x = rng() * (W + 40) - 20;
      y = rng() * H * 0.66;
      if (y < Scene.horizon(x) - 6) break;
    }
    fpX[i] = x;
    fpY[i] = y;
    fpM[i] = 1.6 + rng() * 2.6;
    fpL[i] = initial ? rng() * fpM[i] : 0;
    fpW[i] = 2.2 + rng() * 2.2;
    fpLen[i] = 9 + rng() * 9;
    const ix = clamp((x * q) | 0, 0, BW - 1), iy = clamp((y * q) | 0, 0, BH - 1);
    const j = (iy * BW + ix) * 4;
    let r = baseData[j], g = baseData[j + 1], b = baseData[j + 2];
    const mode = rng();
    if (mode < 0.7) {
      const k = 22 + rng() * 22;
      r += k; g += k; b += k * 0.8;
    } else if (mode < 0.9) {
      r = lerp(r, 205, 0.35); g = lerp(g, 222, 0.35); b = lerp(b, 232, 0.35);
    } else {
      r *= 0.72; g *= 0.72; b *= 0.8;
    }
    fpC[i] = `rgb(${clamp(r, 0, 255) | 0},${clamp(g, 0, 255) | 0},${clamp(b, 0, 255) | 0})`;
  }

  function updateFP(dt) {
    const t = S.t;
    for (let i = 0; i < NP; i++) {
      fpL[i] += dt;
      if (fpL[i] > fpM[i]) {
        spawnFP(i, false);
        continue;
      }
      Scene.flow(fpX[i], fpY[i], t, tmp);
      const x = fpX[i] + tmp.x * dt * 0.9;
      const y = fpY[i] + tmp.y * dt * 0.9;
      if (x > W + 30 || x < -30 || y < -20 || y > Scene.horizon(x) - 2) {
        spawnFP(i, false);
        continue;
      }
      fpX[i] = x;
      fpY[i] = y;
      const L = fpLen[i] * 0.5;
      const m = Math.hypot(tmp.x, tmp.y) || 1;
      const x1 = x + (tmp.x / m) * L, y1 = y + (tmp.y / m) * L;
      Scene.flow(x1, y1, t, tmp2);
      const m2 = Math.hypot(tmp2.x, tmp2.y) || 1;
      fpX1[i] = x1;
      fpY1[i] = y1;
      fpX2[i] = x1 + (tmp2.x / m2) * L;
      fpY2[i] = y1 + (tmp2.y / m2) * L;
    }
  }

  // ---------------------------------------------------------------- game flow

  function start() {
    restoreBase();
    resetState();
    S.state = 'playing';
    S.paused = false;
    Sound.reset();
    hooks.state('playing');
  }

  function startFree() {
    S.state = 'free';
    S.player.energy = EMAX;
    hooks.state('free');
    hint('按住鼠标或空格作画 · 数字键 1–7 换颜料 · C 保存这幅画', 7);
  }

  function inCypress(x, y, k) {
    const C = Scene.cypress;
    return y > C.top && Math.abs(x - C.cx(y)) < C.hw(y) * k;
  }

  function tutorial(dt) {
    const T = S.tut, p = S.player;
    if (!T.move && S.playT > 0.6) {
      T.move = true;
      hint('移动鼠标或拖动手指，引导这滴光；也可以用 WASD / 方向键', 5);
    }
    if (T.move && !T.mote && S.playT > 6.5) {
      T.mote = true;
      hint('风里那些金色的光点，是被吹散的星光——收集它们', 5);
    }
    if (T.mote && !T.star && S.playT > 13 && S.litCount === 0) {
      T.star = true;
      hint('带着光飞进暗淡的星星，停留片刻，把光还给它', 6);
    }
    if (!T.moon && p.inMoon && S.playT > 22) {
      T.moon = true;
      hint('月光会慢慢为你补充光', 4);
    }
    if (!T.hide && p.hidden && S.litCount >= 2) {
      T.hide = true;
      hint('在柏树的影子里，乌鸦看不见你', 4);
    }
    if (p.energy < 18 && !p.dead) {
      S.lowWarnT -= dt;
      if (S.lowWarnT <= 0) {
        S.lowWarnT = 14;
        hint('光快要熄灭了……去收集光点，或回到月亮身边', 4);
      }
    }
  }

  function update(dt) {
    S.t += dt;
    updateFP(dt);
    const active = S.state === 'playing' || S.state === 'ending' || S.state === 'ended' || S.state === 'free';
    if (S.state === 'playing') {
      S.playT += dt;
      S.stats.time += dt;
      tutorial(dt);
    }
    if (active) updatePlayer(dt);
    updateMotes(dt);
    updateCrows(dt);
    if (active) updateMeteor(dt);
    if (S.state === 'ending') updateEnding(dt);
    updateStars(dt);
    updateFx(dt);
    S.shake = Math.max(0, S.shake - dt);
    S.flash = Math.max(0, S.flash - dt * 1.5);
  }

  // ---------------------------------------------------------------- player

  function trimTrail() {
    const tr = S.player.trail;
    while (tr.length && S.t - tr[0].t > 0.9) tr.shift();
  }

  function updatePlayer(dt) {
    const p = S.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCD = Math.max(0, p.dashCD - dt);
    if (p.dead) {
      p.deadT += dt;
      trimTrail();
      if (p.deadT > 1.9) respawn();
      return;
    }

    let dx = 0, dy = 0, mag = 0;
    const K = Input.keys;
    const kx = (K.right ? 1 : 0) - (K.left ? 1 : 0);
    const ky = (K.down ? 1 : 0) - (K.up ? 1 : 0);
    if (kx || ky) {
      const m = Math.hypot(kx, ky);
      dx = kx / m;
      dy = ky / m;
      mag = 1;
      Input.usingKeys = true;
    } else if (Input.pointerActive && !Input.usingKeys) {
      const ox = Input.px - p.x, oy = Input.py - p.y, d = Math.hypot(ox, oy);
      if (d > 1) {
        dx = ox / d;
        dy = oy / d;
        mag = clamp(d / 70, 0, 1);
      }
    }
    const k = 1 - Math.exp(-5.5 * dt);
    p.vx += (dx * MAX_SPEED * mag - p.vx) * k;
    p.vy += (dy * MAX_SPEED * mag - p.vy) * k;

    if (Input.dash) {
      const target = Input.dash;
      Input.dash = null;
      if (S.state !== 'free') {
        if (typeof target === 'object') {
          const ox = target.x - p.x, oy = target.y - p.y, d = Math.hypot(ox, oy);
          if (d > 4) tryDash(ox / d, oy / d);
          else tryDash(dx, dy);
        } else tryDash(dx, dy);
      }
    }
    const bk = Math.exp(-4.5 * dt);
    p.bx *= bk;
    p.by *= bk;

    Scene.flow(p.x, p.y, S.t, tmp);
    let wind = WIND * (p.inMoon ? 0.45 : 1);
    if (S.state === 'playing') {
      // A dim star holds you gently while you give it light.
      for (const st of Scene.stars) {
        if (!st.lit && Math.hypot(p.x - st.x, p.y - st.y) < st.r * 2.3 + 22) {
          wind *= 0.3;
          break;
        }
      }
    }
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += (p.vx + p.bx + tmp.x * wind) * dt;
    p.y += (p.vy + p.by + tmp.y * wind) * dt;
    p.x = clamp(p.x, 10, W - 10);
    p.y = clamp(p.y, 10, Scene.horizon(p.x) + 26);

    p.trail.push({ x: p.x, y: p.y, t: S.t, b: Math.hypot(p.bx, p.by) > 120 });
    trimTrail();

    const m = Scene.moon;
    p.inMoon = Math.hypot(p.x - m.x, p.y - m.y) < m.r * 3;
    const C = Scene.cypress;
    p.hidden = p.y > C.top + 40 && Math.abs(p.x - (C.cx(p.y) + Painter.sway(p.y))) < C.hw(p.y) * 0.78;
    p.inLit = false;
    p.charging = null;
    for (const st of Scene.stars) if (st.lit && Math.hypot(p.x - st.x, p.y - st.y) < st.r * 3.2) p.inLit = true;

    if (S.state === 'playing') energyLogic(dt);
    else p.energy = EMAX;

    if (S.state === 'free' && Input.painting) paintFree(p.prevX, p.prevY, p.x, p.y);
  }

  function energyLogic(dt) {
    const p = S.player;
    p.energy -= DECAY * dt;
    if (p.inMoon) p.energy += 7 * dt;
    if (p.inLit) p.energy += 2.5 * dt;
    let nearest = 1e9;
    S.need = 0;
    for (const st of Scene.stars) {
      if (st.lit) continue;
      const d = Math.hypot(p.x - st.x, p.y - st.y);
      if (d < 300 && d < nearest) {
        nearest = d;
        S.need = st.cost - st.charge;
      }
      if (d < st.r * 2.3 + 16) {
        if (p.energy > 3) {
          const amt = Math.min(st.cost - st.charge, 36 * dt, p.energy - 3);
          st.charge += amt;
          p.energy -= amt;
          p.charging = st;
          if (st.charge >= st.cost - 0.001) igniteStar(st);
        } else if (!S.tut.need || S.t - S.tut.need > 6) {
          S.tut.need = S.t;
          hint('光不够了——去收集更多金色光点', 3.5);
        }
      }
    }
    if (p.charging) {
      S.chargeTickT -= dt;
      if (S.chargeTickT <= 0) {
        S.chargeTickT = 0.1;
        Sound.tick(p.charging.charge / p.charging.cost);
      }
    }
    p.energy = Math.min(EMAX, p.energy);
    if (p.energy <= 0 && S.state === 'playing') die();
  }

  function tryDash(dx, dy) {
    const p = S.player;
    if (p.dashCD > 0 || p.dead) return;
    if (!dx && !dy) {
      const m = Math.hypot(p.vx, p.vy);
      if (m < 5) return;
      dx = p.vx / m;
      dy = p.vy / m;
    }
    if (S.state === 'playing') {
      if (p.energy < 6) {
        hint('光太弱了，冲不动', 2);
        return;
      }
      p.energy -= 4;
    }
    p.bx += dx * 560;
    p.by += dy * 560;
    p.dashCD = 0.75;
    burst(p.x, p.y, 14, ['#fff3b0', '#ffd54a'], 160, 0.5);
    Sound.dash();
  }

  function die() {
    const p = S.player;
    p.dead = true;
    p.deadT = 0;
    p.energy = 0;
    S.stats.fades++;
    burst(p.x, p.y, 40, ['#ffd54a', '#f0a030', '#fff3c0'], 220, 1.2);
    Sound.fade();
    hint('光熄灭了……月亮会把你重新点亮', 3);
  }

  function respawn() {
    const p = S.player, m = Scene.moon;
    p.dead = false;
    p.x = m.x - 40;
    p.y = m.y + 60;
    p.vx = p.vy = p.bx = p.by = 0;
    p.energy = 45;
    p.invuln = 2.2;
    p.trail.length = 0;
    S.rings.push({ x: p.x, y: p.y, r: 4, vr: 160, life: 0, max: 0.8, c: '255,230,150', w: 3 });
    Sound.respawn();
  }

  function paintFree(x0, y0, x1, y1) {
    if (Math.hypot(x1 - x0, y1 - y0) < 0.5) return;
    const rgb = hexToRgb(S.brush);
    Painter.brush(bctx, x0, y0, x1, y1, rgb, rng);
    stampData(x0, y0, x1, y1, rgb, 4);
    baseDirty = true;
  }

  // ---------------------------------------------------------------- stars

  function igniteStar(st) {
    st.lit = true;
    st.litT = S.t;
    st.charge = st.cost;
    S.litCount++;
    const R = Painter.starHalo(bctx, st);
    baseDirty = true;
    refreshColors(st.x - R, st.y - R, st.x + R, st.y + R);
    burst(st.x, st.y, 60, ['#ffffff', '#fff3b0', '#ffd54a', '#f6c033'], 300, 1.1);
    S.rings.push({ x: st.x, y: st.y, r: st.r, vr: 260, life: 0, max: 1.0, c: '255,240,170', w: 4 });
    S.rings.push({ x: st.x, y: st.y, r: st.r, vr: 150, life: 0, max: 1.4, c: '190,220,255', w: 2.5 });
    S.flash = 0.35;
    Sound.ignite(S.litCount);
    lightWindows();
    Scene.setSwirlBoost(1 + S.litCount * 0.035);
    hooks.quote(st.venus ? VENUS_QUOTE : QUOTES[S.quoteIdx++ % QUOTES.length]);
    hooks.star(S.litCount);
    if (S.litCount >= Scene.stars.length) startEnding(st);
    else if (S.litCount === 1) hint('点亮了！点击鼠标或按空格可以冲刺（消耗少量光）', 5);
  }

  function updateStars(dt) {
    const p = S.player;
    for (const st of Scene.stars) {
      if (!st.lit && st.charge > 0 && (!p || p.charging !== st)) st.charge = Math.max(0, st.charge - 1.5 * dt);
    }
  }

  function lightWindows() {
    const unlit = windows.filter((w) => !w.lit);
    for (let i = unlit.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [unlit[i], unlit[j]] = [unlit[j], unlit[i]];
    }
    const left = Scene.stars.length - S.litCount + 1;
    const n = S.litCount >= Scene.stars.length ? unlit.length : Math.ceil(unlit.length / left);
    for (let i = 0; i < n && i < unlit.length; i++) {
      unlit[i].lit = true;
      unlit[i].litAt = S.t + 0.4 + i * 0.16;
    }
  }

  function startEnding(st) {
    S.state = 'ending';
    S.endT = 0;
    S.need = 0;
    S.glory = Painter.buildGlory(st.x, st.y);
    S.gloryIdx = 0;
    Scene.setSwirlBoost(1.45);
    hooks.state('ending');
    Sound.victory();
  }

  function updateEnding(dt) {
    S.endT += dt;
    if (S.endT > 1.2 && S.glory && S.gloryIdx < S.glory.length) {
      const per = Math.ceil(S.glory.length / 170);
      Painter.paintGlory(bctx, S.glory, S.gloryIdx, S.gloryIdx + per);
      S.gloryIdx += per;
      if (S.gloryIdx >= S.glory.length) baseData = bctx.getImageData(0, 0, BW, BH).data;
    }
    if (S.endT > 2.5 && !S.tut.endHint) {
      S.tut.endHint = true;
      hint('夜空醒来了', 4);
    }
    if (S.endT > 9.5) {
      S.state = 'ended';
      hooks.end(S.stats);
    }
  }

  // ---------------------------------------------------------------- motes

  function spawnMote(x, y) {
    if (x === undefined) {
      for (let k = 0; k < 12; k++) {
        x = rng() * W * 0.95;
        y = 20 + rng() * (Scene.horizon(x) - 70);
        if (!inCypress(x, y, 1.1) && Math.hypot(x - Scene.moon.x, y - Scene.moon.y) > Scene.moon.r * 1.6) break;
      }
    }
    S.motes.push({ x, y, dx: 1, dy: 0, life: 0, max: 13 + rng() * 9, ph: rng() * TAU, big: rng() < 0.18 });
  }

  function updateMotes(dt) {
    const p = S.player;
    if (S.state !== 'loading') {
      S.moteT -= dt;
      if (S.moteT <= 0 && S.motes.length < 40) {
        spawnMote();
        S.moteT = 0.85 / (1 + S.litCount * 0.12);
      }
      for (const st of Scene.stars) {
        if (!st.lit) continue;
        st.emitT -= dt;
        if (st.emitT <= 0) {
          st.emitT = 3.8 + rng() * 2.4;
          const a = rng() * TAU;
          spawnMote(st.x + Math.cos(a) * st.r * 2.5, st.y + Math.sin(a) * st.r * 2.5);
        }
      }
    }
    const canCollect = p && !p.dead && (S.state === 'playing' || S.state === 'ending' || S.state === 'free');
    for (let i = S.motes.length - 1; i >= 0; i--) {
      const m = S.motes[i];
      m.life += dt;
      Scene.flow(m.x, m.y, S.t, tmp);
      const mm = Math.hypot(tmp.x, tmp.y) || 1;
      m.dx = tmp.x / mm;
      m.dy = tmp.y / mm;
      m.x += tmp.x * 0.5 * dt + Math.sin(S.t * 1.7 + m.ph) * 8 * dt;
      m.y += tmp.y * 0.5 * dt + Math.cos(S.t * 1.3 + m.ph) * 8 * dt;
      if (canCollect) {
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (d < 18) {
          collect(m);
          S.motes.splice(i, 1);
          continue;
        }
        if (d < 85) {
          const pull = (1 - d / 85) * 300 * dt;
          m.x += (dx / d) * pull;
          m.y += (dy / d) * pull;
        }
      }
      if (m.life > m.max || m.x > W + 20 || m.x < -20 || m.y < -20 || m.y > Scene.horizon(m.x) + 10) S.motes.splice(i, 1);
    }
  }

  function collect(m) {
    const p = S.player;
    if (S.state === 'playing') p.energy = Math.min(EMAX, p.energy + (m.big ? 11 : 7));
    S.stats.motes++;
    burst(m.x, m.y, 8, ['#fff3b0', '#ffd54a'], 90, 0.45);
    Sound.pickup(S.pickupN++);
  }

  // ---------------------------------------------------------------- crows

  function spawnCrow() {
    const side = rng();
    let x, y;
    if (side < 0.4) {
      x = -40;
      y = 50 + rng() * 380;
    } else if (side < 0.8) {
      x = W + 40;
      y = 50 + rng() * 380;
    } else {
      x = 300 + rng() * (W - 600);
      y = -40;
    }
    S.crows.push({
      x, y, vx: 0, vy: 0,
      ph: rng() * TAU, wander: rng() * TAU,
      speed: 92 + S.litCount * 7 + rng() * 22,
      homeX: 200 + rng() * (W - 400), homeY: 80 + rng() * 300,
      s: 0.9 + rng() * 0.35,
    });
    if (!S.tut.crow) {
      S.tut.crow = true;
      hint('乌鸦来了！它们畏惧光——躲进月亮或亮起的星光里', 5);
    }
  }

  function repel(c, x, y, R, dt) {
    const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy) || 1;
    if (d >= R) return;
    const f = 1 - d / R;
    c.vx += (dx / d) * f * 1400 * dt;
    c.vy += (dy / d) * f * 1400 * dt;
    if (d < R * 0.75) {
      const push = (R * 0.75 - d) * 0.2;
      c.x += (dx / d) * push;
      c.y += (dy / d) * push;
    }
  }

  function updateCrows(dt) {
    const p = S.player;
    const playing = S.state === 'playing';
    const target = playing ? CROW_MAX[S.litCount] : 0;
    if (S.crows.length < target) {
      S.crowT -= dt;
      if (S.crowT <= 0) {
        spawnCrow();
        S.crowT = 2.5 + rng() * 3;
      }
    }
    const safe = !p || p.dead || p.hidden || p.inMoon || p.inLit;
    for (let i = S.crows.length - 1; i >= 0; i--) {
      const c = S.crows[i];
      if (!playing) {
        c.vx += (c.x < W / 2 ? -1 : 1) * 300 * dt;
        c.vy -= 160 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.ph += dt * 12;
        if (c.x < -80 || c.x > W + 80 || c.y < -80) S.crows.splice(i, 1);
        continue;
      }
      c.wander += (rng() - 0.5) * 3 * dt;
      let ax = Math.cos(c.wander) * 60, ay = Math.sin(c.wander) * 60;
      if (!safe) {
        const dx = p.x + p.vx * 0.3 - c.x, dy = p.y + p.vy * 0.3 - c.y, d = Math.hypot(dx, dy) || 1;
        ax += (dx / d) * 240;
        ay += (dy / d) * 240;
      } else {
        const hx = c.homeX - c.x, hy = c.homeY - c.y;
        if (hx * hx + hy * hy < 900) {
          c.homeX = 200 + rng() * (W - 400);
          c.homeY = 80 + rng() * 300;
        }
        ax += hx * 0.25;
        ay += hy * 0.25;
      }
      const hz = Scene.horizon(clamp(c.x, 0, W)) - 30;
      if (c.y > hz) ay -= (c.y - hz) * 8;
      c.vx += ax * dt;
      c.vy += ay * dt;
      repel(c, Scene.moon.x, Scene.moon.y, Scene.moon.r * 3.5, dt);
      for (const st of Scene.stars) if (st.lit) repel(c, st.x, st.y, st.r * 3.6 + 18, dt);
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > c.speed) {
        c.vx *= c.speed / sp;
        c.vy *= c.speed / sp;
      }
      Scene.flow(c.x, c.y, S.t, tmp);
      c.x = clamp(c.x + (c.vx + tmp.x * 0.25) * dt, -60, W + 60);
      c.y = clamp(c.y + (c.vy + tmp.y * 0.25) * dt, -60, H);
      c.ph += dt * (8 + sp * 0.02);
      if (!p.dead && p.invuln <= 0 && !p.hidden && Math.hypot(p.x - c.x, p.y - c.y) < 19) {
        hitPlayer(c);
        S.crows.splice(i, 1);
      }
    }
  }

  function hitPlayer(c) {
    const p = S.player;
    p.energy -= 16;
    p.invuln = 1.5;
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
    p.bx += (dx / d) * 380;
    p.by += (dy / d) * 380;
    S.shake = 0.35;
    feathers(c.x, c.y);
    burst(p.x, p.y, 12, ['#ffd54a', '#f0a030'], 140, 0.6);
    Sound.caw();
    S.crowT = Math.max(S.crowT, 3.5);
    if (!S.tut.crowHit) {
      S.tut.crowHit = true;
      hint('乌鸦会啄走你的光——它们畏惧月亮和亮起的星', 4.5);
    }
    if (p.energy <= 0) die();
  }

  // ---------------------------------------------------------------- meteor

  function updateMeteor(dt) {
    if (!S.meteor && S.state !== 'ended') {
      S.meteorT -= dt;
      if (S.meteorT <= 0) {
        S.meteorT = 22 + rng() * 20;
        S.meteor = { x: 80 + rng() * W * 0.55, y: -20, vx: 480 + rng() * 220, vy: 230 + rng() * 120 };
      }
    }
    const mt = S.meteor;
    if (!mt) return;
    mt.x += mt.vx * dt;
    mt.y += mt.vy * dt;
    if (mt.x > W + 80 || mt.y > Scene.horizon(clamp(mt.x, 0, W))) {
      S.meteor = null;
      return;
    }
    const p = S.player;
    if (!p.dead && Math.hypot(p.x - mt.x, p.y - mt.y) < 36) {
      if (S.state === 'playing') p.energy = Math.min(EMAX, p.energy + 30);
      burst(mt.x, mt.y, 36, ['#ffffff', '#fff3b0', '#bfe0ff'], 260, 0.9);
      S.rings.push({ x: mt.x, y: mt.y, r: 6, vr: 220, life: 0, max: 0.9, c: '220,235,255', w: 3 });
      Sound.meteor();
      hint('你接住了一颗流星！', 2.5);
      S.meteor = null;
    }
  }

  // ---------------------------------------------------------------- fx

  function burst(x, y, n, cols, speed, life) {
    if (S.sparks.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, v = speed * (0.3 + rng() * 0.7);
      S.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: life * (0.5 + rng() * 0.6), c: cols[(rng() * cols.length) | 0], w: 1.5 + rng() * 2.5, drag: 2.5, g: 0, dark: false });
    }
  }

  function feathers(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, v = 60 + rng() * 120;
      S.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: 0.9 + rng() * 0.8, c: '#07070d', w: 2.6, drag: 1.6, g: 70, dark: true });
    }
  }

  function updateFx(dt) {
    for (let i = S.sparks.length - 1; i >= 0; i--) {
      const s = S.sparks[i];
      s.life += dt;
      if (s.life >= s.max) {
        S.sparks.splice(i, 1);
        continue;
      }
      const k = Math.exp(-s.drag * dt);
      s.vx *= k;
      s.vy = s.vy * k + s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const r = S.rings[i];
      r.life += dt;
      if (r.life >= r.max) {
        S.rings.splice(i, 1);
        continue;
      }
      r.r += r.vr * dt;
      r.vr *= Math.exp(-1.5 * dt);
    }
  }

  // ---------------------------------------------------------------- render

  function render() {
    ctx.setTransform(q, 0, 0, q, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.save();
    if (S.shake > 0) {
      const k = S.shake * 20;
      ctx.translate((rng() - 0.5) * k, (rng() - 0.5) * k);
    }
    ctx.drawImage(base, 0, 0, W, H);
    drawFP();
    drawStars();
    drawMoon();
    drawMeteor();
    drawMotes();
    drawWindows();
    const showPlayer = S.player && S.state !== 'title' && S.state !== 'loading';
    if (showPlayer) {
      drawTrail();
      drawPlayer();
    }
    drawCrows();
    drawFx();
    Painter.drawCypress(ctx, S.t, cypress);
    if (showPlayer && S.player.hidden && !S.player.dead) drawGhost();
    if (showPlayer) drawCursor();
    ctx.restore();
    if (S.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = S.flash * 0.25;
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(overlay, 0, 0, W, H);
  }

  function drawFP() {
    ctx.lineCap = 'round';
    for (let i = 0; i < NP; i++) {
      const a = Math.sin((fpL[i] / fpM[i]) * Math.PI) * 0.62;
      if (a < 0.03) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = fpC[i];
      ctx.lineWidth = fpW[i];
      ctx.beginPath();
      ctx.moveTo(fpX[i], fpY[i]);
      ctx.quadraticCurveTo(fpX1[i], fpY1[i], fpX2[i], fpY2[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function ringDashes(x, y, r, n, rot, frac, color, w, a) {
    ctx.globalAlpha = a;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const step = TAU / n;
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * step;
      ctx.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
      ctx.arc(x, y, r, a0, a0 + step * frac);
    }
    ctx.stroke();
  }

  function drawStars() {
    const t = S.t, p = S.player;
    for (const st of Scene.stars) {
      if (st.lit) {
        const g = easeOutBack(clamp((t - st.litT) / 1.1, 0, 1));
        const pulse = 1 + Math.sin(t * 2.1 + st.i) * 0.07;
        ctx.globalCompositeOperation = 'lighter';
        const R = st.r * 6.5 * g * pulse;
        ctx.globalAlpha = 0.32;
        ctx.drawImage(glowWarm, st.x - R, st.y - R, R * 2, R * 2);
        const R2 = st.r * 1.9 * g;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(glowWhite, st.x - R2, st.y - R2, R2 * 2, R2 * 2);
        ctx.globalCompositeOperation = 'source-over';
        ringDashes(st.x, st.y, st.r * 1.55 * g, 9, t * 0.7 + st.i, 0.42, '#fff6c4', 3, 0.9);
        ringDashes(st.x, st.y, st.r * 2.25 * g, 13, -t * 0.45 + st.i, 0.3, '#f6d65a', 3, 0.85);
        ringDashes(st.x, st.y, st.r * 3.05 * g, 17, t * 0.3, 0.22, '#d9e2a6', 2.5, 0.6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fffdf0';
        ctx.beginPath();
        ctx.arc(st.x, st.y, Math.max(0, st.r * 0.62 * g), 0, TAU);
        ctx.fill();
      } else {
        const fl = 0.55 + 0.25 * Math.sin(t * 2.6 + st.i * 1.7) + 0.12 * Math.sin(t * 7.3 + st.i);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * fl;
        const R = st.r * 3.2;
        ctx.drawImage(glowBlue, st.x - R, st.y - R, R * 2, R * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.75 * fl;
        ctx.fillStyle = '#d4dcea';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 0.36, 0, TAU);
        ctx.fill();
        const tr = st.r * 2.3 + 16;
        const near = p && S.state === 'playing' ? clamp(1 - (Math.hypot(p.x - st.x, p.y - st.y) - tr) / 220, 0, 1) : 0;
        ctx.globalAlpha = 0.14 + 0.32 * near;
        ctx.strokeStyle = '#e8eefc';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -t * 10;
        ctx.beginPath();
        ctx.arc(st.x, st.y, tr, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        if (st.charge > 0) {
          const pr = st.charge / st.cost;
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#ffd84a';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(st.x, st.y, tr, -Math.PI / 2, -Math.PI / 2 + TAU * pr);
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = pr * 0.8;
          const R3 = st.r * (2 + pr * 3);
          ctx.drawImage(glowWarm, st.x - R3, st.y - R3, R3 * 2, R3 * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawMoon() {
    const m = Scene.moon;
    let end = 0;
    if (S.state === 'ending') end = Math.min(1, S.endT / 3);
    else if (S.state === 'ended' || S.state === 'free') end = 1;
    const pulse = 1 + Math.sin(S.t * 1.3) * 0.04;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + end * 0.3;
    const R = m.r * (4.2 + end * 2.2) * pulse;
    ctx.drawImage(glowMoon, m.x - R, m.y - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    ringDashes(m.x, m.y, m.r * 1.35, 16, S.t * 0.25, 0.35, '#ffe48a', 3, 0.55);
    ringDashes(m.x, m.y, m.r * 1.9, 22, -S.t * 0.18, 0.28, '#f3b84a', 3, 0.45);
    ctx.globalAlpha = 1;
    ctx.drawImage(moon.c, m.x - moon.size / 2, m.y - moon.size / 2, moon.size, moon.size);
  }

  function drawMeteor() {
    const mt = S.meteor;
    if (!mt) return;
    const tx = mt.x - mt.vx * 0.28, ty = mt.y - mt.vy * 0.28;
    const g = ctx.createLinearGradient(tx, ty, mt.x, mt.y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,250,230,0.95)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(mt.x, mt.y);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(glowWhite, mt.x - 22, mt.y - 22, 44, 44);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function moteAlpha(m) {
    return clamp(Math.min(m.life / 0.8, (m.max - m.life) / 1.2), 0, 1);
  }

  function drawMotes() {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of S.motes) {
      const tw = 0.75 + 0.25 * Math.sin(S.t * 6 + m.ph);
      ctx.globalAlpha = moteAlpha(m) * 0.85 * tw;
      const R = m.big ? 19 : 13;
      ctx.drawImage(glowWarm, m.x - R, m.y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    for (const m of S.motes) {
      ctx.globalAlpha = moteAlpha(m);
      ctx.strokeStyle = m.big ? '#fff6c8' : '#f6c933';
      ctx.lineWidth = m.big ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(m.x - m.dx * 4, m.y - m.dy * 4);
      ctx.lineTo(m.x + m.dx * 4, m.y + m.dy * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWindows() {
    const t = S.t;
    ctx.fillStyle = '#ffd95c';
    for (const w of windows) {
      if (!w.lit) continue;
      const a = clamp((t - w.litAt) / 0.6, 0, 1);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const w of windows) {
      if (!w.lit) continue;
      const a = clamp((t - w.litAt) / 0.6, 0, 1);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (0.32 + 0.05 * Math.sin(t * 3 + w.x));
      ctx.drawImage(glowWarm, w.x + w.w / 2 - 14, w.y + w.h / 2 - 14, 28, 28);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawTrail() {
    const p = S.player, tr = p.trail;
    if (tr.length < 2) return;
    const ef = S.state === 'playing' ? 0.5 + (p.energy / EMAX) * 0.7 : 1.2;
    ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const k = 1 - (S.t - b.t) / 0.9;
      if (k <= 0) continue;
      ctx.globalAlpha = k * 0.85;
      ctx.strokeStyle = b.b ? '#fff4c2' : '#f7cf45';
      ctx.lineWidth = (1.5 + 6.5 * k * ef) * (b.b ? 1.5 : 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#e9a92c';
    for (const off of [-3.4, 3.4]) {
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i];
        const k = 1 - (S.t - b.t) / 0.9;
        if (k <= 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const nx = (-dy / d) * off * k, ny = (dx / d) * off * k;
        ctx.globalAlpha = k * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x + nx, a.y + ny);
        ctx.lineTo(b.x + nx, b.y + ny);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const p = S.player;
    if (p.dead) return;
    const blink = p.invuln > 0 ? (Math.sin(S.t * 30) > 0 ? 1 : 0.35) : 1;
    const low = p.energy < 20 && S.state === 'playing';
    const e = S.state === 'playing' ? p.energy / EMAX : 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.55 + 0.45 * e) * blink * (low ? 0.6 + 0.4 * Math.sin(S.t * 9) : 1);
    const R = 16 + e * 22;
    ctx.drawImage(glowWarm, p.x - R, p.y - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = blink;
    ctx.fillStyle = low ? '#ffb347' : '#fffdf2';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + e * 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = S.state === 'free' ? S.brush : '#ffe27a';
    for (let i = 0; i < 3; i++) {
      const a = S.t * 3 + (i * TAU) / 3;
      const r = 9 + e * 4;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGhost() {
    const p = S.player;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(glowWarm, p.x - 16, p.y - 16, 32, 32);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffe9a6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCursor() {
    if (!Input.pointerActive || Input.usingKeys || S.state === 'ended') return;
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#fff6d0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(Input.px, Input.py, 7, 0, TAU);
    ctx.stroke();
    if (S.state === 'free') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = S.brush;
      ctx.beginPath();
      ctx.arc(Input.px, Input.py, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function crowPath() {
    ctx.beginPath();
    for (const c of S.crows) {
      const f = Math.sin(c.ph), s = c.s * 1.15, x = c.x, y = c.y;
      ctx.moveTo(x - 16 * s, y - 2 * s + f * 9 * s);
      ctx.quadraticCurveTo(x - 7 * s, y - 9 * s - f * 3 * s, x, y);
      ctx.quadraticCurveTo(x + 7 * s, y - 9 * s - f * 3 * s, x + 16 * s, y - 2 * s + f * 9 * s);
    }
  }

  function drawCrows() {
    if (!S.crows.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    crowPath();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#b8c8f0';
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.fillStyle = '#05060a';
    ctx.beginPath();
    for (const c of S.crows) {
      ctx.moveTo(c.x + 3.2 * c.s, c.y);
      ctx.ellipse(c.x, c.y, 3.2 * c.s, 2.4 * c.s, 0, 0, TAU);
    }
    ctx.fill();
  }

  function drawFx() {
    ctx.lineCap = 'round';
    for (const s of S.sparks) {
      const k = 1 - s.life / s.max;
      ctx.globalCompositeOperation = s.dark ? 'source-over' : 'lighter';
      ctx.globalAlpha = k;
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const r of S.rings) {
      ctx.globalAlpha = 1 - r.life / r.max;
      ctx.strokeStyle = `rgb(${r.c})`;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- export

  function save() {
    const out = makeCanvas(BW, BH);
    const g = out.getContext('2d');
    g.drawImage(canvas, 0, 0);
    g.setTransform(q, 0, 0, q, 0, 0);
    g.font = 'italic 600 28px Georgia, "Times New Roman", serif';
    g.fillStyle = 'rgba(196,72,38,0.88)';
    g.textAlign = 'right';
    g.fillText('Vincent & you', W - 34, H - 30);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '星月夜-我的版本.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
  }

  return {
    S,
    hooks,
    init,
    start,
    startFree,
    update,
    render,
    save,
    setBrush(c) {
      S.brush = c;
    },
  };
})();
