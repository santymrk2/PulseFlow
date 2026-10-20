# Informe — Barra y menú (lane C, worktree PulseFlow-menu)

Agente: lane C. Rama: `feature/f10-menu`. Worktree:
`/Users/santiagomercadocarbone/Documents/Develops/PulseFlow-menu`.
Tareas asignadas: F10.0f → F10.7 → F11.1 (en ese orden).

---

## F10.0f — IPC sin ruido ✅

**Qué hice**

1. **Canales de servidor (`REMOTE`, `STAGE`, `CONTROLLER`, `OUTPUT_STREAM`)**: en
   `src-tauri/src/commands/servers.rs` agregué el comando `SERVER_SEND`
   (`ServerSendData { channel, message }`, con espejo TS en
   `src/types/IPC/ServerSend.ts` y test de (de)serialización). Valida el canal contra
   `SERVER_ROOMS`, y si el servidor no está corriendo hace *no-op* (antes: "Command
   not found" en cada envío). En `src/frontend/IPC/tauri.ts`, `send()` enruta esos
   4 canales a `invoke("SERVER_SEND", …)` antes del `await` de listeners (los
   mensajes diferidos ya no se pierden esperando el registro de listeners).
2. **Avisos únicos**: los `console.warn` por comando OUTPUT/POSTPONED descartado y por
   canales sin IPC ahora son silenciosos salvo con
   `localStorage.pulseflowIpcDebug = "1"` (una sola vez por nombre de comando).
3. **`LOADED`** (`updateSettings.ts`): eliminado — era el handshake del webview
   Electron; el servidor de control recibe los mensajes por websocket.
4. **`LANGUAGE`** (`language.ts`): eliminados el send de handshake y el reenvío
   `OUTPUT(["LANGUAGE"])` con `setTimeout(…, 3000)` (éste era el warning que aparecía
   a los 3 s en la terminal). El idioma al cliente web remoto va por el canal
   `REMOTE` (remoteTalk).

**Verificación**

- `cargo check` limpio · `cargo test --lib`: 73/73 (4 nuevas).
- `bun run test:unit`: 66/66 (3 nuevas en `tauri.test.ts`).
- `bun run test:svelte`: 60 errores = baseline de la rama (los 2 extra sobre los 58
  originales son de `DisplayLayout.svelte`, de la lane A, ya en el base commit;
  ninguno en archivos míos).
- `bun run build`: OK.
- **App real** (`bun run dev:tauri`, ~4 min): **0 líneas `WARN`/`webview`** en la
  terminal. Antes del cambio, a los 3 segundos aparecía
  `[webview] WARN: [tauri] invoke() failed Command LANGUAGE not found`.
  *Pendiente manual:* abrir un show con 10 slides y confirmar en un cliente web
  remoto que recibe los cambios (no hay forma de hacerlo headless; `screencapture`
  falla por falta del permiso de grabación de pantalla en este entorno).

**Decisión / nota**

- Tocqué `updateSettings.ts` (sacar `LOADED`) aunque es archivo de la lane B
  (F10.1). Es un borrado de una línea, sin lógica; si hay conflicto al mergear,
  prevalece la versión sin `LOADED`.

---

## F10.7 — (pendiente)

## F11.1 — (pendiente)
