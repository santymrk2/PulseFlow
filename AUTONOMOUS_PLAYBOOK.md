# Plan de Migración Autónomo: FreeShow (Electron -> Tauri/Rust)

## Protocolo de Trabajo Autónomo (Directivas para el Agente)

1. **Flujo de Trabajo:** Tu objetivo es avanzar por los bloques de este documento sin intervención humana.
2. **Ciclo de Ejecución:**
   - Lee el siguiente "Bloque Pendiente".
   - Implementa el código en `tauri-app/src-tauri/src/`.
   - Ejecuta `cargo check` de forma autónoma.
   - Si hay errores, lee el log del compilador y corrígelos tú mismo. Aplica este ciclo hasta que compile sin errores.
   - Una vez que compila, edita este archivo (`AUTONOMOUS_PLAYBOOK.md`), cambia `[ ]` por `[x]` en el bloque terminado, y procede inmediatamente al siguiente bloque.
3. **Manejo de Errores Estricto:** NUNCA uses `.unwrap()` ni `.expect()`. Propaga todo mediante `AppResult` definido en `error.rs`.
4. **Respetar Dependencias:** Si necesitas una librería nueva, añádela a `Cargo.toml`.

---

## BITÁCORA DE EJECUCIÓN

### [x] Bloque 1: Fundamentos y Ventanas (COMPLETADO)

- Estructura base, errores, y comandos de ventana.

### [x] Bloque 2: Stores y Files (COMPLETADO)

- `tauri-plugin-store`, `tauri-plugin-dialog`, `std::fs`.

### [x] Bloque 3: Dominio SHOWS y MEDIA (COMPLETADO)

- `commands/shows.rs`: `SAVE`, `SHOW`, `SHOWS`, `REFRESH_SHOWS`, `FULL_SHOWS_LIST`, `BIBLE`, `DELETE_SHOWS`, `DELETE_SHOWS_NI`, `GET_EMPTY_SHOWS`, `BACKUPS`, `DELETE_BACKUP`.
- `commands/media.rs`: `DOES_MEDIA_EXIST`, `GET_THUMBNAIL`, `MEDIA_CODEC`, `READ_EXIF`.
- Dependencias añadidas: `image` (miniaturas de imágenes), `kamadak-exif` (EXIF).

### [x] Bloque 4: Dominio OUTPUT y APP (COMPLETADO)

- `commands/output.rs`: `GET_DISPLAYS` (vía `available_monitors`), `GET_SCREENS` y `GET_WINDOWS` (derivados de monitores/ventanas; la captura nativa llega con los sidecars).
- Rutas del sistema (`OPEN_LOG`, `OPEN_CACHE`, `OPEN_APPDATA`, `OPEN_FOLDER_PATH`) ya implementadas en `commands/files.rs` (con `tauri-plugin-opener`).

### [x] Bloque 5: Dominio SERVERS y SYNC (COMPLETADO)

- `state.rs`: `ServerState { running, websocket, data, ports }` en `AppState`.
- `commands/servers.rs`: `START`, `STOP`, `SERVER_DATA`, `WEBSOCKET_START` (registran estado; servidores reales más adelante).
- `commands/sync.rs`: `CAN_SYNC`, `GET_TEAMS`, `CLOUD_DATA` (respuestas mockeadas de éxito inicial).

### [x] Bloque 6: Dominio TIMECODE y MIDI (COMPLETADO)

- `state.rs`: campo `timecode: Mutex<Value>` en `AppState`.
- `commands/timecode.rs`: `TIMECODE_START`, `TIMECODE_STOP`, `TIMECODE_VALUE` (registran estado; el envío LTC/MTC nativo llega después).
- `commands/midi.rs`: `GET_MIDI_OUTPUTS`, `GET_MIDI_INPUTS` (listas vacías; MIDI nativo con FFI más adelante).

### [x] Bloque 7: Preparación para sidecars y FFI (COMPLETADO)

- `commands/streaming.rs`: `FFMPEG_CHECK` (busca ffmpeg en `PATH`, rutas de sistema y binario local, verificando con `ffmpeg -version`).
- `commands/blackmagic.rs` y `commands/ndi.rs`: módulos placeholder con mensaje "no implementado nativamente aún" (requieren sidecar/FFI nativo).

---

## FASE AUTÓNOMA COMPLETADA

Los 7 bloques están implementados y `cargo check` compila sin errores ni warnings.
Pendiente para siguientes fases: servidores REST/WebSocket reales, sync con proveedores
(ChurchApps), MIDI nativo, timecode LTC/MTC, captura de pantalla/ventana (NDI/Blackmagic),
video thumbnails/ffprobe y cloud/ZIP backup.
