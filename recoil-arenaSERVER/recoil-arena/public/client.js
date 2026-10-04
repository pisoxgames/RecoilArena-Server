'use strict';
/* =====================================================================
   RECOIL ARENA 3D - client.js (ENTREGA 3)
   Cliente principal: render Three.js, red Socket.io, predicción local,
   interpolación, HUD, efectos, menús, lobby, amigos, ajustes, tutorial.
   Hooks opcionales (Entrega 4):
     RAudio.play(name,{x,y,z}) | RAudio.music(name) | RAudio.setVolumes(sfx,music) | RAudio.listener(x,y,z,yaw,pitch)
     RAMaps.decorate({THREE,scene,world,map,theme,add})
     RAShop  (usa window.RA.coins/skin/emotes y el evento 'coins')
   ===================================================================== */
(function () {
  const THREE = window.THREE, FX = window.THREE_FX, UI = window.UI, I18N = window.I18N;
  if (!THREE || !UI || !I18N) { console.error('client.js: faltan THREE/UI/I18N'); return; }
  const $ = id => document.getElementById(id), tr = (k, p) => I18N.t(k, p);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, rnd = (a, b) => a + Math.random() * (b - a);
  const sfx = (n, o) => { try { window.RAudio && window.RAudio.play && window.RAudio.play(n, o); } catch (e) {} };
  const music = n => { try { window.RAudio && window.RAudio.music && window.RAudio.music(n); } catch (e) {} };
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const dirFrom = (yaw, pitch) => { const c = Math.cos(pitch); return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c]; };

  /* ---------------------- AJUSTES / MONEDAS / API PÚBLICA ---------------------- */
  const IS_TOUCH = document.documentElement.classList.contains('touch');
  const DEF = { sfx: 70, music: 50, sens: 40, blur: true, shake: true, quality: IS_TOUCH ? 'low' : 'mid', hud: 100, cb: 'none', reduce: false, aimAssist: true };
  const ST = Object.assign({}, DEF, ls.get('ra_settings', {}));
  const coinsGet = () => parseInt(localStorage.getItem('ra_coins') || '0', 10) || 0;
  function coinsSet(n) { n = Math.max(0, n | 0); localStorage.setItem('ra_coins', String(n)); ['menuCoins', 'shopCoins'].forEach(id => { const e = $(id); if (e) e.textContent = n; }); window.dispatchEvent(new CustomEvent('coins', { detail: n })); }
  const SKIN_EMOJI = { default: '🟦', robot: '🤖', ghost: '👻', ninja: '🥷', clown: '🤡', alien: '👽', gold: '👑' };
  const RA = window.RA = {
    coins: { get: coinsGet, set: coinsSet, add: n => coinsSet(coinsGet() + n), spend(n) { if (coinsGet() < n) return false; coinsSet(coinsGet() - n); return true; } },
    skin: { get: () => localStorage.getItem('ra_skin') || 'default', set(s) { localStorage.setItem('ra_skin', s); if (S.socket && S.socket.connected && S.authed) S.socket.emit('profile:update', { skin: s }); window.dispatchEvent(new CustomEvent('skinchange', { detail: s })); } },
    emotes: { get: () => { const a = ls.get('ra_emotes', null); return Array.isArray(a) && a.length === 4 ? a : ['wave', 'spin', 'robot', 'floss']; }, set: a => ls.set('ra_emotes', a) },
    owned: { get: () => ls.get('ra_owned', ['default', 'wave', 'spin', 'robot', 'floss']), set: a => ls.set('ra_owned', a) },
    settings: ST, skinEmoji: SKIN_EMOJI, sfx, toast: (m, ty) => UI.toast(m, ty)
  };

  /* ------------------------------- ESTADO ------------------------------- */
  const S = {
    socket: null, authed: false, name: localStorage.getItem('ra_name') || '', token: localStorage.getItem('ra_token') || '', id: null,
    room: null, screen: 'menu', map: null, cfg: null, players: new Map(), bullets: new Map(), offset: null, friends: [], requests: [],
    me: null, cd: { dash: 0, bomb: 0, grapple: 0 }, self: null, keys: {}, mouse: false, locked: false, spec: null, shake: 0, slow: 1, hitstop: 0, kick: 0,
    lastSend: 0, lastAim: '', seq: 0, tab: false, lastMini: 0, lastMusicMin: false, anims: [], fx: [], countdownTimer: null, menuActive: true, myCoinsGiven: false, touch: IS_TOUCH
  };

  /* ------------------------------- THREE ------------------------------- */
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
  const Gfx = window.RAGfx; if (!Gfx) { console.error('client.js: falta gfx.js'); return; }
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7ad0, 2.0), sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(20, 40, 10);
  scene.add(hemi, sun);
  const world = new THREE.Group(), actors = new THREE.Group(); scene.add(world, actors);
  const vm = Gfx.makeViewmodel(); // arma en primera persona (se renderiza en un 2º pase, sin atravesar paredes)
  // Pase final: motion blur radial + color grading saturado/contrastado + viñeteado + gamma
  const PostShader = {
    uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, sat: { value: 1.08 }, con: { value: 1.08 }, vig: { value: 0.3 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform sampler2D tDiffuse;uniform float amt,sat,con,vig;varying vec2 vUv;void main(){vec2 d=vUv-0.5;vec4 c=vec4(0.0);for(int i=0;i<6;i++){float s=1.0-amt*float(i)*0.03;c+=texture2D(tDiffuse,0.5+d*s);}c/=6.0;vec3 col=c.rgb;float l=dot(col,vec3(0.299,0.587,0.114));col=mix(vec3(l),col,sat);col=(col-0.5)*con+0.5;col*=1.0-vig*smoothstep(0.3,0.95,length(d)*1.5);gl_FragColor=vec4(pow(max(col,0.0),vec3(1.0/2.2)),c.a);}'
  };
  let composer = null, bloom = null, blurPass = null, vmPass = null;
  function setupComposer() {
    if (!FX || ST.quality === 'low') { composer = null; return; }
    if (!composer) {
      composer = new FX.EffectComposer(renderer); composer.addPass(new FX.RenderPass(scene, camera));
      vmPass = new FX.RenderPass(vm.scene, vm.camera); vmPass.clear = false; vmPass.clearDepth = true; composer.addPass(vmPass);
      bloom = new FX.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.55, 1.0); composer.addPass(bloom);
      blurPass = new FX.ShaderPass(PostShader); composer.addPass(blurPass);
    }
    bloom.strength = ST.quality === 'high' ? 0.85 : 0.6;
  }
  function resize() {
    const pr = ST.quality === 'high' ? Math.min(devicePixelRatio, 2) : ST.quality === 'mid' ? Math.min(devicePixelRatio, 1.5) : (IS_TOUCH ? Math.min(devicePixelRatio, 1.5) : 1);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    vm.camera.aspect = camera.aspect; vm.camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
  }
  addEventListener('resize', resize);

  /* ------------------------------- AVATARES ------------------------------- */
  const SKIN_COL = Gfx.SKIN, GEO = Gfx.G, EMI = { gold: 0x8a5a00, ghost: 0x8fa0ff };
  const labelCache = new Map();
  function makeLabel(text) {
    if (labelCache.has(text)) return labelCache.get(text).clone();
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '900 34px Nunito, "Trebuchet MS", sans-serif'; x.textAlign = 'center'; x.lineWidth = 7; x.lineJoin = 'round'; x.strokeStyle = '#111'; x.strokeText(text, 128, 44); x.fillStyle = '#fff'; x.fillText(text, 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(3, 0.75, 1); sp.renderOrder = 10;
    labelCache.set(text, sp); return sp.clone();
  }
  function makeAvatar(skin, name, showLabel) {
    const g = Gfx.makeAvatar(skin);
    if (showLabel) { const label = makeLabel(name); label.position.y = 1.5; g.add(label); g.userData.label = label; }
    return g;
  }
  function animateEmote(a, id, tm) {
    const { body, armL, armR } = a.userData, pi = Math.PI;
    body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); body.scale.setScalar(1); armL.position.set(-0.62, -0.1, -0.1); armR.position.set(0.62, -0.1, -0.1);
    switch (id) {
      case 'robot': { const s = Math.floor(tm * 4) % 4; body.rotation.y = (s - 1.5) * 0.6; armL.position.y = s % 2 ? 0.5 : -0.1; armR.position.y = s % 2 ? -0.1 : 0.5; break; }
      case 'wave': body.position.y = Math.abs(Math.sin(tm * 6)) * 0.35; armR.position.set(0.7, 0.5 + Math.sin(tm * 12) * 0.25, -0.1); break;
      case 'spin': body.rotation.y = tm * 14; break;
      case 'moonwalk': body.rotation.x = -0.35; body.position.z = Math.sin(tm * 6) * 0.25; armL.position.z = Math.sin(tm * 6) * 0.4; armR.position.z = -Math.sin(tm * 6) * 0.4; break;
      case 'floss': body.rotation.z = Math.sin(tm * 10) * 0.4; armL.position.set(-0.8 + Math.sin(tm * 10) * 0.4, 0, 0); armR.position.set(0.8 + Math.sin(tm * 10) * 0.4, 0, 0); break;
      case 'breakdance': body.rotation.z = pi; body.rotation.y = tm * 10; body.position.y = 0.5; armL.position.y = 0.6; armR.position.y = 0.6; break;
      case 'kpop': body.position.y = Math.abs(Math.sin(tm * 8)) * 0.6; body.rotation.y = Math.sin(tm * 4) * 0.8; armL.position.y = Math.sin(tm * 8) * 0.5; armR.position.y = -Math.sin(tm * 8) * 0.5; break;
      case 'victory': body.position.y = Math.abs(Math.sin(tm * 5)) * 0.8; armL.position.set(-0.7, 0.8, 0); armR.position.set(0.7, 0.8, 0); body.scale.setScalar(1 + Math.sin(tm * 10) * 0.05); break;
    }
    if (a.userData.tail) a.userData.tail.rotation.y = Math.sin(tm * 6) * 0.4;
  }

  RA.input = { // API para controles táctiles (touch.js)
    look(dx, dy) { if (S.screen !== 'game' || !S.me) return; const k = (0.0006 + (ST.sens / 100) * 0.0042) * 1.7; S.me.yaw -= dx * k; S.me.pitch = clamp(S.me.pitch - dy * k, -1.5, 1.5); },
    fire(on) { S.mouse = !!on; },
    aimAssist: () => !!(S.touch && ST.aimAssist),
    isGame: () => S.screen === 'game' && !!S.me, alive: () => !!(S.me && S.me.alive), emotes: () => RA.emotes.get()
  };
  RA.preview = { THREE, Gfx, animateEmote }; // la tienda renderiza modelos 3D reales y bailes reales

  /* ------------------------- MUNDO / MAPAS (geometría del servidor) ------------------------- */
  const TH = {
    arena: { dome: [0x0a0530, 0x3a1a8a, 0x0b0626], fog: 0x24106a, near: 70, far: 240, hemi: [0xc9bfff, 0x4a2c9a, 1.6], sun: [0xffffff, 1.0], solid: 0x5b3fe0, edge: 0x19e5ff, glass: 0x7a6cff },
    sky: { dome: [0x4aaeff, 0xcdeeff, 0xffe0f4], fog: 0xcdeeff, near: 100, far: 360, hemi: [0xffffff, 0xb7a2ff, 2.0], sun: [0xfff2d0, 1.2], solid: 0x9a6b45, edge: 0x3a2a1a, glass: 0xffffff },
    maze: { dome: [0xff93cc, 0xffe6c9, 0xd9ffe8], fog: 0xffe6c9, near: 55, far: 190, hemi: [0xffffff, 0xffc3dc, 2.0], sun: [0xfff0dd, 1.2], solid: 0xff9ecb, edge: 0x2a1a3a, glass: 0xffffff },
    volcano: { dome: [0x2a0804, 0xff6a2a, 0x3a0b05], fog: 0x8a2c12, near: 60, far: 230, hemi: [0xffc9a0, 0x7a2412, 1.7], sun: [0xffb070, 1.25], solid: 0x6f6f7a, edge: 0x111111, glass: 0xff7a3a }
  };
  const MENU_MAP = { id: 'sky', bounds: { min: [-60, -40, -60], max: [60, 50, 60] }, floor: false, walls: false, solids: [{ min: [-8, -0.8, -8], max: [8, 0.8, 8] }, { min: [14, 4, -6], max: [22, 5.6, 2] }, { min: [-24, 2, 4], max: [-14, 3.6, 12] }], trampolines: [], portals: [], lava: [], gravityZones: [], spawns: [] };
  function clearWorld() {
    S.anims.length = 0;
    while (world.children.length) {
      const o = world.children.pop();
      o.traverse(c => {
        if (c.geometry && !(c.geometry.userData && c.geometry.userData.keep)) c.geometry.dispose();
        const mt = c.material; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach(x => { if (x.userData && x.userData.keep) return; if (x.map && !x.map.userData.keep) x.map.dispose(); x.dispose(); });
      });
    }
  }
  const sizeOf = s => [s.max[0] - s.min[0], s.max[1] - s.min[1], s.max[2] - s.min[2]], centerOf = s => [(s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2];
  function solid(s, mat, ol) {
    const z = sizeOf(s), c = centerOf(s), m = new THREE.Mesh(new THREE.BoxGeometry(z[0], z[1], z[2]), mat); m.position.set(c[0], c[1], c[2]); Gfx.addOutline(m, ol || 0.1); world.add(m); return m;
  }
  function island(s, o) { // plataforma flotante: losa (colisión) + capa superior + roca colgante
    const z = sizeOf(s), c = centerOf(s), g = new THREE.Group(); g.position.set(c[0], c[1], c[2]); world.add(g);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(z[0], z[1], z[2]), Gfx.toon(o.side)); Gfx.addOutline(slab, 0.13); g.add(slab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(z[0] + 0.12, 0.3, z[2] + 0.12), Gfx.toon(o.top)); top.position.y = z[1] / 2 - 0.05; g.add(top);
    const r = Math.min(z[0], z[2]) * 0.47, ch = Math.min(z[0], z[2]) * o.depth, mt = Gfx.toon(o.rock); mt.flatShading = true;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 7, 1), mt); cone.rotation.x = Math.PI; cone.rotation.y = rnd(0, 6); cone.position.y = -z[1] / 2 - ch / 2 + 0.2; Gfx.addOutline(cone, 0.13); g.add(cone);
    return g;
  }
  function portalTexture(hex) {
    const c = '#' + hex.toString(16).padStart(6, '0');
    const t = Gfx.canvasTex(128, 128, (x, w, h) => {
      const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.55, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 5; x.lineCap = 'round';
      for (let a = 0; a < 4; a++) { x.beginPath(); for (let k = 0; k < 1; k += 0.04) { const ang = a * Math.PI / 2 + k * 5, rr = 6 + k * 54; x.lineTo(64 + Math.cos(ang) * rr, 64 + Math.sin(ang) * rr); } x.stroke(); }
    }); t.center.set(0.5, 0.5); return t;
  }
  function buildWorld(map) {
    clearWorld(); S.map = map;
    const th = TH[map.id] || TH.arena, b = map.bounds, W = b.max[0] - b.min[0], H = b.max[1] - b.min[1], D = b.max[2] - b.min[2];
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    scene.background = new THREE.Color(th.fog); scene.fog = new THREE.Fog(th.fog, th.near, th.far);
    hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2]; sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
    const dome = Gfx.skyDome(th.dome[0], th.dome[1], th.dome[2], 450); world.add(dome); S.anims.push(() => dome.position.copy(camera.position));
    if (map.floor) { // suelo con textura procedural (rejilla neón / ajedrez / roca con grietas)
      let mat;
      if (map.id === 'arena') { mat = new THREE.MeshBasicMaterial({ map: Gfx.tex.grid([W / 4, D / 4], '#1a0f55', '#0d0833', '#22e8ff') }); mat.color.setScalar(1.3); }
      else if (map.id === 'volcano') { const t = Gfx.tex.rock([W / 9, D / 9]); mat = Gfx.toon(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }); }
      else mat = Gfx.toon(0xffffff, { map: Gfx.tex.checker([W / 7, D / 7], '#cdf8dc', '#b4eccb') });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, b.min[1], cz); world.add(fl);
    }
    if (map.walls) { // paredes de cristal semitransparente con marco
      const glass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshBasicMaterial({ color: th.glass, transparent: true, opacity: map.id === 'arena' ? 0.1 : 0.07, side: THREE.BackSide, depthWrite: false }));
      glass.position.set(cx, cy, cz); glass.renderOrder = 2; world.add(glass);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: th.edge })); edges.position.copy(glass.position); world.add(edges);
    }
    const pastel = [0xff8fc8, 0xffc98a, 0xa6f0a0, 0x86e6ff, 0xb5a8ff, 0xfff08a];
    map.solids.forEach((s, i) => {
      if (map.id === 'sky') island(s, { side: 0x9a6b45, top: 0x6cc36a, rock: 0x7a5236, depth: 0.75 });
      else if (map.id === 'volcano') island(s, { side: 0x5d5d6b, top: 0x3b3b46, rock: 0x45454f, depth: 0.6 });
      else solid(s, map.id === 'maze' ? Gfx.toon(pastel[i % pastel.length]) : Gfx.toon(th.solid, { emissive: 0x1a0c66, emissiveIntensity: 0.6 }), 0.1);
    });
    for (const tr of map.trampolines) {
      const g = new THREE.Group(); g.position.set(tr.x, tr.y, tr.z);
      const base = Gfx.part(GEO.cyl, Gfx.toon(0x2fbf4a), 0, 0.25, 0, tr.r, 0.5, tr.r, 0.08), pad = Gfx.part(GEO.cyl, Gfx.toon(0xffe066), 0, 0.58, 0, tr.r * 0.82, 0.16, tr.r * 0.82, 0.06);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(tr.r * 0.86, 0.08, 8, 32), Gfx.basic(0x7dffb0, 1.7)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.68;
      const arrow = Gfx.part(GEO.cone, Gfx.basic(0xffffff, 1.5), 0, 1.5, 0, 0.5, 0.8, 0.5, 0);
      g.add(base, pad, ring, arrow); world.add(g);
      S.anims.push(tm => { pad.scale.y = 0.16 + Math.sin(tm * 8) * 0.03; arrow.position.y = 1.5 + Math.abs(Math.sin(tm * 3)) * 0.6; ring.scale.setScalar(1 + Math.sin(tm * 4) * 0.04); });
    }
    for (const pt of map.portals) for (const [Pp, col] of [[pt.a, 0x2fa8ff], [pt.b, 0xff9a1f]]) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Pp.nx, Pp.ny, Pp.nz)), tx = portalTexture(col);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(pt.r, 0.34, 12, 40), Gfx.toon(col, { emissive: col, emissiveIntensity: 0.5 })); Gfx.addOutline(ring, 0.08);
      const dm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.DoubleSide, depthWrite: false }); dm.color.setScalar(1.4);
      const disc = new THREE.Mesh(GEO.circ, dm); disc.scale.set(pt.r * 1.02, pt.r * 1.02, 1);
      const grp = new THREE.Group(); grp.position.set(Pp.x, Pp.y, Pp.z); grp.quaternion.copy(q); grp.add(ring, disc); world.add(grp);
      S.anims.push(tm => { tx.rotation = tm * 1.5; dm.opacity = 0.8 + Math.sin(tm * 4) * 0.15; });
    }
    for (const lv of map.lava) { // ríos de lava animados con brillo
      const z = sizeOf(lv), c = centerOf(lv), t = Gfx.tex.lava([z[0] / 7, z[2] / 7]);
      const sideM = Gfx.toon(0x7a1a08, { emissive: 0xff3a0a, emissiveIntensity: 0.8 }), box = new THREE.Mesh(new THREE.BoxGeometry(z[0], z[1], z[2]), sideM); box.position.set(c[0], c[1], c[2]); world.add(box);
      const lm = new THREE.MeshBasicMaterial({ map: t }); lm.color.setScalar(1.3); const top = new THREE.Mesh(new THREE.PlaneGeometry(z[0], z[2]), lm); top.rotation.x = -Math.PI / 2; top.position.set(c[0], lv.max[1] + 0.02, c[2]); world.add(top);
      S.anims.push(tm => { t.offset.set(tm * 0.03, tm * 0.02); if (Math.random() < 0.06) burst(rnd(lv.min[0], lv.max[0]), lv.max[1] + 0.3, rnd(lv.min[2], lv.max[2]), 3, 0xffa030, 3, 0.2, 0.8, -4); });
    }
    for (const zn of map.gravityZones) { // zonas de gravedad loca: caja violeta con flechas
      const z = sizeOf(zn), c = centerOf(zn), gc = new THREE.Group(); gc.position.set(c[0], c[1], c[2]); world.add(gc);
      gc.add(new THREE.Mesh(new THREE.BoxGeometry(z[0], z[1], z[2]), new THREE.MeshBasicMaterial({ color: 0xb06bff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })));
      gc.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(z[0], z[1], z[2])), new THREE.LineBasicMaterial({ color: 0xd9b3ff })));
      const gd = new THREE.Vector3(zn.g[0], zn.g[1], zn.g[2]).normalize(), L = Math.abs(gd.x) * z[0] + Math.abs(gd.y) * z[1] + Math.abs(gd.z) * z[2], arrows = [];
      for (let i = 0; i < 8; i++) { const a = new THREE.Mesh(GEO.cone, Gfx.basic(0xe3c8ff, 1.6)); a.scale.set(0.3, 0.6, 0.3); a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gd); a.userData.o = [rnd(-0.4, 0.4) * z[0], rnd(-0.4, 0.4) * z[1], rnd(-0.4, 0.4) * z[2], rnd(0, 1)]; gc.add(a); arrows.push(a); }
      S.anims.push(tm => arrows.forEach(a => { const o = a.userData.o, p = ((tm * 0.35 + o[3]) % 1 - 0.5) * L; a.position.set(o[0] * (1 - Math.abs(gd.x)) + gd.x * p, o[1] * (1 - Math.abs(gd.y)) + gd.y * p, o[2] * (1 - Math.abs(gd.z)) + gd.z * p); }));
    }
    try { if (window.RAMaps && window.RAMaps.decorate) window.RAMaps.decorate({ THREE, Gfx, scene, world, map, theme: th, add: o => world.add(o), anims: S.anims, camera, burst, rnd, S }); } catch (e) { console.warn('RAMaps.decorate', e); }
  }

  /* --------------------------- PARTÍCULAS Y EFECTOS --------------------------- */
  const pool = [], PMAX = 400;
  const pGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < PMAX; i++) { const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; m.userData = { life: 0, max: 1, v: new THREE.Vector3(), g: 0, s: 0.2 }; scene.add(m); pool.push(m); }
  let pIdx = 0;
  function P(x, y, z, vx, vy, vz, color, size, life, grav) { const m = pool[pIdx = (pIdx + 1) % PMAX], u = m.userData; m.position.set(x, y, z); u.v.set(vx, vy, vz); u.life = u.max = life; u.g = grav || 0; u.s = size; m.material.color.setHex(color); m.visible = true; }
  function burst(x, y, z, n, color, spd, size, life, grav) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), e = rnd(-1, 1), r = Math.sqrt(1 - e * e), s = rnd(0.3, 1) * spd; P(x, y, z, Math.cos(a) * r * s, e * s, Math.sin(a) * r * s, color, size * rnd(0.6, 1.2), life * rnd(0.6, 1), grav); } }

  // Confeti de colores (cuadrados y triángulos) con gravedad suave
  const confPool = [], CMAX = 160, CC = [0xff3d4a, 0xffd93d, 0x3ddc4a, 0x2fa8ff, 0xa55bff, 0xff8a1f, 0xff6ab5];
  const sqGeo = new THREE.PlaneGeometry(0.7, 0.7), triGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.5); sh.lineTo(-0.45, -0.35); sh.lineTo(0.45, -0.35); sh.closePath(); return new THREE.ShapeGeometry(sh); })();
  for (let i = 0; i < CMAX; i++) { const m = new THREE.Mesh(i % 2 ? triGeo : sqGeo, new THREE.MeshBasicMaterial({ color: CC[i % 7], side: THREE.DoubleSide })); m.visible = false; m.userData = { life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() }; scene.add(m); confPool.push(m); }
  let cIdx = 0;
  function confetti(x, y, z, n) { for (let i = 0; i < n; i++) { const m = confPool[cIdx = (cIdx + 1) % CMAX], u = m.userData; m.position.set(x, y, z); m.scale.setScalar(rnd(0.22, 0.4)); u.v.set(rnd(-1, 1) * 9, rnd(0.2, 1) * 10, rnd(-1, 1) * 9); u.spin.set(rnd(-1, 1) * 8, rnd(-1, 1) * 8, rnd(-1, 1) * 8); u.life = rnd(1.4, 2.2); m.visible = true; } }
  function addFx(obj, life, upd) { scene.add(obj); S.fx.push({ obj, life, max: life, upd }); }
  function shockwave(x, y, z, R, color) { const m = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false })); m.position.set(x, y, z); addFx(m, 0.5, (o, k) => { o.scale.setScalar(0.5 + R * k); o.material.opacity = 0.45 * (1 - k); }); }
  function floatText(text, x, y, z, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const cx = c.getContext('2d');
    cx.font = '900 84px "Fredoka One", Nunito, sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 14; cx.strokeStyle = '#111'; cx.strokeText(text, 128, 92); cx.fillStyle = color || '#ffd93d'; cx.fillText(text, 128, 92);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.position.set(x, y + 1, z); sp.scale.set(5, 2.5, 1); sp.renderOrder = 11;
    addFx(sp, 1.2, (o, k) => { o.position.y += 0.03; o.material.opacity = 1 - k * k; const s = 1 + Math.sin(Math.min(1, k * 4) * 3.14) * 0.4; o.scale.set(5 * s, 2.5 * s, 1); });
  }
  function beam(a, b, color) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]); addFx(new THREE.Line(g, new THREE.LineBasicMaterial({ color })), 0.45, (o, k) => { o.material.opacity = 1 - k; o.material.transparent = true; }); }
  function shake(a) { if (ST.shake && !ST.reduce) S.shake = Math.max(S.shake, a); }
  function flash(color) { const f = $('fxFlash'); f.style.background = color || 'radial-gradient(transparent 35%,rgba(255,0,20,.75))'; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

  /* ------------------------------ JUGADORES ------------------------------ */
  function ensurePlayer(id, name, skin, isBot) {
    let p = S.players.get(id);
    if (!p) {
      const mesh3 = makeAvatar(skin || 'default', name || '?', id !== S.id); actors.add(mesh3);
      const blob = Gfx.makeBlob(); actors.add(blob);
      p = { id, name: name || '?', skin: skin || 'default', isBot: !!isBot, mesh: mesh3, blob, buf: [], flags: {}, emote: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hidden: false, alive: true, k: 0, d: 0, c: 0, pg: 0, emoteT: 0, phase: Math.random() * 6.28, trailUntil: 0, lastTrail: 0 };
      S.players.set(id, p);
    }
    return p;
  }
  function removePlayer(id) { const p = S.players.get(id); if (p) { actors.remove(p.mesh); actors.remove(p.blob); p.blob.material.dispose(); S.players.delete(id); } }
  function clearPlayers() { for (const id of [...S.players.keys()]) removePlayer(id); for (const b of S.bullets.values()) scene.remove(b.mesh); S.bullets.clear(); }
  const skinColor = p => SKIN_COL[p.skin] || 0x2fa8ff;
  function groundBelow(x, y, z) { // altura de la superficie bajo el jugador (para la sombra blob)
    const map = S.map; if (!map) return null; let best = null;
    for (const s of map.solids) if (x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2] && s.max[1] <= y + 0.3 && (best === null || s.max[1] > best)) best = s.max[1];
    if (map.floor && (best === null || map.bounds.min[1] > best)) best = map.bounds.min[1];
    return best;
  }

  /* ------------------------------- RED ------------------------------- */
  function emit(ev, d, cb) { if (S.socket && S.socket.connected) S.socket.emit(ev, d || {}, cb); }
  function errToast(r) { if (r && r.ok === false && r.key) UI.toast(tr(r.key), 'err'); }
  function doAuth(name, cb) {
    S.socket.emit('auth', { name, token: S.token, skin: RA.skin.get() }, r => {
      if (r && r.ok) {
        S.authed = true; S.name = r.name; S.token = r.token; S.id = r.id; localStorage.setItem('ra_name', r.name); localStorage.setItem('ra_token', r.token);
        $('menuHello').textContent = '👋 ' + r.name; S.friends = r.friends || []; S.requests = r.requests || []; renderFriends();
      }
      if (cb) cb(r);
    });
  }
  function initSocket() {
    const SERVER_URL = (function () { try { return (localStorage.getItem('ra_server') || window.RA_SERVER_URL || '').trim() || undefined; } catch (e) { return undefined; } })();
    const s = S.socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 3000 });
    s.on('connect', () => { $('connBanner').classList.add('hidden'); if (S.name) doAuth(S.name, r => { if (r && !r.ok) { S.authed = false; showNameModal(); $('nameErr').textContent = tr(r.key); } }); });
    s.on('disconnect', () => { S.authed = false; $('connBanner').classList.remove('hidden'); });
    s.on('sping', ack => { if (typeof ack === 'function') ack(); });
    s.on('notify', n => UI.toast(tr(n.key, n.p)));
    s.on('room:joined', d => { S.room = d.room; S.id = d.you; UI.panel(null); if (d.room.state !== 'playing') { S.screen = 'lobby'; showLobby(); } });
    s.on('room:update', r => { S.room = r; if (S.screen === 'lobby') renderLobby(); });
    s.on('room:left', () => { if (S.screen !== 'menu') goMenu(); S.room = null; });
    s.on('game:start', startGame);
    s.on('state', onState);
    s.on('spawn', onSpawn); s.on('kill', onKill); s.on('hit', onHit); s.on('shot', onShot); s.on('gameOver', onGameOver);
    s.on('bomb', d => { shockwave(d.x, d.y, d.z, d.r, 0xff9a1f); burst(d.x, d.y, d.z, 26, 0xffb347, 16, 0.3, 0.7); sfx('bomb', d); const m = S.me; if (m && Math.hypot(m.p[0] - d.x, m.p[1] - d.y, m.p[2] - d.z) < d.r) shake(0.6); });
    s.on('nuke', d => { shockwave(d.x, d.y, d.z, 60, 0xffffff); burst(d.x, d.y, d.z, 60, 0xffffff, 40, 0.5, 1.2); sfx('nuke', d); shake(1.2); flash('rgba(255,255,255,.9)'); });
    s.on('dash', d => { const p = S.players.get(d.id); if (p) { burst(p.pos.x, p.pos.y, p.pos.z, 12, 0x7fd4ff, 8, 0.25, 0.5); p.trailUntil = performance.now() + 550; } sfx('dash'); if (d.id === S.id) S.kick = 14; });
    s.on('grapple', d => { beam([d.ox, d.oy, d.oz], [d.tx, d.ty, d.tz], 0xa55bff); if (d.hit) burst(d.tx, d.ty, d.tz, 10, 0xa55bff, 6, 0.2, 0.4); sfx('grapple', { x: d.ox, y: d.oy, z: d.oz }); });
    s.on('jump', d => { burst(d.x, d.y - 0.5, d.z, 10, 0xffffff, 5, 0.2, 0.5); sfx('jump', d); });
    s.on('portal', d => { burst(d.x, d.y, d.z, 18, 0x66ccff, 10, 0.25, 0.6); sfx('portal', d); });
    s.on('trampoline', d => { shockwave(d.x, d.y + 0.4, d.z, 4, 0x3ddc4a); sfx('trampoline', d); });
    s.on('lava', d => { burst(d.x, d.y, d.z, 24, 0xff5a1f, 12, 0.3, 0.8, -8); sfx('lava', d); if (d.id === S.id) { flash(); shake(0.7); } });
    s.on('voidFall', d => { burst(d.x, d.y, d.z, 26, 0xffffff, 10, 0.3, 0.8); if (d.id === S.id && S.me) { S.me.p = [d.x, d.y, d.z]; S.me.v = [0, 0, 0]; UI.toast(tr('void_fall')); } });
    s.on('bounce', d => { burst(d.x, d.y, d.z, 6, 0xffee88, 6, 0.15, 0.3); sfx('bounce', d); });
    s.on('emote', d => { const p = S.players.get(d.id); if (p) { p.emote = d.emote; p.emoteT = 0; p.emoteDur = d.dur; } sfx('emote'); });
    s.on('roulette', onRoulette);
    s.on('powerup', d => { UI.toast(tr('pu_got', { name: tr('pu_' + d.type) }), 'ok'); sfx('powerup'); });
    s.on('powerupEnd', d => { UI.toast(tr('pu_expired')); });
    s.on('friends:status', d => { const f = S.friends.find(x => x.name.toLowerCase() === d.name.toLowerCase()); if (f) { f.status = d.status; renderFriends(); } });
    s.on('friends:online', d => { UI.toast(tr('friend_online', { name: d.name })); sfx('notify'); });
    s.on('friends:offline', d => UI.toast(tr('friend_offline', { name: d.name })));
    s.on('friends:request', d => { if (!S.requests.includes(d.from)) S.requests.push(d.from); renderFriends(); reqToast(d.from); });
    s.on('friends:accepted', d => { S.friends.push({ name: d.name, status: d.status }); renderFriends(); UI.toast(tr('friend_added', { name: d.name }), 'ok'); });
    s.on('invite:received', d => {
      const tt = UI.toast(tr('invite_received', { name: d.from }), '', 12000); sfx('notify');
      const a = document.createElement('button'); a.className = 'btn small green'; a.textContent = tr('accept'); a.onclick = () => { emit('room:join', { code: d.code }, errToast); tt.remove(); };
      const b = document.createElement('button'); b.className = 'btn small red'; b.textContent = tr('decline'); b.onclick = () => { emit('invite:decline', { from: d.from }); tt.remove(); };
      tt.append(a, b);
    });
  }
  function reqToast(from) {
    const tt = UI.toast(tr('request_from', { name: from }), '', 12000);
    const a = document.createElement('button'); a.className = 'btn small green'; a.textContent = tr('accept'); a.onclick = () => { respondReq(from, true); tt.remove(); };
    const b = document.createElement('button'); b.className = 'btn small red'; b.textContent = tr('decline'); b.onclick = () => { respondReq(from, false); tt.remove(); };
    tt.append(a, b);
  }

  /* ----------------------- INICIO / FIN DE PARTIDA ----------------------- */
  function startGame(d) {
    clearPlayers(); buildWorld(d.map); S.cfg = d.cfg; S.id = d.you; S.offset = null; S.menuActive = false; S.myCoinsGiven = false; S.lastMusicMin = false;
    for (const p of d.players) ensurePlayer(p.id, p.name, p.skin, p.isBot);
    S.me = { p: [0, 5, 0], v: [0, 0, 0], yaw: 0, pitch: 0, init: false, alive: true, djUsed: false, grounded: false, acc: 0, lastShot: 0, dashReady: 0, g: d.map.gravity };
    S.spec = null; S.screen = 'game'; UI.only('hud'); UI.panel(null); $('bigCount').classList.remove('hidden'); music('game');
    if (!S.touch && !document.pointerLockElement) canvas.requestPointerLock && canvas.requestPointerLock();
    let left = Math.ceil(d.startsIn / 1000); clearInterval(S.countdownTimer);
    const tick = () => { if (left > 0) { $('bigCount').textContent = left; $('bigCount').style.animation = 'none'; void $('bigCount').offsetWidth; $('bigCount').style.animation = ''; sfx('countdown'); left--; } else { $('bigCount').textContent = 'GO!'; sfx('go'); clearInterval(S.countdownTimer); setTimeout(() => $('bigCount').classList.add('hidden'), 700); startTutorial(); } };
    tick(); S.countdownTimer = setInterval(tick, 1000);
  }
  function onGameOver(d) {
    S.screen = 'victory'; if (document.exitPointerLock) document.exitPointerLock();
    UI.only('victory'); music('victory'); sfx('victory'); S.keys = {}; S.mouse = false; $('winnerName').textContent = tr('winner_is', { name: d.winnerName });
    $('stBody').innerHTML = ''; let mine = null;
    for (const r of d.standings) {
      if (r.id === S.id) mine = r;
      const tr_ = document.createElement('tr'); if (r.id === S.id) tr_.className = 'me';
      tr_.innerHTML = '<td></td><td class="n">' + r.kills + '</td><td class="n">' + r.deaths + '</td><td class="n">' + (r.deaths ? (r.kills / r.deaths).toFixed(1) : r.kills) + '</td><td class="n">' + r.damage + '</td><td class="n">' + r.distance + 'm</td><td class="n">' + r.powerups + '</td>';
      tr_.firstChild.textContent = (r.winner ? '👑 ' : '') + r.name; $('stBody').appendChild(tr_);
    }
    if (mine && !S.myCoinsGiven) { S.myCoinsGiven = true; RA.coins.add(mine.coins); $('stCoins').textContent = '+' + mine.coins; }
    const cf = $('confetti'); cf.innerHTML = ''; for (let i = 0; i < 90; i++) { const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = ['#ff3d4a', '#ffd93d', '#3ddc4a', '#2fa8ff', '#a55bff'][i % 5]; c.style.animationDuration = 2 + Math.random() * 3 + 's'; c.style.animationDelay = Math.random() * 2 + 's'; cf.appendChild(c); }
  }
  function goMenu() { S.screen = 'menu'; S.me = null; S.menuActive = true; clearPlayers(); buildMenuScene(); UI.only('menu'); music('menu'); if (document.exitPointerLock) document.exitPointerLock(); }

  /* --------------------------- ESTADO DEL SERVIDOR --------------------------- */
  function onSpawn(d) {
    const p = S.players.get(d.id); if (!p) return;
    p.buf.length = 0; p.alive = true; burst(d.x, d.y, d.z, 18, skinColor(p), 9, 0.25, 0.7);
    if (d.id === S.id && S.me) { S.me.p = [d.x, d.y, d.z]; S.me.v = [0, 0, 0]; S.me.alive = true; S.me.djUsed = false; S.spec = null; UI.hide('death'); sfx('spawn'); }
  }
  function onShot(d) {
    sfx('shoot', d); burst(d.x + d.dx, d.y + d.dy, d.z + d.dz, 4, 0xffee88, 6, 0.15, 0.25);
    const pl = S.players.get(d.id); if (pl) pl.mesh.userData.pulse = 1; // squash & stretch al disparar
    if (d.id === S.id) { $('crosshair').classList.add('fire'); setTimeout(() => $('crosshair').classList.remove('fire'), 80); shake(0.12); }
    else { // fogonazo del arma de otros jugadores
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Gfx.tex.star(), color: 0xffe27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(d.x + d.dx * 1.1, d.y + d.dy * 1.1, d.z + d.dz * 1.1); sp.scale.setScalar(1.0); addFx(sp, 0.1, (o, k) => o.scale.setScalar(1.0 * (1 - k)));
    }
  }
  function onHit(d) { burst(d.x, d.y, d.z, 14, d.shield ? 0x66ccff : 0xffffff, 9, 0.22, 0.5); sfx(d.shield ? 'shield' : 'hit', d); if (d.shield && d.v === S.id) flash('radial-gradient(transparent 35%,rgba(80,170,255,.6))'); }
  function onKill(k) {
    const v = S.players.get(k.v), ki = k.k ? S.players.get(k.k) : null;
    if (v) { v.alive = false; confetti(k.x, k.y, k.z, 44); burst(k.x, k.y, k.z, 40, skinColor(v), 18, 0.35, 1.0, -6); burst(k.x, k.y, k.z, 14, 0xffffff, 10, 0.25, 0.6); shockwave(k.x, k.y, k.z, 7, skinColor(v)); floatText(k.word, k.x, k.y, k.z); }
    sfx('kill', k); shake(0.5);
    const feed = $('killfeed'), row = document.createElement('div'), vn = v ? v.name : '?';
    row.textContent = ki ? ki.name + ' 💥 ' + tr('killed') + ' ' + vn : '🔥 ' + vn + ' — ' + tr(k.cause === 'lava' ? 'cause_lava' : 'cause_void'); feed.appendChild(row); setTimeout(() => row.remove(), 4500); while (feed.children.length > 5) feed.firstChild.remove();
    if (k.k === S.id || k.v === S.id) { S.hitstop = 0.06; S.slow = 0.35; setTimeout(() => { S.slow = 1; }, 450); }
    if (k.k === S.id) {
      const key = k.multi >= 4 ? 'mega_kill' : k.multi === 3 ? 'triple_kill' : k.multi === 2 ? 'double_kill' : null, st = $('streak');
      st.textContent = k.fever ? tr('fever_mode') : key ? tr(key) : ''; st.style.animation = 'none'; void st.offsetWidth; st.style.animation = 'pop .4s'; setTimeout(() => { st.textContent = ''; }, 1700);
    }
    if (k.v === S.id && S.me) {
      S.me.alive = false; const d0 = dirFrom(S.me.yaw, 0); S.spec = { p: [S.me.p[0] - d0[0] * 6, S.me.p[1] + 3, S.me.p[2] - d0[2] * 6] }; // la cámara se aleja
      $('deathWho').textContent = ki ? tr('killed_by', { name: ki.name }) : tr(k.cause === 'lava' ? 'killed_by_lava' : 'void_fall'); UI.show('death'); sfx('death');
      let ms = S.cfg.respawnMs; const cd = $('deathCd'); cd.textContent = Math.ceil(ms / 1000); const iv = setInterval(() => { ms -= 250; cd.textContent = Math.max(0, Math.ceil(ms / 1000)); if (ms <= 0 || S.screen !== 'game') clearInterval(iv); }, 250);
    }
  }
  function onRoulette(d) {
    const ICON = { shield: '🛡️', invisible: '👻', giant: '🎈', speed: '🚀', magnet: '🧲', nuke: '☢️' };
    UI.show('rouletteOv'); sfx('roulette'); let i = 0; const t0 = performance.now();
    const iv = setInterval(() => {
      if (performance.now() - t0 >= d.spinMs) { clearInterval(iv); $('wheelIcon').textContent = ICON[d.result]; $('wheelName').textContent = tr('pu_' + d.result); setTimeout(() => UI.hide('rouletteOv'), 1100); }
      else $('wheelIcon').textContent = ICON[d.types[i++ % d.types.length]];
    }, 90);
  }
  const PU_ICON = { shield: '🛡️', invisible: '👻', giant: '🎈', speed: '🚀', magnet: '🧲', fever: '🔥' };
  function onState(st) {
    if (S.screen !== 'game' || !S.me) return;
    const o = Date.now() - st.t; S.offset = S.offset === null ? o : S.offset * 0.9 + o * 0.1;
    let meE = null;
    for (const e of st.pl) {
      const p = ensurePlayer(e.id); p.alive = !!e.a; p.k = e.k; p.d = e.d; p.c = e.c; p.pg = e.pg;
      if (e.id === S.id) meE = e;
      if (e.x === undefined) { p.hidden = true; continue; }
      p.hidden = false; p.flags = { sh: e.sh, fv: e.fv, iv: e.iv, gi: e.gi, sp: e.sp, mg: e.mg }; if (!e.em && p.emote && p.emoteT > 0.2) p.emote = null; else if (e.em && !p.emote) { p.emote = e.em; p.emoteT = 0; }
      p.buf.push({ t: st.t, x: e.x, y: e.y, z: e.z, yaw: e.yaw, pitch: e.pitch, vx: e.vx, vy: e.vy, vz: e.vz }); if (p.buf.length > 24) p.buf.shift();
    }
    // reconciliación suave del jugador local
    const m = S.me;
    if (meE && meE.x !== undefined) {
      const rtt = (meE.pg || 40) / 2000, tx = meE.x + meE.vx * rtt, ty = meE.y + meE.vy * rtt, tz = meE.z + meE.vz * rtt, ex = tx - m.p[0], ey = ty - m.p[1], ez = tz - m.p[2], err = Math.hypot(ex, ey, ez);
      if (!m.init || err > 4 || !m.alive) { m.p = [tx, ty, tz]; m.v = [meE.vx, meE.vy, meE.vz]; m.init = true; }
      else { const k = 0.22; m.p[0] += ex * k; m.p[1] += ey * k; m.p[2] += ez * k; m.v[0] = lerp(m.v[0], meE.vx, k); m.v[1] = lerp(m.v[1], meE.vy, k); m.v[2] = lerp(m.v[2], meE.vz, k); }
      m.alive = !!meE.a;
    }
    // balas
    const seen = new Set();
    for (const b of st.b) {
      seen.add(b.i); let ob = S.bullets.get(b.i);
      if (!ob) { const mine = b.o === S.id, mm = new THREE.Mesh(GEO.sph, Gfx.basic(mine ? 0xffe455 : 0xff5ad0, 1.7)); mm.scale.setScalar(b.r); Gfx.addOutline(mm, 0.05); scene.add(mm); ob = { mesh: mm, trail: 0 }; S.bullets.set(b.i, ob); }
      const lead = (m.p ? (meE ? (meE.pg || 40) / 2000 : 0.02) : 0.02); ob.x = b.x + b.vx * lead; ob.y = b.y + b.vy * lead; ob.z = b.z + b.vz * lead; ob.vx = b.vx; ob.vy = b.vy; ob.vz = b.vz; ob.mesh.scale.setScalar(b.r);
    }
    for (const [id, ob] of S.bullets) if (!seen.has(id)) { scene.remove(ob.mesh); ob.mesh.material.dispose(); S.bullets.delete(id); }
    S.self = st.self; S.cd.dash = performance.now() + st.self.cd.dash; S.cd.bomb = performance.now() + st.self.cd.bomb; S.cd.grapple = performance.now() + st.self.cd.grapple;
    if (st.self.dj) m.djUsed = false;
    updateHud(st, meE);
  }

  /* --------------------------------- HUD --------------------------------- */
  function updateHud(st, meE) {
    if (!meE) return;
    const kn = $('killsNum'); if (kn.textContent !== String(meE.k)) { kn.textContent = meE.k; kn.classList.remove('bounce'); void kn.offsetWidth; kn.classList.add('bounce'); }
    $('matchCoins').textContent = meE.c; $('pingVal').textContent = meE.pg;
    const sorted = [...S.players.values()].sort((a, b) => b.k - a.k); $('top3').innerHTML = '';
    sorted.slice(0, 3).forEach((p, i) => { const r = document.createElement('div'); r.className = 'r' + (p.id === S.id ? ' me' : ''); r.innerHTML = '<span></span><b>' + p.k + '</b>'; r.firstChild.textContent = (i + 1) + '. ' + p.name; $('top3').appendChild(r); });
    const rl = $('hudRoulette'); $('rouletteTime').textContent = st.spin ? '...' : UI.fmtTime(st.rl); rl.classList.toggle('warn', !st.spin && st.rl < 5000);
    if (sorted[0] && sorted[0].k >= S.cfg.winKills - 1 && !S.lastMusicMin) { S.lastMusicMin = true; music('lastminute'); }
    const sf = st.self; $('nukeBadge').classList.toggle('hidden', !sf.nuke);
    const pu = $('hudPowerup'); let type = null, ms = 0, total = 1;
    if (sf.timed) { type = sf.timed.type; ms = sf.timed.ms; total = sf.timed.total; } else if (sf.fever > 0) { type = 'fever'; ms = sf.fever; total = S.cfg.feverMs; } else if (meE.sh) { type = 'shield'; ms = 0; }
    pu.classList.toggle('hidden', !type);
    if (type) { $('puIcon').textContent = PU_ICON[type]; $('puName').textContent = tr('pu_' + type); $('puTime').textContent = ms ? UI.fmtTime(ms) : '∞'; $('puBar').style.width = (ms ? ms / total * 100 : 100) + '%'; pu.classList.toggle('warn', ms > 0 && ms < 3000); }
    for (const [id, cdk, tot] of [['abDash', 'dash', S.cfg.dashCd], ['abBomb', 'bomb', S.cfg.bombCd], ['abGrapple', 'grapple', S.cfg.grappleCd]]) { const e = $(id), rem = sf.cd[cdk]; e.style.setProperty('--p', clamp(rem / tot, 0, 1)); e.classList.toggle('ready', rem <= 0); }
    if (S.tab) renderScoreboard();
  }
  function renderScoreboard() {
    const b = $('sbBody'); b.innerHTML = '';
    [...S.players.values()].sort((a, c) => c.k - a.k || a.d - c.d).forEach(p => { const r = document.createElement('tr'); if (p.id === S.id) r.className = 'me'; r.innerHTML = '<td></td><td class="n">' + p.k + '</td><td class="n">' + p.d + '</td><td class="n">' + (p.isBot ? '🤖' : p.pg) + '</td>'; r.firstChild.textContent = p.name; b.appendChild(r); });
  }
  const mini = $('minimap').getContext('2d');
  function drawMini() {
    const map = S.map, m = S.me; if (!map || !m) return; const c = 150, b = map.bounds, sx = c / (b.max[0] - b.min[0]), sz = c / (b.max[2] - b.min[2]), X = x => (x - b.min[0]) * sx, Z = z => (z - b.min[2]) * sz;
    mini.clearRect(0, 0, c, c); mini.fillStyle = 'rgba(255,255,255,.12)'; mini.fillRect(0, 0, c, c); mini.fillStyle = 'rgba(255,255,255,.4)';
    for (const s of map.solids) mini.fillRect(X(s.min[0]), Z(s.min[2]), Math.max(1.5, (s.max[0] - s.min[0]) * sx), Math.max(1.5, (s.max[2] - s.min[2]) * sz));
    mini.fillStyle = 'rgba(255,90,30,.7)'; for (const l of map.lava) mini.fillRect(X(l.min[0]), Z(l.min[2]), (l.max[0] - l.min[0]) * sx, (l.max[2] - l.min[2]) * sz);
    for (const p of S.players.values()) { if (p.id === S.id || !p.alive || p.hidden) continue; mini.fillStyle = '#ff3d4a'; mini.beginPath(); mini.arc(X(p.pos.x), Z(p.pos.z), 3.5, 0, 6.3); mini.fill(); }
    mini.save(); mini.translate(X(m.p[0]), Z(m.p[2])); mini.rotate(-m.yaw); mini.fillStyle = '#ffd93d'; mini.beginPath(); mini.moveTo(0, -6); mini.lineTo(4.5, 5); mini.lineTo(-4.5, 5); mini.closePath(); mini.fill(); mini.restore();
  }

  /* ----------------------- SIMULACIÓN LOCAL (predicción) ----------------------- */
  function pushOut(p, r, bx) {
    const cx = clamp(p[0], bx.min[0], bx.max[0]), cy = clamp(p[1], bx.min[1], bx.max[1]), cz = clamp(p[2], bx.min[2], bx.max[2]), dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) return null; let n, pen;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); n = [dx / d, dy / d, dz / d]; pen = r - d; }
    else { const ds = [p[0] - bx.min[0], bx.max[0] - p[0], p[1] - bx.min[1], bx.max[1] - p[1], p[2] - bx.min[2], bx.max[2] - p[2]]; let k = 0; for (let i = 1; i < 6; i++) if (ds[i] < ds[k]) k = i; n = [0, 0, 0]; n[k >> 1] = k % 2 ? 1 : -1; pen = ds[k] + r; }
    p[0] += n[0] * pen; p[1] += n[1] * pen; p[2] += n[2] * pen; return n;
  }
  function bounce(m, n) { const vn = m.v[0] * n[0] + m.v[1] * n[1] + m.v[2] * n[2]; if (vn >= 0) return; const k = Math.abs(vn) < 1.2 ? 1 : 1.6; for (let i = 0; i < 3; i++) m.v[i] -= k * vn * n[i]; const g = m.g, gl = Math.hypot(g[0], g[1], g[2]); if (gl > 0.01 ? -(n[0] * g[0] + n[1] * g[1] + n[2] * g[2]) / gl > 0.7 : n[1] > 0.7) m.grounded = true; }
  function localStep(dt) {
    const m = S.me, map = S.map, R = S.cfg.playerR; if (!m || !m.alive || !m.init) return;
    let g = map.gravity; for (const z of map.gravityZones) if (m.p[0] >= z.min[0] && m.p[0] <= z.max[0] && m.p[1] >= z.min[1] && m.p[1] <= z.max[1] && m.p[2] >= z.min[2] && m.p[2] <= z.max[2]) { g = z.g; break; }
    m.g = g; for (let i = 0; i < 3; i++) m.v[i] += g[i] * dt;
    const f = Math.pow(S.cfg.friction, dt * 60); for (let i = 0; i < 3; i++) m.v[i] *= f;
    const sp = Math.hypot(m.v[0], m.v[1], m.v[2]); if (sp > 70) for (let i = 0; i < 3; i++) m.v[i] *= 70 / sp;
    for (let i = 0; i < 3; i++) m.p[i] += m.v[i] * dt; m.grounded = false;
    const b = map.bounds;
    for (let i = 0; i < 3; i++) {
      const n = [0, 0, 0];
      if (i === 1 && !map.floor) { if (m.p[1] > b.max[1] - R) { m.p[1] = b.max[1] - R; n[1] = -1; bounce(m, n); } continue; }
      if (m.p[i] < b.min[i] + R) { m.p[i] = b.min[i] + R; n[i] = 1; bounce(m, n); } else if (m.p[i] > b.max[i] - R) { m.p[i] = b.max[i] - R; n[i] = -1; bounce(m, n); }
    }
    for (const bx of map.solids) { const n = pushOut(m.p, R, bx); if (n) bounce(m, n); }
    for (const tr_ of map.trampolines) if (Math.hypot(m.p[0] - tr_.x, m.p[2] - tr_.z) < tr_.r && m.p[1] < tr_.y + R + 0.6 && m.v[1] < 4) { m.v[1] = 20; m.djUsed = false; }
    if (m.grounded) m.djUsed = false;
  }

  /* --------------------------------- ENTRADA --------------------------------- */
  const tutDone = () => { localStorage.setItem('ra_tut', '1'); UI.hide('tutorial'); TUT.active = false; };
  const TUT = { active: false, i: 0, steps: [['tut_shoot', 'shoot'], ['tut_dash', 'dash'], ['tut_bomb', 'bomb'], ['tut_grapple', 'grapple'], ['tut_jump', 'jump'], ['tut_emote', 'emote']] };
  function startTutorial() { if (localStorage.getItem('ra_tut')) return; TUT.active = true; TUT.i = 0; showTut(); }
  function showTut() { if (TUT.i >= TUT.steps.length) { $('tutText').textContent = tr('tut_done'); UI.show('tutorial'); setTimeout(tutDone, 1800); return; } $('tutText').textContent = tr(TUT.steps[TUT.i][0] + (S.touch ? '_t' : '')); UI.show('tutorial'); }
  function tutAction(a) { if (TUT.active && TUT.i < TUT.steps.length && TUT.steps[TUT.i][1] === a) { TUT.i++; showTut(); } }
  function aimMsg() { const m = S.me; return { yaw: m.yaw, pitch: m.pitch, seq: ++S.seq }; }
  function recoilMult() { const sf = S.self; return ((sf && sf.timed && sf.timed.type === 'speed') ? 3 : 1) * ((sf && sf.fever > 0) ? 2 : 1); }
  function tryShoot() {
    const m = S.me; if (!m || !m.alive || !m.init) return; const now = performance.now();
    if (now - m.lastShot < S.cfg.fireInterval * 1000) return; m.lastShot = now;
    const d = dirFrom(m.yaw, m.pitch), rm = recoilMult(); for (let i = 0; i < 3; i++) m.v[i] -= d[i] * S.cfg.recoil * rm; // retroceso predicho
    S.kick = 6; vm.shoot(); emit('shoot', aimMsg()); tutAction('shoot');
  }
  function act(ev) { const m = S.me; if (!m || !m.alive) return; emit(ev, aimMsg()); tutAction(ev); }
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { if (e.key === 'Enter') { if (e.target.id === 'nameInput') $('nameOk').click(); else if (e.target.id === 'joinCode') $('btnJoinCode').click(); else if (e.target.id === 'friendSearch') $('btnAddFriend').click(); } return; }
    if (S.screen !== 'game' || !S.me) return;
    if (e.code === 'Tab') { e.preventDefault(); if (!S.tab) { S.tab = true; renderScoreboard(); UI.show('scoreboard'); } return; }
    if (e.code === 'Enter' && TUT.active) { TUT.i++; showTut(); return; }
    S.keys[e.code] = true; if (e.repeat) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { const m = S.me; if (m.alive && performance.now() >= S.cd.dash) { const d = dirFrom(m.yaw, m.pitch); for (let i = 0; i < 3; i++) m.v[i] += d[i] * S.cfg.dashForce; vm.dash(); } act('dash'); }
    else if (e.code === 'KeyQ') act('bomb'); else if (e.code === 'KeyE') act('grapple'); else if (e.code === 'KeyR') act('nuke');
    else if (e.code === 'Space') { e.preventDefault(); const m = S.me; if (m.alive && !m.grounded && !m.djUsed) { m.djUsed = true; const g = m.g, gl = Math.hypot(g[0], g[1], g[2]) || 1; for (let i = 0; i < 3; i++) m.v[i] += -g[i] / gl * S.cfg.jump; } act('jump'); }
    else if (/^Digit[1-4]$/.test(e.code)) { const id = RA.emotes.get()[+e.code[5] - 1]; if (id && S.me.alive) { emit('emote', { id }); tutAction('emote'); } }
  });
  addEventListener('keyup', e => { S.keys[e.code] = false; if (e.code === 'Tab' && S.tab) { S.tab = false; UI.hide('scoreboard'); } });
  addEventListener('mousemove', e => {
    if (S.screen !== 'game' || !S.me || !document.pointerLockElement) return;
    const k = 0.0006 + (ST.sens / 100) * 0.0042; S.me.yaw -= e.movementX * k; S.me.pitch = clamp(S.me.pitch - e.movementY * k, -1.5, 1.5);
  });
  addEventListener('mousedown', e => {
    if (S.screen !== 'game' || e.button !== 0 || S.touch) return;
    if (!document.pointerLockElement) { if (!e.target.closest('.btn,.card,input,select,.side')) canvas.requestPointerLock && canvas.requestPointerLock(); return; }
    S.mouse = true;
  });
  addEventListener('mouseup', () => { S.mouse = false; });
  document.addEventListener('pointerlockchange', () => { S.locked = !!document.pointerLockElement; if (!S.locked) S.mouse = false; });
  addEventListener('contextmenu', e => { if (S.screen === 'game') e.preventDefault(); });
  addEventListener('blur', () => { S.keys = {}; S.mouse = false; });

  /* ---------------------------- MENÚ / LOBBY / AMIGOS ---------------------------- */
  let menuAvatars = [];
  function buildMenuScene() {
    buildWorld(MENU_MAP); menuAvatars.forEach(a => actors.remove(a)); menuAvatars = [];
    const mine = RA.skin.get(), pool_ = Object.keys(SKIN_COL).filter(k => k !== mine), picks = [pool_[1 % pool_.length], mine, pool_[3 % pool_.length]];
    picks.forEach((sk, i) => { const a = Gfx.makeAvatar(sk); a.position.set(i * 3.4 - 3.4, 1.9, 0); a.scale.setScalar(i === 1 ? 1.25 : 1); actors.add(a); menuAvatars.push(a); });
  }
  addEventListener('skinchange', () => { if (S.screen !== 'game') buildMenuScene(); });
  function showNameModal() { $('nameInput').value = S.name || ''; $('nameErr').textContent = ''; UI.show('nameModal'); setTimeout(() => $('nameInput').focus(), 50); }
  $('nameOk').addEventListener('click', () => {
    const n = $('nameInput').value.trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) { $('nameErr').textContent = tr('err_name_invalid'); return; }
    if (!S.socket.connected) { $('nameErr').textContent = tr('connecting'); return; }
    doAuth(n, r => { if (r.ok) { UI.hide('nameModal'); UI.toast(tr('connected'), 'ok', 1500); } else $('nameErr').textContent = tr(r.key); });
  });
  $('nameCancel').addEventListener('click', () => { if (S.authed) UI.hide('nameModal'); });
  $('btnChangeName').addEventListener('click', () => { UI.hide('settings'); showNameModal(); });
  const needAuth = fn => () => { if (!S.authed) { showNameModal(); return; } fn(); };
  $('optQuick').addEventListener('click', needAuth(() => emit('room:quick', {}, errToast)));
  $('optCreate').addEventListener('click', needAuth(() => emit('room:create', { public: false }, errToast)));
  $('btnJoinCode').addEventListener('click', needAuth(() => emit('room:join', { code: $('joinCode').value }, errToast)));
  function loadRooms() {
    emit('room:list', {}, r => {
      const box = $('roomList'); box.innerHTML = ''; if (!r || !r.rooms.length) { box.innerHTML = '<div style="text-align:center;opacity:.7;padding:20px"></div>'; box.firstChild.textContent = tr('no_rooms'); return; }
      for (const x of r.rooms) {
        const row = document.createElement('div'); row.className = 'roomrow'; row.innerHTML = '<b></b><span></span><button class="btn small green"></button>';
        row.children[0].textContent = x.code; row.children[1].textContent = tr('map_' + x.map) + ' · ' + x.players + '/' + x.max + ' · ' + tr(x.state === 'playing' ? 'in_game' : 'in_lobby'); row.children[2].textContent = tr('join');
        row.children[2].onclick = () => emit('room:join', { code: x.code }, errToast); box.appendChild(row);
      }
    });
  }
  $('optBrowse').addEventListener('click', needAuth(loadRooms)); $('btnRefresh').addEventListener('click', loadRooms);
  function showLobby() { UI.only('lobby'); UI.panel(null); music('menu'); renderLobby(); }
  function renderLobby() {
    const r = S.room; if (!r) return; const host = r.host === S.id;
    $('roomCode').textContent = r.code; const pl = $('playerList'); pl.innerHTML = '';
    for (const p of r.players) { const row = document.createElement('div'); row.className = 'prow'; row.innerHTML = '<div class="avatar"></div><span style="flex:1"></span>'; row.children[0].textContent = SKIN_EMOJI[p.skin] || '🟦'; row.children[1].textContent = p.name; if (p.host) row.insertAdjacentHTML('beforeend', '<span class="badge">' + tr('host_badge') + '</span>'); if (p.isBot) row.insertAdjacentHTML('beforeend', '<span class="badge bot">' + tr('bot_badge') + '</span>'); pl.appendChild(row); }
    document.querySelectorAll('#mapBtns .mapbtn').forEach(b => b.classList.toggle('sel', b.dataset.map === r.map)); $('mapPrev').dataset.map = r.map; $('mapPrevName').textContent = tr('map_' + r.map);
    document.querySelectorAll('#segVis button').forEach(b => b.classList.toggle('sel', (b.dataset.v === '1') === r.isPublic));
    $('maxRange').value = r.max; $('maxVal').textContent = r.max; const bots = r.players.filter(p => p.isBot).length; $('botsRange').value = bots; $('botsVal').textContent = bots;
    ['maxRange', 'botsRange'].forEach(id => { $(id).disabled = !host; }); $('btnStart').classList.toggle('hidden', !host); $('waitHost').classList.toggle('hidden', host);
  }
  addEventListener('mappick', e => { if (S.room && S.room.host === S.id) emit('room:config', { map: e.detail }, errToast); });
  document.querySelectorAll('#segVis button').forEach(b => b.addEventListener('click', () => { if (S.room && S.room.host === S.id) emit('room:config', { public: b.dataset.v === '1' }, errToast); }));
  $('maxRange').addEventListener('change', e => emit('room:config', { max: +e.target.value }, errToast));
  $('botsRange').addEventListener('change', e => emit('room:bots', { count: +e.target.value }, errToast));
  $('btnStart').addEventListener('click', () => emit('room:start', {}, errToast));
  $('btnLeave').addEventListener('click', () => emit('room:leave', {}, () => {}));
  $('btnAgain').addEventListener('click', () => { if (S.room && S.room.host === S.id) emit('room:start', {}, errToast); else { emit('room:lobby', {}); S.screen = 'lobby'; showLobby(); } });
  $('btnToLobby').addEventListener('click', () => { emit('room:lobby', {}); S.screen = 'lobby'; buildMenuScene(); showLobby(); });

  // Amigos
  function renderFriends() {
    const L = $('friendsList'), Rq = $('friendReqs'); if (!L) return; L.innerHTML = ''; Rq.innerHTML = '';
    if (!S.friends.length) { L.innerHTML = '<div style="opacity:.7;text-align:center;padding:14px"></div>'; L.firstChild.textContent = tr('no_friends'); }
    const order = { online: 0, ingame: 1, offline: 2 };
    [...S.friends].sort((a, b) => order[a.status] - order[b.status]).forEach(f => {
      const r = document.createElement('div'); r.className = 'frow'; r.innerHTML = '<span class="dot ' + f.status + '"></span><span class="nm"></span><small></small>';
      r.children[1].textContent = f.name; r.children[2].textContent = tr('st_' + f.status);
      const btn = (key, cls, fn) => { const b = document.createElement('button'); b.className = 'btn small ' + cls; b.textContent = tr(key); b.onclick = fn; r.appendChild(b); };
      if (f.status !== 'offline' && S.room) btn('invite', 'green', () => emit('invite:send', { to: f.name }, x => x.ok ? UI.toast(tr('invite_sent'), 'ok') : errToast(x)));
      if (f.status !== 'offline') btn('join_friend', 'blue', () => emit('friends:join', { name: f.name }, errToast));
      btn('remove', 'red', () => { emit('friends:remove', { name: f.name }); S.friends = S.friends.filter(x => x !== f); renderFriends(); }); L.appendChild(r);
    });
    S.requests.forEach(n => { const r = document.createElement('div'); r.className = 'frow'; r.innerHTML = '<span class="nm"></span>'; r.firstChild.textContent = n; const a = document.createElement('button'); a.className = 'btn small green'; a.textContent = tr('accept'); a.onclick = () => respondReq(n, true); const d = document.createElement('button'); d.className = 'btn small red'; d.textContent = tr('decline'); d.onclick = () => respondReq(n, false); r.append(a, d); Rq.appendChild(r); });
  }
  function respondReq(name, accept) { emit('friends:respond', { from: name, accept }, r => { S.requests = S.requests.filter(x => x !== name); if (r && r.friend) S.friends.push(r.friend); renderFriends(); errToast(r); }); }
  $('btnAddFriend').addEventListener('click', () => { const n = $('friendSearch').value.trim(); if (!n) return; emit('friends:request', { to: n }, r => { if (r && r.ok) { UI.toast(tr('request_sent'), 'ok'); $('friendSearch').value = ''; } else errToast(r); }); });
  let searchT = null; const resBox = document.createElement('div'); resBox.className = 'list'; resBox.style.cssText = 'flex:0 0 auto;max-height:20vh'; $('friendSearch').parentElement.after(resBox);
  $('friendSearch').addEventListener('input', e => {
    clearTimeout(searchT); const q = e.target.value.trim(); resBox.innerHTML = ''; if (q.length < 2) return;
    searchT = setTimeout(() => emit('friends:search', { q }, r => { resBox.innerHTML = ''; (r && r.results || []).filter(x => !x.friend).forEach(x => { const row = document.createElement('div'); row.className = 'frow'; row.innerHTML = '<span class="dot ' + x.status + '"></span><span class="nm"></span>'; row.children[1].textContent = x.name; const b = document.createElement('button'); b.className = 'btn small purple'; b.textContent = tr('add_friend'); b.onclick = () => emit('friends:request', { to: x.name }, y => y.ok ? UI.toast(tr('request_sent'), 'ok') : errToast(y)); row.appendChild(b); resBox.appendChild(row); }); }), 300);
  });
  $('btnFriends').addEventListener('click', () => { if (S.authed) emit('friends:sync', {}, r => { if (r && r.ok) { S.friends = r.friends; S.requests = r.requests; renderFriends(); } }); });

  // Ajustes
  function applySettings(save) {
    const set = (id, v) => { const e = $(id); if (e) { if (e.classList.contains('toggle')) e.classList.toggle('on', !!v); else e.value = v; } };
    set('setSfx', ST.sfx); set('setMusic', ST.music); set('setSens', ST.sens); set('setBlur', ST.blur); set('setShake', ST.shake); set('setQuality', ST.quality); set('setHud', ST.hud); set('setCb', ST.cb); set('setReduce', ST.reduce); set('setAimAssist', ST.aimAssist);
    document.documentElement.style.setProperty('--hud-scale', ST.hud / 100); document.body.classList.remove('cb-prot', 'cb-deut', 'cb-trit'); if (ST.cb !== 'none') document.body.classList.add('cb-' + ST.cb); document.body.classList.toggle('bodyfx-reduce', ST.reduce);
    try { window.RAudio && window.RAudio.setVolumes && window.RAudio.setVolumes(ST.sfx / 100, ST.music / 100); } catch (e) {}
    if (save) ls.set('ra_settings', ST);
  }
  [['setSfx', 'sfx', 'input', Number], ['setMusic', 'music', 'input', Number], ['setSens', 'sens', 'input', Number], ['setHud', 'hud', 'input', Number], ['setQuality', 'quality', 'change', String], ['setCb', 'cb', 'change', String]].forEach(([id, key, ev, cast]) => $(id).addEventListener(ev, e => { ST[key] = cast(e.target.value); applySettings(true); if (key === 'quality') { setupComposer(); resize(); } }));
  [['setBlur', 'blur'], ['setShake', 'shake'], ['setReduce', 'reduce'], ['setAimAssist', 'aimAssist']].forEach(([id, key]) => $(id).addEventListener('click', e => { ST[key] = e.currentTarget.classList.contains('on'); applySettings(true); }));
  addEventListener('langchange', () => { if (S.screen === 'lobby') renderLobby(); renderFriends(); });

  /* ------------------------------ BUCLE PRINCIPAL ------------------------------ */
  const clock = { last: performance.now(), t: 0 }; let accSim = 0;
  function interpolate(p, renderT) {
    const b = p.buf; if (!b.length) return false; let a = null, c = null;
    for (let i = b.length - 1; i >= 0; i--) if (b[i].t <= renderT) { a = b[i]; c = b[i + 1] || null; break; }
    if (!a) a = b[0];
    if (c) { const k = clamp((renderT - a.t) / Math.max(1, c.t - a.t), 0, 1); p.pos.set(lerp(a.x, c.x, k), lerp(a.y, c.y, k), lerp(a.z, c.z, k)); p.yaw = lerp(a.yaw, c.yaw, k); p.pitch = lerp(a.pitch, c.pitch, k); }
    else { const dt = Math.min(0.15, Math.max(0, (renderT - a.t) / 1000)); p.pos.set(a.x + a.vx * dt, a.y + a.vy * dt, a.z + a.vz * dt); p.yaw = a.yaw; p.pitch = a.pitch; }
    p.vel.set(a.vx, a.vy, a.vz);
    return true;
  }
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0);
  // Squash & stretch: estira en la dirección del movimiento y aplasta en perpendicular
  function applySquash(a, vel, dt, fallback) {
    const u = a.userData, sp = vel.length(), target = 1 + clamp(sp * 0.011, 0, 0.32) + u.pulse * 0.28;
    u.stretch += (target - u.stretch) * Math.min(1, dt * 16); u.pulse *= Math.pow(0.0005, dt);
    if (u.stretch < 1.015) { u.squash.quaternion.identity(); u.inner.quaternion.identity(); u.squash.scale.set(1, 1, 1); return; }
    tmpV.copy(sp >= 0.6 ? vel : fallback).normalize(); tmpQ.copy(a.quaternion).invert(); tmpV.applyQuaternion(tmpQ);
    u.squash.quaternion.setFromUnitVectors(UPV, tmpV); u.inner.quaternion.copy(u.squash.quaternion).invert();
    const k = u.stretch, w = 1 / Math.sqrt(k); u.squash.scale.set(w, k, w);
  }
  const aimV = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - clock.last) / 1000); clock.last = now; clock.t += dt;
    if (S.hitstop > 0) { S.hitstop -= dt; dt = 0; }
    const vdt = dt * S.slow, tm = clock.t;
    for (const fn of S.anims) fn(tm, vdt);
    let showVM = false;
    if (S.screen === 'game' && S.me) showVM = gameFrame(dt, vdt, tm);
    else { // fondo del menú: cámara orbitando
      const a = tm * 0.12; camera.position.set(Math.sin(a) * 25, 6.5 + Math.sin(tm * 0.3) * 1.2, Math.cos(a) * 25); camera.lookAt(0, 0.4, 0); camera.fov = 62; camera.updateProjectionMatrix();
      menuAvatars.forEach((m, i) => { const u = m.userData; m.position.y = 1.9 + Math.sin(tm * 2 + i) * 0.18; m.rotation.y = Math.sin(tm * 0.8 + i) * 0.5 + (i - 1) * -0.35 + Math.PI * 0.0; animateEmote(m, ['wave', 'robot', 'victory'][i], tm + i); u.body.position.y += 0; });
    }
    // partículas y efectos
    for (const m of pool) { const u = m.userData; if (!m.visible) continue; u.life -= vdt; if (u.life <= 0) { m.visible = false; continue; } u.v.y += u.g * vdt; m.position.addScaledVector(u.v, vdt); const k = u.life / u.max; m.scale.setScalar(u.s * k); m.material.opacity = Math.min(1, k * 1.6); }
    for (const m of confPool) { if (!m.visible) continue; const u = m.userData; u.life -= vdt; if (u.life <= 0) { m.visible = false; continue; } u.v.y -= 7 * vdt; u.v.multiplyScalar(Math.pow(0.35, vdt)); m.position.addScaledVector(u.v, vdt); m.rotation.x += u.spin.x * vdt; m.rotation.y += u.spin.y * vdt; m.rotation.z += u.spin.z * vdt; }
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; f.life -= vdt; const k = 1 - clamp(f.life / f.max, 0, 1); f.upd(f.obj, k); if (f.life <= 0) { scene.remove(f.obj); if (f.obj.material) f.obj.material.dispose(); S.fx.splice(i, 1); } }
    if (blurPass) blurPass.uniforms.amt.value = 0;
    if (composer && S.screen === 'game' && ST.blur && !ST.reduce && S.me) blurPass.uniforms.amt.value = clamp((Math.hypot(S.me.v[0], S.me.v[1], S.me.v[2]) - 14) / 40, 0, 1) * 0.9;
    if (composer) { vmPass.enabled = showVM; composer.render(); }
    else { renderer.render(scene, camera); if (showVM) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vm.scene, vm.camera); renderer.autoClear = true; } }
  }
  // AIM ASSIST (solo móvil): imán suave hacia el enemigo más cercano a la mira mientras se dispara. El servidor sólo recibe yaw/pitch, sigue siendo autoritativo.
  function aimAssist(dt) {
    const m = S.me; if (!S.touch || !ST.aimAssist || !m || !m.alive) return;
    let best = null, bd = 0.2; // cono ~11°
    for (const p of S.players.values()) {
      if (p.id === S.id || !p.alive || p.hidden || !p.pos) continue;
      const dx = p.pos.x - m.p[0], dy = p.pos.y - m.p[1], dz = p.pos.z - m.p[2], dist = Math.hypot(dx, dy, dz); if (dist < 1 || dist > 70) continue;
      const ty = Math.asin(dy / dist); let tw = Math.atan2(-dx, -dz);
      let ey = tw - m.yaw; ey = Math.atan2(Math.sin(ey), Math.cos(ey)); const ep = ty - m.pitch;
      const e = Math.hypot(ey * Math.cos(m.pitch), ep) * (1 + dist / 140); if (e < bd) { bd = e; best = { ey, ep }; }
    }
    if (!best) return; const k = Math.min(1, dt * 7);
    m.yaw += best.ey * k; m.pitch = clamp(m.pitch + best.ep * k, -1.5, 1.5);
  }
  function gameFrame(dt, vdt, tm) {
    const m = S.me, map = S.map; if (!m) return false;
    // envío de apuntado (30 Hz)
    const nowMs = performance.now(), aim = m.yaw.toFixed(3) + m.pitch.toFixed(3);
    if (nowMs - S.lastSend > 33 && aim !== S.lastAim) { S.lastSend = nowMs; S.lastAim = aim; emit('input', aimMsg()); }
    if (S.mouse && S.touch) aimAssist(dt);
    if (S.mouse && (document.pointerLockElement || S.touch)) tryShoot();
    const sp0 = Math.hypot(m.v[0], m.v[1], m.v[2]), wasG = m.grounded;
    accSim += dt; while (accSim >= 1 / 60) { localStep(1 / 60); accSim -= 1 / 60; }
    if (m.alive && m.grounded && !wasG && sp0 > 7) burst(m.p[0], m.p[1] - 0.5, m.p[2], 10, 0xeee8ff, 5, 0.24, 0.5, -2); // polvo al aterrizar
    // interpolación de jugadores remotos
    const renderT = Date.now() - (S.offset || 0) - 100, ad = dirFrom(m.yaw, m.pitch); aimV.set(-ad[0], -ad[1], -ad[2]);
    for (const p of S.players.values()) {
      const isMe = p.id === S.id;
      if (isMe) { p.pos.set(m.p[0], m.p[1], m.p[2]); p.yaw = m.yaw; p.pitch = m.pitch; p.vel.set(m.v[0], m.v[1], m.v[2]); }
      else if (!interpolate(p, renderT)) { p.mesh.visible = false; p.blob.visible = false; continue; }
      const vis = p.alive && !p.hidden && (!isMe || !!p.emote); p.mesh.visible = vis; if (!vis) { p.blob.visible = false; continue; }
      const a = p.mesh, f = p.flags || {}, u = a.userData;
      a.position.copy(p.pos); a.rotation.y = p.yaw; a.updateMatrixWorld();
      if (p.emote) { p.emoteT += vdt; animateEmote(a, p.emote, p.emoteT); if (p.emoteDur && p.emoteT > p.emoteDur + 0.5) p.emote = null; }
      else { animateEmote(a, 'none', 0); u.body.position.y = Math.sin(tm * 2.2 + p.phase) * 0.05; } // flotación idle
      if (u.tail) u.tail.rotation.y = Math.sin(tm * 6 + p.phase) * 0.35;
      applySquash(a, p.vel, vdt, aimV);
      a.scale.setScalar(f.gi ? 1.4 : 1); u.bubble.visible = !!f.sh; u.aura.visible = !!(f.fv || f.sp || f.mg); u.aura.rotation.z = tm * 3;
      u.aura.material.color.setHex(f.fv ? 0xff6a1f : f.sp ? 0x7fd4ff : 0xffd93d);
      u.mat.emissive.setHex(f.fv ? 0xff5500 : (EMI[u.skin] || 0)); u.mat.emissiveIntensity = f.fv ? 0.6 + Math.sin(tm * 14) * 0.3 : (u.skin === 'gold' ? 1 : u.skin === 'ghost' ? 0.35 : 0);
      u.mat.opacity = f.iv && isMe ? 0.3 : (u.skin === 'ghost' ? 0.82 : 1); u.mat.transparent = u.skin === 'ghost' || (f.iv && isMe);
      // sombra blob bajo el jugador
      const gy = groundBelow(p.pos.x, p.pos.y, p.pos.z);
      if (gy === null) p.blob.visible = false;
      else { const h = Math.max(0, p.pos.y - 0.6 - gy), s2 = clamp(1.25 - h * 0.035, 0.4, 1.25) * (f.gi ? 1.4 : 1); p.blob.visible = true; p.blob.position.set(p.pos.x, gy + 0.04, p.pos.z); p.blob.scale.setScalar(s2 * 0.95); p.blob.material.opacity = clamp(1 - h * 0.03, 0.2, 1); }
      // estela de colores (dash) y trail de velocidad
      if (p.trailUntil > nowMs && nowMs - p.lastTrail > 45) {
        p.lastTrail = nowMs; const ai = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((tm * 1.5) % 1, 1, 0.6), transparent: true, opacity: 0.55, depthWrite: false }));
        ai.position.copy(p.pos); ai.scale.setScalar(0.55); addFx(ai, 0.45, (o, k) => { o.material.opacity = 0.55 * (1 - k); o.scale.setScalar(0.55 * (1 - k * 0.5)); });
      }
      if (p.vel.length() > 24 && Math.random() < 0.5) P(p.pos.x - p.vel.x * 0.02, p.pos.y - p.vel.y * 0.02, p.pos.z - p.vel.z * 0.02, 0, 0, 0, skinColor(p), 0.2, 0.35);
      if (f.sp && Math.random() < 0.5) P(p.pos.x, p.pos.y, p.pos.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0x7fd4ff, 0.22, 0.4);
      if (f.fv && Math.random() < 0.6) P(p.pos.x + rnd(-0.4, 0.4), p.pos.y + 0.6, p.pos.z + rnd(-0.4, 0.4), 0, 3, 0, 0xff8a1f, 0.25, 0.5);
    }
    // balas
    for (const ob of S.bullets.values()) { ob.x += ob.vx * vdt; ob.y += ob.vy * vdt; ob.z += ob.vz * vdt; ob.mesh.position.set(ob.x, ob.y, ob.z); ob.trail -= vdt; if (ob.trail <= 0) { ob.trail = 0.025; P(ob.x, ob.y, ob.z, 0, 0, 0, ob.mesh.material.color.getHex(), ob.mesh.scale.x * 0.8, 0.3); } }
    // cámara
    const me = S.players.get(S.id), emoting = me && me.emote && m.alive;
    let cx, cy, cz, yaw = m.yaw, pitch = m.pitch;
    if (!m.alive && S.spec) {
      const sp = S.spec, d = dirFrom(m.yaw, m.pitch), rt = [Math.cos(m.yaw), 0, -Math.sin(m.yaw)], v = 16 * dt, K = S.keys;
      const f = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0), r = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0), up = (K.Space ? 1 : 0) - (K.ShiftLeft ? 1 : 0);
      for (let i = 0; i < 3; i++) sp.p[i] += (d[i] * f + rt[i] * r) * v; sp.p[1] += up * v; [cx, cy, cz] = sp.p;
    } else if (emoting) { const d = dirFrom(m.yaw, 0.15); cx = m.p[0] + d[0] * 4.5; cy = m.p[1] + 1.4; cz = m.p[2] + d[2] * 4.5; yaw = m.yaw + Math.PI; pitch = -0.2; }
    else { cx = m.p[0]; cy = m.p[1] + 0.2; cz = m.p[2]; }
    if (S.dbg) { [cx, cy, cz] = S.dbg.p; yaw = S.dbg.yaw; pitch = S.dbg.pitch; } // cámara libre solo para pruebas (#dbg)
    if (S.shake > 0.001) { cx += rnd(-1, 1) * S.shake * 0.35; cy += rnd(-1, 1) * S.shake * 0.35; cz += rnd(-1, 1) * S.shake * 0.35; S.shake *= Math.pow(0.001, dt); }
    camera.position.set(cx, cy, cz); camera.rotation.order = 'YXZ'; camera.rotation.set(pitch + (S.kick > 0 ? S.kick * 0.002 : 0), yaw, 0);
    const spd = Math.hypot(m.v[0], m.v[1], m.v[2]); S.kick *= Math.pow(0.0005, dt);
    const fov = (ST.reduce ? 75 : 75 + Math.min(18, spd * 0.35) + S.kick * 0.6); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, 0.25); camera.updateProjectionMatrix(); }
    try { window.RAudio && window.RAudio.listener && window.RAudio.listener(cx, cy, cz, yaw, pitch); } catch (e) {}
    if (nowMs - S.lastMini > 100) { S.lastMini = nowMs; drawMini(); }
    const showVM = m.alive && !emoting && !S.dbg;
    if (showVM) vm.update(dt, spd, m.yaw, m.pitch, camera.aspect);
    return showVM;
  }

  /* ---------------------------------- INIT ---------------------------------- */
  if (location.hash === '#dbg') { RA.debug = { S, camera, scene, vm }; S.dbg = null; }
  function init() {
    applySettings(false); setupComposer(); resize(); coinsSet(coinsGet()); buildMenuScene(); UI.only('menu'); initSocket(); renderFriends();
    if (!S.name) showNameModal();
    document.addEventListener('pointerdown', function once() { music('menu'); document.removeEventListener('pointerdown', once); }); // el navegador exige un gesto para el audio
    requestAnimationFrame(frame);
  }
  init();
})();
