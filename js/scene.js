'use strict';

const W = 1600;
const H = 1000;

const Scene = (() => {
  // [x, y, radius, isVenus] in normalized painting coordinates
  const STAR_DEFS = [
    [0.05, 0.085, 12],
    [0.06, 0.36, 12],
    [0.3, 0.09, 12],
    [0.33, 0.455, 20, true],
    [0.46, 0.08, 11],
    [0.62, 0.1, 12],
    [0.74, 0.27, 14],
    [0.84, 0.43, 13],
    [0.955, 0.3, 11],
    [0.64, 0.505, 12],
    [0.5, 0.535, 10],
  ];

  const stars = STAR_DEFS.map(([u, v, r, venus], i) => ({
    i,
    x: u * W,
    y: v * H,
    r,
    venus: !!venus,
    cost: venus ? 34 : Math.round(11 + r),
    lit: false,
    litT: 0,
    charge: 0,
    emitT: 2,
  }));

  const moon = { x: 0.885 * W, y: 0.135 * H, r: 44 };

  const swirls = [
    { x: 0.53 * W, y: 0.33 * H, R: 230, s: 125, dir: 1 },
    { x: 0.355 * W, y: 0.235 * H, R: 150, s: 105, dir: -1 },
    { x: 0.7 * W, y: 0.16 * H, R: 95, s: 70, dir: 1 },
  ];

  const cypress = {
    top: 0.022 * H,
    bottom: H + 12,
    v(y) {
      return clamp((y - this.top) / (this.bottom - this.top), 0, 1);
    },
    cx(y) {
      const v = this.v(y);
      return W * (0.15 - 0.035 * v + 0.012 * Math.sin(v * 8 + 0.4));
    },
    hw(y) {
      const v = this.v(y);
      return W * (0.004 + 0.074 * Math.pow(v, 0.85)) * (1 + 0.16 * Math.sin(v * 21 + 1.2));
    },
  };

  let swirlBoost = 1;

  function horizon(x) {
    const u = x / W;
    return H * (0.655 - 0.075 * smoothstep(0.3, 1.0, u) + 0.016 * Math.sin(u * 19 + 0.6) + 0.01 * Math.sin(u * 47 + 2.1));
  }

  function addVortex(x, y, cx, cy, R, s, dir, out) {
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    const R2 = R * R;
    if (d2 > R2 * 6) return;
    const f = ((s * 2.33) / R) * Math.exp(-d2 / R2);
    out.x += (-dy * dir - dx * 0.14) * f;
    out.y += (dx * dir - dy * 0.14) * f;
  }

  // The night wind: a rightward drift, rolling waves, curl from noise,
  // the great whirls, and small eddies around every star and the moon.
  function flow(x, y, t, out) {
    let vx = 36;
    let vy = 16 * Math.sin(x * 0.0042 + t * 0.22) + 9 * Math.sin(y * 0.011 + x * 0.002 - t * 0.15);
    const a = Noise.n2(x * 0.0032 + t * 0.025, y * 0.0032 - t * 0.018) * 5.0;
    vx += 20 * Math.cos(a);
    vy += 20 * Math.sin(a);
    out.x = vx;
    out.y = vy;
    for (let i = 0; i < swirls.length; i++) {
      const s = swirls[i];
      addVortex(x, y, s.x, s.y, s.R, s.s * swirlBoost, s.dir, out);
    }
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      addVortex(x, y, st.x, st.y, st.r * 4.2, st.lit ? 95 : 38, 1, out);
    }
    addVortex(x, y, moon.x, moon.y, moon.r * 2.8, 80, 1, out);
    const d = horizon(x) - y;
    if (d < 90) {
      const k = clamp(d / 90, 0, 1);
      out.y *= k;
      out.x = out.x * k + 40 * (1 - k);
    }
  }

  return {
    stars,
    moon,
    swirls,
    cypress,
    horizon,
    flow,
    setSwirlBoost(v) {
      swirlBoost = v;
    },
  };
})();
