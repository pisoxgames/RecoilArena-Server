'use strict';
// RECOIL ARENA 3D - app de escritorio (Electron).
// Con URL de servidor (app/config.json): abre directamente el juego online (igual que en el navegador), con pantalla de espera
// mientras el servidor gratuito "despierta" y reintentos automáticos.
// Sin URL: arranca un servidor integrado en 127.0.0.1 y juegas en local.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path'), net = require('net'), fs = require('fs');

function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function remoteUrl() {
  try { return (JSON.parse(fs.readFileSync(path.join(__dirname, 'app', 'config.json'), 'utf8')).url || '').trim().replace(/\/+$/, ''); } catch (e) { return ''; }
}
const splash = (msg, sub) => 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#58c8ff,#8f86ff 55%,#ff9be0);font-family:Arial Rounded MT Bold,Segoe UI,sans-serif;color:#fff;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.35)"><div><div style="font-size:56px;font-weight:900;letter-spacing:2px">RECOIL ARENA 3D</div><div style="margin:26px auto;width:54px;height:54px;border:8px solid #fff8;border-top-color:#fff;border-radius:50%;animation:s 1s linear infinite"></div><div style="font-size:22px">${msg}</div><div style="font-size:15px;opacity:.85;margin-top:8px">${sub || ''}</div></div><style>@keyframes s{to{transform:rotate(360deg)}}</style>`);

let win = null;
async function createWindow() {
  const remote = remoteUrl();
  let target;
  if (remote) target = remote + '/';
  else {
    const port = await freePort();
    process.env.PORT = String(port);
    process.env.RA_DATA_DIR = path.join(app.getPath('userData'), 'data');
    try { require('./app/server.js'); } catch (e) { dialog.showErrorBox('Error al iniciar el servidor integrado', String(e && e.stack || e)); app.quit(); return; }
    target = 'http://127.0.0.1:' + port + '/';
  }
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 900, minHeight: 560, backgroundColor: '#0b0820', title: 'Recoil Arena 3D', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
  });
  let tries = 0, retry = null;
  const go = () => { if (win && !win.isDestroyed()) win.loadURL(target); };
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3 || url.startsWith('data:')) return; // -3 = navegación cancelada
    tries++;
    win.loadURL(splash(remote ? 'Conectando con el servidor…' : 'Iniciando…', remote ? `El servidor gratuito puede tardar hasta un minuto en despertar (intento ${tries}).<br>${desc}` : desc));
    clearTimeout(retry); retry = setTimeout(go, 4000);
  });
  win.loadURL(splash(remote ? 'Conectando con el servidor…' : 'Iniciando…', remote ? 'Puede tardar hasta un minuto la primera vez.' : ''));
  setTimeout(go, 400);
}
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
