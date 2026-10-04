# RECOIL ARENA 3D

Shooter 3D multijugador online donde **el retroceso de tus disparos es tu único movimiento**.
Node.js + Express + Socket.io (servidor autoritativo) · HTML/CSS/JS vanilla · Three.js solo para render · Web Audio API.

## Arrancar
```
npm install
npm start
```
Abre http://localhost:3000 (varias pestañas = varios jugadores). Puerto: variable `PORT`.

## Controles
| Acción | Tecla |
|---|---|
| Disparar (retroceso) | Clic izquierdo (mantener) |
| Dash | Shift |
| Bomba de retroceso | Q |
| Gancho | E |
| Doble salto | Espacio (en el aire) |
| Bomba nuclear (si la tienes) | R |
| Bailar | 1-4 |
| Marcador | Tab (mantener) |

## Estructura
```
server.js          servidor autoritativo: salas, física, bots, ruleta, amigos
public/index.html  UI y CSS de todas las pantallas
public/i18n.js     traducciones ES / EN / FR
public/client.js   render, red, predicción, HUD, efectos, menús
public/maps.js     decoración de los 4 mapas (la geometría jugable viene del servidor)
public/shop.js     tienda: destacados semanales, ofertas diarias, equipar skins y bailes
public/audio.js    efectos y música procedurales (sin archivos)
data/friends.json  se crea solo: amigos y solicitudes
```

## Notas
- Monedas, skins y bailes viven en `localStorage` (no hay cuentas). El servidor no valida la propiedad de cosméticos.
- Para jugar en red, expón el puerto y comparte la IP o el código de sala.

## Gráficos (pulido)
- `public/gfx.js`: estilo toon (MeshToonMaterial + gradiente), contornos negros, avatares, arma en 1ª persona, cielo/nubes.
- `public/maps.js`: decoración de los 4 mapas (gradas con público, árboles, arcoíris, volcanes...).
- Postproceso: bloom, viraje de color, viñeta, desenfoque radial.

## Versión móvil (juega junto a jugadores de PC)
Es el mismo juego y el mismo servidor: móviles y PCs comparten salas. El modo táctil se activa solo en pantallas táctiles (o con `?touch=1`).
1. Arranca el servidor en el PC: `npm start`. En la consola aparece `📱 Desde el móvil: http://192.168.x.x:3000`.
2. Abre esa dirección en el móvil (misma red Wi-Fi). Gira el móvil en horizontal.
3. Controles: arrastra para apuntar · 🔥 mantener para disparar (también puedes arrastrar desde el botón) · ⚡ dash · 💥 bomba · 🪝 gancho · ⤒ doble salto · 😀 bailes · 📊 marcador.
4. En móvil la calidad gráfica empieza en "baja" (se cambia en Ajustes).
Para jugar por Internet, despliega el servidor en un host con HTTPS (Render, Railway, Fly.io...) y comparte la URL.
