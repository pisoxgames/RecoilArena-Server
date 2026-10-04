'use strict';
/* RECOIL ARENA 3D - touch.js
   Controles táctiles para móvil/tablet. Se activa solo si <html> tiene la clase "touch".
   Mismo servidor y mismo protocolo que PC: los jugadores de móvil y de PC comparten sala.
   - Arrastrar por la pantalla: apuntar     - Botón 🔥 (mantener): disparar (también se puede apuntar arrastrando)
   - ⚡ 💥 🪝: habilidades                    - ⤒: doble salto     - 😀: bailes     - 📊: marcador */
(function () {
  if (!document.documentElement.classList.contains('touch')) return;
  const RA = window.RA, I = RA && RA.input, hud = document.getElementById('hud');
  if (!RA || !I || !hud) { console.warn('touch.js: falta RA.input/#hud'); return; }
  document.body.classList.add('touch');

  const pd = e => { if (e.cancelable) e.preventDefault(); };
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  const tap = code => { key(code, true); setTimeout(() => key(code, false), 60); };
  const EMOJI = { wave: '🌊', spin: '🌀', robot: '🤖', floss: '🪥', moonwalk: '🌙', breakdance: '🤸', kpop: '💃', victory: '🏆' };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };

  /* ------------------------------ ELEMENTOS ------------------------------ */
  const look = document.createElement('div'); look.id = 'touchLook'; hud.insertBefore(look, hud.firstChild);
  const ui = document.createElement('div'); ui.id = 'touchUI'; hud.appendChild(ui);
  const mk = (id, txt, extra) => { const b = document.createElement('div'); b.id = id; b.className = 'tbtn'; b.textContent = txt; if (extra) b.setAttribute('aria-label', extra); ui.appendChild(b); return b; };
  const fire = mk('tFire', '🔥', 'fire'), jump = mk('tJump', '⤒', 'jump'), emoteBtn = mk('tEmote', '😀', 'emote'), board = mk('tBoard', '📊', 'scoreboard');
  const picker = document.createElement('div'); picker.id = 'tEmotes'; ui.appendChild(picker);

  /* ----------------------- APUNTAR (arrastrar con un dedo) ----------------------- */
  const pts = new Map(); // identifier -> {x,y}
  function startLook(e) { for (const t of e.changedTouches) pts.set(t.identifier, { x: t.clientX, y: t.clientY }); }
  function moveLook(e) {
    for (const t of e.changedTouches) { const p = pts.get(t.identifier); if (!p) continue; I.look(t.clientX - p.x, t.clientY - p.y); p.x = t.clientX; p.y = t.clientY; }
  }
  function endLook(e) { for (const t of e.changedTouches) pts.delete(t.identifier); }
  look.addEventListener('touchstart', e => { pd(e); startLook(e); picker.classList.remove('open'); }, { passive: false });
  look.addEventListener('touchmove', e => { pd(e); moveLook(e); }, { passive: false });
  ['touchend', 'touchcancel'].forEach(n => look.addEventListener(n, e => { pd(e); endLook(e); }, { passive: false }));

  /* --------------------------------- DISPARO --------------------------------- */
  let fireId = null;
  fire.addEventListener('touchstart', e => {
    pd(e); const t = e.changedTouches[0]; fireId = t.identifier; pts.set(t.identifier, { x: t.clientX, y: t.clientY });
    fire.classList.add('on'); I.fire(true); buzz(8);
  }, { passive: false });
  fire.addEventListener('touchmove', e => { pd(e); moveLook(e); }, { passive: false }); // se puede apuntar arrastrando desde el botón
  const stopFire = e => { pd(e); for (const t of e.changedTouches) if (t.identifier === fireId) { fireId = null; pts.delete(t.identifier); fire.classList.remove('on'); I.fire(false); } };
  fire.addEventListener('touchend', stopFire, { passive: false }); fire.addEventListener('touchcancel', stopFire, { passive: false });

  /* ------------------------------- HABILIDADES ------------------------------- */
  function bindTap(el, code, v) {
    el.addEventListener('touchstart', e => { pd(e); el.classList.add('on'); tap(code); if (v) buzz(v); }, { passive: false });
    ['touchend', 'touchcancel'].forEach(n => el.addEventListener(n, e => { pd(e); el.classList.remove('on'); }, { passive: false }));
  }
  bindTap(document.getElementById('abDash'), 'ShiftLeft', 15); bindTap(document.getElementById('abBomb'), 'KeyQ', 25); bindTap(document.getElementById('abGrapple'), 'KeyE', 15);
  bindTap(jump, 'Space', 10); bindTap(document.getElementById('nukeBadge'), 'KeyR', 40);

  /* --------------------------------- MARCADOR --------------------------------- */
  let boardOn = false;
  board.addEventListener('touchstart', e => { pd(e); boardOn = !boardOn; key('Tab', boardOn); if (!boardOn) key('Tab', false); board.classList.toggle('on', boardOn); }, { passive: false });

  /* ---------------------------------- BAILES ---------------------------------- */
  emoteBtn.addEventListener('touchstart', e => {
    pd(e); if (picker.classList.toggle('open')) {
      picker.innerHTML = ''; RA.emotes.get().forEach((id, n) => {
        const b = document.createElement('div'); b.className = 'tbtn'; b.textContent = EMOJI[id] || '❓';
        b.addEventListener('touchstart', ev => { pd(ev); tap('Digit' + (n + 1)); picker.classList.remove('open'); }, { passive: false }); picker.appendChild(b);
      });
    }
  }, { passive: false });

  /* ------------------------ DISPOSICIÓN PERSONALIZABLE ------------------------ */
  // Cada botón se guarda como {x,y} (fracción de la pantalla, centro), s (tamaño px) y o (opacidad). Se edita en Ajustes > Personalizar controles.
  const REAL = { fire: 'tFire', jump: 'tJump', dash: 'abDash', bomb: 'abBomb', grapple: 'abGrapple', emote: 'tEmote', board: 'tBoard' };
  const ICON = { fire: '🔥', jump: '⤒', dash: '⚡', bomb: '💥', grapple: '🪝', emote: '😀', board: '📊' };
  const COL = { fire: ['#ff6a3d', '#d41f2a'], jump: ['#6be26b', '#1f9a2b'], dash: ['#4fc0ff', '#1a6fd0'], bomb: ['#ffb347', '#e0701a'], grapple: ['#c08bff', '#6a35c9'], emote: ['#ffd93d', '#ff9a1f'], board: ['#8fd0ff', '#2a7be0'] };
  const NAME_KEY = { fire: 'ctrl_fire', jump: 'ctrl_jump', dash: 'ability_dash', bomb: 'ability_bomb', grapple: 'ability_grapple', emote: 'ctrl_emote', board: 'ctrl_board' };
  const DEFAULT_LAYOUT = {
    fire: { x: 0.905, y: 0.805, s: 116, o: 1 }, jump: { x: 0.92, y: 0.53, s: 66, o: 1 },
    dash: { x: 0.605, y: 0.88, s: 60, o: 1 }, bomb: { x: 0.69, y: 0.88, s: 60, o: 1 }, grapple: { x: 0.775, y: 0.88, s: 60, o: 1 },
    emote: { x: 0.045, y: 0.25, s: 46, o: 1 }, board: { x: 0.045, y: 0.39, s: 46, o: 1 }
  };
  ['abDash', 'abBomb', 'abGrapple'].forEach(id => { const e = document.getElementById(id); if (e) ui.appendChild(e); }); // las habilidades pasan a ser libres (mantienen su anillo de recarga)
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function loadLayout() {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('ra_touch_layout') || '{}') || {}; } catch (e) { saved = {}; }
    const L = clone(DEFAULT_LAYOUT); for (const k of Object.keys(L)) if (saved[k]) Object.assign(L[k], { x: +saved[k].x || L[k].x, y: +saved[k].y || L[k].y, s: +saved[k].s || L[k].s, o: saved[k].o === undefined ? 1 : +saved[k].o });
    return L;
  }
  function place(el, c) {
    const st = el.style; st.left = (c.x * 100) + '%'; st.top = (c.y * 100) + '%'; st.right = 'auto'; st.bottom = 'auto';
    st.width = st.height = c.s + 'px'; st.marginLeft = st.marginTop = (-c.s / 2) + 'px'; st.opacity = c.o; st.fontSize = (c.s * 0.45) + 'px';
  }
  let layout = loadLayout();
  function applyLayout() {
    for (const k of Object.keys(REAL)) { const el = document.getElementById(REAL[k]); if (el) place(el, layout[k]); }
    const c = layout.emote; picker.style.left = (c.x * innerWidth + c.s / 2 + 8) + 'px'; picker.style.top = (c.y * innerHeight - 25) + 'px';
  }
  applyLayout(); addEventListener('resize', applyLayout);

  /* ------------------------------ EDITOR VISUAL ------------------------------ */
  const T = (k, d) => { try { const v = window.I18N && window.I18N.t(k); return v && v !== k ? v : d; } catch (e) { return d; } };
  let ed = null;
  function openEditor() {
    if (ed) return; const work = clone(layout); let sel = 'fire';
    const root = document.createElement('div'); root.id = 'tEditor';
    root.innerHTML = '<div class="te-hint"></div><div class="te-panel"><b class="te-name"></b>' +
      '<label>' + T('ctrl_size', 'Tamaño') + '<input type="range" id="teSize" min="32" max="170"></label>' +
      '<label>' + T('ctrl_opacity', 'Opacidad') + '<input type="range" id="teOp" min="25" max="100"></label>' +
      '<button class="btn small" id="teReset">' + T('ctrl_reset', 'Restablecer') + '</button><button class="btn small red" id="teCancel">' + T('cancel', 'Cancelar') + '</button><button class="btn small green" id="teSave">' + T('save', 'Guardar') + '</button></div>';
    document.body.appendChild(root); root.querySelector('.te-hint').textContent = T('ctrl_hint', 'Arrastra los botones donde quieras · toca uno para cambiar su tamaño');
    const ghosts = {};
    for (const k of Object.keys(REAL)) {
      const g = document.createElement('div'); g.className = 'tbtn te-ghost'; g.textContent = ICON[k]; g.dataset.k = k;
      g.style.setProperty('--c1', COL[k][0]); g.style.setProperty('--c2', COL[k][1]); root.appendChild(g); ghosts[k] = g; place(g, work[k]);
      let id = null, dx = 0, dy = 0;
      g.addEventListener('touchstart', e => { pd(e); const t = e.changedTouches[0]; id = t.identifier; select(k); dx = t.clientX - work[k].x * innerWidth; dy = t.clientY - work[k].y * innerHeight; }, { passive: false });
      g.addEventListener('touchmove', e => { pd(e); for (const t of e.changedTouches) if (t.identifier === id) { work[k].x = clamp((t.clientX - dx) / innerWidth, 0.03, 0.97); work[k].y = clamp((t.clientY - dy) / innerHeight, 0.05, 0.97); place(g, work[k]); } }, { passive: false });
      ['touchend', 'touchcancel'].forEach(n => g.addEventListener(n, e => { pd(e); id = null; }, { passive: false }));
    }
    const size = root.querySelector('#teSize'), op = root.querySelector('#teOp'), nm = root.querySelector('.te-name');
    function select(k) { sel = k; for (const q of Object.keys(ghosts)) ghosts[q].classList.toggle('sel', q === k); nm.textContent = ICON[k] + ' ' + T(NAME_KEY[k], k); size.value = work[k].s; op.value = Math.round(work[k].o * 100); }
    size.addEventListener('input', () => { work[sel].s = +size.value; place(ghosts[sel], work[sel]); });
    op.addEventListener('input', () => { work[sel].o = +op.value / 100; place(ghosts[sel], Object.assign({}, work[sel], { o: Math.max(0.35, work[sel].o) })); });
    const close = () => { root.remove(); ed = null; };
    root.querySelector('#teReset').addEventListener('click', () => { Object.assign(work, clone(DEFAULT_LAYOUT)); for (const k of Object.keys(ghosts)) place(ghosts[k], work[k]); select(sel); });
    root.querySelector('#teCancel').addEventListener('click', close);
    root.querySelector('#teSave').addEventListener('click', () => { layout = clone(work); try { localStorage.setItem('ra_touch_layout', JSON.stringify(layout)); } catch (e) { /* sin storage */ } applyLayout(); close(); if (window.UI && UI.toast) UI.toast(T('ctrl_saved', '¡Controles guardados!'), 'ok', 1500); });
    ed = root; select('fire');
  }
  const editBtn = document.getElementById('btnEditControls');
  if (editBtn) editBtn.addEventListener('click', () => { if (window.UI) UI.hide('settings'); openEditor(); });
  window.RATouch = { openEditor, getLayout: () => clone(layout) };

  /* ------------------- PANTALLA COMPLETA + HORIZONTAL AL JUGAR ------------------- */
  let fsTried = false;
  function goFullscreen() {
    if (fsTried) return; fsTried = true;
    try {
      const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) { const p = req.call(el); const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* no soportado */ } }; if (p && p.then) p.then(lock).catch(() => {}); else lock(); }
    } catch (e) { /* iOS Safari no permite fullscreen: se juega igualmente */ }
  }
  document.addEventListener('touchend', e => { if (e.target.closest && e.target.closest('#btnPlay,#optQuick,#optCreate,#btnJoinCode')) goFullscreen(); }, { capture: true });

  /* Evita gestos del navegador (zoom por doble toque, menú contextual) durante la partida */
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  let lastEnd = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastEnd < 300 && e.target.closest && e.target.closest('#hud')) pd(e); lastEnd = n; }, { passive: false });
})();
