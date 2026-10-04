'use strict';
/* =====================================================================
   RECOIL ARENA 3D  -  server.js  (ENTREGA 1)
   Servidor autoritativo: Node.js + Express + Socket.io. Física propia.
   Convención de ángulos (igual que Three.js con rotation.order='YXZ'):
     dir = [-sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch)]
   ===================================================================== */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 1e5, cors: { origin: true, methods: ['GET', 'POST'] } }); // CORS abierto: el .exe y otras webs pueden conectarse a este servidor

app.disable('x-powered-by');
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ ok: true, game: 'recoil-arena-3d', uptime: Math.round(process.uptime()) })); // para UptimeRobot / comprobaciones
app.get('/', (req, res) => res.type('text').send('RECOIL ARENA 3D: servidor activo. Falta public/index.html (Entrega 2).'));

/* ------------------------- CONFIGURACIÓN ------------------------- */
const CFG = {
  TICK_RATE: 60, NET_RATE: 20, MAX_DT: 1 / 30,
  MAX_PLAYERS: 10, WIN_KILLS: 10,
  PLAYER_R: 0.6, BULLET_R: 0.25, BULLET_SPEED: 42, BULLET_TTL: 3, BULLET_BOUNCES: 1,
  FIRE_INTERVAL: 0.22, RECOIL: 9, FRICTION: 0.98, RESTITUTION: 0.6,
  DASH_FORCE: 26, DASH_CD: 3000, BOMB_CD: 10000, BOMB_R: 14, BOMB_FORCE: 34,
  GRAPPLE_CD: 5000, GRAPPLE_MISS_CD: 800, GRAPPLE_RANGE: 70, GRAPPLE_FORCE: 34,
  NUKE_FORCE: 58, JUMP: 9, TRAMPOLINE: 20, GEYSER: 26, LAVA_DMG: 25,
  MAX_SPEED: 45, MAX_SPEED_SPEED: 58, MAX_SPEED_BOOST: 70,
  RESPAWN_MS: 3000, INVULN_MS: 1500, START_DELAY_MS: 3000,
  ROULETTE_INTERVAL: 60, ROULETTE_SPIN: 3,
  FEVER_MS: 5000, MULTI_WINDOW: 4000, ASSIST_WINDOW: 5000, PUSH_CREDIT_WINDOW: 4000,
  COIN_KILL: 10, COIN_ASSIST: 5, COIN_WIN: 50, COIN_PARTICIPATION: 20,
  GRACE_MS: 15000, REWIND_INTERP_MS: 100, REWIND_MAX_MS: 250
};
// Subconjunto que necesita el cliente para predicción local
const CLIENT_CFG = {
  playerR: CFG.PLAYER_R, bulletSpeed: CFG.BULLET_SPEED, recoil: CFG.RECOIL, friction: CFG.FRICTION,
  restitution: CFG.RESTITUTION, dashForce: CFG.DASH_FORCE, dashCd: CFG.DASH_CD, bombCd: CFG.BOMB_CD,
  bombR: CFG.BOMB_R, grappleCd: CFG.GRAPPLE_CD, grappleRange: CFG.GRAPPLE_RANGE, jump: CFG.JUMP,
  maxSpeed: CFG.MAX_SPEED, respawnMs: CFG.RESPAWN_MS, winKills: CFG.WIN_KILLS, fireInterval: CFG.FIRE_INTERVAL,
  rouletteInterval: CFG.ROULETTE_INTERVAL, rouletteSpin: CFG.ROULETTE_SPIN, netRate: CFG.NET_RATE, feverMs: CFG.FEVER_MS
};

const SKINS = ['default', 'robot', 'ghost', 'ninja', 'clown', 'alien', 'gold'];
const EMOTE_DUR = { robot: 3, wave: 3, spin: 2.5, moonwalk: 3.5, floss: 4, breakdance: 4, kpop: 5, victory: 5 };
const EMOTE_IDS = Object.keys(EMOTE_DUR);
const ROULETTE_TYPES = ['shield', 'invisible', 'giant', 'speed', 'magnet', 'nuke'];
const TIMED_MS = { invisible: 5000, giant: 10000, speed: 10000, magnet: 15000 };
const BOT_NAMES = ['BotTron3000', 'IAnoob', 'RobotFeliz', 'PixelPanda', 'SrTornillo', 'Chatarrin', 'BeepBoop', 'DonBits', 'LataLoca', 'MisterByte', 'CaptainCable', 'TurboTostadora'];
const WORDS = ['POW!', 'BAM!', 'BONK!'];

/* ---------------------------- UTILIDADES ---------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const r2 = v => Math.round(v * 100) / 100;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function dirFrom(yaw, pitch) { const c = Math.cos(pitch); return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c]; }
function aimTo(dx, dy, dz) { const l = Math.hypot(dx, dy, dz) || 1; return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(clamp(dy / l, -1, 1)) }; }
function sanitizeName(n) { n = String(n == null ? '' : n).trim(); return /^[A-Za-z0-9_]{3,16}$/.test(n) ? n : null; }
const low = s => String(s).toLowerCase();

/* ------------------------------ MAPAS ------------------------------ */
// El servidor es la fuente de verdad de la geometría. El cliente (maps.js) añade la decoración.
const box = (cx, cy, cz, w, h, d) => ({ min: [cx - w / 2, cy - h / 2, cz - d / 2], max: [cx + w / 2, cy + h / 2, cz + d / 2] });

function buildMaze() {
  const N = 7, S = 7, T = 1.2, H = 9, off = -(N * S) / 2, rng = mulberry32(20240607);
  const mk = v => Array.from({ length: N }, () => Array(N).fill(v));
  const vis = mk(false), east = mk(true), south = mk(true);
  const stack = [[0, 0]]; vis[0][0] = true;
  while (stack.length) {
    const [x, z] = stack[stack.length - 1], nb = [];
    if (x > 0 && !vis[x - 1][z]) nb.push([x - 1, z, 'w']);
    if (x < N - 1 && !vis[x + 1][z]) nb.push([x + 1, z, 'e']);
    if (z > 0 && !vis[x][z - 1]) nb.push([x, z - 1, 'n']);
    if (z < N - 1 && !vis[x][z + 1]) nb.push([x, z + 1, 's']);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, nz, d] = nb[Math.floor(rng() * nb.length)];
    if (d === 'e') east[x][z] = false; else if (d === 'w') east[nx][nz] = false;
    else if (d === 's') south[x][z] = false; else south[nx][nz] = false;
    vis[nx][nz] = true; stack.push([nx, nz]);
  }
  const solids = [];
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    if (x < N - 1 && east[x][z] && rng() > 0.22) solids.push(box(off + (x + 1) * S, H / 2, off + (z + 0.5) * S, T, H, S + T));
    if (z < N - 1 && south[x][z] && rng() > 0.22) solids.push(box(off + (x + 0.5) * S, H / 2, off + (z + 1) * S, S + T, H, T));
  }
  const cc = c => off + (c + 0.5) * S, h = S / 2 - 0.1;
  const zone = (cx, cz, g) => ({ min: [cc(cx) - h, 0, cc(cz) - h], max: [cc(cx) + h, 12, cc(cz) + h], g });
  const spawnCells = [[0, 0], [6, 0], [0, 6], [6, 6], [3, 3], [3, 0], [0, 3], [6, 3], [3, 6], [2, 4]];
  return {
    solids, gravityZones: [zone(1, 1, [0, 5, 0]), zone(5, 2, [5, 0, 0]), zone(3, 5, [0, 0, -5])],
    spawns: spawnCells.map(([cx, cz]) => [cc(cx), 2, cc(cz)])
  };
}

function buildMaps() {
  const M = {};
  const base = { trampolines: [], portals: [], lava: [], gravityZones: [], voidY: null, voidRespawn: null };
  const P = 19;
  M.arena = Object.assign({}, base, {
    id: 'arena', nameKey: 'map_arena', bounds: { min: [-24, 0, -24], max: [24, 22, 24] }, floor: true, walls: true, gravity: [0, -6, 0],
    solids: [box(P, 11, P, 3, 22, 3), box(-P, 11, P, 3, 22, 3), box(P, 11, -P, 3, 22, 3), box(-P, 11, -P, 3, 22, 3)],
    trampolines: [{ x: 14, y: 0, z: 14, r: 2.6 }, { x: -14, y: 0, z: 14, r: 2.6 }, { x: 14, y: 0, z: -14, r: 2.6 }, { x: -14, y: 0, z: -14, r: 2.6 }],
    portals: [{ r: 2.4, a: { x: -24, y: 7, z: 0, nx: 1, ny: 0, nz: 0 }, b: { x: 24, y: 7, z: 0, nx: -1, ny: 0, nz: 0 } }],
    spawns: [[-10, 3, -10], [10, 3, -10], [-10, 3, 10], [10, 3, 10], [0, 3, -16], [0, 3, 16], [-16, 3, 0], [16, 3, 0], [0, 8, 0], [-6, 3, 4]]
  });
  M.sky = Object.assign({}, base, {
    id: 'sky', nameKey: 'map_sky', bounds: { min: [-60, -40, -60], max: [60, 50, 60] }, floor: false, walls: false, gravity: [0, -5, 0],
    solids: [box(0, 0, 0, 16, 1.6, 16), box(24, 6, 8, 9, 1.6, 9), box(-22, 4, 14, 11, 1.6, 9), box(10, 11, -26, 9, 1.6, 9), box(-18, 15, -20, 8, 1.6, 8), box(30, -3, -14, 10, 1.6, 10)],
    voidY: -30, voidRespawn: [0, 4, 0],
    spawns: [[0, 2.5, 0], [24, 8, 8], [-22, 6, 14], [10, 13, -26], [-18, 17, -20], [30, -0.5, -14], [4, 2.5, 4], [-4, 2.5, -4], [26, 8, 10], [-24, 6, 16]]
  });
  const mz = buildMaze();
  M.maze = Object.assign({}, base, {
    id: 'maze', nameKey: 'map_maze', bounds: { min: [-24.5, 0, -24.5], max: [24.5, 12, 24.5] }, floor: true, walls: true, gravity: [0, -5, 0],
    solids: mz.solids, gravityZones: mz.gravityZones, spawns: mz.spawns
  });
  M.volcano = Object.assign({}, base, {
    id: 'volcano', nameKey: 'map_volcano', bounds: { min: [-32, 0, -32], max: [32, 28, 32] }, floor: true, walls: true, gravity: [0, -6.5, 0],
    solids: [box(-16, 7, -14, 7, 1.6, 7), box(15, 10, -12, 6, 1.6, 6), box(0, 14, 10, 8, 1.6, 8), box(-18, 18, 14, 6, 1.6, 6), box(20, 6, 16, 7, 1.6, 7)],
    lava: [{ min: [-32, 0, -3], max: [-9, 1.4, 3] }, { min: [9, 0, -3], max: [32, 1.4, 3] }, { min: [-3, 0, 12], max: [3, 1.4, 32] }],
    spawns: [[-20, 2, -20], [20, 2, -20], [-20, 2, 20], [20, 2, 20], [0, 2, -16], [-8, 2, 16], [8, 2, 10], [0, 2, 0], [-16, 9, -14], [15, 12, -12]]
  });
  return M;
}
const MAPS = buildMaps();
const MAP_IDS = Object.keys(MAPS);

/* ------------------------ FÍSICA (vectorial) ------------------------ */
// Empuja una esfera fuera de una caja AABB. Devuelve la normal de contacto o null.
function pushOutBox(e, r, bx) {
  const cx = clamp(e.x, bx.min[0], bx.max[0]), cy = clamp(e.y, bx.min[1], bx.max[1]), cz = clamp(e.z, bx.min[2], bx.max[2]);
  const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz, d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return null;
  let nx, ny, nz, pen;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
  else { // centro dentro de la caja: salir por la cara más cercana
    const ds = [e.x - bx.min[0], bx.max[0] - e.x, e.y - bx.min[1], bx.max[1] - e.y, e.z - bx.min[2], bx.max[2] - e.z];
    let k = 0; for (let i = 1; i < 6; i++) if (ds[i] < ds[k]) k = i;
    nx = ny = nz = 0;
    if (k === 0) nx = -1; else if (k === 1) nx = 1; else if (k === 2) ny = -1; else if (k === 3) ny = 1; else if (k === 4) nz = -1; else nz = 1;
    pen = ds[k] + r;
  }
  e.x += nx * pen; e.y += ny * pen; e.z += nz * pen;
  return [nx, ny, nz];
}
// Rebote con restitución; a baja velocidad no rebota (evita temblores)
function bounceVel(e, n, rest) {
  const vn = e.vx * n[0] + e.vy * n[1] + e.vz * n[2];
  if (vn >= 0) return;
  const k = Math.abs(vn) < 1.2 ? 1 : 1 + rest;
  e.vx -= k * vn * n[0]; e.vy -= k * vn * n[1]; e.vz -= k * vn * n[2];
}
function noteContact(p, n) {
  const g = p.g, gl = Math.hypot(g[0], g[1], g[2]);
  if (gl > 0.01) { if (-(n[0] * g[0] + n[1] * g[1] + n[2] * g[2]) / gl > 0.7) p.grounded = true; }
  else if (n[1] > 0.7) p.grounded = true;
}
function insideBox(e, bx) { return e.x >= bx.min[0] && e.x <= bx.max[0] && e.y >= bx.min[1] && e.y <= bx.max[1] && e.z >= bx.min[2] && e.z <= bx.max[2]; }

// Portales: teletransportan jugadores y balas conservando velocidad
function usePortals(m, e, r, dt) {
  if (!m.portals.length) return null;
  e.pcd = Math.max(0, (e.pcd || 0) - dt);
  if (e.pcd > 0) return null;
  for (const pt of m.portals) for (const [A, B] of [[pt.a, pt.b], [pt.b, pt.a]]) {
    const dx = e.x - A.x, dy = e.y - A.y, dz = e.z - A.z, rr = pt.r + r;
    if (dx * dx + dy * dy + dz * dz < rr * rr && e.vx * A.nx + e.vy * A.ny + e.vz * A.nz < 0) {
      const sp = Math.max(Math.hypot(e.vx, e.vy, e.vz), 8), off = pt.r + r + 1.2;
      e.x = B.x + B.nx * off; e.y = B.y + B.ny * off; e.z = B.z + B.nz * off;
      e.vx = B.nx * sp; e.vy = B.ny * sp; e.vz = B.nz * sp; e.pcd = 0.7;
      return { x: B.x, y: B.y, z: B.z };
    }
  }
  return null;
}

function segDist2(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, l2 = abx * abx + aby * aby + abz * abz;
  let t = 0; if (l2 > 1e-12) t = clamp(((cx - ax) * abx + (cy - ay) * aby + (cz - az) * abz) / l2, 0, 1);
  const dx = ax + abx * t - cx, dy = ay + aby * t - cy, dz = az + abz * t - cz;
  return dx * dx + dy * dy + dz * dz;
}
function rayBox(o, d, bx) {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < bx.min[i] || o[i] > bx.max[i]) return null; }
    else {
      let t1 = (bx.min[i] - o[i]) / d[i], t2 = (bx.max[i] - o[i]) / d[i];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
function rayExit(o, d, b) {
  let t = Infinity;
  for (let i = 0; i < 3; i++) { if (d[i] > 1e-9) t = Math.min(t, (b.max[i] - o[i]) / d[i]); else if (d[i] < -1e-9) t = Math.min(t, (b.min[i] - o[i]) / d[i]); }
  return isFinite(t) ? Math.max(t, 0) : null;
}
function raySphere(o, d, c, r) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

/* --------------------------- ESTADO GLOBAL --------------------------- */
const rooms = new Map();      // code -> room
const users = new Map();      // id -> user (sesión)
const tokens = new Map();     // token -> user
const names = new Map();      // nombre en minúsculas -> user
const friendships = new Map();// nombre(min) -> Set(nombre(min))
const displayNames = new Map();// nombre(min) -> nombre original
const pendingReq = new Map(); // destino(min) -> Map(origen(min) -> nombre)

/* Persistencia sencilla de amigos en ./data/friends.json */
const DATA_DIR = process.env.RA_DATA_DIR || path.join(__dirname, 'data'), DATA_FILE = path.join(DATA_DIR, 'friends.json');
(function loadData() {
  try {
    const j = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const [k, v] of Object.entries(j.friends || {})) friendships.set(k, new Set(v));
    for (const [k, v] of Object.entries(j.names || {})) displayNames.set(k, v);
    for (const [k, v] of Object.entries(j.pending || {})) pendingReq.set(k, new Map(Object.entries(v)));
  } catch (e) { /* primera ejecución */ }
})();
let saveTimer = null;
function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const o = { friends: {}, names: {}, pending: {} };
      for (const [k, v] of friendships) o.friends[k] = [...v];
      for (const [k, v] of displayNames) o.names[k] = v;
      for (const [k, v] of pendingReq) o.pending[k] = Object.fromEntries(v);
      fs.writeFileSync(DATA_FILE, JSON.stringify(o));
    } catch (e) { console.error('saveData:', e.message); }
  }, 500);
}

/* ------------------------------ SALAS ------------------------------ */
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) { let c = ''; for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)]; if (!rooms.has(c)) return c; }
}
function createRoom(host, isPublic) {
  const room = {
    code: genCode(), host: host.id, isPublic: !!isPublic, max: CFG.MAX_PLAYERS, mapId: 'arena', map: MAPS.arena,
    state: 'lobby', players: new Map(), bullets: [], nextBulletId: 1, botSeq: 1, startAt: 0, rouletteAt: 0,
    pendingRoulette: null, autoStartAt: 0, createdAt: Date.now()
  };
  rooms.set(room.code, room);
  return room;
}
function emitRoom(room, ev, data) { io.to(room.code).emit(ev, data); }
function toUser(u, ev, data) { if (u && u.socket) u.socket.emit(ev, data); }
function publicRoom(room) {
  return {
    code: room.code, isPublic: room.isPublic, max: room.max, map: room.mapId, state: room.state, host: room.host,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, isBot: p.isBot, skin: p.skin, host: p.id === room.host }))
  };
}
function emitRoomUpdate(room) { emitRoom(room, 'room:update', publicRoom(room)); }
function listRooms() {
  return [...rooms.values()].filter(r => r.isPublic && r.state !== 'ended' && r.players.size < r.max).map(r => {
    const h = r.players.get(r.host);
    return { code: r.code, players: r.players.size, max: r.max, map: r.mapId, state: r.state, hostName: h ? h.name : '' };
  });
}

function makePlayer(id, name, isBot, skin) {
  return {
    id, name, isBot: !!isBot, skin: SKINS.includes(skin) ? skin : 'default', joinedAt: Date.now(), disconnectedAt: 0,
    x: 0, y: 3, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, g: [0, -6, 0], grounded: false, djUsed: false, pcd: 0,
    alive: false, hp: 100, respawnAt: 0, invulnUntil: 0, lastDamage: 0, lavaCd: 0, boostUntil: 0,
    lastShot: 0, dashReadyAt: 0, bombReadyAt: 0, grappleReadyAt: 0, lastSeq: 0,
    shield: false, nuke: false, timed: null, feverUntil: 0, emote: null,
    kills: 0, deaths: 0, coins: 0, streak: 0, multi: 0, lastKillAt: 0, pushers: new Map(),
    stats: { shots: 0, hits: 0, damage: 0, distance: 0, powerups: 0, assists: 0 },
    hist: [], rewind: 0, ping: 0, ai: null, nukeAt: 0
  };
}
function resetPlayer(p) {
  Object.assign(p, {
    alive: false, hp: 100, kills: 0, deaths: 0, coins: 0, streak: 0, multi: 0, lastKillAt: 0, shield: false, nuke: false, timed: null,
    feverUntil: 0, emote: null, dashReadyAt: 0, bombReadyAt: 0, grappleReadyAt: 0, lastShot: 0, hist: [], ai: null, nukeAt: 0,
    stats: { shots: 0, hits: 0, damage: 0, distance: 0, powerups: 0, assists: 0 }
  });
  p.pushers.clear();
}
const has = (p, type, t) => !!(p.timed && p.timed.type === type && p.timed.until > t);

function pickSpawn(room, p) {
  const sp = room.map.spawns; let best = sp[0], bd = -1;
  for (let k = 0; k < 6; k++) {
    const c = pick(sp); let md = 1e9;
    for (const q of room.players.values()) { if (q === p || !q.alive) continue; md = Math.min(md, Math.hypot(c[0] - q.x, c[1] - q.y, c[2] - q.z)); }
    if (md > bd) { bd = md; best = c; }
  }
  return best;
}
function respawn(room, p, t) {
  const s = pickSpawn(room, p);
  p.x = s[0]; p.y = s[1]; p.z = s[2]; p.vx = p.vy = p.vz = 0; p.hp = 100; p.alive = true; p.djUsed = false;
  p.invulnUntil = t + CFG.INVULN_MS; p.hist = []; p.pcd = 0; p.g = room.map.gravity;
  emitRoom(room, 'spawn', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
}

function addBot(room) {
  if (room.players.size >= room.max) return false;
  const used = new Set([...room.players.values()].map(p => p.name));
  let name = BOT_NAMES.find(n => !used.has(n));
  if (!name) name = 'Bot' + (room.botSeq + 100);
  const id = 'bot' + room.botSeq++ + '_' + room.code;
  const b = makePlayer(id, name, true, pick(SKINS));
  room.players.set(id, b);
  return true;
}
function removeBot(room) {
  const bots = [...room.players.values()].filter(p => p.isBot);
  if (!bots.length) return false;
  room.players.delete(bots[bots.length - 1].id);
  return true;
}

function joinRoom(u, room) {
  if (room.players.has(u.id)) return { ok: true };
  if (room.players.size >= room.max) return { ok: false, key: 'err_room_full' };
  if (u.roomCode) leaveRoom(u);
  const p = makePlayer(u.id, u.name, false, u.skin);
  room.players.set(u.id, p); u.roomCode = room.code;
  if (u.socket) u.socket.join(room.code);
  toUser(u, 'room:joined', { room: publicRoom(room), you: u.id });
  if (u.socket) u.socket.to(room.code).emit('notify', { key: 'player_joined', p: { name: u.name } });
  emitRoomUpdate(room);
  if (room.state === 'playing') { resetPlayer(p); respawn(room, p, Date.now()); sendGameStart(u, room); }
  pushStatus(u);
  return { ok: true };
}
function leaveRoom(u) {
  const room = rooms.get(u.roomCode); u.roomCode = null;
  if (!room) return;
  room.players.delete(u.id);
  if (u.socket) { u.socket.leave(room.code); u.socket.emit('room:left', {}); }
  emitRoom(room, 'notify', { key: 'player_left', p: { name: u.name } });
  const humans = [...room.players.values()].filter(x => !x.isBot);
  if (!humans.length) { rooms.delete(room.code); pushStatus(u); return; }
  if (room.host === u.id) {
    humans.sort((a, b) => a.joinedAt - b.joinedAt); room.host = humans[0].id;
    emitRoom(room, 'notify', { key: 'new_host', p: { name: humans[0].name } });
  }
  emitRoomUpdate(room);
  if (room.state === 'playing' && room.players.size < 2) {
    const last = [...room.players.values()][0]; if (last) endGame(room, last, Date.now());
  }
  pushStatus(u);
}
function sendGameStart(u, room) {
  toUser(u, 'game:start', {
    map: room.map, cfg: CLIENT_CFG, you: u.id, startsIn: Math.max(0, room.startAt - Date.now()),
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, skin: p.skin, isBot: p.isBot }))
  });
}
function startGame(room) {
  const t = Date.now();
  room.state = 'playing'; room.bullets = []; room.pendingRoulette = null; room.autoStartAt = 0;
  room.map = MAPS[room.mapId]; room.startAt = t + CFG.START_DELAY_MS;
  room.rouletteAt = room.startAt + CFG.ROULETTE_INTERVAL * 1000;
  for (const p of room.players.values()) { resetPlayer(p); respawn(room, p, room.startAt); }
  for (const p of room.players.values()) { const u = users.get(p.id); if (u) { sendGameStart(u, room); pushStatus(u); } }
  emitRoomUpdate(room);
}

/* --------------------------- COMBATE / ACCIONES --------------------------- */
const recoilMult = (p, t) => (has(p, 'speed', t) ? 3 : 1) * (p.feverUntil > t ? 2 : 1);
const award = (p, n, t) => { p.coins += n * (has(p, 'magnet', t) ? 2 : 1); };

function canAct(room, p, t) { return room.state === 'playing' && t >= room.startAt && p.alive && !p.emote; }

function fireBullet(room, p, t) {
  if (!canAct(room, p, t) || t - p.lastShot < CFG.FIRE_INTERVAL * 1000) return false;
  p.lastShot = t; p.stats.shots++;
  const d = dirFrom(p.yaw, p.pitch), rm = recoilMult(p, t);
  p.vx -= d[0] * CFG.RECOIL * rm; p.vy -= d[1] * CFG.RECOIL * rm; p.vz -= d[2] * CFG.RECOIL * rm; // RETROCESO = movimiento
  const r = CFG.BULLET_R * (has(p, 'giant', t) ? 3 : 1) * (p.feverUntil > t ? 1.8 : 1), off = CFG.PLAYER_R + r + 0.05;
  if (room.bullets.length > 400) room.bullets.shift();
  p.rewind = clamp(p.ping / 2 + CFG.REWIND_INTERP_MS, 0, CFG.REWIND_MAX_MS) / 1000; // compensación de lag
  room.bullets.push({
    id: room.nextBulletId++, o: p.id, x: p.x + d[0] * off, y: p.y + d[1] * off, z: p.z + d[2] * off,
    vx: d[0] * CFG.BULLET_SPEED, vy: d[1] * CFG.BULLET_SPEED, vz: d[2] * CFG.BULLET_SPEED,
    r, age: 0, bounces: CFG.BULLET_BOUNCES, pcd: 0, rewind: p.rewind
  });
  emitRoom(room, 'shot', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), dx: r2(d[0]), dy: r2(d[1]), dz: r2(d[2]), big: r > CFG.BULLET_R * 1.5 });
  return true;
}
function doDash(room, p, t, d) {
  if (!canAct(room, p, t) || t < p.dashReadyAt) return false;
  d = d || dirFrom(p.yaw, p.pitch);
  p.vx += d[0] * CFG.DASH_FORCE; p.vy += d[1] * CFG.DASH_FORCE; p.vz += d[2] * CFG.DASH_FORCE;
  p.boostUntil = t + 500; p.dashReadyAt = t + CFG.DASH_CD;
  emitRoom(room, 'dash', { id: p.id, dx: r2(d[0]), dy: r2(d[1]), dz: r2(d[2]) });
  return true;
}
function pushAway(room, src, force, radius, t, upBias) {
  for (const q of room.players.values()) {
    if (q === src || !q.alive) continue;
    let dx = q.x - src.x, dy = q.y - src.y, dz = q.z - src.z; const dist = Math.hypot(dx, dy, dz);
    if (radius && dist > radius) continue;
    if (dist < 1e-4) { dx = rnd(-1, 1); dy = 0.5; dz = rnd(-1, 1); }
    const l = Math.hypot(dx, dy, dz), f = radius ? force * (1 - 0.6 * dist / radius) : force;
    q.vx += dx / l * f; q.vy += dy / l * f + upBias; q.vz += dz / l * f; q.boostUntil = t + 800;
    q.pushers.set(src.id, t);
  }
}
function doBomb(room, p, t) {
  if (!canAct(room, p, t) || t < p.bombReadyAt) return false;
  p.bombReadyAt = t + CFG.BOMB_CD;
  pushAway(room, p, CFG.BOMB_FORCE, CFG.BOMB_R, t, 3);
  emitRoom(room, 'bomb', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), r: CFG.BOMB_R });
  return true;
}
function doNuke(room, p, t) {
  if (!canAct(room, p, t) || !p.nuke) return false;
  p.nuke = false; pushAway(room, p, CFG.NUKE_FORCE, 0, t, 8);
  emitRoom(room, 'nuke', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  return true;
}
function castRay(room, p, d, maxT) {
  const m = room.map, o = [p.x, p.y, p.z]; let best = null, bt = maxT;
  for (const bx of m.solids) { const t = rayBox(o, d, bx); if (t !== null && t < bt) { bt = t; best = { t, kind: 'solid' }; } }
  if (m.walls) { const t = rayExit(o, d, m.bounds); if (t !== null && t < bt) { bt = t; best = { t, kind: 'wall' }; } }
  const now = Date.now();
  for (const q of room.players.values()) {
    if (q === p || !q.alive || has(q, 'invisible', now)) continue;
    const t = raySphere(o, d, [q.x, q.y, q.z], CFG.PLAYER_R + 0.5);
    if (t !== null && t < bt) { bt = t; best = { t, kind: 'player', id: q.id }; }
  }
  return best;
}
function doGrapple(room, p, t) {
  if (!canAct(room, p, t) || t < p.grappleReadyAt) return false;
  const d = dirFrom(p.yaw, p.pitch), hit = castRay(room, p, d, CFG.GRAPPLE_RANGE);
  p.grappleReadyAt = t + (hit ? CFG.GRAPPLE_CD : CFG.GRAPPLE_MISS_CD);
  if (hit) {
    const f = clamp(hit.t * 1.2, 10, CFG.GRAPPLE_FORCE);
    p.vx += d[0] * f; p.vy += d[1] * f; p.vz += d[2] * f; p.boostUntil = t + 700;
  }
  const L = hit ? hit.t : CFG.GRAPPLE_RANGE;
  emitRoom(room, 'grapple', { id: p.id, ox: r2(p.x), oy: r2(p.y), oz: r2(p.z), tx: r2(p.x + d[0] * L), ty: r2(p.y + d[1] * L), tz: r2(p.z + d[2] * L), hit: !!hit, kind: hit ? hit.kind : null });
  return true;
}
function doJump(room, p, t) {
  if (!canAct(room, p, t) || p.grounded || p.djUsed) return false;
  const g = p.g, gl = Math.hypot(g[0], g[1], g[2]) || 1, up = gl > 0.01 ? [-g[0] / gl, -g[1] / gl, -g[2] / gl] : [0, 1, 0];
  p.vx += up[0] * CFG.JUMP; p.vy += up[1] * CFG.JUMP; p.vz += up[2] * CFG.JUMP; p.djUsed = true;
  emitRoom(room, 'jump', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  return true;
}
function startEmote(room, p, id, t) {
  if (room.state !== 'playing' || !p.alive || p.emote || !EMOTE_DUR[id]) return false;
  p.emote = { id, until: t + EMOTE_DUR[id] * 1000 };
  emitRoom(room, 'emote', { id: p.id, emote: id, dur: EMOTE_DUR[id] });
  return true;
}

function lastPusher(room, v, t) {
  let best = null, bt = 0;
  for (const [id, pt] of v.pushers) if (t - pt < CFG.PUSH_CREDIT_WINDOW && pt > bt) { const a = room.players.get(id); if (a && a !== v) { best = a; bt = pt; } }
  return best;
}
function killPlayer(room, v, killer, cause, t) {
  if (!v.alive) return;
  v.alive = false; v.deaths++; v.respawnAt = t + CFG.RESPAWN_MS; v.streak = 0; v.feverUntil = 0;
  v.shield = false; v.nuke = false; v.timed = null; v.emote = null; v.multi = 0; v.vx *= 0.3; v.vy *= 0.3; v.vz *= 0.3;
  let multi = 0, streak = 0, fever = false;
  if (killer && killer !== v) {
    killer.kills++; award(killer, CFG.COIN_KILL, t);
    killer.multi = (t - killer.lastKillAt < CFG.MULTI_WINDOW) ? killer.multi + 1 : 1; killer.lastKillAt = t; multi = killer.multi;
    killer.streak++; streak = killer.streak;
    if (killer.streak % 3 === 0) { killer.feverUntil = t + CFG.FEVER_MS; fever = true; }
  }
  for (const [id, pt] of v.pushers) {
    if (t - pt < CFG.ASSIST_WINDOW && (!killer || id !== killer.id)) { const a = room.players.get(id); if (a && a !== v) { a.stats.assists++; award(a, CFG.COIN_ASSIST, t); } }
  }
  v.pushers.clear();
  emitRoom(room, 'kill', { k: killer && killer !== v ? killer.id : null, v: v.id, cause, word: pick(WORDS), multi, streak, fever, x: r2(v.x), y: r2(v.y), z: r2(v.z) });
  if (killer && killer !== v && killer.kills >= CFG.WIN_KILLS) endGame(room, killer, t);
}
function damagePlayer(room, v, amount, killer, cause, t) {
  if (!v.alive || v.invulnUntil > t) return;
  v.hp -= amount; v.lastDamage = t;
  if (v.hp <= 0) killPlayer(room, v, killer, cause, t);
}
function endGame(room, winner, t) {
  if (room.state !== 'playing') return;
  room.state = 'ended'; room.bullets = [];
  const standings = [...room.players.values()].map(p => {
    if (!p.isBot || true) p.coins += CFG.COIN_PARTICIPATION + (p === winner ? CFG.COIN_WIN : 0);
    return {
      id: p.id, name: p.name, isBot: p.isBot, kills: p.kills, deaths: p.deaths, assists: p.stats.assists,
      damage: Math.round(p.stats.damage), distance: Math.round(p.stats.distance), powerups: p.stats.powerups, coins: p.coins, winner: p === winner
    };
  }).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  emitRoom(room, 'gameOver', { winner: winner.id, winnerName: winner.name, standings });
  emitRoomUpdate(room);
  for (const p of room.players.values()) { const u = users.get(p.id); if (u) pushStatus(u); }
}

/* ------------------------------ RULETA ------------------------------ */
function runRoulette(room, t) {
  const list = [...room.players.values()].filter(p => !p.disconnectedAt), results = {}; let bag = [];
  for (const p of list) { if (!bag.length) bag = shuffle(ROULETTE_TYPES); results[p.id] = bag.pop(); }
  room.pendingRoulette = { at: t + CFG.ROULETTE_SPIN * 1000, results };
  for (const p of list) { const u = users.get(p.id); if (u) toUser(u, 'roulette', { spinMs: CFG.ROULETTE_SPIN * 1000, result: results[p.id], types: ROULETTE_TYPES }); }
}
function grantPowerup(p, type, t) {
  if (type === 'shield') p.shield = true;
  else if (type === 'nuke') { p.nuke = true; p.nukeAt = t + rnd(2000, 8000); }
  else p.timed = { type, until: t + TIMED_MS[type], total: TIMED_MS[type] };
  p.stats.powerups++;
  const u = users.get(p.id); if (u) toUser(u, 'powerup', { type, ms: TIMED_MS[type] || 0 });
}
function applyRoulette(room, t) {
  const res = room.pendingRoulette.results;
  for (const [id, type] of Object.entries(res)) { const p = room.players.get(id); if (p && p.alive) grantPowerup(p, type, t); }
  room.pendingRoulette = null; room.rouletteAt = t + CFG.ROULETTE_INTERVAL * 1000;
}

/* ------------------------------- BOTS IA ------------------------------- */
function nearestEnemy(room, b, t) {
  let best = null, bd = 1e12;
  for (const q of room.players.values()) {
    if (q === b || !q.alive || has(q, 'invisible', t)) continue;
    const d = (q.x - b.x) ** 2 + (q.y - b.y) ** 2 + (q.z - b.z) ** 2; if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function botThink(room, b, t) {
  if (!b.alive || b.emote) return;
  if (!b.ai) b.ai = { nextShot: t + rnd(500, 1500), nextEmote: t + rnd(10000, 20000), nextAbility: t + rnd(2000, 5000) };
  const ai = b.ai;
  if (t >= ai.nextEmote) { startEmote(room, b, pick(EMOTE_IDS), t); ai.nextEmote = t + rnd(10000, 20000); return; }
  const tg = nearestEnemy(room, b, t);
  if (t >= ai.nextShot) {
    let yaw, pitch;
    if (tg && Math.random() < 0.7) { const a = aimTo(tg.x - b.x, tg.y - b.y, tg.z - b.z); yaw = a.yaw + rnd(-0.3, 0.3); pitch = a.pitch + rnd(-0.2, 0.2); }
    else { yaw = rnd(-Math.PI, Math.PI); pitch = rnd(-0.9, 0.9); } // dispara al azar para moverse
    b.yaw = yaw; b.pitch = pitch; fireBullet(room, b, t); ai.nextShot = t + rnd(1000, 2000);
  }
  if (t >= ai.nextAbility) {
    ai.nextAbility = t + rnd(2500, 6000);
    const r = Math.random();
    b.yaw = rnd(-Math.PI, Math.PI); b.pitch = rnd(-0.6, 0.6);
    if (r < 0.35) doDash(room, b, t);
    else if (r < 0.65) { if (tg && Math.hypot(tg.x - b.x, tg.y - b.y, tg.z - b.z) < CFG.BOMB_R * 0.8) doBomb(room, b, t); }
    else doGrapple(room, b, t);
  }
  if (b.nuke && t >= b.nukeAt) doNuke(room, b, t);
}

/* ---------------------- SIMULACIÓN POR PASO ---------------------- */
function samplePos(p, t) { // posición histórica (lag compensation), interpolada
  const h = p.hist; if (!h.length || t >= h[h.length - 1].t) return p;
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= t) { const a = h[i - 1], b = h[i], k = (t - a.t) / Math.max(1, b.t - a.t); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; }
  }
  return h[0];
}

function stepPlayer(room, p, dt, t) {
  const m = room.map, R = CFG.PLAYER_R, e = CFG.RESTITUTION;
  // gravedad (con zonas locas en el laberinto)
  let g = m.gravity;
  for (const z of m.gravityZones) if (insideBox(p, z)) { g = z.g; break; }
  p.g = g; p.vx += g[0] * dt; p.vy += g[1] * dt; p.vz += g[2] * dt;
  // fricción mínima (0.98 por 1/60 s) y amortiguación extra al bailar
  const f = Math.pow(CFG.FRICTION, dt * 60) * (p.emote ? Math.pow(0.9, dt * 60) : 1);
  p.vx *= f; p.vy *= f; p.vz *= f;
  // límite de velocidad (anti-cheat + estabilidad)
  const lim = p.boostUntil > t ? CFG.MAX_SPEED_BOOST : has(p, 'speed', t) ? CFG.MAX_SPEED_SPEED : CFG.MAX_SPEED;
  const sp = Math.hypot(p.vx, p.vy, p.vz);
  if (sp > lim) { const k = lim / sp; p.vx *= k; p.vy *= k; p.vz *= k; }
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  p.stats.distance += Math.min(sp, lim) * dt;
  p.grounded = false;
  // portales
  if (usePortals(m, p, R, dt)) emitRoom(room, 'portal', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  // límites de la arena (bounding box)
  const b = m.bounds, pos = [p.x, p.y, p.z], vel = [p.vx, p.vy, p.vz];
  for (let i = 0; i < 3; i++) {
    if (i === 1 && !m.floor && pos[1] < b.max[1] - R) continue;
    const n = [0, 0, 0];
    if (pos[i] < b.min[i] + R && !(i === 1 && !m.floor)) { pos[i] = b.min[i] + R; n[i] = 1; }
    else if (pos[i] > b.max[i] - R) { pos[i] = b.max[i] - R; n[i] = -1; }
    else continue;
    p.x = pos[0]; p.y = pos[1]; p.z = pos[2];
    bounceVel(p, n, e); noteContact(p, n);
    vel[0] = p.vx; vel[1] = p.vy; vel[2] = p.vz;
  }
  p.x = pos[0]; p.y = pos[1]; p.z = pos[2];
  // sólidos (pilares, plataformas, muros del laberinto, rocas)
  for (const bx of m.solids) { const n = pushOutBox(p, R, bx); if (n) { bounceVel(p, n, e); noteContact(p, n); } }
  // trampolines (impulso vertical)
  for (const tr of m.trampolines) {
    if (Math.hypot(p.x - tr.x, p.z - tr.z) < tr.r && p.y < tr.y + R + 0.6 && p.vy < 4) {
      p.vy = CFG.TRAMPOLINE; p.djUsed = false; p.boostUntil = t + 500; emitRoom(room, 'trampoline', { id: p.id, x: r2(tr.x), y: r2(tr.y), z: r2(tr.z) });
    }
  }
  // lava: géiser + daño
  p.lavaCd = Math.max(0, p.lavaCd - dt);
  for (const lv of m.lava) {
    if (p.x > lv.min[0] - R && p.x < lv.max[0] + R && p.z > lv.min[2] - R && p.z < lv.max[2] + R && p.y - R < lv.max[1] && p.lavaCd <= 0) {
      p.vy = CFG.GEYSER; p.boostUntil = t + 600; p.lavaCd = 0.8;
      emitRoom(room, 'lava', { id: p.id, x: r2(p.x), y: r2(lv.max[1]), z: r2(p.z) });
      damagePlayer(room, p, CFG.LAVA_DMG, lastPusher(room, p, t), 'lava', t);
      if (!p.alive) return;
    }
  }
  // vacío (Cielo Infinito): reaparece en el centro
  if (m.voidY !== null && p.y < m.voidY) {
    p.x = m.voidRespawn[0]; p.y = m.voidRespawn[1]; p.z = m.voidRespawn[2]; p.vx = p.vy = p.vz = 0; p.invulnUntil = t + 800;
    emitRoom(room, 'voidFall', { id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  }
  if (p.grounded) p.djUsed = false;
  // seguridad numérica
  if (!isFinite(p.x + p.y + p.z + p.vx + p.vy + p.vz)) { const s = m.spawns[0]; p.x = s[0]; p.y = s[1]; p.z = s[2]; p.vx = p.vy = p.vz = 0; }
  // regeneración lenta de vida
  if (p.hp < 100 && t - p.lastDamage > 3000) p.hp = Math.min(100, p.hp + 10 * dt);
  p.hist.push({ t, x: p.x, y: p.y, z: p.z });
  while (p.hist.length && t - p.hist[0].t > 1000) p.hist.shift();
}

function collidePlayers(room) {
  const arr = [...room.players.values()].filter(p => p.alive), R2 = CFG.PLAYER_R * 2;
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i], b = arr[j]; let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R2 * R2) continue;
    let d = Math.sqrt(d2); if (d < 1e-6) { dx = 1; dy = 0; dz = 0; d = 1; }
    const nx = dx / d, ny = dy / d, nz = dz / d, pen = (R2 - d) / 2;
    a.x -= nx * pen; a.y -= ny * pen; a.z -= nz * pen; b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
    if (vn < 0) { const j2 = -(1 + 0.8) * vn / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; a.vz -= j2 * nz; b.vx += j2 * nx; b.vy += j2 * ny; b.vz += j2 * nz; }
  }
}

function stepBullets(room, dt, t) {
  const m = room.map, bd = m.bounds;
  for (let i = room.bullets.length - 1; i >= 0; i--) {
    const b = room.bullets[i]; let dead = false;
    const px = b.x, py = b.y, pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.age += dt;
    if (b.age > CFG.BULLET_TTL) dead = true;
    if (!dead && usePortals(m, b, b.r, dt)) { emitRoom(room, 'portal', { id: null, x: r2(b.x), y: r2(b.y), z: r2(b.z) }); b.pcdKeep = true; }
    // límites: rebota 1 vez y luego muere
    if (!dead) {
      const pos = [b.x, b.y, b.z], vel = [b.vx, b.vy, b.vz];
      for (let k = 0; k < 3 && !dead; k++) {
        let side = 0;
        if (pos[k] < bd.min[k] + b.r) side = 1; else if (pos[k] > bd.max[k] - b.r) side = -1;
        if (!side) continue;
        if (!m.walls) { if (k !== 1 || pos[1] < bd.min[1] + b.r || pos[1] > bd.max[1] - b.r) dead = true; continue; }
        if (b.bounces > 0) { pos[k] = side > 0 ? bd.min[k] + b.r : bd.max[k] - b.r; vel[k] = -vel[k]; b.bounces--; emitRoom(room, 'bounce', { x: r2(b.x), y: r2(b.y), z: r2(b.z) }); }
        else dead = true;
      }
      b.x = pos[0]; b.y = pos[1]; b.z = pos[2]; b.vx = vel[0]; b.vy = vel[1]; b.vz = vel[2];
      if (!m.floor && b.y < m.voidY) dead = true;
    }
    // sólidos
    if (!dead) for (const bx of m.solids) {
      const n = pushOutBox(b, b.r, bx);
      if (n) {
        if (b.bounces > 0) { const vn = b.vx * n[0] + b.vy * n[1] + b.vz * n[2]; b.vx -= 2 * vn * n[0]; b.vy -= 2 * vn * n[1]; b.vz -= 2 * vn * n[2]; b.bounces--; emitRoom(room, 'bounce', { x: r2(b.x), y: r2(b.y), z: r2(b.z) }); }
        else { dead = true; }
        break;
      }
    }
    // jugadores (test de segmento contra esfera, con rebobinado de lag en los primeros 250 ms)
    if (!dead) for (const q of room.players.values()) {
      if (!q.alive) continue;
      if (q.id === b.o && b.bounces === CFG.BULLET_BOUNCES) continue; // no te golpeas antes de rebotar
      const rp = (b.age < 0.25 && b.rewind > 0) ? samplePos(q, t - b.rewind * 1000) : q, rr = CFG.PLAYER_R + b.r;
      if (segDist2(px, py, pz, b.x, b.y, b.z, rp.x, rp.y, rp.z) < rr * rr) {
        dead = true;
        const owner = room.players.get(b.o) || null;
        if (q.invulnUntil > t) break;
        if (owner) { owner.stats.hits++; owner.stats.damage += q.hp; }
        if (q.shield) { // el escudo absorbe 1 disparo
          q.shield = false; q.vx += b.vx * 0.25; q.vy += b.vy * 0.25; q.vz += b.vz * 0.25;
          emitRoom(room, 'hit', { v: q.id, x: r2(b.x), y: r2(b.y), z: r2(b.z), shield: true });
        } else {
          emitRoom(room, 'hit', { v: q.id, x: r2(b.x), y: r2(b.y), z: r2(b.z), shield: false });
          q.hp = 0; killPlayer(room, q, owner, 'bullet', t);
        }
        break;
      }
    }
    if (dead) room.bullets.splice(i, 1);
  }
}

function tickRoom(room, dt, t, doNet) {
  if (room.state === 'lobby') { if (room.autoStartAt && t >= room.autoStartAt && room.players.size >= 2) startGame(room); return; }
  if (room.state !== 'playing') return;
  if (t >= room.startAt) {
    if (!room.pendingRoulette && t >= room.rouletteAt) runRoulette(room, t);
    if (room.pendingRoulette && t >= room.pendingRoulette.at) applyRoulette(room, t);
    for (const p of room.players.values()) {
      if (room.state !== 'playing') return;
      if (p.isBot) botThink(room, p, t);
      if (!p.alive) { if (t >= p.respawnAt) respawn(room, p, t); continue; }
      if (p.emote && t >= p.emote.until) p.emote = null;
      if (p.timed && t >= p.timed.until) { const type = p.timed.type; p.timed = null; const u = users.get(p.id); if (u) toUser(u, 'powerupEnd', { type }); }
      stepPlayer(room, p, dt, t);
    }
    if (room.state !== 'playing') return;
    collidePlayers(room);
    stepBullets(room, dt, t);
  }
  if (doNet && room.state === 'playing') broadcast(room, t);
}

/* ---------------------------- SINCRONIZACIÓN ---------------------------- */
function broadcast(room, t) {
  const bl = room.bullets.map(b => ({ i: b.id, x: r2(b.x), y: r2(b.y), z: r2(b.z), vx: r2(b.vx), vy: r2(b.vy), vz: r2(b.vz), r: r2(b.r), o: b.o }));
  const rin = Math.max(0, room.rouletteAt - t);
  for (const me of room.players.values()) {
    if (me.isBot) continue;
    const u = users.get(me.id); if (!u || !u.socket) continue;
    const pl = [];
    for (const p of room.players.values()) {
      const pu = users.get(p.id), inv = has(p, 'invisible', t);
      const e = { id: p.id, a: p.alive ? 1 : 0, k: p.kills, d: p.deaths, c: p.coins, pg: p.isBot ? 0 : (pu ? pu.ping : 0) };
      if (inv && p.id !== me.id) e.inv = 1; // invisible: se oculta la posición a los demás (anti-wallhack)
      else {
        Object.assign(e, {
          x: r2(p.x), y: r2(p.y), z: r2(p.z), vx: r2(p.vx), vy: r2(p.vy), vz: r2(p.vz), yaw: r2(p.yaw), pitch: r2(p.pitch), hp: Math.round(p.hp),
          sh: p.shield ? 1 : 0, fv: p.feverUntil > t ? 1 : 0, iv: inv ? 1 : 0, gi: has(p, 'giant', t) ? 1 : 0, sp: has(p, 'speed', t) ? 1 : 0,
          mg: has(p, 'magnet', t) ? 1 : 0, em: p.emote ? p.emote.id : null
        });
      }
      pl.push(e);
    }
    u.socket.volatile.emit('state', {
      t, seq: me.lastSeq, pl, b: bl, rl: rin, spin: room.pendingRoulette ? 1 : 0,
      self: {
        cd: { dash: Math.max(0, me.dashReadyAt - t), bomb: Math.max(0, me.bombReadyAt - t), grapple: Math.max(0, me.grappleReadyAt - t) },
        nuke: me.nuke ? 1 : 0, dj: me.djUsed ? 0 : 1, respawn: me.alive ? 0 : Math.max(0, me.respawnAt - t), fever: Math.max(0, me.feverUntil - t),
        timed: me.timed ? { type: me.timed.type, ms: Math.max(0, me.timed.until - t), total: me.timed.total } : null
      }
    });
  }
}

/* --------------------------- AMIGOS Y ESTADO --------------------------- */
function friendStatus(lower) {
  const u = names.get(lower); if (!u || !u.connected) return 'offline';
  const r = u.roomCode && rooms.get(u.roomCode);
  return r && r.state === 'playing' ? 'ingame' : 'online';
}
function friendSet(lower) { if (!friendships.has(lower)) friendships.set(lower, new Set()); return friendships.get(lower); }
function pushStatus(u) {
  const set = friendships.get(low(u.name)); if (!set) return;
  const st = friendStatus(low(u.name));
  for (const f of set) { const fu = names.get(f); if (fu && fu.connected) fu.socket.emit('friends:status', { name: u.name, status: st }); }
}
function announce(u, ev) {
  const set = friendships.get(low(u.name)); if (!set) return;
  for (const f of set) { const fu = names.get(f); if (fu && fu.connected) fu.socket.emit(ev, { name: u.name }); }
}
function friendList(u) {
  const set = friendships.get(low(u.name)) || new Set();
  return [...set].map(f => ({ name: displayNames.get(f) || f, status: friendStatus(f) }));
}
function removeUser(u) {
  clearTimeout(u.graceTimer);
  if (u.roomCode) leaveRoom(u);
  const wasOn = u.announced; u.announced = false; u.connected = false;
  users.delete(u.id); tokens.delete(u.token);
  if (names.get(low(u.name)) === u) names.delete(low(u.name));
  if (wasOn) announce(u, 'friends:offline');
}
function createUser(name) {
  const id = Math.random().toString(36).slice(2, 10), token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const u = { id, token, name, socket: null, connected: false, roomCode: null, skin: 'default', ping: 0, graceTimer: null, announced: false };
  users.set(id, u); tokens.set(token, u); names.set(low(name), u); displayNames.set(low(name), name);
  return u;
}

/* --------------------------- LIMITADOR DE TASA --------------------------- */
function rateOk(socket) {
  const b = socket.data.bucket, t = Date.now();
  b.tokens = Math.min(b.cap, b.tokens + (t - b.last) / 1000 * b.rate); b.last = t;
  if (t - b.vt > 10000) { b.vt = t; b.viol = 0; }
  if (b.tokens >= 1) { b.tokens--; return true; }
  if (++b.viol > 400) socket.disconnect(true); // spam sostenido
  return false;
}

/* ------------------------------- SOCKETS ------------------------------- */
io.on('connection', (socket) => {
  socket.data.bucket = { tokens: 120, cap: 120, rate: 90, last: Date.now(), viol: 0, vt: Date.now() };
  socket.use((packet, next) => { if (rateOk(socket)) next(); });
  const ack = cb => (typeof cb === 'function' ? cb : () => {});
  const me = () => users.get(socket.data.uid);
  const on = (ev, fn) => socket.on(ev, (d, cb) => {
    try { const u = me(); if (!u || u.socket !== socket) return ack(cb)({ ok: false, key: 'err_auth' }); fn(u, d && typeof d === 'object' ? d : {}, ack(cb)); }
    catch (e) { console.error('[' + ev + ']', e); }
  });
  const inGame = (u) => { const room = rooms.get(u.roomCode); const p = room && room.players.get(u.id); return room && p ? { room, p } : null; };
  const applyAim = (p, d) => {
    if (Number.isFinite(d.yaw)) p.yaw = ((d.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (Number.isFinite(d.pitch)) p.pitch = clamp(d.pitch, -1.5, 1.5);
    if (Number.isFinite(d.seq)) p.lastSeq = d.seq | 0;
  };

  /* --- Autenticación / reconexión --- */
  socket.on('auth', (d, cb) => {
    cb = ack(cb); d = d && typeof d === 'object' ? d : {};
    const name = sanitizeName(d.name); if (!name) return cb({ ok: false, key: 'err_name_invalid' });
    let user = null;
    if (typeof d.token === 'string' && tokens.has(d.token)) { const c = tokens.get(d.token); if (low(c.name) === low(name)) user = c; }
    if (!user) {
      const ex = names.get(low(name));
      if (ex && ex.connected && ex.socket !== socket) return cb({ ok: false, key: 'err_name_taken' });
      if (ex) removeUser(ex);
      user = createUser(name);
    }
    const old = users.get(socket.data.uid);
    if (old && old !== user) removeUser(old); // cambio de nombre en la misma conexión
    if (user.socket && user.socket !== socket) { const os = user.socket; user.socket = null; try { os.disconnect(true); } catch (e) {} }
    clearTimeout(user.graceTimer);
    user.socket = socket; user.connected = true; socket.data.uid = user.id;
    if (SKINS.includes(d.skin)) user.skin = d.skin;
    let resumed = false;
    const room = user.roomCode && rooms.get(user.roomCode);
    if (room && room.players.has(user.id)) { // reconexión a partida en curso
      resumed = true; room.players.get(user.id).disconnectedAt = 0; socket.join(room.code);
      toUser(user, 'room:joined', { room: publicRoom(room), you: user.id });
      if (room.state === 'playing') sendGameStart(user, room);
    } else user.roomCode = null;
    if (!user.announced) { user.announced = true; announce(user, 'friends:online'); }
    pushStatus(user);
    const reqs = pendingReq.get(low(name));
    cb({ ok: true, id: user.id, token: user.token, name: user.name, resumed, friends: friendList(user), requests: reqs ? [...reqs.values()] : [] });
  });
  socket.on('sping', () => {});
  socket.on('disconnect', () => {
    const u = users.get(socket.data.uid); if (!u || u.socket !== socket) return;
    u.connected = false; u.socket = null;
    const room = u.roomCode && rooms.get(u.roomCode), p = room && room.players.get(u.id);
    if (p) p.disconnectedAt = Date.now();
    pushStatus(u);
    u.graceTimer = setTimeout(() => removeUser(u), CFG.GRACE_MS);
  });

  /* --- Perfil --- */
  on('profile:update', (u, d, cb) => { if (SKINS.includes(d.skin)) { u.skin = d.skin; const g = inGame(u); if (g) { g.p.skin = u.skin; if (g.room.state !== 'playing') emitRoomUpdate(g.room); } } cb({ ok: true }); });

  /* --- Salas --- */
  on('room:list', (u, d, cb) => cb({ ok: true, rooms: listRooms() }));
  on('room:create', (u, d, cb) => {
    if (u.roomCode) leaveRoom(u);
    const room = createRoom(u, !!d.public); const r = joinRoom(u, room); cb(Object.assign({ code: room.code }, r));
  });
  on('room:join', (u, d, cb) => {
    const code = String(d.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return cb({ ok: false, key: 'err_code_invalid' });
    const room = rooms.get(code); if (!room) return cb({ ok: false, key: 'err_room_not_found' });
    cb(Object.assign({ code }, joinRoom(u, room)));
  });
  on('room:quick', (u, d, cb) => {
    const cands = [...rooms.values()].filter(r => r.isPublic && r.state !== 'ended' && r.players.size < r.max && [...r.players.values()].some(p => !p.isBot));
    cands.sort((a, b) => (a.state === 'lobby' ? 0 : 1) - (b.state === 'lobby' ? 0 : 1));
    if (cands.length) return cb(Object.assign({ code: cands[0].code }, joinRoom(u, cands[0])));
    if (u.roomCode) leaveRoom(u);
    const room = createRoom(u, true); joinRoom(u, room); for (let i = 0; i < 3; i++) addBot(room);
    room.mapId = pick(MAP_IDS); room.autoStartAt = Date.now() + 2500; emitRoomUpdate(room);
    cb({ ok: true, code: room.code, created: true });
  });
  on('room:leave', (u, d, cb) => { if (u.roomCode) leaveRoom(u); cb({ ok: true }); });
  const hostOnly = (u, cb) => { const g = inGame(u); if (!g || g.room.host !== u.id) { cb({ ok: false, key: 'err_not_host' }); return null; } return g.room; };
  on('room:config', (u, d, cb) => {
    const room = hostOnly(u, cb); if (!room) return;
    if (room.state === 'playing') return cb({ ok: false, key: 'err_in_game' });
    if (typeof d.public === 'boolean') room.isPublic = d.public;
    if (MAPS[d.map]) { room.mapId = d.map; room.map = MAPS[d.map]; }
    if (Number.isFinite(d.max)) { room.max = clamp(d.max | 0, Math.max(2, room.players.size), CFG.MAX_PLAYERS); }
    emitRoomUpdate(room); cb({ ok: true });
  });
  on('room:bots', (u, d, cb) => {
    const room = hostOnly(u, cb); if (!room) return;
    if (room.state === 'playing') return cb({ ok: false, key: 'err_in_game' });
    const want = clamp(Number.isFinite(d.count) ? d.count | 0 : 0, 0, 9);
    let bots = [...room.players.values()].filter(p => p.isBot).length;
    while (bots < want && addBot(room)) bots++;
    while (bots > want && removeBot(room)) bots--;
    emitRoomUpdate(room); cb({ ok: true, bots });
  });
  on('room:start', (u, d, cb) => {
    const room = hostOnly(u, cb); if (!room) return;
    if (room.state === 'playing') return cb({ ok: false, key: 'err_in_game' });
    if (room.players.size < 2) return cb({ ok: false, key: 'err_need_players' });
    startGame(room); cb({ ok: true });
  });
  on('room:lobby', (u, d, cb) => { const g = inGame(u); if (g && g.room.state === 'ended') { g.room.state = 'lobby'; emitRoomUpdate(g.room); pushStatus(u); } cb({ ok: true }); });

  /* --- Entradas de juego --- */
  on('input', (u, d) => { const g = inGame(u); if (g) applyAim(g.p, d); });
  on('shoot', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); fireBullet(g.room, g.p, Date.now()); });
  on('dash', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); doDash(g.room, g.p, Date.now()); });
  on('bomb', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); doBomb(g.room, g.p, Date.now()); });
  on('grapple', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); doGrapple(g.room, g.p, Date.now()); });
  on('jump', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); doJump(g.room, g.p, Date.now()); });
  on('nuke', (u, d) => { const g = inGame(u); if (!g) return; applyAim(g.p, d); doNuke(g.room, g.p, Date.now()); });
  on('emote', (u, d) => { const g = inGame(u); if (g) startEmote(g.room, g.p, String(d.id), Date.now()); });

  /* --- Amigos --- */
  on('friends:sync', (u, d, cb) => { const reqs = pendingReq.get(low(u.name)); cb({ ok: true, friends: friendList(u), requests: reqs ? [...reqs.values()] : [] }); });
  on('friends:search', (u, d, cb) => {
    const q = low(String(d.q || '').slice(0, 16)); if (q.length < 2) return cb({ ok: true, results: [] });
    const set = friendships.get(low(u.name)) || new Set(), res = [];
    for (const [k, v] of names) { if (v !== u && v.connected && k.includes(q)) res.push({ name: v.name, status: friendStatus(k), friend: set.has(k) }); if (res.length >= 10) break; }
    cb({ ok: true, results: res });
  });
  on('friends:request', (u, d, cb) => {
    const to = sanitizeName(d.to); if (!to) return cb({ ok: false, key: 'err_name_invalid' });
    const tl = low(to), ml = low(u.name);
    if (tl === ml) return cb({ ok: false, key: 'err_self' });
    if (friendSet(ml).has(tl)) return cb({ ok: false, key: 'err_already_friends' });
    if (!displayNames.has(tl)) return cb({ ok: false, key: 'err_user_not_found' });
    if (!pendingReq.has(tl)) pendingReq.set(tl, new Map());
    pendingReq.get(tl).set(ml, u.name); saveData();
    const tu = names.get(tl); if (tu && tu.connected) tu.socket.emit('friends:request', { from: u.name });
    cb({ ok: true });
  });
  on('friends:respond', (u, d, cb) => {
    const fl = low(String(d.from || '')), ml = low(u.name), reqs = pendingReq.get(ml);
    if (!reqs || !reqs.has(fl)) return cb({ ok: false, key: 'err_no_request' });
    const fname = reqs.get(fl); reqs.delete(fl);
    if (d.accept) {
      friendSet(ml).add(fl); friendSet(fl).add(ml); displayNames.set(fl, fname);
      const fu = names.get(fl); if (fu && fu.connected) { fu.socket.emit('friends:accepted', { name: u.name, status: friendStatus(ml) }); }
      cb({ ok: true, friend: { name: fname, status: friendStatus(fl) } });
    } else cb({ ok: true });
    saveData();
  });
  on('friends:remove', (u, d, cb) => {
    const fl = low(String(d.name || '')), ml = low(u.name);
    friendSet(ml).delete(fl); friendSet(fl).delete(ml); saveData(); cb({ ok: true });
  });
  on('invite:send', (u, d, cb) => {
    const fl = low(String(d.to || '')), fu = names.get(fl);
    if (!u.roomCode) return cb({ ok: false, key: 'err_no_room' });
    if (!friendSet(low(u.name)).has(fl)) return cb({ ok: false, key: 'err_not_friends' });
    if (!fu || !fu.connected) return cb({ ok: false, key: 'err_friend_offline' });
    fu.socket.emit('invite:received', { from: u.name, code: u.roomCode }); cb({ ok: true });
  });
  on('invite:decline', (u, d, cb) => { const fu = names.get(low(String(d.from || ''))); if (fu && fu.connected) fu.socket.emit('invite:declined', { name: u.name }); cb({ ok: true }); });
  on('friends:join', (u, d, cb) => {
    const fl = low(String(d.name || '')), fu = names.get(fl);
    if (!friendSet(low(u.name)).has(fl)) return cb({ ok: false, key: 'err_not_friends' });
    const room = fu && fu.roomCode && rooms.get(fu.roomCode);
    if (!room) return cb({ ok: false, key: 'err_friend_not_in_room' });
    if (!room.isPublic) return cb({ ok: false, key: 'err_room_private' });
    cb(Object.assign({ code: room.code }, joinRoom(u, room)));
  });
});

/* Ping medido con acks cada 2 s (se usa para HUD y compensación de lag) */
setInterval(() => {
  for (const u of users.values()) {
    if (!u.socket) continue; const t0 = Date.now();
    u.socket.timeout(3000).emit('sping', (err) => { if (!err) { u.ping = Date.now() - t0; const r = rooms.get(u.roomCode), p = r && r.players.get(u.id); if (p) p.ping = u.ping; } });
  }
}, 2000);

/* Bucle principal a 60 Hz; red a 20 Hz (cada 50 ms) */
let last = Date.now(), netAcc = 0;
setInterval(() => {
  const t = Date.now(); let dt = (t - last) / 1000; last = t;
  dt = Math.min(dt, CFG.MAX_DT); // clamp anti-tunneling
  netAcc += dt; const doNet = netAcc >= 1 / CFG.NET_RATE; if (doNet) netAcc = 0;
  for (const room of rooms.values()) { try { tickRoom(room, dt, t, doNet); } catch (e) { console.error('tick', e); } }
}, 1000 / CFG.TICK_RATE);

server.listen(PORT, '0.0.0.0', () => {
  console.log('RECOIL ARENA 3D escuchando en http://localhost:' + PORT);
  try { // direcciones para jugar desde el móvil (misma red Wi-Fi)
    const nets = require('os').networkInterfaces();
    for (const k of Object.keys(nets)) for (const n of nets[k]) if (n.family === 'IPv4' && !n.internal) console.log('  📱 Desde el móvil (mismo Wi-Fi): http://' + n.address + ':' + PORT);
  } catch (e) { /* sin red */ }
});
