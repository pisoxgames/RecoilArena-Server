'use strict';
/* =====================================================================
   RECOIL ARENA 3D - maps.js
   Decoración de los 4 mapas (solo visual; la física/colisiones viene del servidor).
   Hook: RAMaps.decorate({THREE, Gfx, scene, world, map, theme, add, anims, camera, burst, rnd, S})
   ===================================================================== */
(function () {
  const rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, pick = a => a[Math.floor(Math.random() * a.length)];
  const FONT = '"Fredoka One", Nunito, "Trebuchet MS", "Arial Rounded MT Bold", sans-serif';
  const DECOR = {};

  /* ---------------------------- utilidades comunes ---------------------------- */
  function rotY(THREE, x, z, a) { return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; }
  function canvasScreen(c, w, h, draw) { // textura de canvas redibujable (pantallas, carteles)
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), t = new c.THREE.CanvasTexture(cv); t.colorSpace = c.THREE.SRGBColorSpace; t.anisotropy = 4;
    const r = { cv, x, t, draw(tm) { draw(x, w, h, tm); t.needsUpdate = true; } }; r.draw(0); return r;
  }
  function crowd(c, spots, root) { // público cartoon con InstancedMesh (cuerpo + ojos)
    const { THREE, Gfx } = c, n = spots.length, dummy = new THREE.Object3D(), col = new THREE.Color();
    const body = new THREE.InstancedMesh(Gfx.G.sph, Gfx.toon(0xffffff), n), ew = new THREE.InstancedMesh(Gfx.G.sph, Gfx.toon(0xffffff), n * 2), eb = new THREE.InstancedMesh(Gfx.G.sph, Gfx.toon(0x15101f), n * 2);
    [body, ew, eb].forEach(m => { m.frustumCulled = false; root.add(m); });
    spots.forEach((s, i) => body.setColorAt(i, col.setHex(s.col)));
    function update(tm) {
      for (let i = 0; i < n; i++) {
        const s = spots[i], hop = Math.max(0, Math.sin(tm * 4 + s.ph)) * (s.jump ? 0.7 : 0.18), y = s.y + hop;
        dummy.rotation.set(0, 0, 0); dummy.position.set(s.x, y, s.z); dummy.scale.set(0.8, 0.85 + hop * 0.15, 0.8); dummy.updateMatrix(); body.setMatrixAt(i, dummy.matrix);
        for (let k = 0; k < 2; k++) {
          const side = k ? 1 : -1, ox = -s.fz * side * 0.27, oz = s.fx * side * 0.27;
          dummy.position.set(s.x + s.fx * 0.62 + ox, y + 0.14, s.z + s.fz * 0.62 + oz); dummy.scale.set(0.2, 0.26, 0.2); dummy.updateMatrix(); ew.setMatrixAt(i * 2 + k, dummy.matrix);
          dummy.position.set(s.x + s.fx * 0.77 + ox, y + 0.12, s.z + s.fz * 0.77 + oz); dummy.scale.set(0.1, 0.13, 0.1); dummy.updateMatrix(); eb.setMatrixAt(i * 2 + k, dummy.matrix);
        }
      }
      body.instanceMatrix.needsUpdate = ew.instanceMatrix.needsUpdate = eb.instanceMatrix.needsUpdate = true;
    }
    update(0); c.anims.push(update);
  }
  function tree(c, s) { // árbol cartoon
    const { THREE, Gfx } = c, g = new THREE.Group(), T = Gfx.toon, P = Gfx.part, G = Gfx.G;
    g.add(P(G.cyl, T(0x8a5a3a), 0, 0.7 * s, 0, 0.22 * s, 1.4 * s, 0.22 * s, 0.05));
    const m1 = T(0x2fb86a), m2 = T(0x45d27c); g.add(P(G.cone, m1, 0, 1.9 * s, 0, 1.0 * s, 1.5 * s, 1.0 * s, 0.05), P(G.cone, m2, 0, 2.7 * s, 0, 0.75 * s, 1.3 * s, 0.75 * s, 0.05));
    return g;
  }
  function miniIsland(c, w, d, h, topCol, sideCol, rockCol) { // isla decorativa (sin colisión)
    const { THREE, Gfx } = c, g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Gfx.toon(sideCol)); Gfx.addOutline(slab, 0.2); g.add(slab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.5, d + 0.2), Gfx.toon(topCol)); top.position.y = h / 2 - 0.1; g.add(top);
    const mt = Gfx.toon(rockCol); mt.flatShading = true; const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.47, Math.min(w, d) * 0.8, 7), mt); cone.rotation.x = Math.PI; cone.position.y = -h / 2 - Math.min(w, d) * 0.4 + 0.3; Gfx.addOutline(cone, 0.2); g.add(cone);
    return g;
  }
  function pointsFall(c, n, area, color, size, speed, h, opts) { // partículas que caen (ceniza, cascadas)
    const { THREE } = c, pos = new Float32Array(n * 3), ph = new Float32Array(n), g = new THREE.BufferGeometry();
    for (let i = 0; i < n; i++) { ph[i] = Math.random(); pos[i * 3] = area.x + rnd(-1, 1) * area.w; pos[i * 3 + 2] = area.z + rnd(-1, 1) * area.d; pos[i * 3 + 1] = area.y; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial(Object.assign({ color, size, transparent: true, opacity: 0.9, depthWrite: false }, opts || {})), pts = new THREE.Points(g, mat); pts.frustumCulled = false;
    const base = Array.from({ length: n }, (_, i) => [pos[i * 3], pos[i * 3 + 2]]);
    c.anims.push(tm => { const a = g.attributes.position; for (let i = 0; i < n; i++) { const t = (tm * speed / h + ph[i]) % 1; a.setXYZ(i, base[i][0] + Math.sin(tm + i) * 0.4, area.y - t * h, base[i][1]); } a.needsUpdate = true; });
    return pts;
  }

  /* ============================== ARENA CLÁSICA ============================== */
  DECOR.arena = function (c) {
    const { THREE, Gfx, map } = c, T = Gfx.toon, P = Gfx.part, G = Gfx.G, b = map.bounds, bx = b.max[0], bz = b.max[2], H = b.max[1], root = new THREE.Group(); c.add(root);
    const Y = new THREE.Vector3(0, 1, 0), spots = [], tierCols = [0x6a3fe0, 0xd13fe0, 0x3f7fe0], crowdCols = [0xff3d4a, 0xffd93d, 0x3ddc4a, 0x2fa8ff, 0xff8a1f, 0xff6ab5, 0xa55bff, 0x6af0ff];
    // Gradas con espectadores en los 4 lados
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, half = (k % 2 ? bz : bx) + 4, g = new THREE.Group(); g.rotation.y = a; root.add(g);
      for (let i = 0; i < 3; i++) {
        const h = 2.4 + 2.3 * i, depth = 4.2, zc = -((k % 2 ? bx : bz) + 2.2 + depth * i + depth / 2), st = new THREE.Mesh(new THREE.BoxGeometry(half * 2, h, depth), T(tierCols[i])); st.position.set(0, h / 2, zc); Gfx.addOutline(st, 0.12); g.add(st);
        for (let x = -half + 1.6; x <= half - 1.6; x += 2.3) {
          const lx = x + rnd(-0.3, 0.3), lz = zc + rnd(-0.5, 0.5), [wx, wz] = rotY(THREE, lx, lz, a), [fx, fz] = rotY(THREE, 0, 1, a);
          spots.push({ x: wx, y: h + 0.62, z: wz, fx, fz, col: pick(crowdCols), ph: rnd(0, TAU), jump: Math.random() < 0.4 });
        }
      }
    }
    crowd(c, spots, root);
    // Pantallas gigantes con marcador (norte y sur)
    for (const k of [0, 2]) {
      const g = new THREE.Group(); g.rotation.y = k * Math.PI / 2; g.position.y = 0; root.add(g);
      const scr = canvasScreen(c, 640, 256, (x, w, h, tm) => {
        const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#16064a'); gr.addColorStop(1, '#3a0e7a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = '#ffd93d'; x.font = '44px ' + FONT; x.textAlign = 'center'; x.lineWidth = 8; x.strokeStyle = '#111'; x.strokeText('RECOIL ARENA', w / 2, 56); x.fillText('RECOIL ARENA', w / 2, 56);
        const list = c.S && c.S.players ? [...c.S.players.values()].sort((p, q) => q.k - p.k).slice(0, 4) : [];
        x.font = '34px ' + FONT; x.textAlign = 'left';
        list.forEach((p, i) => { x.fillStyle = i === 0 ? '#ffd93d' : '#fff'; x.fillText((i + 1) + '. ' + String(p.name).slice(0, 12), 70, 112 + i * 40); x.textAlign = 'right'; x.fillText(String(p.k), w - 70, 112 + i * 40); x.textAlign = 'left'; });
        if (!list.length) { x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('¡A DISPARAR!', w / 2, 150); }
        x.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(tm * 4) * 0.3) + ')'; x.fillRect(0, h - 10, w * ((tm * 0.2) % 1), 10);
      });
      const frame = P(G.box, T(0x1a1238), 0, 17.5, -(bz + 38), 27, 11, 1.2, 0.15), screen = new THREE.Mesh(new THREE.PlaneGeometry(25, 9.8), new THREE.MeshBasicMaterial({ map: scr.t })); screen.position.set(0, 17.5, -(bz + 37.35));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(27.6, 11.6), Gfx.basic(0x19e5ff, 1.7)); glow.position.set(0, 17.5, -(bz + 38.7)); g.add(frame, screen, glow);
      let last = 0; c.anims.push(tm => { if (tm - last > 0.25) { last = tm; scr.draw(tm); } });
    }
    // Carteles publicitarios animados (este y oeste) y cinta publicitaria en la primera grada
    const ads = ['POW!', 'BAM!', 'BONK!', 'BOOM!'], adCols = ['#ff3d4a', '#ffd93d', '#3ddc4a', '#2fa8ff'];
    for (const k of [1, 3]) {
      const g = new THREE.Group(); g.rotation.y = k * Math.PI / 2; root.add(g);
      for (const sx of [-1, 1]) {
        const idx = (k + (sx > 0 ? 1 : 0)) % 4, sc = canvasScreen(c, 384, 160, (x, w, h, tm) => {
          x.fillStyle = '#12082e'; x.fillRect(0, 0, w, h); x.fillStyle = adCols[(idx + Math.floor(tm * 1.2)) % 4]; x.font = '84px ' + FONT; x.textAlign = 'center'; x.lineWidth = 10; x.strokeStyle = '#111'; x.strokeText(ads[(idx + Math.floor(tm * 1.2)) % 4], w / 2, 110); x.fillText(ads[(idx + Math.floor(tm * 1.2)) % 4], w / 2, 110);
        });
        const pz = -(bx + 36), board = P(G.box, T(0x1a1238), sx * 17, 13, pz, 14, 6, 0.8, 0.12), face = new THREE.Mesh(new THREE.PlaneGeometry(13, 5.2), new THREE.MeshBasicMaterial({ map: sc.t })); face.position.set(sx * 17, 13, pz + 0.45);
        const pole = P(G.cyl, T(0x3a3a58), sx * 17, 5, pz, 0.3, 10, 0.3, 0.06); g.add(board, face, pole);
        let last = 0; c.anims.push(tm => { if (tm - last > 0.4) { last = tm; sc.draw(tm); } });
      }
    }
    // Neón perimetral y de esquinas que cambia de color
    const strips = [];
    const addStrip = (w, h, d, x, y, z) => { const m = new THREE.Mesh(G.box, Gfx.basic(0x19e5ff, 1.8)); m.scale.set(w, h, d); m.position.set(x, y, z); root.add(m); strips.push(m); };
    addStrip(bx * 2 - 0.4, 0.25, 0.25, 0, 0.15, -(bz - 0.15)); addStrip(bx * 2 - 0.4, 0.25, 0.25, 0, 0.15, bz - 0.15); addStrip(0.25, 0.25, bz * 2 - 0.4, -(bx - 0.15), 0.15, 0); addStrip(0.25, 0.25, bz * 2 - 0.4, bx - 0.15, 0.15, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { addStrip(0.35, H, 0.35, sx * (bx - 0.2), H / 2, sz * (bz - 0.2)); addStrip(bx * 2 - 0.4, 0.3, 0.3, 0, H - 0.15, sz * (bz - 0.2)); }
    // Anillos neón en los pilares
    const rings = []; for (const s of map.solids) if (s.max[1] - s.min[1] > 15) for (let k = 0; k < 5; k++) { const w = s.max[0] - s.min[0], r = new THREE.Mesh(new THREE.TorusGeometry(w * 0.82, 0.12, 8, 28), Gfx.basic(0xff3dd9, 1.7)); r.rotation.x = Math.PI / 2; r.position.set((s.min[0] + s.max[0]) / 2, 3 + k * 4.4, (s.min[2] + s.max[2]) / 2); root.add(r); rings.push(r); }
    // Anillos decorativos en el suelo
    const floorRings = []; for (const [r, col] of [[5, 0x19e5ff], [11, 0xff3dd9], [17, 0x19e5ff]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.3, 64), Gfx.basic(col, 1.5, { transparent: true, opacity: 0.8, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = b.min[1] + 0.05; root.add(m); floorRings.push(m); }
    // Cables y tuberías decorativas por fuera de las paredes
    const pipeCols = [0xff8a1f, 0x19e5ff, 0xff3dd9, 0xffd93d];
    for (let i = 0; i < 8; i++) {
      const k = i % 4, a = k * Math.PI / 2, off = rnd(-14, 14), pts = [[off, H - 1, 0], [off + rnd(-3, 3), H * 0.6, 0.6], [off + rnd(-5, 5), H * 0.3, 0], [off + rnd(-6, 6), 1, 0.4]].map(p => { const [wx, wz] = rotY(THREE, p[0], -((k % 2 ? bx : bz) + 0.6 + p[2]), a); return new THREE.Vector3(wx, p[1], wz); });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22, 8, false), T(pipeCols[i % 4])); Gfx.addOutline(tube, 0.05); root.add(tube);
    }
    // Focos de luz que barren la arena
    const beams = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const grp = new THREE.Group(); grp.position.set(sx * (bx + 12), 22, sz * (bz + 12)); const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 55, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.y = -27.5; grp.add(cone); root.add(grp); beams.push({ grp, sx, sz });
    }
    // Planeta y estrellas de fondo (punto de referencia)
    const planet = new THREE.Group(); planet.position.set(-150, 100, -260); planet.add(new THREE.Mesh(G.sph, Gfx.basic(0xb06bff, 1.1))); planet.children[0].scale.setScalar(38);
    const prng = new THREE.Mesh(new THREE.TorusGeometry(60, 3, 6, 48), Gfx.basic(0xffd0ff, 1.0)); prng.rotation.x = 1.25; prng.rotation.y = 0.3; planet.add(prng); root.add(planet); root.add(Gfx.stars(500, 400, 0xffffff, 2));
    const cubes = []; for (let i = 0; i < 14; i++) { const s = rnd(3, 8), m = new THREE.LineSegments(new THREE.EdgesGeometry(G.box), new THREE.LineBasicMaterial({ color: i % 2 ? 0x19e5ff : 0xff3dd9 })); m.scale.setScalar(s); const an = rnd(0, TAU), d = rnd(70, 120); m.position.set(Math.cos(an) * d, rnd(10, 70), Math.sin(an) * d); m.userData.sp = rnd(0.2, 0.7); root.add(m); cubes.push(m); }
    const tgt = new THREE.Vector3(), dir = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    c.anims.push(tm => {
      strips.forEach((m, i) => m.material.color.setHSL((tm * 0.06 + i * 0.07) % 1, 1, 0.55).multiplyScalar(1.8));
      rings.forEach((r, i) => r.material.color.setHSL((tm * 0.12 + i * 0.06) % 1, 1, 0.55).multiplyScalar(1.7));
      floorRings.forEach((r, i) => { r.material.opacity = 0.55 + Math.sin(tm * 2 + i) * 0.25; });
      cubes.forEach((m, i) => { m.rotation.x = tm * m.userData.sp; m.rotation.y = tm * m.userData.sp * 0.7; });
      beams.forEach((bm, i) => { tgt.set(Math.sin(tm * 0.7 + i * 1.6) * 14, 0, Math.cos(tm * 0.55 + i * 2.1) * 14); dir.copy(tgt).sub(bm.grp.position).normalize(); bm.grp.quaternion.setFromUnitVectors(down, dir); bm.grp.children[0].material.color.setHSL((tm * 0.1 + i * 0.25) % 1, 0.8, 0.7); });
      planet.rotation.y = tm * 0.03;
    });
  };

  /* ============================== CIELO INFINITO ============================== */
  DECOR.sky = function (c) {
    const { THREE, Gfx, map } = c, T = Gfx.toon, P = Gfx.part, G = Gfx.G, root = new THREE.Group(); c.add(root);
    const cols = [0xff3d4a, 0xff9a1f, 0xffd93d, 0x3ddc4a, 0x2fa8ff, 0x5b5bff, 0xa55bff];
    cols.forEach((col, i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(110 - i * 3.2, 1.7, 8, 72, Math.PI), Gfx.basic(col, 1.0, { fog: false })); a.position.set(0, -42, -190); root.add(a); });
    const sun = new THREE.Mesh(G.sph, Gfx.basic(0xfff3a0, 1.2, { fog: false })), halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: Gfx.tex.glow(), color: 0xffe9a0, transparent: true, depthWrite: false, fog: false })); sun.scale.setScalar(16); sun.position.set(130, 90, -300); halo.position.copy(sun.position); halo.scale.setScalar(150); root.add(sun, halo);
    // árboles y arbustos sobre las plataformas
    for (const s of map.solids) {
      const w = s.max[0] - s.min[0], d = s.max[2] - s.min[2], n = Math.max(1, Math.min(5, Math.floor(w * d / 55))), y0 = s.max[1] + 0.1;
      for (let i = 0; i < n; i++) {
        const t = tree(c, rnd(0.7, 1.2)), edge = Math.random() < 0.5; t.position.set(s.min[0] + 1.5 + Math.random() * (w - 3), y0, edge ? (Math.random() < 0.5 ? s.min[2] + 1.4 : s.max[2] - 1.4) : s.min[2] + 1.5 + Math.random() * (d - 3)); t.rotation.y = rnd(0, 6); root.add(t);
      }
      for (let i = 0; i < n * 2; i++) { const bush = P(G.sph, T(pick([0x45d27c, 0x7ae04a, 0xffd93d, 0xff6ab5])), s.min[0] + 1 + Math.random() * (w - 2), y0 + 0.3, s.min[2] + 1 + Math.random() * (d - 2), rnd(0.35, 0.6), rnd(0.3, 0.45), rnd(0.35, 0.6), 0.04); root.add(bush); }
    }
    // islas flotantes decorativas de fondo
    for (let i = 0; i < 8; i++) { const w = rnd(14, 30), isl = miniIsland(c, w, w * rnd(0.7, 1), 2.4, 0x58d65a, 0x9a6b45, 0x7a5236), an = rnd(0, TAU), d = rnd(120, 190); isl.position.set(Math.cos(an) * d, rnd(-30, 30), Math.sin(an) * d); isl.userData.b = rnd(0, 6); const tr = tree(c, 2); tr.position.set(rnd(-3, 3), 1.4, rnd(-3, 3)); isl.add(tr); root.add(isl); c.anims.push(tm => { isl.position.y += Math.sin(tm * 0.5 + isl.userData.b) * 0.01; }); }
    // nubes animadas
    const cm = T(0xffffff, { emissive: 0xbfd8ff, emissiveIntensity: 0.25 });
    for (let i = 0; i < 18; i++) { const cl = Gfx.cloud(rnd(5, 9), cm), an = rnd(0, TAU), d = rnd(70, 190), base = Math.cos(an) * d, z = Math.sin(an) * d, y = rnd(-38, 45), sp = rnd(1.2, 3); cl.position.set(base, y, z); cl.children.forEach(m => Gfx.addOutline(m, 0.14)); root.add(cl); c.anims.push(tm => { cl.position.x = ((base + tm * sp + 220) % 440) - 220; }); }
    // pájaros cartoon
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group(), body = P(G.sph, T(pick([0xff6ab5, 0xffd93d, 0x2fa8ff, 0xff8a1f])), 0, 0, 0, 0.5, 0.42, 0.6, 0.05), beak = P(G.cone, T(0xff9a1f), 0, 0, -0.62, 0.12, 0.3, 0.12, 0.02); beak.rotation.x = -Math.PI / 2;
      const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(P(G.box, T(0xffffff), -0.6, 0, 0, 1.2, 0.07, 0.5, 0.03)); wr.add(P(G.box, T(0xffffff), 0.6, 0, 0, 1.2, 0.07, 0.5, 0.03)); wl.position.x = -0.3; wr.position.x = 0.3;
      bird.add(body, beak, wl, wr); bird.scale.setScalar(1.8); root.add(bird); const R = rnd(26, 60), hh = rnd(2, 22), sp = rnd(0.12, 0.25) * (i % 2 ? 1 : -1), ph = rnd(0, TAU);
      c.anims.push(tm => { const a = tm * sp + ph; bird.position.set(Math.cos(a) * R, hh + Math.sin(tm * 1.5 + ph) * 1.2, Math.sin(a) * R); bird.rotation.y = -a + (sp > 0 ? Math.PI : 0); wl.rotation.z = Math.sin(tm * 9 + ph) * 0.6; wr.rotation.z = -Math.sin(tm * 9 + ph) * 0.6; });
    }
    // globos de colores
    for (let i = 0; i < 9; i++) { const g = new THREE.Group(), col = pick(cols); g.add(P(G.sph, T(col), 0, 0, 0, 1.7, 2.0, 1.7, 0.07), P(G.cone, T(col), 0, -2.1, 0, 0.35, 0.5, 0.35, 0.03), P(G.cyl, T(0xffffff), 0, -4, 0, 0.03, 3.4, 0.03, 0)); const an = rnd(0, TAU), d = rnd(35, 80); g.position.set(Math.cos(an) * d, rnd(-8, 28), Math.sin(an) * d); root.add(g); const b0 = g.position.y, ph = rnd(0, 6); c.anims.push(tm => { g.position.y = b0 + Math.sin(tm * 0.8 + ph) * 1.4; g.rotation.y = tm * 0.2; }); }
    // estrellas fugaces
    const shoot = [];
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.scale.set(0.35, 0.35, 12); m.visible = false; root.add(m); shoot.push({ m, t: rnd(1, 5), life: 0, v: new THREE.Vector3() }); }
    let lastT = 0; c.anims.push(tm => { const dt = Math.min(0.1, tm - lastT); lastT = tm; for (const s of shoot) { if (s.life > 0) { s.life -= dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.min(1, s.life * 2); if (s.life <= 0) { s.m.visible = false; s.t = rnd(3, 8); } } else { s.t -= dt; if (s.t <= 0) { const an = rnd(0, TAU); s.m.position.set(Math.cos(an) * 160, rnd(50, 110), Math.sin(an) * 160); s.v.set(-Math.cos(an) * 90, -rnd(20, 40), -Math.sin(an) * 90); s.m.lookAt(s.m.position.clone().add(s.v)); s.m.visible = true; s.life = 1.2; } } } });
    // cascadas de partículas azules desde las plataformas grandes
    [...map.solids].sort((a, b) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) - (a.max[0] - a.min[0]) * (a.max[2] - a.min[2])).slice(0, 4).forEach(s => {
      const w = s.max[0] - s.min[0]; root.add(pointsFall(c, 45, { x: (s.min[0] + s.max[0]) / 2, z: s.max[2] + 0.35, y: s.max[1] - 0.2, w: w * 0.3, d: 0.15 }, 0x8fe0ff, 0.9, 7, 24, { sizeAttenuation: true }));
    });
  };

  /* ============================== LABERINTO DE CAJAS ============================== */
  DECOR.maze = function (c) {
    const { THREE, Gfx, map } = c, T = Gfx.toon, P = Gfx.part, G = Gfx.G, b = map.bounds, root = new THREE.Group(); c.add(root);
    const faceMats = [0, 1].map(k => new THREE.MeshBasicMaterial({ map: Gfx.tex.face(k), transparent: true, depthWrite: false }));
    const walls = map.solids.filter(s => s.max[1] - s.min[1] > 6);
    // caras sonrientes en los cubos
    for (const s of walls) {
      const sx = s.max[0] - s.min[0], sz = s.max[2] - s.min[2], thinX = sx < sz, len = thinX ? sz : sx, th = thinX ? sx : sz, cxw = (s.min[0] + s.max[0]) / 2, czw = (s.min[2] + s.max[2]) / 2;
      for (const side of [-1, 1]) {
        if (Math.random() < 0.45) continue; const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), faceMats[Math.random() < 0.75 ? 0 : 1]), along = rnd(-1, 1) * (len / 2 - 2);
        if (thinX) { f.position.set(cxw + side * (th / 2 + 0.03), rnd(3.5, 5.5), czw + along); f.rotation.y = side * Math.PI / 2; } else { f.position.set(cxw + along, rnd(3.5, 5.5), czw + side * (th / 2 + 0.03)); f.rotation.y = side > 0 ? 0 : Math.PI; }
        root.add(f);
      }
      if (Math.random() < 0.28) { // cristal incrustado
        const cr = P(G.oct, Gfx.basic(pick([0x5ff5ff, 0xff7ad9, 0xb6ff5a]), 1.7), (thinX ? cxw + (Math.random() < 0.5 ? -1 : 1) * (th / 2) : cxw + rnd(-1, 1) * (len / 2 - 2)), rnd(1.5, 6), (thinX ? czw + rnd(-1, 1) * (len / 2 - 2) : czw + (Math.random() < 0.5 ? -1 : 1) * (th / 2)), 0.35, 0.9, 0.35, 0.03); cr.rotation.set(rnd(-0.5, 0.5), rnd(0, 6), rnd(-0.5, 0.5)); root.add(cr); c.anims.push(tm => { cr.scale.y = 0.9 + Math.sin(tm * 3 + cr.position.x) * 0.1; });
      }
    }
    const free = (x, z, m) => { for (const s of map.solids) if (x > s.min[0] - m && x < s.max[0] + m && z > s.min[2] - m && z < s.max[2] + m) return false; return true; };
    const spot = (m) => { for (let i = 0; i < 40; i++) { const x = rnd(b.min[0] + 1.5, b.max[0] - 1.5), z = rnd(b.min[2] + 1.5, b.max[2] - 1.5); if (free(x, z, m)) return [x, z]; } return null; };
    // setas gigantes
    for (let i = 0; i < 16; i++) {
      const p = spot(1.6); if (!p) continue; const g = new THREE.Group(), sc = rnd(0.8, 2.4), capCol = pick([0xff4a5a, 0xff8ad0, 0xffb14a, 0x9a6bff]);
      g.add(P(G.cyl, T(0xfff0d6), 0, 0.45, 0, 0.26, 0.9, 0.26, 0.04)); const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI / 2), T(capCol)); cap.scale.set(0.95, 0.6, 0.95); cap.position.y = 0.85; Gfx.addOutline(cap, 0.04); g.add(cap);
      for (let k = 0; k < 4; k++) { const a = k * 1.7; g.add(P(G.sph, T(0xffffff), Math.cos(a) * 0.5, 1.28 - k * 0.04, Math.sin(a) * 0.5, 0.13, 0.05, 0.13, 0)); }
      g.position.set(p[0], b.min[1], p[1]); g.scale.setScalar(sc); root.add(g);
    }
    // plantas cartoon
    for (let i = 0; i < 16; i++) { const p = spot(1.2); if (!p) continue; const g = new THREE.Group(); for (let k = 0; k < 6; k++) { const leaf = P(G.cone, T(pick([0x2fb86a, 0x45d27c, 0x7ae04a])), 0, 0.6, 0, 0.22, 1.2 + rnd(0, 0.5), 0.12, 0.03), a = k / 6 * TAU; leaf.position.set(Math.cos(a) * 0.2, 0.65, Math.sin(a) * 0.2); leaf.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5); g.add(leaf); } g.add(P(G.cyl, T(0xc8744a), 0, 0.2, 0, 0.35, 0.4, 0.35, 0.04)); g.position.set(p[0], b.min[1], p[1]); g.scale.setScalar(rnd(0.9, 1.7)); root.add(g); }
    // cristales sueltos
    for (let i = 0; i < 10; i++) { const p = spot(1.2); if (!p) continue; const g = new THREE.Group(), col = pick([0x5ff5ff, 0xff7ad9, 0xb6ff5a]); for (let k = 0; k < 3; k++) { const cr = P(G.oct, Gfx.basic(col, 1.6), rnd(-0.3, 0.3), 0.7 + k * 0.1, rnd(-0.3, 0.3), 0.26, 0.9 + k * 0.25, 0.26, 0.03); cr.rotation.set(rnd(-0.3, 0.3), rnd(0, 6), rnd(-0.3, 0.3)); g.add(cr); } g.position.set(p[0], b.min[1], p[1]); root.add(g); c.anims.push(tm => { g.rotation.y = tm * 0.4; }); }
    // cofres del tesoro
    for (let i = 0; i < 5; i++) { const p = spot(1.6); if (!p) continue; const g = new THREE.Group(); g.add(P(G.box, T(0x9a5a2a), 0, 0.4, 0, 1.4, 0.8, 0.95, 0.05)); const lid = P(G.cyl, T(0xb26a32), 0, 0.85, 0, 0.47, 1.4, 0.47, 0.05); lid.rotation.z = Math.PI / 2; g.add(lid, P(G.box, T(0xffd93d, { emissive: 0x6a4a00 }), 0, 0.55, -0.49, 0.28, 0.3, 0.06, 0.03), P(G.box, T(0xffd93d), 0, 0.4, 0, 1.46, 0.12, 1.0, 0.03)); g.position.set(p[0], b.min[1], p[1]); g.rotation.y = rnd(0, 6); root.add(g); }
    // charcos de colores
    for (let i = 0; i < 9; i++) { const p = spot(1.8); if (!p) continue; const m = new THREE.Mesh(G.circ, new THREE.MeshBasicMaterial({ color: pick([0xff7ad9, 0x6ad0ff, 0xffe066, 0xb6ff5a]), transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(p[0], b.min[1] + 0.04, p[1]); m.scale.set(rnd(1, 2.4), rnd(1, 2.2), 1); root.add(m); }
    // banderas ondeando sobre los muros
    const flags = [];
    for (let i = 0; i < 9 && walls.length; i++) { const s = pick(walls), g = new THREE.Group(), col = pick([0xff3d4a, 0xffd93d, 0x2fa8ff, 0xa55bff, 0x3ddc4a]); g.add(P(G.cyl, T(0xe8e0d0), 0, 1.6, 0, 0.07, 3.2, 0.07, 0.03)); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), T(col, { side: THREE.DoubleSide })); fl.position.set(0.9, 2.7, 0); g.add(fl); g.position.set((s.min[0] + s.max[0]) / 2 + rnd(-1, 1), s.max[1], (s.min[2] + s.max[2]) / 2 + rnd(-1, 1)); root.add(g); flags.push({ fl, ph: rnd(0, 6) }); }
    // puentes de cuerda animados entre los muros
    const bridges = []; const thin = walls.filter(s => (s.max[0] - s.min[0]) < (s.max[2] - s.min[2]));
    for (let i = 0; i < thin.length && bridges.length < 6; i++) for (let j = i + 1; j < thin.length && bridges.length < 6; j++) {
      const a = thin[i], d = thin[j], za = (a.min[2] + a.max[2]) / 2, zb = (d.min[2] + d.max[2]) / 2, gap = (d.min[0] + d.max[0]) / 2 - (a.min[0] + a.max[0]) / 2;
      if (Math.abs(za - zb) < 0.1 && Math.abs(gap) > 5 && Math.abs(gap) < 8.5 && Math.random() < 0.5) {
        const x0 = (a.max[0] + (gap > 0 ? 0 : a.min[0] - a.max[0])), x1 = gap > 0 ? d.min[0] : d.max[0], g = new THREE.Group(), len = Math.abs(x1 - x0), n = Math.round(len / 0.6);
        for (let k = 0; k < n; k++) { const t = k / (n - 1), pl = P(G.box, T(0xb07a42), (t - 0.5) * len, -Math.sin(t * Math.PI) * 0.25, 0, 0.5, 0.1, 1.5, 0.02); g.add(pl); }
        for (const sz of [-0.75, 0.75]) { const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3((t - 0.5) * len, 0.55 - Math.sin(t * Math.PI) * 0.25, sz)); } g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.045, 5), T(0xe8d3a0))); }
        g.position.set((x0 + x1) / 2, (a.max[1] + 0.2), za); root.add(g); bridges.push({ g, ph: rnd(0, 6) });
      }
    }
    // nubes de algodón de azúcar de fondo
    const cm = T(0xffffff, { emissive: 0xffc0e0, emissiveIntensity: 0.35 }); for (let i = 0; i < 12; i++) { const cl = Gfx.cloud(rnd(6, 11), cm), an = rnd(0, TAU), d = rnd(60, 120); cl.position.set(Math.cos(an) * d, rnd(25, 60), Math.sin(an) * d); cl.children.forEach(m => Gfx.addOutline(m, 0.14)); root.add(cl); }
    c.anims.push(tm => { flags.forEach(f => { f.fl.rotation.y = Math.sin(tm * 3 + f.ph) * 0.35; f.fl.scale.x = 1 + Math.sin(tm * 5 + f.ph) * 0.08; }); bridges.forEach(br => { br.g.rotation.z = Math.sin(tm * 1.5 + br.ph) * 0.015; br.g.position.y += Math.sin(tm * 2 + br.ph) * 0.0015; }); });
  };

  /* ============================== VOLCÁN CARTOON ============================== */
  DECOR.volcano = function (c) {
    const { THREE, Gfx, map } = c, T = Gfx.toon, P = Gfx.part, G = Gfx.G, b = map.bounds, root = new THREE.Group(); c.add(root);
    const dark = T(0x4a2a22); dark.flatShading = true;
    // volcán gigante y volcanes pequeños con humo
    const volcanoes = [[0, -120, 75, 58], [-95, -105, 36, 28], [100, -95, 42, 32], [-130, 20, 30, 24], [125, 40, 34, 26]];
    const smokes = [];
    for (const [x, z, h, r] of volcanoes) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10, 1, true), dark); cone.position.set(x, h / 2 - 2, z); Gfx.addOutline(cone, 0.35); root.add(cone);
      const cr = new THREE.Mesh(G.circ, Gfx.basic(0xff6a1f, 1.5)); cr.rotation.x = -Math.PI / 2; cr.scale.setScalar(r * 0.18); cr.position.set(x, h - 2 + 0.2, z); root.add(cr);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x3a3030, transparent: true, opacity: 0.6, depthWrite: false })); s.userData = { p: i / 6, x, y: h - 2, z, r: r * 0.12 }; root.add(s); smokes.push(s); }
    }
    // rocas flotantes grises decorativas con contorno negro
    for (let i = 0; i < 12; i++) { const m = T(0x707080); m.flatShading = true; const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(2, 5), 0), m); Gfx.addOutline(rock, 0.18); const an = rnd(0, TAU), d = rnd(45, 95); rock.position.set(Math.cos(an) * d, rnd(6, 45), Math.sin(an) * d); rock.rotation.set(rnd(0, 6), rnd(0, 6), 0); rock.userData.b = rnd(0, 6); root.add(rock); c.anims.push(tm => { rock.position.y += Math.sin(tm * 0.6 + rock.userData.b) * 0.012; rock.rotation.y += 0.002; }); }
    const free = (x, z, m) => { for (const s of map.solids) if (x > s.min[0] - m && x < s.max[0] + m && z > s.min[2] - m && z < s.max[2] + m && s.min[1] < 2) return false; for (const l of map.lava) if (x > l.min[0] - m && x < l.max[0] + m && z > l.min[2] - m && z < l.max[2] + m) return false; return true; };
    const spot = m => { for (let i = 0; i < 50; i++) { const x = rnd(b.min[0] + 2, b.max[0] - 2), z = rnd(b.min[2] + 2, b.max[2] - 2); if (free(x, z, m)) return [x, z]; } return null; };
    // calaveras con ojos brillantes y huesos
    const bone = T(0xf1e8d2), eyeMat = Gfx.basic(0xff7a1f, 2);
    for (let i = 0; i < 9; i++) { const p = spot(2); if (!p) continue; const g = new THREE.Group(); g.add(P(G.sph, bone, 0, 0.7, 0, 0.7, 0.62, 0.62, 0.05), P(G.box, bone, 0, 0.25, -0.12, 0.5, 0.28, 0.4, 0.04)); for (const s of [-1, 1]) { g.add(P(G.sph, T(0x15101f), s * 0.25, 0.78, -0.5, 0.18, 0.2, 0.1, 0)); const e = new THREE.Mesh(G.sph, eyeMat); e.scale.set(0.09, 0.1, 0.06); e.position.set(s * 0.25, 0.78, -0.57); g.add(e); } g.position.set(p[0], b.min[1], p[1]); g.rotation.y = rnd(0, 6); g.scale.setScalar(rnd(1, 1.8)); root.add(g); }
    for (let i = 0; i < 12; i++) { const p = spot(1.5); if (!p) continue; const g = new THREE.Group(); for (const a of [0.6, -0.6]) { const bn = P(G.cyl, bone, 0, 0.12, 0, 0.1, 1.6, 0.1, 0.03); bn.rotation.z = Math.PI / 2; bn.rotation.y = a; bn.add(P(G.sph, bone, 0, 0.8, 0, 1.6, 0.16, 1.6, 0.03), P(G.sph, bone, 0, -0.8, 0, 1.6, 0.16, 1.6, 0.03)); g.add(bn); } g.position.set(p[0], b.min[1] + 0.1, p[1]); g.rotation.y = rnd(0, 6); root.add(g); }
    // antorchas con llamas animadas
    const flames = [];
    const torchSpots = [[b.min[0] + 1.5, b.min[2] + 1.5], [b.max[0] - 1.5, b.min[2] + 1.5], [b.min[0] + 1.5, b.max[2] - 1.5], [b.max[0] - 1.5, b.max[2] - 1.5], [0, b.min[2] + 1.5], [0, b.max[2] - 1.5], [b.min[0] + 1.5, 0], [b.max[0] - 1.5, 0]];
    torchSpots.forEach(([x, z], i) => {
      const g = new THREE.Group(); g.add(P(G.cyl, T(0x6a4a30), 0, 1.6, 0, 0.14, 3.2, 0.14, 0.04), P(G.cyl, T(0x3a3a48), 0, 3.3, 0, 0.45, 0.4, 0.45, 0.05));
      const f1 = new THREE.Mesh(G.cone, Gfx.basic(0xff7a1f, 1.8)), f2 = new THREE.Mesh(G.cone, Gfx.basic(0xffd84a, 1.8)); f1.scale.set(0.42, 1.2, 0.42); f2.scale.set(0.25, 0.8, 0.25); f1.position.y = 4.1; f2.position.y = 3.9; g.add(f1, f2);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: Gfx.tex.glow(), color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.y = 4; gl.scale.setScalar(5); g.add(gl);
      g.position.set(x, b.min[1], z); root.add(g); flames.push({ f1, f2, gl, ph: i * 1.3 });
    });
    for (const l of map.lava.slice(0, 2)) { const pl = new THREE.PointLight(0xff5a1f, 22, 40); pl.position.set((l.min[0] + l.max[0]) / 2, 4, (l.min[2] + l.max[2]) / 2); root.add(pl); }
    // ceniza cayendo
    root.add(pointsFall(c, 260, { x: 0, z: 0, y: b.max[1], w: b.max[0], d: b.max[2] }, 0xd9cfc8, 0.55, 2.2, b.max[1], { sizeAttenuation: true }));
    // brasas ascendentes
    const N = 140, pos = new Float32Array(N * 3), sp = new Float32Array(N); for (let i = 0; i < N; i++) { pos[i * 3] = rnd(b.min[0], b.max[0]); pos[i * 3 + 1] = rnd(0, 30); pos[i * 3 + 2] = rnd(b.min[2], b.max[2]); sp[i] = rnd(1.5, 4); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa033, size: 0.5, transparent: true, opacity: 0.95, depthWrite: false })); embers.frustumCulled = false; root.add(embers);
    const floorMesh = c.world.children.find(o => o.isMesh && o.material && o.material.emissiveMap); let last = 0;
    c.anims.push(tm => {
      const dt = Math.min(0.1, tm - last); last = tm;
      flames.forEach(f => { const k = 1 + Math.sin(tm * 12 + f.ph) * 0.12 + Math.sin(tm * 23 + f.ph) * 0.06; f.f1.scale.set(0.42 * k, 1.2 * k, 0.42 * k); f.f2.scale.set(0.25, 0.8 * (2 - k), 0.25); f.gl.material.opacity = 0.6 + Math.sin(tm * 9 + f.ph) * 0.2; });
      smokes.forEach(s => { const u = s.userData; u.p = (u.p + dt * 0.05) % 1; s.position.set(u.x + Math.sin(u.p * 8 + s.id) * u.r, u.y + u.p * 40, u.z); s.scale.setScalar(u.r * (0.7 + u.p * 1.6)); s.material.opacity = 0.6 * (1 - u.p); });
      const a = embers.geometry.attributes.position; for (let i = 0; i < N; i++) { let y = a.getY(i) + sp[i] * dt; if (y > 34) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(tm + i) * dt * 0.7); } a.needsUpdate = true;
      if (floorMesh) floorMesh.material.emissiveIntensity = 0.38 + Math.sin(tm * 1.6) * 0.2; // grietas que pulsan
    });
  };

  window.RAMaps = { decorate(ctx) { const f = DECOR[ctx.map.id]; if (f) f(ctx); } };
})();
