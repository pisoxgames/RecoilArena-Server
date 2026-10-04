'use strict';
/* RECOIL ARENA 3D - audio.js (ENTREGA 4)
   Todo el sonido se genera con Web Audio API (sin archivos). API usada por client.js:
     RAudio.play(nombre, {x,y,z})  -> efecto (espacial si trae posición)
     RAudio.music(nombre)          -> 'menu' | 'game' | 'lastminute' | 'victory'
     RAudio.setVolumes(sfx, music) -> 0..1
     RAudio.listener(x,y,z,yaw,pitch) */
(function () {
  let ctx = null, master, sfxGain, musicGain, noiseBuf, vols = { sfx: 0.7, music: 0.5 }, pending = null, cur = null, trackGain = null, timer = null, active = 0;
  const st = { step: 0, next: 0 };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
      sfxGain = ctx.createGain(); musicGain = ctx.createGain(); sfxGain.connect(master); musicGain.connect(master); applyVols();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { ctx = null; return false; }
  }
  function applyVols() { if (!ctx) return; sfxGain.gain.value = vols.sfx; musicGain.gain.value = vols.music; }
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (ensure()) { if (ctx.state === 'suspended') ctx.resume(); if (pending && !cur) music(pending); } }, { passive: true }));

  /* ---- síntesis básica ---- */
  function tone(type, f0, f1, dur, peak, dest, when) {
    const t = when || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, peak, dest, ftype, freq, when, q) {
    const t = when || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ftype || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function spatial(pos) {
    if (!pos || typeof pos.x !== 'number') return sfxGain;
    const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.1; p.maxDistance = 250;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(sfxGain); return p;
  }
  const N = { C: 261.6, D: 293.7, E: 329.6, G: 392, A: 440, C5: 523.3, E5: 659.3, G5: 784, C6: 1046.5 };

  const SFX = {
    hover: o => tone('sine', 900, 1150, 0.05, 0.05, o),
    click: o => tone('square', 520, 300, 0.07, 0.1, o),
    shoot: o => { noise(0.12, 0.35, o, 'bandpass', 1800, 0, 1.2); tone('sawtooth', 320, 70, 0.16, 0.22, o); },
    hit: o => { noise(0.1, 0.3, o, 'highpass', 2500); tone('triangle', 650, 200, 0.12, 0.25, o); },
    shield: o => { tone('sine', 400, 1000, 0.25, 0.3, o); noise(0.15, 0.2, o, 'highpass', 4000); },
    kill: o => { tone('square', 230, 110, 0.25, 0.28, o); tone('sine', 880, 1320, 0.15, 0.2, o, ctx.currentTime + 0.06); noise(0.3, 0.3, o, 'lowpass', 900); },
    bomb: o => { noise(0.55, 0.75, o, 'lowpass', 420); tone('sine', 130, 30, 0.5, 0.6, o); },
    nuke: o => { noise(1.4, 0.9, o, 'lowpass', 220); tone('sawtooth', 90, 20, 1.4, 0.6, o); tone('sine', 55, 25, 1.6, 0.8, o); },
    dash: o => { noise(0.26, 0.3, o, 'highpass', 1800, 0, 0.5); tone('sine', 300, 900, 0.18, 0.12, o); },
    grapple: o => { tone('sawtooth', 200, 900, 0.18, 0.22, o); noise(0.05, 0.25, o, 'highpass', 3000, ctx.currentTime + 0.17); },
    jump: o => tone('sine', 300, 720, 0.16, 0.26, o),
    portal: o => { tone('sine', 500, 1500, 0.28, 0.22, o); tone('sine', 1500, 400, 0.25, 0.18, o, ctx.currentTime + 0.12); },
    trampoline: o => { tone('sine', 180, 820, 0.22, 0.35, o); tone('triangle', 360, 1200, 0.2, 0.15, o); },
    lava: o => { noise(0.4, 0.4, o, 'lowpass', 650); tone('sine', 110, 55, 0.35, 0.3, o); },
    bounce: o => tone('triangle', 720, 400, 0.08, 0.22, o),
    emote: o => [N.C, N.E, N.G].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.18, o, ctx.currentTime + i * 0.06)),
    powerup: o => [N.C, N.E, N.G, N.C5, N.E5].forEach((f, i) => tone('square', f, 0, 0.12, 0.13, o, ctx.currentTime + i * 0.06)),
    roulette: o => { let t = 0; for (let i = 0; i < 26; i++) { tone('square', 700 + (i % 2) * 200, 0, 0.03, 0.1, o, ctx.currentTime + t); t += 0.04 + i * 0.006; } tone('sine', N.C6, 0, 0.5, 0.25, o, ctx.currentTime + 3); },
    countdown: o => tone('sine', 660, 0, 0.18, 0.3, o),
    go: o => { tone('sine', 990, 0, 0.3, 0.35, o); tone('sine', 1320, 0, 0.4, 0.3, o, ctx.currentTime + 0.12); },
    death: o => { tone('sawtooth', 420, 60, 0.6, 0.3, o); noise(0.4, 0.3, o, 'lowpass', 500); },
    spawn: o => tone('sine', 300, 900, 0.3, 0.22, o),
    victory: o => [N.C, N.E, N.G, N.C5, 0, N.G, N.C5, N.E5, N.G5].forEach((f, i) => { if (f) tone('square', f, 0, 0.2, 0.14, o, ctx.currentTime + i * 0.13); }),
    notify: o => { tone('sine', N.E5, 0, 0.12, 0.2, o); tone('sine', N.G5, 0, 0.2, 0.2, o, ctx.currentTime + 0.1); }
  };
  function play(name, pos) {
    if (!ctx || ctx.state !== 'running' || !SFX[name] || vols.sfx <= 0 || active > 40) return;
    active++; setTimeout(() => { active--; }, 400);
    try { SFX[name](spatial(pos)); } catch (e) {}
  }

  /* ---- música procedural (secuenciador de 16 pasos) ---- */
  const TRACKS = {
    menu: { bpm: 92, root: 220, wave: 'sine', hat: 0, vol: 0.06, lead: [0, null, 7, null, 12, null, 7, null, 3, null, 10, null, 7, null, 5, null], bass: [0, null, null, null, -5, null, null, null, -3, null, null, null, -7, null, null, null] },
    game: { bpm: 128, root: 110, wave: 'square', hat: 1, vol: 0.045, lead: [12, null, 15, 12, null, 10, null, 7, 12, null, 15, 17, null, 15, null, 10], bass: [0, 0, null, 0, 0, null, 0, null, -2, -2, null, -2, -2, null, -2, null] },
    lastminute: { bpm: 164, root: 123.47, wave: 'sawtooth', hat: 2, vol: 0.038, lead: [12, 15, 12, 15, 17, 15, 12, 10, 12, 15, 12, 19, 17, 15, 12, 10], bass: [0, null, 0, 0, null, 0, 0, null, 1, null, 1, 1, null, 1, 1, null] },
    victory: { bpm: 118, root: 196, wave: 'triangle', hat: 0, vol: 0.07, lead: [0, 4, 7, 12, null, 12, 7, null, 4, 7, 12, 16, null, 16, 12, null], bass: [0, null, null, null, 5, null, null, null, 7, null, null, null, 0, null, null, null] }
  };
  function stepNote(tk, i, when, dest) {
    const sd = 60 / tk.bpm / 4, f = s => tk.root * Math.pow(2, s / 12);
    if (tk.lead[i] !== null) tone(tk.wave, f(tk.lead[i]), 0, sd * 1.7, tk.vol, dest, when);
    if (tk.bass[i] !== null) tone(tk.wave === 'sine' ? 'sine' : 'triangle', f(tk.bass[i]) / 2, 0, sd * 3, tk.vol * 1.7, dest, when);
    if (tk.hat && (tk.hat === 2 || i % 2 === 0)) noise(0.04, tk.vol * 0.7, dest, 'highpass', 7000, when);
    if (tk.hat && i % 4 === 0) noise(0.09, tk.vol * 1.1, dest, 'lowpass', 160, when);
  }
  function music(name) {
    pending = name; if (!ctx || name === cur) return;
    if (!TRACKS[name]) return;
    if (trackGain) { const old = trackGain, t = ctx.currentTime; old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + 0.5); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 700); }
    clearInterval(timer); cur = name; trackGain = ctx.createGain(); trackGain.gain.value = 1; trackGain.connect(musicGain);
    const tk = TRACKS[name], dest = trackGain; st.step = 0; st.next = ctx.currentTime + 0.1;
    timer = setInterval(() => { if (dest !== trackGain) return; while (st.next < ctx.currentTime + 0.3) { stepNote(tk, st.step, st.next, dest); st.next += 60 / tk.bpm / 4; st.step = (st.step + 1) % 16; } }, 100);
  }
  function listener(x, y, z, yaw, pitch) {
    if (!ctx) return; const L = ctx.listener, c = Math.cos(pitch), fx = -Math.sin(yaw) * c, fy = Math.sin(pitch), fz = -Math.cos(yaw) * c;
    if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(x, y, z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
  }
  function setVolumes(s, m) { vols.sfx = s; vols.music = m; applyVols(); }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  window.RAudio = { play, music, setVolumes, listener, unlock: ensure };
})();
