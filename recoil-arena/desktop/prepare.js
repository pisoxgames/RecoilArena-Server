// Copia el servidor y el cliente del juego a desktop/app/ y escribe la URL del servidor online.
// URL del servidor: variable RA_SERVER_URL o archivo desktop/server-url.txt (una línea). Vacía = el .exe usa su propio servidor local.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(__dirname, 'app');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, 'server.js'), path.join(out, 'server.js'));
fs.cpSync(path.join(root, 'public'), path.join(out, 'public'), { recursive: true });
let url = (process.env.RA_SERVER_URL || '').trim();
const f = path.join(__dirname, 'server-url.txt');
if (!url && fs.existsSync(f)) url = fs.readFileSync(f, 'utf8').split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#')) || '';
url = url.replace(/\/+$/, '');
fs.writeFileSync(path.join(out, 'public', 'config.js'), "window.RA_SERVER_URL = " + JSON.stringify(url) + ";\n");
console.log('[prepare] servidor online:', url || '(ninguno: servidor local integrado)');
