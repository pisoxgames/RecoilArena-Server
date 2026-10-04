'use strict';
// RECOIL ARENA 3D - app de escritorio (Electron).
// Arranca el servidor/cliente integrado en 127.0.0.1 (puerto libre) y abre la ventana del juego.
// Si config.js trae una URL de servidor online, el cliente se conecta a ese servidor; si no, juega contra el servidor local.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path'), net = require('net');

function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
let win = null;
async function createWindow() {
  const port = await freePort();
  process.env.PORT = String(port);
  process.env.RA_DATA_DIR = path.join(app.getPath('userData'), 'data');
  try { require('./app/server.js'); } catch (e) { dialog.showErrorBox('Error al iniciar el servidor integrado', String(e && e.stack || e)); app.quit(); return; }
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
  setTimeout(() => win && !win.isDestroyed() && win.loadURL('http://127.0.0.1:' + port + '/'), 300);
}
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-frame-rate-limit'); // sin límite de 60 fps si el monitor es más rápido
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
