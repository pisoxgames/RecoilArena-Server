# Jugar online y crear el .exe (todo gratis)

El juego tiene dos piezas: el **servidor** (Node + Socket.io, el que sincroniza a todos) y el **cliente** (la web o el .exe).
Para jugar online necesitas el servidor alojado en Internet. Después, **web, móvil y .exe se conectan al mismo servidor** y juegan juntos.

## 1) Subir el servidor gratis (Render, lo más fácil)
1. Crea una cuenta en https://github.com y sube esta carpeta a un repositorio nuevo (puede ser privado).
2. Crea una cuenta en https://render.com (entra con GitHub).
3. **New + → Blueprint** → elige tu repositorio. Render lee `render.yaml` y lo despliega solo.
4. Al terminar te da una URL tipo `https://recoil-arena.onrender.com`. **Esa es la URL del juego**: ábrela en PC o móvil y ya funciona online.

Limitación del plan gratis: tras ~15 min sin jugadores el servidor se duerme y la primera conexión tarda ~30-60 s en despertar.
Truco: crea una cuenta gratis en https://uptimerobot.com y añade un monitor HTTP a `https://TU-URL/health` cada 5 minutos para mantenerlo despierto.

Alternativas gratuitas: **Fly.io** (`fly.toml` incluido) o **Koyeb/Railway** (usan el `Dockerfile`).

## 2) El .exe
**Opción A – ya construido:** `RecoilArena3D-Portable-1.0.0.exe` (no necesita instalación).
Ábrelo → Ajustes → **Servidor online** → pega tu URL de Render → Guardar. Listo (se guarda para la próxima vez).
Windows puede avisar "protegió su PC" porque no está firmado: *Más información → Ejecutar de todas formas*.

**Opción B – construirlo con tu URL ya dentro (y también el instalador):**
- Sin instalar nada: en GitHub, pestaña **Actions → "Construir .exe (Windows)" → Run workflow**. Descargas los .exe de "Artifacts".
  Antes, en Settings → Secrets and variables → Actions → *Variables*, crea `RA_SERVER_URL` = tu URL de Render.
- En tu PC (Node 18+): `cd desktop`, escribe tu URL en `server-url.txt`, y ejecuta `npm install` y `npm run dist`. Salen en `desktop/dist/`.
- Para probar sin empaquetar: `cd desktop && npm install && npm start`.

Si no pones ninguna URL, el .exe lleva un servidor integrado y solo juegas en tu propio PC/red local.

## Notas
- Cada vez que cambies el juego, vuelve a subir a GitHub (Render redespliega solo) y reconstruye el .exe.
- Amigos y monedas se guardan en el servidor / en tu navegador; en el plan gratis de Render el disco se borra al reiniciar, así que la lista de amigos puede perderse.

## 3) La APK (Android)
La app Android (`mobile/`, hecha con Capacitor) abre tu servidor online en pantalla completa y en horizontal, igual que el .exe.
No se puede compilar en cualquier PC sin el Android SDK, así que se construye gratis en GitHub:
1. Sube el proyecto a tu repositorio de GitHub (el mismo de Render).
2. Pestaña **Actions → "Construir APK (Android)" → Run workflow** (tarda ~5 min).
3. Entra en la ejecución terminada y descarga **RecoilArena3D-apk** (Artifacts). Dentro está `app-debug.apk`.
4. Pásala al móvil, ábrela y permite "instalar apps de origen desconocido" cuando lo pida.
URL distinta de Render: en GitHub → Settings → Secrets and variables → Actions → *Variables* → `RA_SERVER_URL`.
Para compilar tú mismo con Android Studio: `cd mobile && npm install && npx cap sync android && npx cap open android`.
La APK es de depuración (instalable directamente). Para subirla a Google Play habría que firmarla con tu propia clave (release).
