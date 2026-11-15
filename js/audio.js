'use strict';

const Sound = (() => {
  let ac = null;
  let out, sfx, music, verb, padFilter, noiseBuf;
  let muted = false;
  let chordIdx = 0;
  let intensity = 0;
  const padVoices = [];

  const D4 = 293.66;
  const PENTA = [0, 2, 4, 7, 9];
  const fr = (semi) => D4 * Math.pow(2, semi / 12);
  const pent = (i) => PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
  // Dmaj9 · Bm11 · Gmaj9 · A6sus — semitones relative to D4
  const CHORDS = [
    [-12, -5, 2, 4, 11],
    [-15, -8, 0, 2, 7],
    [-19, -12, -3, 4, 7],
    [-17, -10, -3, 0, 4],
  ];

  const ok = () => ac && !muted;

  function impulse(sec, decay) {
    const n = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  function makeNoise(sec) {
    const n = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function init() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    out = ac.createGain();
    out.gain.value = muted ? 0 : 0.85;
    comp.connect(out);
    out.connect(ac.destination);

    verb = ac.createConvolver();
    verb.buffer = impulse(3.6, 2.4);
    const vg = ac.createGain();
    vg.gain.value = 0.5;
    verb.connect(vg);
    vg.connect(comp);

    sfx = ac.createGain();
    sfx.gain.value = 0.8;
    sfx.connect(comp);

    music = ac.createGain();
    music.gain.value = 0;
    music.connect(comp);
    const mv = ac.createGain();
    mv.gain.value = 0.6;
    music.connect(mv);
    mv.connect(verb);

    noiseBuf = makeNoise(1.5);
    startPad();
    music.gain.setTargetAtTime(0.5, ac.currentTime, 2.5);
    scheduleTwinkle();
  }

  function startPad() {
    padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ac.createGain();
    lg.gain.value = 320;
    lfo.connect(lg);
    lg.connect(padFilter.frequency);
    lfo.start();
    padFilter.connect(music);
    const ch = CHORDS[0];
    for (let i = 0; i < ch.length; i++) {
      const g = ac.createGain();
      g.gain.value = 0.05 / (1 + i * 0.15);
      const o1 = ac.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = fr(ch[i]);
      const o2 = ac.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = fr(ch[i]);
      o2.detune.value = 7;
      o1.connect(g);
      o2.connect(g);
      g.connect(padFilter);
      o1.start();
      o2.start();
      padVoices.push([o1, o2]);
    }
    setInterval(nextChord, 9000);
  }

  function nextChord() {
    chordIdx = (chordIdx + 1) % CHORDS.length;
    const ch = CHORDS[chordIdx];
    padVoices.forEach(([o1, o2], i) => {
      const f = fr(ch[i]);
      o1.frequency.setTargetAtTime(f, ac.currentTime, 1.2);
      o2.frequency.setTargetAtTime(f, ac.currentTime, 1.2);
    });
  }

  function scheduleTwinkle() {
    const wait = (2600 / (1 + intensity * 0.3)) * (0.4 + Math.random());
    setTimeout(() => {
      if (ok() && ac.state === 'running') {
        const t = ac.currentTime;
        tone(fr(pent(10 + ((Math.random() * 7) | 0))), t, 2.4, 0.035 + intensity * 0.003, 'sine', 0.9, 0.02);
      }
      scheduleTwinkle();
    }, wait);
  }

  function tone(f, t0, dur, vol, type = 'sine', send = 0.4, attack = 0.008) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(sfx);
    if (send > 0) {
      const s = ac.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(verb);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  function noise(t0, dur, vol, type, freq, freqEnd) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    init,
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      if (ac) out.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.08);
    },
    pickup(n) {
      if (!ok()) return;
      const t = ac.currentTime;
      const s = pent(10 + (n % 8));
      tone(fr(s), t, 0.7, 0.09, 'sine', 0.5);
      tone(fr(s + 12), t, 0.35, 0.025, 'triangle', 0.3);
    },
    tick(p) {
      if (!ok()) return;
      tone(fr(pent(5 + Math.floor(p * 9))), ac.currentTime, 0.18, 0.035, 'triangle', 0.2);
    },
    ignite(n) {
      if (!ok()) return;
      intensity = n;
      const t = ac.currentTime;
      const b = 5 + (n % 5);
      for (let i = 0; i < 5; i++) tone(fr(pent(b + i * 2)), t + i * 0.07, 1.8, 0.08, 'sine', 0.6);
      tone(fr(-12), t, 3.2, 0.1, 'sine', 0.6);
      tone(fr(-17), t, 3, 0.05, 'triangle', 0.4);
      for (let i = 0; i < 6; i++) tone(fr(pent(18 + i)), t + 0.3 + i * 0.05, 1.2, 0.015, 'sine', 0.9);
    },
    caw() {
      if (!ok()) return;
      const t = ac.currentTime;
      for (let k = 0; k < 2; k++) {
        const t0 = t + k * 0.2;
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(720, t0);
        o.frequency.exponentialRampToValueAtTime(380, t0 + 0.16);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1300;
        bp.Q.value = 3;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
        o.connect(bp);
        bp.connect(g);
        g.connect(sfx);
        const s = ac.createGain();
        s.gain.value = 0.25;
        g.connect(s);
        s.connect(verb);
        o.start(t0);
        o.stop(t0 + 0.2);
      }
      noise(t, 0.25, 0.12, 'lowpass', 500);
    },
    dash() {
      if (!ok()) return;
      const t = ac.currentTime;
      noise(t, 0.35, 0.08, 'bandpass', 500, 2400);
      tone(fr(pent(12)), t, 0.25, 0.03, 'triangle', 0.3);
    },
    fade() {
      if (!ok()) return;
      const t = ac.currentTime;
      const o = tone(fr(7), t, 1.6, 0.1, 'sine', 0.7, 0.02);
      o.frequency.exponentialRampToValueAtTime(fr(-17), t + 1.4);
    },
    respawn() {
      if (!ok()) return;
      const t = ac.currentTime;
      for (let i = 0; i < 4; i++) tone(fr(pent(5 + i * 2)), t + i * 0.09, 0.9, 0.05, 'sine', 0.6);
    },
    meteor() {
      if (!ok()) return;
      const t = ac.currentTime;
      for (let i = 0; i < 9; i++) tone(fr(pent(8 + i)), t + i * 0.04, 0.8, 0.05, 'sine', 0.7);
    },
    victory() {
      if (!ac) return;
      const t = ac.currentTime;
      music.gain.setTargetAtTime(0.85, t, 1.5);
      padFilter.frequency.setTargetAtTime(1900, t, 2);
      if (muted) return;
      for (let i = 0; i < 22; i++) tone(fr(pent(3 + i)), t + i * 0.11, 2.6, 0.06, i % 2 ? 'triangle' : 'sine', 0.7);
      tone(fr(-24), t, 6, 0.12, 'sine', 0.7, 0.4);
      tone(fr(-12), t + 0.5, 6, 0.08, 'sine', 0.7, 0.6);
    },
    reset() {
      intensity = 0;
      if (!ac) return;
      music.gain.setTargetAtTime(0.5, ac.currentTime, 1.5);
      padFilter.frequency.setTargetAtTime(900, ac.currentTime, 1.5);
    },
  };
})();
