'use strict';
/* =====================================================================
   RECOIL ARENA 3D - gfx.js
   Librería de estilo cartoon: materiales toon (cel shading), contornos por
   casco invertido, texturas procedurales, cúpula de cielo, avatares, arma en
   primera persona y sombras blob. Sin archivos externos.
   ===================================================================== */
(function () {
  const THREE = window.THREE; if (!THREE) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  /* ------------------------------ TOON + CONTORNO ------------------------------ */
  let gradTex = null;
  function gradient() { // 4 escalones de luz = cel shading
    if (gradTex) return gradTex;
    const d = new Uint8Array([85, 145, 205, 255]);
    gradTex = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.generateMipmaps = false; gradTex.needsUpdate = true;
    return gradTex;
  }
  const toon = (color, o) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: gradient() }, o || {}));
  // Material sin luz; intensity > 1 hace que el bloom lo haga brillar
  function basic(color, intensity, o) { const m = new THREE.MeshBasicMaterial(Object.assign({ color }, o || {})); if (intensity && intensity !== 1) m.color.multiplyScalar(intensity); return m; }
  const outlineCache = new Map();
  function outlineMat(t, color) {
    const k = t + '|' + (color || 0);
    if (outlineCache.has(k)) return outlineCache.get(k);
    const m = new THREE.ShaderMaterial({
      uniforms: { thick: { value: t }, col: { value: new THREE.Color(color === undefined ? 0x0b0818 : color) } },
      vertexShader: 'uniform float thick;void main(){vec3 n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);mv.xyz+=n*thick;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 col;void main(){gl_FragColor=vec4(col,1.0);}', side: THREE.BackSide, fog: false
    });
    m.userData.keep = true; outlineCache.set(k, m); return m;
  }
  function addOutline(mesh, t, color) { // contorno negro de grosor constante en unidades de mundo
    const o = new THREE.Mesh(mesh.geometry, outlineMat(t || 0.04, color)); o.userData.outline = true; mesh.add(o); return mesh;
  }
  const G = {
    sph: new THREE.SphereGeometry(1, 26, 18), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 18), cone: new THREE.ConeGeometry(1, 1, 18),
    tor: new THREE.TorusGeometry(1, 0.2, 10, 28), circ: new THREE.CircleGeometry(1, 32), ico: new THREE.IcosahedronGeometry(1, 0), oct: new THREE.OctahedronGeometry(1, 0)
  };
  Object.values(G).forEach(g => { g.userData.keep = true; });
  function part(geo, mat, x, y, z, sx, sy, sz, ol, olc) { // malla con posición/escala y contorno opcional
    const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    if (ol !== 0 && ol !== false) addOutline(m, ol || 0.035, olc); return m;
  }

  /* ----------------------------- TEXTURAS PROCEDURALES ----------------------------- */
  function canvasTex(w, h, draw, rep, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t;
  }
  const tex = {
    grid(rep, c1, c2, line) { // suelo neón con rejilla
      return canvasTex(256, 256, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.strokeStyle = line; x.shadowColor = line; x.shadowBlur = 14; x.lineWidth = 6; x.strokeRect(0, 0, w, h);
        x.shadowBlur = 0; x.globalAlpha = 0.22; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
      }, rep);
    },
    checker(rep, c1, c2) {
      return canvasTex(128, 128, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }, rep);
    },
    rock(rep) { // roca oscura con grietas de lava
      return canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = '#2c1d1d'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(' + (60 + rnd(0, 30) | 0) + ',' + (38 + rnd(0, 20) | 0) + ',' + (34 + rnd(0, 16) | 0) + ',.55)'; x.beginPath(); x.arc(rnd(0, w), rnd(0, h), rnd(6, 26), 0, TAU); x.fill(); }
        x.lineCap = 'round'; x.shadowColor = '#ff7a1f'; x.shadowBlur = 12;
        for (let i = 0; i < 7; i++) { let px = rnd(0, w), py = rnd(0, h); x.strokeStyle = i % 2 ? '#ff9a2f' : '#ff5a1f'; x.lineWidth = rnd(2, 4.5); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rnd(-34, 34); py += rnd(-34, 34); x.lineTo(px, py); } x.stroke(); }
      }, rep);
    },
    lava(rep) { // lava tileable animable (se desplaza con offset)
      return canvasTex(128, 128, (x, w, h) => {
        const im = x.createImageData(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const u = i / w * TAU, v = j / h * TAU;
          let n = Math.sin(u * 2 + Math.sin(v * 3)) + Math.sin(v * 2 + Math.sin(u * 3 + 1)) + Math.sin((u + v) * 3) * 0.6 + Math.sin((u - v) * 4) * 0.4; n = (n + 3) / 6;
          const k = (j * w + i) * 4, t = Math.pow(n, 1.4);
          im.data[k] = 255; im.data[k + 1] = 70 + t * 185; im.data[k + 2] = 10 + t * 40; im.data[k + 3] = 255;
        }
        x.putImageData(im, 0, 0);
      }, rep);
    },
    face(kind) { // cara sonriente para los cubos del laberinto
      return canvasTex(128, 128, (x, w, h) => {
        x.clearRect(0, 0, w, h); x.fillStyle = '#1a1230'; x.strokeStyle = '#1a1230'; x.lineCap = 'round';
        x.beginPath(); x.ellipse(40, 50, 11, 15, 0, 0, TAU); x.ellipse(88, 50, 11, 15, 0, 0, TAU); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(43, 45, 4, 0, TAU); x.arc(91, 45, 4, 0, TAU); x.fill();
        x.lineWidth = 7; x.beginPath(); if (kind === 1) { x.ellipse(64, 86, 14, 10, 0, 0, TAU); x.fillStyle = '#1a1230'; x.fill(); } else x.arc(64, 70, 26, 0.25, Math.PI - 0.25); x.stroke();
        x.fillStyle = 'rgba(255,80,120,.45)'; x.beginPath(); x.ellipse(22, 76, 9, 6, 0, 0, TAU); x.ellipse(106, 76, 9, 6, 0, 0, TAU); x.fill();
      }, null);
    },
    blob() { return canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(0.6, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); },
    glow() { return canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); },
    star() { return canvasTex(64, 64, (x, w, h) => { x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 28, a = i * Math.PI / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }); }
  };

  ['blob', 'glow', 'star'].forEach(k => { const f = tex[k]; let c = null; tex[k] = () => c || (c = f()); }); // texturas compartidas (evita fugas)

  /* ------------------------------ CIELO / FONDO ------------------------------ */
  function skyDome(top, mid, bot, radius) { // degradado vertical con colores por vértice
    const g = new THREE.SphereGeometry(radius || 420, 32, 20), pos = g.attributes.position, cols = [], ct = new THREE.Color(top), cm = new THREE.Color(mid), cb = new THREE.Color(bot), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / (radius || 420); if (y > 0) c.copy(cm).lerp(ct, Math.pow(y, 0.7)); else c.copy(cm).lerp(cb, Math.pow(-y, 0.6)); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -10; m.frustumCulled = false; m.userData.dome = true; return m;
  }
  function stars(n, spread, color, size) {
    const p = []; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), e = rnd(-0.1, 1), r = Math.sqrt(1 - e * e) * spread; p.push(Math.cos(a) * r, e * spread, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size: size || 1.6, fog: false, sizeAttenuation: false, transparent: true, depthWrite: false })); m.frustumCulled = false; return m;
  }
  function cloud(scale, mat) { // nube esponjosa de esferas
    const g = new THREE.Group(); const n = 5 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) g.add(part(G.sph, mat, (i - n / 2) * scale * 0.7, rnd(-0.2, 0.3) * scale, rnd(-0.3, 0.3) * scale, scale * rnd(0.6, 1.0), scale * rnd(0.5, 0.8), scale * rnd(0.5, 0.8), 0));
    return g;
  }

  /* -------------------------------- AVATARES -------------------------------- */
  const SKIN = { default: 0x2fa8ff, robot: 0xc9d0dc, ghost: 0xf4f7ff, ninja: 0x2b2b44, clown: 0xfff0dc, alien: 0x7ae04a, gold: 0xffc21f };
  const white = toon(0xffffff), black = toon(0x15101f);
  function eyes(body, sp, y, z, w, h) {
    for (const s of [-1, 1]) { body.add(part(G.sph, white, s * sp, y, z, w, h, w * 0.6, 0.02)); body.add(part(G.sph, black, s * sp, y - h * 0.08, z - w * 0.45, w * 0.5, h * 0.55, w * 0.3, 0)); }
  }
  function smile(body, y, z, r, color, width) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, width || 0.025, 6, 14, Math.PI), toon(color || 0x15101f)); m.position.set(0, y, z); m.rotation.z = Math.PI; body.add(m); return m;
  }
  function makeAvatar(skin) {
    skin = SKIN[skin] ? skin : 'default';
    const g = new THREE.Group(), squash = new THREE.Group(), inner = new THREE.Group(), body = new THREE.Group(); g.add(squash); squash.add(inner); inner.add(body);
    const col = SKIN[skin], extra = skin === 'gold' ? { emissive: 0x8a5a00, emissiveIntensity: 1 } : skin === 'ghost' ? { transparent: true, opacity: 0.82, emissive: 0x8fa0ff, emissiveIntensity: 0.35 } : {};
    const mat = toon(col, extra), dark = toon(new THREE.Color(col).multiplyScalar(0.62).getHex());
    let tail = null;
    const armL = part(G.sph, mat, -0.64, -0.1, -0.1, 0.17, 0.17, 0.17, 0.03), armR = part(G.sph, mat, 0.64, -0.1, -0.1, 0.17, 0.17, 0.17, 0.03);
    if (skin === 'default') {
      body.add(part(G.sph, mat, 0, 0, 0, 0.6, 0.6, 0.6, 0.04));
      body.add(part(G.sph, toon(0xdff3ff), 0, -0.18, -0.34, 0.4, 0.34, 0.3, 0));
      eyes(body, 0.2, 0.2, -0.5, 0.15, 0.2); smile(body, 0.02, -0.57, 0.11);
      body.add(part(G.sph, toon(0x1b7fd6), 0, 0.5, -0.1, 0.2, 0.1, 0.2, 0.02)); // coronilla
    } else if (skin === 'robot') {
      body.add(part(G.box, mat, 0, 0, 0, 1.0, 0.92, 0.92, 0.04));
      body.add(part(G.box, toon(0x1b2438), 0, 0.12, -0.47, 0.72, 0.4, 0.06, 0.02));
      for (const s of [-1, 1]) body.add(part(G.box, basic(0x36f4ff, 1.8), s * 0.17, 0.12, -0.52, 0.17, 0.2, 0.04, 0));
      body.add(part(G.box, toon(0x1b2438), 0, -0.2, -0.47, 0.34, 0.06, 0.05, 0));
      body.add(part(G.cyl, dark, 0, 0.62, 0, 0.04, 0.2, 0.04, 0.025)); body.add(part(G.sph, basic(0xff3d4a, 1.6), 0, 0.84, 0, 0.1, 0.1, 0.1, 0.02));
      for (const s of [-1, 1]) { const b = part(G.cyl, dark, s * 0.52, 0.1, 0, 0.1, 0.14, 0.1, 0.02); b.rotation.z = Math.PI / 2; body.add(b); }
    } else if (skin === 'ghost') {
      body.add(part(G.sph, mat, 0, 0.06, 0, 0.6, 0.62, 0.6, 0.03, 0x2b3560));
      body.add(part(G.cyl, mat, 0, -0.28, 0, 0.6, 0.3, 0.6, 0.03, 0x2b3560));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; body.add(part(G.sph, mat, Math.cos(a) * 0.43, -0.55 + (i % 2) * 0.05, Math.sin(a) * 0.43, 0.2, 0.22, 0.2, 0.03, 0x2b3560)); }
      for (const s of [-1, 1]) body.add(part(G.sph, black, s * 0.2, 0.18, -0.52, 0.12, 0.17, 0.08, 0));
      body.add(part(G.sph, black, 0, -0.08, -0.56, 0.09, 0.12, 0.06, 0));
    } else if (skin === 'ninja') {
      body.add(part(G.sph, mat, 0, 0, 0, 0.5, 0.62, 0.5, 0.04));
      body.add(part(G.sph, toon(0xf2c9a0), 0, 0.15, -0.3, 0.36, 0.14, 0.22, 0));
      for (const s of [-1, 1]) { const e = part(G.sph, white, s * 0.16, 0.16, -0.47, 0.11, 0.05, 0.05, 0); e.rotation.z = -s * 0.3; body.add(e); body.add(part(G.sph, black, s * 0.16, 0.16, -0.5, 0.045, 0.045, 0.03, 0)); }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.06, 8, 24), toon(0xff3d4a)); band.position.y = 0.34; band.rotation.x = Math.PI / 2; body.add(band);
      tail = new THREE.Group(); tail.position.set(0, 0.34, 0.5); body.add(tail);
      [0, 1].forEach(i => { const t = part(G.box, toon(0xff3d4a), i ? 0.12 : -0.1, -0.05 * i, 0.3 + i * 0.1, 0.12, 0.05, 0.6, 0.02); t.rotation.y = i ? -0.3 : 0.3; tail.add(t); });
      body.add(part(G.cyl, toon(0xb0b8c8), -0.18, 0.1, 0.5, 0.03, 0.55, 0.03, 0.015)); // katana a la espalda
    } else if (skin === 'clown') {
      body.add(part(G.sph, mat, 0, 0, 0, 0.74, 0.68, 0.74, 0.04));
      eyes(body, 0.22, 0.2, -0.66, 0.14, 0.17);
      body.add(part(G.sph, toon(0xff3d4a), 0, 0.0, -0.74, 0.15, 0.15, 0.15, 0.025));
      smile(body, -0.18, -0.68, 0.22, 0xe0192b, 0.045);
      [0xff3d4a, 0xffd93d, 0x3ddc4a, 0x2fa8ff].forEach((c, i) => { const s = i < 2 ? -1 : 1, h = i % 2; body.add(part(G.sph, toon(c), s * (0.46 + h * 0.14), 0.4 + h * 0.12, 0.05, 0.24, 0.24, 0.24, 0.03)); });
      const col2 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.1, 8, 24), toon(0xff6ab5)); col2.position.y = -0.36; col2.rotation.x = Math.PI / 2; body.add(col2);
      const hat = part(G.cone, toon(0xffd93d), 0, 0.82, 0, 0.2, 0.42, 0.2, 0.025); hat.rotation.z = 0.25; body.add(hat);
    } else if (skin === 'alien') {
      body.add(part(G.sph, mat, 0, 0, 0, 0.56, 0.68, 0.56, 0.04));
      for (const [x, y, s] of [[0, 0.24, 0.17], [-0.24, 0.12, 0.12], [0.24, 0.12, 0.12]]) { body.add(part(G.sph, white, x, y, -0.48 + Math.abs(x) * 0.5, s, s * 1.2, s * 0.6, 0.02)); body.add(part(G.sph, black, x, y, -0.55 + Math.abs(x) * 0.5, s * 0.5, s * 0.7, s * 0.3, 0)); }
      smile(body, -0.12, -0.5, 0.08);
      for (const s of [-1, 1]) { const a = part(G.cyl, dark, s * 0.26, 0.74, 0, 0.03, 0.22, 0.03, 0.02); a.rotation.z = -s * 0.3; body.add(a); body.add(part(G.sph, basic(0xd6ff5a, 1.7), s * 0.35, 0.98, 0, 0.1, 0.1, 0.1, 0.02)); }
    } else if (skin === 'gold') {
      body.add(part(G.sph, mat, 0, 0, 0, 0.6, 0.6, 0.6, 0.04));
      eyes(body, 0.2, 0.18, -0.5, 0.15, 0.2); smile(body, 0.0, -0.57, 0.11);
      const crown = new THREE.Group(); crown.position.y = 0.58; body.add(crown);
      crown.add(part(G.cyl, toon(0xffe066, { emissive: 0x9a6a00 }), 0, 0, 0, 0.36, 0.1, 0.36, 0.025));
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; crown.add(part(G.cone, toon(0xffe066, { emissive: 0x9a6a00 }), Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3, 0.09, 0.2, 0.09, 0.02)); }
      crown.add(part(G.sph, basic(0xff3d4a, 1.4), 0, 0.02, -0.36, 0.06, 0.06, 0.06, 0));
    }
    // blaster (todos)
    const gun = new THREE.Group(); gun.position.set(0.46, -0.12, -0.52); body.add(gun);
    const bar = part(G.cyl, toon(0x3a3a58), 0, 0, 0, 0.085, 0.4, 0.085, 0.025); bar.rotation.x = Math.PI / 2; gun.add(bar);
    const tip = part(G.cyl, toon(0xff9a1f), 0, 0, -0.38, 0.11, 0.05, 0.11, 0.02); tip.rotation.x = Math.PI / 2; gun.add(tip);
    gun.add(part(G.box, toon(0xff5a3a), 0, -0.1, 0.1, 0.08, 0.2, 0.1, 0.02));
    body.add(armL, armR);
    // escudo burbuja y aura
    const bubble = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.3, depthWrite: false })); bubble.scale.setScalar(1.05); bubble.visible = false; g.add(bubble);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd93d })); aura.scale.setScalar(1.15); aura.rotation.x = Math.PI / 2; aura.visible = false; g.add(aura);
    g.userData = { body, squash, inner, armL, armR, bubble, aura, mat, tail, skin, label: null, stretch: 1, pulse: 0 };
    return g;
  }
  // Sombra blob (círculo oscuro bajo el jugador)
  let blobMat = null;
  function makeBlob() {
    if (!blobMat) { blobMat = new THREE.MeshBasicMaterial({ map: tex.blob(), transparent: true, depthWrite: false }); blobMat.userData.keep = true; }
    const m = new THREE.Mesh(G.circ, blobMat.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.userData.blob = true; return m;
  }

  /* ------------------------- ARMA EN PRIMERA PERSONA ------------------------- */
  function makeViewmodel() {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(52, 1, 0.05, 20);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5aa0, 1.7)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 3, 2); scene.add(d);
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun); scene.add(root);
    const orange = toon(0xff7a2a), cream = toon(0xfff1d6), dk = toon(0x35335a), cyan = basic(0x3ff1ff, 1.8);
    const ol = 0.012;
    const body = part(G.box, orange, 0, 0, 0, 0.16, 0.18, 0.55, ol); gun.add(body);
    const top = part(G.box, cream, 0, 0.11, 0.03, 0.1, 0.05, 0.4, ol); gun.add(top);
    const barrel = part(G.cyl, dk, 0, 0.0, -0.4, 0.06, 0.26, 0.06, ol); barrel.rotation.x = Math.PI / 2; gun.add(barrel);
    const muzzle = part(G.cyl, cream, 0, 0, -0.56, 0.085, 0.05, 0.085, ol); muzzle.rotation.x = Math.PI / 2; gun.add(muzzle);
    const core = part(G.cyl, cyan, 0, 0.0, -0.22, 0.095, 0.03, 0.095, 0); core.rotation.x = Math.PI / 2; gun.add(core);
    const grip = part(G.box, dk, 0, -0.17, 0.18, 0.09, 0.22, 0.1, ol); grip.rotation.x = 0.28; gun.add(grip);
    const hand = part(G.sph, toon(0xffd7b0), 0, -0.2, 0.2, 0.1, 0.1, 0.1, ol); gun.add(hand);
    const sight = part(G.box, dk, 0, 0.17, -0.18, 0.025, 0.05, 0.05, 0.008); gun.add(sight);
    // fogonazo
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.star(), color: 0xffe27a, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); flash.position.set(0, 0, -0.66); flash.scale.setScalar(0.0001); gun.add(flash);
    const flashLight = new THREE.PointLight(0xffc860, 0, 3); flashLight.position.set(0, 0, -0.7); gun.add(flashLight);
    gun.scale.setScalar(0.42); gun.position.set(0.24, -0.22, -0.75); gun.rotation.set(0.02, 0.1, 0);
    const st = { kick: 0, flash: 0, sway: [0, 0], lastYaw: 0, lastPitch: 0, dash: 0, t: 0 };
    return {
      scene, camera: cam, root, visible: true,
      shoot() { st.kick = 1; st.flash = 1; flash.material.rotation = rnd(0, TAU); },
      dash() { st.dash = 1; },
      update(dt, speed, yaw, pitch, aspect) {
        st.t += dt; const dy = ((yaw - st.lastYaw + Math.PI * 3) % TAU) - Math.PI, dp = pitch - st.lastPitch; st.lastYaw = yaw; st.lastPitch = pitch;
        st.sway[0] += (clamp(-dy * 2.2, -0.35, 0.35) - st.sway[0]) * Math.min(1, dt * 9); st.sway[1] += (clamp(dp * 2.2, -0.3, 0.3) - st.sway[1]) * Math.min(1, dt * 9);
        st.kick *= Math.pow(0.0004, dt); st.flash *= Math.pow(0.00002, dt); st.dash *= Math.pow(0.02, dt);
        const bob = Math.sin(st.t * 3) * 0.006 + Math.sin(st.t * 1.3) * 0.004;
        gun.position.set(0.24 + st.sway[0] * 0.05, -0.22 + bob - st.sway[1] * 0.04 - st.dash * 0.05, -0.75 + st.kick * 0.1);
        gun.rotation.set(0.02 + st.kick * 0.28 + st.sway[1] * 0.3, 0.1 + st.sway[0] * 0.4, st.dash * 0.25);
        const fs = st.flash > 0.08 ? 0.32 * st.flash + 0.06 : 0.0001; flash.scale.setScalar(fs); flashLight.intensity = st.flash > 0.08 ? 3.5 * st.flash : 0;
        cam.aspect = aspect; cam.updateProjectionMatrix();
      }
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  window.RAGfx = { THREE, toon, basic, outlineMat, addOutline, G, part, tex, canvasTex, skyDome, stars, cloud, makeAvatar, makeBlob, makeViewmodel, SKIN, gradient };
})();
