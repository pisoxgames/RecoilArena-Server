'use strict';
/* RECOIL ARENA 3D - shop.js (ENTREGA 4)
   Tienda: destacados semanales, ofertas diarias (rotan a medianoche UTC), pestañas, compra y equipado.
   Usa window.RA (client.js): RA.coins, RA.skin, RA.emotes, RA.owned. Datos en localStorage. */
(function () {
  const RA = window.RA, I18N = window.I18N, UI = window.UI, $ = id => document.getElementById(id);
  if (!RA || !I18N || !UI) { console.warn('shop.js: falta RA/I18N/UI'); return; }
  const tr = (k, p) => I18N.t(k, p);

  /* ------------------------------ CATÁLOGO ------------------------------ */
  const SKINS = [['default', 0, 'common'], ['clown', 200, 'common'], ['robot', 400, 'rare'], ['ninja', 500, 'rare'], ['alien', 800, 'epic'], ['ghost', 900, 'epic'], ['gold', 2000, 'legendary']];
  const EMOTES = [['wave', 0, 'common'], ['spin', 0, 'common'], ['robot', 0, 'common'], ['floss', 0, 'common'], ['moonwalk', 150, 'common'], ['breakdance', 300, 'rare'], ['kpop', 500, 'epic'], ['victory', 1200, 'legendary']];
  const EMOJI = { wave: '🌊', spin: '🌀', robot: '🤖', floss: '🪥', moonwalk: '🌙', breakdance: '🤸', kpop: '💃', victory: '🏆' };
  const ITEMS = SKINS.map(([id, price, rarity]) => ({ key: 'skin:' + id, type: 'skin', id, price, rarity }))
    .concat(EMOTES.map(([id, price, rarity]) => ({ key: 'emote:' + id, type: 'emote', id, price, rarity })));
  const BY_KEY = Object.fromEntries(ITEMS.map(i => [i.key, i]));

  /* ---------------------------- INVENTARIO ---------------------------- */
  function owned() {
    let list = RA.owned.get().slice(), changed = false;
    list = list.map(k => { if (k.indexOf(':') > 0) return k; changed = true; return k === 'default' ? 'skin:default' : (EMOJI[k] ? 'emote:' + k : 'skin:' + k); }); // migración de ids antiguos
    for (const it of ITEMS) if (it.price === 0 && !list.includes(it.key)) { list.push(it.key); changed = true; }
    if (changed) RA.owned.set(list);
    return new Set(list);
  }
  const isOwned = it => owned().has(it.key);
  const slots = () => RA.emotes.get();

  /* ---------------------- ROTACIÓN DIARIA / SEMANAL ---------------------- */
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seededShuffle(arr, seed) { const r = mulberry32(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function rotation() {
    const day = Math.floor(Date.now() / 86400000), paid = ITEMS.filter(i => i.price > 0);
    const featured = seededShuffle(paid.filter(i => i.rarity === 'epic' || i.rarity === 'legendary'), Math.floor(day / 7) + 101).slice(0, 3);
    const daily = seededShuffle(paid.filter(i => !featured.includes(i)), day + 7).slice(0, 6);
    return { featured, daily };
  }
  const msToReset = () => 86400000 - (Date.now() % 86400000);

  /* --------------------- PREVIEWS 3D (modelos y bailes reales) --------------------- */
  const PV = RA.preview, T = PV && PV.THREE, Gfx = PV && PV.Gfx;
  const stage = { ok: false, list: new Set(), cursor: 0, running: false, cache: new Map() };
  function initStage() {
    if (stage.ok || !T || !Gfx) return stage.ok;
    try {
      const W = 320, H = 260; stage.W = W; stage.H = H;
      stage.r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: false }); stage.r.setSize(W, H, false); stage.r.setPixelRatio(1); stage.r.setClearColor(0x000000, 0);
      stage.scene = new T.Scene(); stage.cam = new T.PerspectiveCamera(34, W / H, 0.1, 50); stage.cam.position.set(0, 0.6, 4.9); stage.cam.lookAt(0, 0.3, 0);
      stage.scene.add(new T.HemisphereLight(0xffffff, 0xb7a2ff, 2.1)); const d = new T.DirectionalLight(0xffffff, 1.3); d.position.set(2, 4, 4); stage.scene.add(d);
      const sh = new T.Mesh(new T.CircleGeometry(0.8, 24), new T.MeshBasicMaterial({ color: 0x1a1040, transparent: true, opacity: 0.28, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = -0.78; stage.scene.add(sh); stage.shadow = sh;
      stage.ok = true;
    } catch (e) { console.warn('shop 3D no disponible', e); stage.ok = false; }
    return stage.ok;
  }
  function avatarFor(skin) {
    let a = stage.cache.get(skin); if (!a) { a = Gfx.makeAvatar(skin); a.visible = false; stage.scene.add(a); stage.cache.set(skin, a); }
    return a;
  }
  function renderPreview(p, t) {
    const skin = p.type === 'skin' ? p.id : RA.skin.get(), a = avatarFor(skin);
    stage.cache.forEach(o => { o.visible = false; }); a.visible = true;
    const u = a.userData, tm = t + p.phase;
    if (p.type === 'skin') {
      PV.animateEmote(a, p.hover ? 'wave' : 'none', tm); u.body.position.y += Math.sin(tm * 2) * 0.06;
      a.rotation.y = p.hover ? Math.sin(tm * 2) * 0.35 : tm * 0.9; // plataforma giratoria
    } else {
      a.rotation.y = Math.PI + 0.3; PV.animateEmote(a, p.id, tm);
    }
    stage.shadow.scale.setScalar(1 - Math.min(0.35, Math.max(0, (u.body.position.y || 0) * 0.35)));
    stage.r.render(stage.scene, stage.cam); const x = p.cv.getContext('2d'); x.clearRect(0, 0, p.cv.width, p.cv.height); x.drawImage(stage.r.domElement, 0, 0);
  }
  function loop(now) {
    if (!stage.ok || $('shop').classList.contains('hidden')) { stage.running = false; return; }
    const t = now / 1000, vis = [], vh = innerHeight;
    stage.list.forEach(p => { if (!p.cv.isConnected) { stage.list.delete(p); return; } const r = p.cv.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh && r.width > 0) vis.push(p); });
    vis.sort((a, b) => (b.hover ? 1 : 0) - (a.hover ? 1 : 0)); let n = 0;
    for (const p of vis) { if (p.hover || p.first) { renderPreview(p, t); p.first = false; n++; } }
    const budget = 4; for (let k = 0; k < vis.length && n < budget + 1; k++) { const p = vis[(stage.cursor + k) % vis.length]; if (p.hover) continue; renderPreview(p, t); n++; }
    stage.cursor += budget; requestAnimationFrame(loop);
  }
  function startLoop() { if (stage.ok && !stage.running) { stage.running = true; requestAnimationFrame(loop); } }
  function makePreview(it) {
    if (!initStage()) { const f = document.createElement('div'); f.textContent = it.type === 'skin' ? (RA.skinEmoji[it.id] || '🟦') : EMOJI[it.id]; return f; }
    const cv = document.createElement('canvas'); cv.width = stage.W; cv.height = stage.H;
    const p = { cv, type: it.type, id: it.id, phase: Math.random() * 3, hover: false, first: true }; stage.list.add(p);
    cv.addEventListener('mouseenter', () => { p.hover = true; }); cv.addEventListener('mouseleave', () => { p.hover = false; });
    return cv;
  }

  /* ------------------------------ INTERFAZ ------------------------------ */
  let tab = 'all', picking = null;
  const featGrid = $('shopFeatured'), dailyGrid = $('shopDaily'), featTitle = featGrid.previousElementSibling, dailyTitle = dailyGrid.previousElementSibling;
  const listTitle = document.createElement('h2'), list = document.createElement('div'), timer = document.createElement('div'), bar = document.createElement('div');
  listTitle.className = 'shop-sec stroke'; list.className = 'grid-daily'; timer.style.cssText = 'opacity:.85;margin:-4px 0 10px;font-family:"Fredoka One",sans-serif'; bar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0 4px';
  dailyGrid.before(timer); $('shopEmpty').before(listTitle, list); document.querySelector('#shop .shop-top').after(bar);

  const itemName = it => tr((it.type === 'skin' ? 'skin_' : 'emote_') + it.id);
  function buy(it) {
    if (!RA.coins.spend(it.price)) { UI.toast(tr('not_enough'), 'err'); return; }
    const o = owned(); o.add(it.key); RA.owned.set([...o]); UI.toast(tr('purchased'), 'ok'); UI.sfx('powerup'); render();
  }
  function equip(it, slot) {
    if (it.type === 'skin') { RA.skin.set(it.id); UI.sfx('click'); picking = null; render(); return; }
    const a = slots().slice(), old = a.indexOf(it.id), prev = a[slot]; if (old >= 0) a[old] = prev; a[slot] = it.id; RA.emotes.set(a); picking = null; render();
  }
  function card(it, big) {
    const el = document.createElement('div'); el.className = 'item ' + it.rarity + (big ? ' big' : '');
    const prev = document.createElement('div'); prev.className = 'prev';
    prev.appendChild(makePreview(it));
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = itemName(it);
    const rar = document.createElement('div'); rar.className = 'rar'; rar.textContent = tr('rarity_' + it.rarity) + ' · ' + tr(it.type === 'skin' ? 'tab_skins' : 'tab_dances');
    el.append(prev, nm, rar);
    const has = isOwned(it), b = document.createElement('button'); b.className = 'btn small';
    if (!has) { b.classList.add('orange'); b.textContent = tr('buy') + ' · 🪙 ' + it.price; b.onclick = () => buy(it); el.appendChild(b); return el; }
    const eq = it.type === 'skin' ? RA.skin.get() === it.id : slots().includes(it.id);
    if (it.type === 'skin') { b.textContent = eq ? tr('equipped') : tr('equip'); if (!eq) b.classList.add('green'); b.disabled = eq; b.onclick = () => equip(it); el.appendChild(b); }
    else if (picking === it.key) { const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px'; for (let n = 0; n < 4; n++) { const s = document.createElement('button'); s.className = 'btn small blue'; s.textContent = tr('slot', { n: n + 1 }); s.onclick = () => equip(it, n); row.appendChild(s); } el.appendChild(row); }
    else { b.textContent = eq ? tr('equipped') + ' ✔' : tr('equip'); b.classList.add('green'); b.onclick = () => { picking = it.key; render(); }; el.appendChild(b); }
    return el;
  }
  function renderBar() {
    bar.innerHTML = ''; const a = slots();
    a.forEach((id, i) => { const s = document.createElement('div'); s.className = 'coinbox'; s.style.cssText += ';font-size:1rem;padding:4px 14px'; s.textContent = '[' + (i + 1) + '] ' + (EMOJI[id] || '?') + ' ' + tr('emote_' + id); bar.appendChild(s); });
  }
  function render() {
    if (!$('shop')) return; $('shopCoins').textContent = RA.coins.get(); renderBar();
    const all = tab === 'all', rot = rotation(); [featTitle, featGrid, dailyTitle, dailyGrid, timer].forEach(e => { e.style.display = all ? '' : 'none'; }); listTitle.style.display = list.style.display = all ? 'none' : '';
    if (all) { featGrid.innerHTML = ''; dailyGrid.innerHTML = ''; rot.featured.forEach(i => featGrid.appendChild(card(i, true))); rot.daily.forEach(i => dailyGrid.appendChild(card(i, false))); $('shopEmpty').classList.add('hidden'); }
    else {
      list.innerHTML = ''; listTitle.textContent = tr(tab === 'skins' ? 'tab_skins' : tab === 'dances' ? 'tab_dances' : 'tab_owned');
      const o = owned(), items = ITEMS.filter(i => tab === 'skins' ? i.type === 'skin' : tab === 'dances' ? i.type === 'emote' : o.has(i.key));
      items.forEach(i => list.appendChild(card(i, false))); $('shopEmpty').classList.toggle('hidden', items.length > 0);
    }
    tick(); startLoop();
  }
  function tick() { const s = Math.floor(msToReset() / 1000), p = n => String(n).padStart(2, '0'); timer.textContent = '⏱ ' + p(Math.floor(s / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60); }
  let lastDay = Math.floor(Date.now() / 86400000);
  setInterval(() => { if ($('shop').classList.contains('hidden')) return; tick(); const d = Math.floor(Date.now() / 86400000); if (d !== lastDay) { lastDay = d; render(); } }, 1000);

  $('btnShop').addEventListener('click', () => { picking = null; setTimeout(render, 0); });
  window.addEventListener('shoptab', e => { tab = e.detail; picking = null; render(); });
  window.addEventListener('coins', () => { if (!$('shop').classList.contains('hidden')) render(); });
  window.addEventListener('langchange', () => { if (!$('shop').classList.contains('hidden')) render(); });
  owned(); // migra ids antiguos al arrancar
  window.RAShop = { items: ITEMS, render, owned: () => [...owned()] };
})();
