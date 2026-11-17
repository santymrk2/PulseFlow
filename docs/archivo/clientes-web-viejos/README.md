# Clientes web viejos (archivados)

Antes `src/server/`. Archivados el 2026-11-17 por decisión del usuario. **No se compilan ni se empaquetan.**

## Qué son

Cinco PWA heredadas de FreeShow, cada una con `index.html`, `manifest.json` y service worker:

| Cliente | Líneas | Función original |
| --- | ---: | --- |
| `remote/` | 14.385 | Control remoto desde celular/tablet |
| `stage/` | 4.661 | Monitor de stage con layout de ítems |
| `common/` | 2.103 | Helpers y componentes compartidos |
| `controller/` | 565 | Control de dibujo (Focus, Zoom, Paint) |
| `output_stream/` | 371 | Reproducir audio PCM recibido por red |
| `cam/` | 344 | Cámara (sin sala en el backend actual) |

Total: 138 archivos, ~22.700 líneas.

## Por qué se archivaron

- No están en `vite.config.mjs` ni en ningún script de `package.json`. `tauri.conf.json` declara `frontendDist: "../dist"` y no declara `resources`.
- El backend Rust (`src-tauri/src/server/mod.rs`) mantiene cuatro salas: `remote` 5510, `stage` 5511, `controller` 5512 y `output_stream` 5513. Busca el cliente en `<root>/public/<room>` o `<root>/<room>`, pero no hay ninguno empaquetado: cuando no encuentra `index.html` loguea *"sin cliente web empaquetado, no se abre el puerto"*.
- El transporte usa `socket.io-client`, que F23.9 dejó atrás. El ROADMAP (F15.6) ya preveía eliminar esa dependencia junto con este código.
- El cliente `controller` manda mensajes `FOCUS` / `clear_painting` que el frontend actual ya no atiende (F14.1c).
- Existía una directiva de "No tocar" en la guía de ejecutores de F24. El usuario la levantó explícitamente el 2026-11-17, eligiendo archivar en lugar de borrar.

## Qué se reutilizó y qué no

- `dBUtils.ts` es idéntico a `src/frontend/audio/dBUtils.ts` (ya está en la app).
- `transpose.ts` es el mismo algoritmo que `src/frontend/utils/chordTranspose.ts`, con otro nombre.
- `scripture.ts` (12 líneas), `stores.ts` (17) y `icons.ts` (157) son copias truncadas o viejas de las del frontend (2.261, 543 y 384 líneas respectivamente). No aportan nada.
- Lo exclusivo está atado al protocolo viejo: `socket.ts` / `receiver.ts` (socket.io), `audioStream.ts` (PCM por WebSocket) y `wakeLock.ts` (21 líneas, `navigator.wakeLock`). Ninguno sirve tal cual con el servidor actual.

## Para reactivarlos algún día

1. Build propio por cliente (Vite, un `index.html` por sala).
2. Empaquetar el resultado como `resources` en `tauri.conf.json` y dejarlo en `public/<room>`.
3. Reescribir el transporte (socket.io → el canal actual de Axum) y tipar los mensajes, que hoy son `serde_json::Value`.
4. Usar los helpers de `src/frontend/`, no las copias truncadas de acá.
5. Probar desde un celular o tablet real, incluido el bloom de la pantalla y la desconexión.

## Recuperar un archivo

El último commit antes del archivado es `6226d2f1`:

```sh
git show 6226d2f1:src/server/remote/main.ts
```

## Referencias

- `docs/ROADMAP.md` — deuda "Clientes web de `src/server/`" y tarea F15.6.
- `docs/superpowers/plans/2026-11-06-f23-nucleo-engine-y-backend.md` — hallazgo B2 (servidores de red).
