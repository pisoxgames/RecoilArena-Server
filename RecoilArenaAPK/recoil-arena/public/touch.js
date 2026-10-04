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
  window.RATouch = { active: true };
})();
