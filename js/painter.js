'use strict';

const Painter = (() => {
  const P = (list) => list.map(hexToRgb);
  const SKY = P(['#081536', '#0c1d48', '#12295e', '#183676', '#1f4489', '#2a559c', '#3a68ad', '#5582bd', '#7aa0cc', '#a6c2dc', '#cfe0e4']);
  const MOONW = P(['#ffe9a0', '#fbd35a', '#f4b93c', '#eba036', '#f7dc7a', '#f0c45a']);
  const MOON_RIM = P(['#e8902a', '#f0a030', '#d97a22', '#f5b540', '#e48628']);
  const GLORY = P(['#eef0d6', '#dbe8d6', '#bcd8d2', '#a0c6d6', '#8cb6dc', '#e4e6b0', '#c8dfb8', '#f2e7a0']);
  const BAND = P(['#7fa3c8', '#a9c4d8', '#c8d9dc', '#8fb0cf', '#b5cfd6']);
  const HILL = P(['#0f1d3c', '#16284f', '#1d3563', '#264476', '#30538a', '#3d6398', '#4b72a6']);
  const VALLEY = P(['#0c1729', '#111f35', '#172943', '#1f3450', '#1a2f3c', '#26404d', '#14262c']);
  const TREE = P(['#081114', '#0d1a1d', '#132326', '#1a2f2e', '#223a37', '#2c4744']);
  const WALL = P(['#4d6888', '#5b7695', '#6f86a0', '#3e5a7e', '#7a8a8c', '#647a72', '#8a845e']);
  const ROOF = P(['#162544', '#1e3156', '#283c62', '#3a3550', '#2a3a44', '#47465a', '#5a5040']);
  const DIM = P(['#5d78a6', '#7389b0', '#8a9cbc', '#4f6a9a']);
  const HALO = [
    P(['#ffffff', '#fffbe4', '#fff5c0']),
    P(['#fff0a0', '#fbe274', '#f6d250']),
    P(['#f2d058', '#e8d68e', '#dadca6']),
    P(['#b9d3c2', '#a0c4ce', '#8eb2d6']),
  ];

  const tmp = { x: 0, y: 0 };
  let rng = makeRng(1889);

  function swirlArm(x, y) {
    let a = 0;
    for (const s of Scene.swirls) {
      const dx = x - s.x, dy = y - s.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > s.R * 1.5) continue;
      const th = Math.atan2(dy, dx);
      const ph = th * s.dir + Math.log(r / s.R + 0.04) * 4.2;
      const band = Math.pow(0.5 + 0.5 * Math.cos(ph * 2), 3);
      const env = smoothstep(s.R * 0.06, s.R * 0.32, r) * (1 - smoothstep(s.R * 0.85, s.R * 1.45, r));
      a = Math.max(a, band * env);
    }
    return a;
  }

  function flowPath(ctx, x, y, len, steps) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    const seg = len / steps;
    for (let i = 0; i < steps; i++) {
      Scene.flow(x, y, 0, tmp);
      const m = Math.hypot(tmp.x, tmp.y) || 1;
      x += (tmp.x / m) * seg;
      y += (tmp.y / m) * seg;
      ctx.lineTo(x, y);
    }
  }

  function skyColor(x, y, jit) {
    const m = Scene.moon;
    const dm = Math.hypot(x - m.x, y - m.y);
    const mw = Math.exp(-Math.pow(dm / (m.r * 3.0), 2));
    if (rng() < mw * 0.85) return jitterRgb(pick(MOONW, rng), rng, 12);
    const hz = Scene.horizon(x);
    const v = clamp(y / hz, 0, 1);
    let L = 0.2 + 0.34 * v * v;
    L += 0.2 * Noise.fbm(x * 0.0045, y * 0.0045);
    L += 0.2 * swirlArm(x, y);
    L += (rng() - 0.5) * 2 * jit;
    const idx = clamp(Math.floor(L * SKY.length), 0, SKY.length - 1);
    return jitterRgb(SKY[idx], rng, 9);
  }

  function skyPass(ctx, sp, wMin, wMax, len, jit) {
    for (let gy = -sp; gy < H * 0.7; gy += sp) {
      for (let gx = -sp; gx < W + sp; gx += sp) {
        const x = gx + (rng() - 0.5) * sp * 1.3;
        const y = gy + (rng() - 0.5) * sp * 1.3;
        if (y > Scene.horizon(x) + 4) continue;
        ctx.strokeStyle = skyColor(x, y, jit);
        ctx.lineWidth = lerp(wMin, wMax, rng());
        flowPath(ctx, x, y, len * (0.7 + rng() * 0.6), 3);
        ctx.stroke();
      }
    }
  }

  function horizonBand(ctx, alpha, reach) {
    ctx.globalAlpha = alpha;
    for (let x = -10; x < W + 10; x += 4) {
      for (let j = 0; j < 2; j++) {
        const off = 4 + Math.pow(rng(), 1.6) * 46 * reach;
        const x0 = x + (rng() - 0.5) * 6;
        const len = 14 + rng() * 22;
        const y0 = Scene.horizon(x0) - off;
        const y1 = Scene.horizon(x0 + len) - off + (rng() - 0.5) * 3;
        ctx.strokeStyle = jitterRgb(pick(BAND, rng), rng, 10);
        ctx.lineWidth = 2.5 + rng() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + len, y1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function moonHalo(ctx) {
    const m = Scene.moon;
    for (let i = 0; i < 900; i++) {
      const b = 1.05 + Math.pow(rng(), 0.9) * 2.5;
      const rr = m.r * b;
      const th = rng() * TAU;
      const pal = b < 1.45 ? MOON_RIM : b < 1.9 ? MOONW : b < 2.6 ? HALO[1] : HALO[2];
      ctx.strokeStyle = jitterRgb(pick(pal, rng), rng, 10);
      ctx.lineWidth = 2.5 + rng() * 2.5;
      ctx.globalAlpha = b > 3 ? 0.7 : 0.92;
      ctx.beginPath();
      ctx.arc(m.x, m.y, rr + (rng() - 0.5) * 3, th, th + (8 + rng() * 14) / rr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function dimStarHalo(ctx, s) {
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 70; i++) {
      const rr = s.r * (0.9 + rng() * 1.9);
      const th = rng() * TAU;
      ctx.strokeStyle = jitterRgb(pick(DIM, rng), rng, 10);
      ctx.lineWidth = 2 + rng() * 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr, th, th + (6 + rng() * 10) / rr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Concentric rings of white, lemon, chrome yellow and pale teal, the signature
  // halo of the painting. Returns the radius touched, for refreshing color samples.
  function starHalo(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round';
    const N = 260 + s.r * 30;
    const maxB = s.venus ? 5.4 : 4.6;
    for (let i = 0; i < N; i++) {
      const b = 0.7 + Math.pow(rng(), 0.85) * (maxB - 0.7);
      const rr = s.r * b;
      const th = rng() * TAU;
      let pal, alpha = 0.95;
      if (b < 1.4) pal = HALO[0];
      else if (b < 2.4) pal = HALO[1];
      else if (b < 2.9) {
        pal = SKY.slice(5, 8);
        alpha = 0.85;
      } else if (b < 3.8) pal = HALO[2];
      else {
        pal = HALO[3];
        alpha = 0.6;
      }
      ctx.strokeStyle = jitterRgb(pick(pal, rng), rng, 10);
      ctx.lineWidth = 2.4 + rng() * 2.4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr + (rng() - 0.5) * 2.5, th, th + (7 + rng() * 12) / rr);
      ctx.stroke();
    }
    ctx.restore();
    return s.r * maxB + 8;
  }

  function paintGround(ctx) {
    ctx.beginPath();
    ctx.moveTo(-5, H + 5);
    for (let x = -5; x <= W + 5; x += 8) ctx.lineTo(x, Scene.horizon(x));
    ctx.lineTo(W + 5, H + 5);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H * 0.58, 0, H);
    g.addColorStop(0, '#2a4a80');
    g.addColorStop(0.35, '#1b3260');
    g.addColorStop(1, '#0d1829');
    ctx.fillStyle = g;
    ctx.fill();

    const valleyY = (x) => H * (0.745 + 0.018 * Math.sin(x * 0.006 + 1.1));
    for (let gy = H * 0.54; gy < H + 8; gy += 6) {
      for (let gx = -6; gx < W + 6; gx += 7) {
        const x = gx + (rng() - 0.5) * 8;
        const y = gy + (rng() - 0.5) * 8;
        const hz = Scene.horizon(x);
        if (y < hz + 3) continue;
        const depth = y - hz;
        const vy = valleyY(x);
        let rgb, ang;
        if (y < vy) {
          const slope = (Scene.horizon(x + 6) - Scene.horizon(x - 6)) / 12;
          const band = 0.5 + 0.5 * Math.sin(depth * 0.09 + Noise.n2(x * 0.01, y * 0.01) * 3);
          const L = 0.75 - depth / 180 + band * 0.25 + (rng() - 0.5) * 0.3;
          rgb = HILL[clamp(Math.floor(L * HILL.length), 0, HILL.length - 1)];
          ang = Math.atan(slope) * (1 - depth / 200) + Noise.n2(x * 0.008, y * 0.02) * 0.5;
        } else {
          const L = 0.55 - (y - vy) / 400 + (rng() - 0.5) * 0.5;
          rgb = VALLEY[clamp(Math.floor(L * VALLEY.length), 0, VALLEY.length - 1)];
          ang = Noise.n2(x * 0.006, y * 0.006) * 1.2;
        }
        const len = 9 + rng() * 9;
        const c = Math.cos(ang) * len * 0.5, s = Math.sin(ang) * len * 0.5;
        ctx.strokeStyle = jitterRgb(rgb, rng, 8);
        ctx.lineWidth = 3 + rng() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x - c, y - s);
        ctx.quadraticCurveTo(x, y - 2 + rng() * 4, x + c, y + s);
        ctx.stroke();
      }
    }

    for (let k = 0; k < 4; k++) {
      const off = 3 + k * 24 + rng() * 6;
      ctx.strokeStyle = k === 0 ? 'rgba(120,160,210,0.55)' : 'rgba(70,110,170,0.45)';
      ctx.lineWidth = k === 0 ? 3 : 2.2;
      let x = 0;
      while (x < W) {
        const len = 30 + rng() * 60;
        if (rng() < 0.75) {
          ctx.beginPath();
          for (let xx = x; xx <= x + len; xx += 6) {
            const y = Scene.horizon(xx) + off + 6 * Math.sin(xx * 0.013 + k * 2);
            if (xx === x) ctx.moveTo(xx, y);
            else ctx.lineTo(xx, y);
          }
          ctx.stroke();
        }
        x += len + rng() * 14;
      }
    }
  }

  function paintTree(ctx, x, y, r) {
    const n = 3 + ((rng() * 3) | 0);
    const blobs = [];
    for (let i = 0; i < n; i++) {
      blobs.push({ x: x + (rng() - 0.5) * r * 0.9, y: y + (rng() - 0.5) * r * 0.6, r: r * (0.5 + rng() * 0.4) });
    }
    ctx.fillStyle = '#0a1517';
    for (const b of blobs) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < r * 6; i++) {
      const b = blobs[(rng() * n) | 0];
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * b.r * 0.9;
      const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
      const L = clamp(0.45 - ((py - y) / r) * 0.35 + ((px - x) / r) * 0.15 + (rng() - 0.5) * 0.45, 0, 0.999);
      const ang = -Math.PI / 2 + (rng() - 0.5) * 1.6;
      const len = 5 + rng() * 7;
      ctx.strokeStyle = jitterRgb(TREE[(L * TREE.length) | 0], rng, 8);
      ctx.lineWidth = 2.5 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(ang + 0.6) * len * 0.5, py + Math.sin(ang + 0.6) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  function roofPath(ctx, h) {
    const { x, w, roofH: rh } = h;
    const top = h.base - h.hh;
    ctx.beginPath();
    if (h.type === 0) {
      ctx.moveTo(x - 3, top);
      ctx.lineTo(x + w / 2, top - rh);
      ctx.lineTo(x + w + 3, top);
    } else if (h.type === 1) {
      ctx.moveTo(x - 3, top);
      ctx.lineTo(x - 1, top - rh);
      ctx.lineTo(x + w + 3, top - rh * 0.35);
      ctx.lineTo(x + w + 3, top);
    } else {
      ctx.moveTo(x - 3, top);
      ctx.lineTo(x + w * 0.22, top - rh * 0.8);
      ctx.lineTo(x + w * 0.78, top - rh * 0.8);
      ctx.lineTo(x + w + 3, top);
    }
    ctx.closePath();
  }

  function addWindows(ctx, x, top, w, hh, n, windows) {
    for (let i = 0; i < n; i++) {
      const ww = 4 + rng() * 2.5, wh = 4.5 + rng() * 3;
      const wx = x + (w / (n + 1)) * (i + 1) - ww / 2 + (rng() - 0.5) * 3;
      const wy = top + hh * (0.25 + rng() * 0.3);
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(wx, wy, ww, wh);
      windows.push({ x: wx, y: wy, w: ww, h: wh, lit: false, litAt: 0 });
    }
  }

  function wallStrokes(ctx, x, top, w, hh, rgb) {
    ctx.fillStyle = rgbStr(rgb);
    ctx.fillRect(x, top, w, hh);
    for (let i = 0; i < (w * hh) / 18; i++) {
      const sx = x + 1 + rng() * (w - 2), sy = top + 2 + rng() * (hh - 4);
      ctx.strokeStyle = jitterRgb(rgb, rng, 18);
      ctx.lineWidth = 2 + rng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 3);
      ctx.lineTo(sx + (rng() - 0.5) * 1.5, sy + 3);
      ctx.stroke();
    }
  }

  function paintHouse(ctx, h, windows) {
    if (h.church) return paintChurch(ctx, h, windows);
    const { x, base, w, hh } = h;
    const top = base - hh;
    wallStrokes(ctx, x, top, w, hh, h.wall);

    roofPath(ctx, h);
    ctx.fillStyle = rgbStr(h.roof);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < (w * h.roofH) / 12; i++) {
      const sx = x + rng() * w, sy = top - rng() * h.roofH;
      ctx.strokeStyle = jitterRgb(h.roof, rng, 16);
      ctx.lineWidth = 2 + rng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy + 1.5);
      ctx.lineTo(sx + 4, sy - 1.5);
      ctx.stroke();
    }
    ctx.restore();
    roofPath(ctx, h);
    ctx.strokeStyle = 'rgba(8,14,36,0.92)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeRect(x, top, w, hh);

    const n = w > 40 ? 2 + (rng() < 0.4 ? 1 : 0) : 1 + (rng() < 0.5 ? 1 : 0);
    addWindows(ctx, x, top, w, hh, n, windows);
  }

  function paintChurch(ctx, h, windows) {
    const { x, base, w, hh } = h;
    const top = base - hh;
    const wall = hexToRgb('#3f5578');
    wallStrokes(ctx, x, top, w, hh, wall);
    ctx.beginPath();
    ctx.moveTo(x - 4, top);
    ctx.lineTo(x + w * 0.45, top - 16);
    ctx.lineTo(x + w + 4, top);
    ctx.closePath();
    ctx.fillStyle = '#1b2a4c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,14,36,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeRect(x, top, w, hh);

    const tx = x + w * 0.6, tw = 18;
    const towerTop = top - 30;
    const spireTop = H * 0.592;
    wallStrokes(ctx, tx, towerTop, tw, base - towerTop - hh * 0.4, hexToRgb('#2c3f63'));
    ctx.strokeRect(tx, towerTop, tw, base - towerTop - hh * 0.4);
    ctx.beginPath();
    ctx.moveTo(tx - 3, towerTop);
    ctx.lineTo(tx + tw / 2, spireTop);
    ctx.lineTo(tx + tw + 3, towerTop);
    ctx.closePath();
    ctx.fillStyle = '#1a2b52';
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 70; i++) {
      const yy = lerp(spireTop, towerTop, rng());
      ctx.strokeStyle = jitterRgb(hexToRgb('#2b4272'), rng, 14);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + tw / 2 + (rng() - 0.5) * 8, yy - 5);
      ctx.lineTo(tx + tw / 2 + (rng() - 0.5) * 8, yy + 5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(tx - 3, towerTop);
    ctx.lineTo(tx + tw / 2, spireTop);
    ctx.lineTo(tx + tw + 3, towerTop);
    ctx.strokeStyle = 'rgba(8,14,36,0.95)';
    ctx.stroke();

    addWindows(ctx, x + 2, top, w * 0.55, hh, 2, windows);
    addWindows(ctx, tx, towerTop - 4, tw, 22, 1, windows);
  }

  function paintVillage(ctx) {
    const windows = [];
    const trees = [];
    for (let i = 0; i < 18; i++) {
      trees.push({ x: lerp(0.22 * W, W, rng()), y: lerp(0.72 * H, 0.83 * H, rng()), r: 14 + rng() * 26 });
    }
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) paintTree(ctx, t.x, t.y, t.r);

    const houses = [];
    let attempts = 0;
    while (houses.length < 46 && attempts++ < 1200) {
      const x = lerp(0.24 * W, 0.985 * W, rng());
      const base = lerp(0.77 * H, 0.96 * H, Math.pow(rng(), 0.8));
      const w = 26 + rng() * 34, hh = 15 + rng() * 18;
      if (Math.abs(x + w / 2 - 0.535 * W) < 62 && base < 0.895 * H) continue;
      let ok = true;
      for (const o of houses) {
        if (Math.abs(o.x + o.w / 2 - (x + w / 2)) < (o.w + w) * 0.34 && Math.abs(o.base - base) < 15) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      houses.push({ x, base, w, hh, roofH: 7 + rng() * 10, type: (rng() * 3) | 0, wall: pick(WALL, rng), roof: pick(ROOF, rng) });
    }
    houses.push({ church: true, x: 0.505 * W, base: 0.875 * H, w: 56, hh: 30 });
    houses.sort((a, b) => a.base - b.base);
    for (const h of houses) paintHouse(ctx, h, windows);

    for (let i = 0; i < 14; i++) paintTree(ctx, lerp(0.2 * W, W, rng()), lerp(0.975 * H, 1.03 * H, rng()), 16 + rng() * 20);
    return windows;
  }

  function renderBase(ctx) {
    rng = makeRng(1889);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.66);
    g.addColorStop(0, '#0a1940');
    g.addColorStop(0.5, '#15357a');
    g.addColorStop(1, '#2f5d9f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    skyPass(ctx, 15, 8, 12, 24, 0.12);
    skyPass(ctx, 6.5, 3, 5, 13, 0.2);
    horizonBand(ctx, 0.55, 1);
    moonHalo(ctx);
    for (const s of Scene.stars) dimStarHalo(ctx, s);
    paintGround(ctx);
    const windows = paintVillage(ctx);
    ctx.restore();
    return { windows };
  }

  // Strokes for the finale, sorted to ripple outward from the last star lit.
  function buildGlory(ox, oy) {
    const list = [];
    let tries = 0;
    while (list.length < 3600 && tries++ < 60000) {
      const x = rng() * W, y = rng() * H * 0.68;
      if (y > Scene.horizon(x) - 6) continue;
      const a = swirlArm(x, y);
      if (a < 0.25 || rng() > a * 1.2) continue;
      list.push({ k: 0, x, y, c: jitterRgb(pick(GLORY, rng), rng, 10), w: 2.5 + rng() * 2.5, len: 10 + rng() * 10, a: 0.85 });
    }
    for (let i = 0; i < 1600; i++) {
      const x = rng() * W, y = rng() * H * 0.66;
      if (y > Scene.horizon(x) - 4) continue;
      list.push({ k: 0, x, y, c: jitterRgb(SKY[6 + ((rng() * 4) | 0)], rng, 10), w: 2.5 + rng() * 2, len: 9 + rng() * 8, a: 0.7 });
    }
    for (let x = -10; x < W + 10; x += 3) {
      const off = 4 + Math.pow(rng(), 1.4) * 60;
      const len = 14 + rng() * 24;
      const y = Scene.horizon(x) - off;
      list.push({ k: 1, x, y, x1: x + len, y1: Scene.horizon(x + len) - off, c: jitterRgb(pick(BAND, rng), rng, 12), w: 2.5 + rng() * 2.5, a: 0.8 });
    }
    const m = Scene.moon;
    for (let i = 0; i < 700; i++) {
      const b = 1.1 + Math.pow(rng(), 0.8) * 3.3;
      const r = m.r * b;
      const th = rng() * TAU;
      const pal = b < 2 ? HALO[0] : b < 3 ? MOONW : HALO[1];
      list.push({ k: 2, x: m.x + Math.cos(th) * r, y: m.y + Math.sin(th) * r, cx: m.x, cy: m.y, r, th, al: (9 + rng() * 14) / r, c: jitterRgb(pick(pal, rng), rng, 10), w: 2.5 + rng() * 2.5, a: 0.9 });
    }
    for (const it of list) it.d = Math.hypot(it.x - ox, it.y - oy) + rng() * 120;
    list.sort((a, b) => a.d - b.d);
    return list;
  }

  function paintGlory(ctx, list, from, to) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = from; i < to && i < list.length; i++) {
      const it = list[i];
      ctx.globalAlpha = it.a;
      ctx.strokeStyle = it.c;
      ctx.lineWidth = it.w;
      if (it.k === 0) {
        flowPath(ctx, it.x, it.y, it.len, 3);
      } else if (it.k === 1) {
        ctx.beginPath();
        ctx.moveTo(it.x, it.y);
        ctx.lineTo(it.x1, it.y1);
      } else {
        ctx.beginPath();
        ctx.arc(it.cx, it.cy, it.r, it.th, it.th + it.al);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function brush(ctx, x0, y0, x1, y1, rgb, r) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = jitterRgb(rgb, r, 10);
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.4;
    for (let k = -2; k <= 2; k++) {
      if (!k) continue;
      const o = k * 2.4;
      ctx.strokeStyle = jitterRgb(rgb, r, 34);
      ctx.beginPath();
      ctx.moveTo(x0 + nx * o, y0 + ny * o);
      ctx.lineTo(x1 + nx * o, y1 + ny * o);
      ctx.stroke();
    }
    ctx.restore();
  }

  function makeMoon(q) {
    const m = Scene.moon;
    const R = m.r;
    const size = R * 2.4;
    const px = Math.ceil(size * q);
    const c = makeCanvas(px, px);
    const g = c.getContext('2d');
    g.setTransform(q, 0, 0, q, 0, 0);
    const cx = size / 2, cy = size / 2;
    const eg = g.createRadialGradient(cx - R * 0.2, cy - R * 0.1, R * 0.1, cx, cy, R);
    eg.addColorStop(0, 'rgba(240,160,60,0.62)');
    eg.addColorStop(1, 'rgba(206,112,32,0.7)');
    g.fillStyle = eg;
    g.beginPath();
    g.arc(cx, cy, R * 0.98, 0, TAU);
    g.fill();

    const t = makeCanvas(px, px);
    const tg = t.getContext('2d');
    tg.setTransform(q, 0, 0, q, 0, 0);
    const grd = tg.createRadialGradient(cx + R * 0.45, cy + R * 0.1, R * 0.1, cx, cy, R);
    grd.addColorStop(0, '#fffdf0');
    grd.addColorStop(0.55, '#fff0a0');
    grd.addColorStop(1, '#f7c24a');
    tg.fillStyle = grd;
    tg.beginPath();
    tg.arc(cx, cy, R, 0, TAU);
    tg.fill();
    tg.save();
    tg.clip();
    const r = makeRng(5);
    tg.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const rr = r() * R;
      const th = r() * TAU;
      tg.strokeStyle = r() < 0.5 ? 'rgba(255,250,210,0.7)' : 'rgba(240,170,50,0.6)';
      tg.lineWidth = 2 + r() * 2;
      tg.beginPath();
      tg.arc(cx, cy, rr, th, th + 0.4 + r() * 0.6);
      tg.stroke();
    }
    tg.restore();
    tg.globalCompositeOperation = 'destination-out';
    tg.beginPath();
    tg.arc(cx - R * 0.5, cy - R * 0.26, R * 0.8, 0, TAU);
    tg.fill();
    g.drawImage(t, 0, 0, size, size);
    g.strokeStyle = 'rgba(200,100,22,0.85)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, R * 1.0, 0, TAU);
    g.stroke();
    return { c, size };
  }

  // ---- the cypress: a dark flame in the foreground, swaying in the wind ----
  const swayRows = new Float32Array(Math.ceil((H + 80) / 4));
  function sway(y) {
    return swayRows[clamp((y / 4) | 0, 0, swayRows.length - 1)];
  }

  function genCypress() {
    const r = makeRng(7);
    const C = Scene.cypress;
    const COLS = ['#040805', '#08110b', '#0d1a10', '#132416', '#1a2e1b', '#233a20', '#2e4522', '#3d4c24', '#2b2214', '#46361b'];
    const WEIGHTS = [3.5, 4, 4, 3.2, 2.2, 1.4, 0.8, 0.45, 1.0, 0.5];
    const total = WEIGHTS.reduce((a, b) => a + b, 0);
    const weighted = () => {
      let v = r() * total;
      for (let i = 0; i < WEIGHTS.length; i++) {
        v -= WEIGHTS[i];
        if (v <= 0) return i;
      }
      return 0;
    };
    const batches = [];
    for (const c of COLS) {
      batches.push({ c, w: 3.2, data: [] });
      batches.push({ c, w: 5, data: [] });
    }
    let maxHw = 0;
    for (let y = C.top; y < H; y += 5) maxHw = Math.max(maxHw, C.hw(y));

    let n = 0;
    while (n < 1500) {
      const y = lerp(C.top + 4, H + 10, r());
      const hw = C.hw(y);
      if (r() * maxHw > hw) continue;
      const u = r() * 2 - 1;
      const x = C.cx(y) + u * hw * 0.92;
      const v = C.v(y);
      const len = 12 + r() * (16 + 26 * v);
      const ang = -Math.PI / 2 + u * 0.5 + (r() - 0.5) * 0.6;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      const bend = (r() - 0.5) * len * 0.7;
      const mx = (x + ex) / 2 + Math.cos(ang + Math.PI / 2) * bend;
      const my = (y + ey) / 2 + Math.sin(ang + Math.PI / 2) * bend;
      let ci = weighted();
      if (u > 0.45 && r() < 0.35) ci = 5 + ((r() * 3) | 0);
      batches[ci * 2 + (r() < 0.55 ? 0 : 1)].data.push(x, y, mx, my, ex, ey);
      n++;
    }
    for (let i = 0; i < 300; i++) {
      const y = lerp(C.top + 2, H * 0.9, Math.pow(r(), 0.75));
      const side = r() < 0.5 ? -1 : 1;
      const x = C.cx(y) + side * C.hw(y) * (0.75 + r() * 0.2);
      const len = 18 + r() * 34 * (0.4 + C.v(y));
      const ang = -Math.PI / 2 + side * (0.15 + r() * 0.35);
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      const mx = x + side * len * 0.35, my = (y + ey) / 2 + len * 0.1;
      const ci = r() < 0.7 ? (r() * 3) | 0 : 3 + ((r() * 3) | 0);
      batches[ci * 2 + 1].data.push(x, y, mx, my, ex, ey);
    }
    for (let i = 0; i < 14; i++) {
      const x = C.cx(C.top) + (r() - 0.5) * 6;
      const y = C.top + 30 + r() * 30;
      batches[2 * ((r() * 3) | 0) + 1].data.push(x, y, x + (r() - 0.5) * 10, y - 30, x + (r() - 0.5) * 6, C.top - 8 - r() * 14);
    }
    return batches.filter((b) => b.data.length).map((b) => ({ c: b.c, w: b.w, data: new Float32Array(b.data) }));
  }

  function drawCypress(ctx, t, batches) {
    const C = Scene.cypress;
    for (let i = 0; i < swayRows.length; i++) {
      const y = i * 4;
      const k = Math.pow(1 - C.v(y), 1.7);
      swayRows[i] = (Math.sin(t * 0.75 + y * 0.005) * 9 + Math.sin(t * 1.9 + y * 0.021) * 2.2) * k;
    }
    ctx.fillStyle = '#060c08';
    ctx.beginPath();
    for (let y = C.top + 6; y <= H + 10; y += 10) ctx.lineTo(C.cx(y) - C.hw(y) * 0.86 + sway(y), y);
    for (let y = H + 10; y >= C.top + 6; y -= 10) ctx.lineTo(C.cx(y) + C.hw(y) * 0.86 + sway(y), y);
    ctx.closePath();
    ctx.fill();
    ctx.lineCap = 'round';
    for (const b of batches) {
      const d = b.data;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = b.w;
      ctx.beginPath();
      for (let i = 0; i < d.length; i += 6) {
        ctx.moveTo(d[i] + sway(d[i + 1]), d[i + 1]);
        ctx.quadraticCurveTo(d[i + 2] + sway(d[i + 3]), d[i + 3], d[i + 4] + sway(d[i + 5]), d[i + 5]);
      }
      ctx.stroke();
    }
  }

  return {
    renderBase,
    starHalo,
    buildGlory,
    paintGlory,
    brush,
    makeMoon,
    genCypress,
    drawCypress,
    sway,
  };
})();
