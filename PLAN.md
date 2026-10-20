# PulseFlow — Plan del proyecto (Svelte + Tauri v2 + engine Rust)

> PulseFlow es un fork de [FreeShow](https://github.com/ChurchApps/FreeShow) (GPL-3.0). Identificador de la app: `com.pulseflow.app`; datos por defecto en `Documents/PulseFlow`.

## Arquitectura objetivo

```
┌──────────────────────────────────────────────────────────┐
│        UI de control (Svelte 5, src/frontend/)           │
│     El operador edita shows, elige slides, lanza salida  │
└───────────────────────────┬──────────────────────────────┘
                            │ IPC Tauri (invoke) — Scene Graph tipado
                            ▼
┌──────────────────────────────────────────────────────────┐
│         Engine de render Rust (src-tauri/src/render/)    │
│   wgpu + glyphon/cosmic-text + media pool + shaders WGSL │
└─────────────┬─────────────────┬──────────────────┬───────┘
              ▼                 ▼                  ▼
        Proyector (sala)   Stage Display     (salida de red:
                                              pendiente, sin NDI)
```

Decisiones de diseño:

- **No existe modo legacy web de salida.** La salida (audiencia y stage) es
  SIEMPRE el engine Rust nativo. No hay switch "Web / Nativo". Las ventanas de
  salida son ventanas nativas sin webview.
- La UI de control es Svelte (`src/frontend/`). Se comunica con Rust sólo por IPC
  (`src/frontend/IPC/tauri.ts`: `send(channel, [command], data)` → `invoke`).
- El estado que viaja a la salida es un **Scene Graph** serializado desde Svelte
  (items con posición/tamaño/estilo en coordenadas de la resolución de salida,
  fondo, transición), no HTML ni texto plano concatenado.
- `docs/design-reference/` conserva la estética del intento abandonado en React
  (shadcn + Tailwind v4 + Geist) sólo como referencia visual, no se compila.

## Estructura del repo

- `src/frontend/` — app Svelte real. `index.html` y `vite.config.mjs` de la raíz apuntan ahí.
- `src/types/` — tipos TypeScript compartidos.
- `src-tauri/` — backend Tauri v2 en Rust (`commands/`, `render/`, `server/`, ...).
- `docs/design-reference/` — referencia de diseño (no se compila).
- `scripts/setup-sidecars.js` — prepara ffmpeg/ffprobe como sidecars en `src-tauri/binaries/`.

## Reglas del proyecto

1. **Sin `.unwrap()` ni `.expect()` en código de producción de Rust** (en `#[cfg(test)]` sí).
   Devolver `Result<T, AppError>` (tipo en `src-tauri/src/error.rs`, serializable al frontend).
   Los locks envenenados se recuperan con `unwrap_or_else(|e| e.into_inner())` o se propagan como error.
2. Todo lo que antes era `ipcMain.handle` de Electron es un `#[tauri::command]` registrado en `lib.rs`.
3. Toda interfaz TypeScript que viaja al backend tiene su `struct` espejo en Rust con
   `#[derive(Serialize, Deserialize)]` (y `#[serde(rename_all = "camelCase")]` cuando aplique).
4. Usar `std::fs`, `std::path` o `tokio` en Rust; no inventar APIs de Node.
5. **Gestor de paquetes: SOLO bun** (`bun install`, `bun run`, `bunx`). Nunca npm/yarn/pnpm.
   El lockfile oficial es `bun.lock`.
6. Antes de commitear: `bun run test:svelte`, `bun run test:unit`, prettier sobre lo tocado
   y `cargo check` en `src-tauri/` si se tocó Rust.

## Estado real (honesto)

Hecho y funcionando a nivel código (compila; falta validación manual con hardware):

- Ventana nativa sin webview + swapchain wgpu con VSync.
- Texto en GPU con glyphon/cosmic-text, carga de fuentes del sistema/custom, stroke y sombra.
- Imágenes a textura (crate `image`) y media pool con reutilización de texturas entre salidas.
- Shaders WGSL de transición (crossfade, dip-to-black, push/wipe) con easing por uniforms en
  `render/transition.rs`. **Ojo:** el bucle de render de salida todavía NO los usa; `RENDER_SCENE` sólo
  guarda la configuración (tipo, duración, easing) y el cambio de slide es instantáneo.
- Stage display: ventana nativa propia.
- `TOGGLE_OUTPUTS` abre/cierra las salidas y emite `OUTPUT_STATE` al frontend. La API de
  ventanas por tipo (`OPEN/CLOSE/IS_OUTPUT_WINDOW(_OPEN)`, `OPEN/CLOSE/IS_STAGE_WINDOW(_OPEN)`)
  y el no-op `OUTPUTS` se eliminaron en F2.7 (sin uso en el frontend); hoy abrir/cerrar
  salida pasa por `TOGGLE_OUTPUTS` y la escena por `RENDER_SCENE`.
- **Scene Graph (`RENDER_SCENE`):** Svelte serializa el output activo (`sceneGraph.ts`, tipo en
  `src/types/SceneGraph.ts`, espejo en `render/scene.rs`) con items de texto en coordenadas de la
  resolución de la salida (posición, tamaño, fuente, peso, color, alineación horizontal/vertical,
  line-height, stroke, sombra, tramos con estilo propio), fondo (ruta, tipo, ajuste) y transición.
  El engine escala de la resolución lógica (1920 de ancho) a la ventana real.

Limitaciones reales:

- **Video:** se decodifica con **ffmpeg por pipe** (CPU) y se sube cada frame a una
  textura. NO es decodificación por hardware ni zero-copy. Sin sincronización
  audio/video ni control fino de reproducción.
- **Stage:** muestra texto plano (slide actual/siguiente), no los layouts reales de stage heredados de FreeShow.
- **NDI:** no hay salida ni captura. La captura de framebuffer del engine se eliminó en
  F8.4 (2026-10-19) porque era código muerto: escribía a un buffer cuyo contenido nadie
  leía nunca. Ver `docs/VERIFICAR.md`, sección "F8.4".
- **Overlays, timers y alertas** no se renderizan en el engine.
- **Limitaciones del Scene Graph actual:**
  - Sólo items de texto; los items de media, timer, reloj, web, cámara, formas, etc. se ignoran.
  - La alineación horizontal es una por item (la de la primera línea); no por línea.
  - El stroke y la sombra se toman del primer tramo de texto del item; el blur de `text-shadow` se ignora.
  - Autosize de texto: sólo se usa `autoFontSize` si ya está calculado; el engine no mide.
  - No se aplican `letter-spacing`, fondos/bordes del item, ni `lineGap`.
  - Sólo se renderiza una salida de audiencia (la primera activa); el Stage Display recibe el texto
    plano de esa misma escena.
  - Color de fondo sólido, `filter`, `flipped` y `blend` del fondo no se aplican.
  - La relación de aspecto del estilo de salida se asume igual a la de la ventana (se escala por ancho).
- Antes de la Fase 2 el comando `OUTPUTS` concatenaba todo el texto de la slide con
  fuente 56 fija y un rect 1720x700 fijo (se perdían posiciones y estilos).

## Fases

### Fase 1 — Limpieza del repo
- [x] Referencia de diseño React movida a `docs/design-reference/`; `src-react/` eliminado.
- [x] Scaffold de ejemplo `tauri-app/` eliminado; `tauri-app/src-tauri` pasa a `src-tauri/`.
- [x] `@tauri-apps/cli` en devDependencies raíz; scripts `tauri`, `dev:tauri`, `build:tauri`.
- [x] `package-lock.json` eliminado; sólo `bun.lock`.
- [x] Planes viejos eliminados; este `PLAN.md` es la fuente de verdad.
- [x] Crate renombrado a `pulseflow` / `pulseflow_lib`.

### Fase 2 — Un solo modo de salida: engine Rust
- [x] API única de ventanas (se unificaron los duplicados `*_NATIVE_*`); la API por tipo
  (`OPEN/CLOSE/IS_OUTPUT_WINDOW(_OPEN)`, `OPEN/CLOSE/IS_STAGE_WINDOW(_OPEN)`) se eliminó
  en F2.7 por no tener uso en el frontend.
- [x] Sin `.unwrap()` de locks en `render/` de producción (`render/sync.rs`).
- [x] Scene Graph real desde Svelte (`RENDER_SCENE`) en lugar de la concatenación de texto.
  El no-op `OUTPUTS` se eliminó en F2.7 (sin uso).
- [x] Eliminado el camino de la ventana webview de salida (`MainOutput.svelte`, `startupOutput`, `receiveOUTPUTasOUTPUT`); `isOutputWindow()` devuelve siempre `false`.
- [x] Inventario de comandos `send(OUTPUT, ...)` (ver más abajo).
- [ ] Limpieza pendiente (ambigua, no se borró): ramas `$currentWindow === "output"` / `"output"` que quedan como código inerte en
  `Textbox.svelte`, `Zoomed.svelte`, `Output.svelte` (`updateLinesTime`), `SlideItemTransition.svelte`, `SlideItems.svelte`,
  `Website.svelte`, `Captions.svelte`, `drawer/player/YouTube.svelte`, `drawer/player/Vimeo.svelte`, `stage/Stagebox.svelte`.
  El tipo del store `currentWindow` sigue incluyendo `"output"` para no romper esas comparaciones en svelte-check.
  Además `Output.svelte` y `stage/StageLayout.svelte` se usan sólo para las previews dentro de la UI de control.
- [ ] Limpiar los `send(OUTPUT, ...)` obsoletos del frontend (ver tabla, categoría "eliminar").
- **Prueba manual con monitor real (Fase 2 / F2.8) pendiente para el usuario**: texto,
  fondo imagen/video, cambio de slides y ubicación en el monitor elegido. La lista guiada
  está en `docs/VERIFICAR.md` (secciones F2.2–F2.8); no se puede ejecutar en este entorno
  (sin display físico ni segundo monitor).

### Fases siguientes

Las tareas pendientes (salida multi-pantalla, persistencia, Scene Graph, Looks, diseño,
IPC, video) están en [`docs/ROADMAP.md`](docs/ROADMAP.md), que es la lista de trabajo
a ejecutar. Plataformas soportadas: **macOS y Windows**.

## Inventario de comandos `send(OUTPUT, [...])`

El frontend envía por el canal `OUTPUT` (→ `invoke(<comando>)`) los comandos de abajo. Casi todos existían para
alimentar a la ventana webview de salida y a la gestión de ventanas de Electron. Hoy sólo pasan al backend los
comandos con `#[tauri::command]` propio de salida — `TOGGLE_OUTPUTS`, `RENDER_SCENE`, `UPDATE_BOUNDS` e
`IDENTIFY_SCREENS` (los `*_NDI_NATIVE_FEED` se eliminaron en F8.4) —; desde F2.6 el resto se **descarta antes de `invoke`** en la lista blanca de
`OUTPUT_COMMANDS` (`src/frontend/IPC/tauri.ts`), sin ensuciar la consola. Dos nombres coinciden con comandos de
Rust que NO son de salida:

- `SHOWS` (3 envíos): invoca `commands/shows.rs::SHOWS` (carga la biblioteca de shows) y descarta `data`. Es tráfico inútil: eliminar.
- `OUTPUTS`: **eliminado en F2.7** (era un no-op de compatibilidad sin uso).

Clasificación:

- **Cubierto por Scene Graph / Rust**: el dato ya viaja resuelto dentro de `RENDER_SCENE` o existe comando Rust.
- **Pendiente implementar en engine**: el engine nativo necesita la función y aún no la tiene.
- **Eliminar**: sólo sincronizaba datos o eventos a la ventana webview de salida (que ya no existe).

| Comando | Envíos | Clasificación | Nota |
| --- | --- | --- | --- |
| `RENDER_SCENE` | 1 | Cubierto (nuevo) | Scene Graph de la salida principal |
| `OUTPUTS` | 1 | Eliminado (F2.7) | Reemplazado por `RENDER_SCENE`; comando no-op eliminado |
| `TOGGLE_OUTPUTS` | 1 | Cubierto | Comando Rust existente (abre/cierra engine) |
| `TRANSITION` | 1 | Cubierto | La transición viaja en `scene.transition` (falta aplicarla en el render) |
| `STYLES` | 1 | Cubierto | El estilo de salida ya está aplicado en el Scene Graph |
| `TEMPLATES` | 1 | Cubierto | Plantillas aplicadas por `setTemplateStyle` antes de serializar |
| `MEDIA` | 1 | Cubierto | Ajustes de fondo resueltos en `scene.background` |
| `LANGUAGE` | 1 | Eliminar | Idioma para el contexto de la ventana webview |
| `TIME_FORMAT` | 1 | Eliminar | Dato para dynamic values en webview (ya resueltos en Svelte) |
| `GLOBAL_REGEXES` | 1 | Eliminar | Idem |
| `CUSTOM_METADATA` | 1 | Eliminar | Metadata resuelta al serializar (falta metadata como item, ver overlays) |
| `CUSTOM_CREDITS` | 1 | Eliminar | Idem |
| `VARIABLES` | 1 | Eliminar | Dynamic values se resuelven en Svelte (`replaceDynamicValues`) |
| `DYNAMIC_VALUE_DATA` | 1 | Eliminar | Idem |
| `REQUEST_DYNAMIC_VALUE` / `MAIN_REQUEST_DYNAMIC_VALUE` | 2 | Eliminar | Ida y vuelta webview <-> main |
| `REQUEST_VOLUME` / `MAIN_REQUEST_VOLUME` | 2 | Eliminar | Idem (condiciones por volumen) |
| `SPECIAL` | 1 | Eliminar | Ajustes para la ventana webview |
| `SLIDE_TIMELINE_SPEED_MULTIPLIER` | 1 | Eliminar | Timeline de items (HTML) |
| `SYNCED_OUTPUTS` | 1 | Eliminar | Sync entre ventanas |
| `ALL_OUTPUTS` | 2 | Eliminar | "Stage mirror" para webview; el stage nativo usa `plainText` |
| `OUT_SLIDE_CACHE` | 1 | Eliminar | Cache para stage webview |
| `STAGE` | 1 | Eliminar | Los layouts de stage se resolverán en el Scene Graph (ver stage con layouts reales) |
| `SHOWS` | 3 | Eliminar | Colisiona con el comando `SHOWS` de la biblioteca |
| `SHOWS_DATA` / `MAIN_SHOWS_DATA` | 3 | Eliminar | Datos de shows para webview |
| `CATEGORIES` | 1 | Eliminar | Idem |
| `GROUPS` | 1 | Eliminar | Idem |
| `PROJECTS` / `ACTIVE_PROJECT` | 2 | Eliminar | Idem |
| `EVENTS` | 1 | Eliminar | Idem |
| `PLAYER_VIDEOS` | 1 | Eliminar | Players web (YouTube/Vimeo) no se renderizan en el engine |
| `PLAYING_AUDIO` / `AUDIO_DATA` | 2 | Eliminar | Estado de audio para webview |
| `PLAYING_VIDEO_STATE` | 1 | Pendiente | Entra con "video sincronizado" |
| `WEBSITE_ACTION` | 1 | Eliminar | Items web no se soportan en el engine |
| `METRONOME` / `METRONOME_TIMER` | 2 | Eliminar | Visual del metrónomo en webview |
| `VISUALIZER_DATA` | 3 | Eliminar | Visualizador de audio en webview |
| `CLOSE_AD` | 1 | Eliminar | Anuncio de YouTube en webview |
| `MAIN_SHORTCUT` | 1 | Eliminar | Atajos reenviados desde la ventana webview de salida |
| `ACTION_MAIN` | 2 | Eliminar | Botones clicables dentro de la ventana de salida |
| `ALERT_MAIN` | 1 | Eliminar | Alerta desde la ventana de salida (Captions) |
| `FOCUS` | 1 | Eliminar | Foco de la ventana web (websiteDomPool) |
| `PREVIEW_RESOLUTION` | 2 | Eliminar | Ya está comentado en el código; era para el canvas de preview |
| `TOGGLE_KIOSK` | 1 | Eliminar | Ya está comentado en el código |
| `UPDATE_VIDEO` | 1 | Eliminar | Ya está comentado en el código; lo reemplaza "video sincronizado" |
| `OVERLAYS` / `OVERLAY` | 3 | Pendiente | Overlays en el Scene Graph y en el engine |
| `EFFECTS` | 1 | Pendiente | Capa de efectos (partículas, etc.) |
| `ACTIVE_TIMERS` / `TIMERS` | 6 | Pendiente | Timers/relojes renderizados por el engine |
| `COLORBARS` | 1 | Pendiente | Patrón de barras en el engine |
| `LIVE_PREPARE` | 1 | Pendiente | Fundido a negro mientras se prepara el cambio |
| `DRAW` / `DRAW_TOOL` / `DRAW_SETTINGS` | 7 | Pendiente | Herramienta de dibujo sobre la salida (baja prioridad) |
| `CREATE` | 7 | Eliminado (F2.7) | Crear la ventana de una salida: hoy se hace con `TOGGLE_OUTPUTS` |
| `SET_VALUE` | 7 | Pendiente | Propiedades de la salida (alwaysOnTop, transparente, webrtc/rtmp data...) |
| `REMOVE` | 1 | Pendiente | Cerrar/eliminar la ventana de una salida |
| `UPDATE_BOUNDS` | 2 | Pendiente | Mover/redimensionar la ventana nativa |
| `TO_FRONT` | 1 | Pendiente | Traer ventana al frente |
| `ALIGN_WITH_SCREEN` | 1 | Pendiente | Alinear la ventana a la pantalla elegida |
| `IDENTIFY_SCREENS` | 2 | Pendiente | Mostrar el número de cada pantalla (ventanas nativas) |
| `CAPTURE` | 3 | Pendiente | Captura de frames para streaming/preview/grabadora (framebuffer del engine). En F8.4 se eliminó la captura NDI que existía: era código muerto (ver `docs/VERIFICAR.md`, "F8.4") |

Los números de la columna "Envíos" son las ocurrencias de `send(OUTPUT, ["X"]...)` en `src/frontend/`
(los `//` comentados incluidos en algunos casos). Para limpiar la categoría "eliminar" hay que revisar
cada llamador porque algunas de esas señales también las consume el receptor de la ventana principal.

---

## Inventario de canales `Main.*` sin comando en Rust (F7.1)

`src/types/IPC/Main.ts` declara 153 canales; `src-tauri/src/lib.rs` registra 90
comandos. Los 76 canales restantes hoy quedan sin destinatario: `requestMain`
espera 15 s y resuelve `undefined` (F7.2 agrega la respuesta inmediata para los
pospuestos). Estado: ✅ implementado / 🗑 eliminar / ⏸ posponer.

### Implementar (F7.4)

| Canal | Pantalla / uso | Notas |
| --- | --- | --- |
| `IMPORT` | Drawer Import (`startImport` en `helpers/import.ts`) | Diálogo nativo; zip→`IMPORT_FILES`, `.pdf`→`IMPORT2`, media→`IMAGES_TO_SHOW`. Formats: `.pro`/`.pdf`/`.zip` |
| `IMPORT_FILES` | Mismo `startImport` (files explícitos) | Comparte el pipeline con `IMPORT`, sin diálogo |
| `URL` | Drawer Import | Descarga `url` a `Media/<folder>`; requiere `createFolder`/`readFolder` (F5.1) |
| `SAVE_IMAGE` | `components/output/` (guardado de imágenes exportadas) | Escribe base64 en `Exports/` y abre la carpeta (`open_in_system`, F4.1) |
| `PDF_TO_IMAGE` | `utils/apiHelper.ts::getPDFThumbnails` | pdfjs ya corre en el frontend; falta el comando Rust que vuelca las páginas a `Imports/PDF/<name>/N.jpg` |
| `IP` | `components/systemInfo/Info.svelte` | Direcciones locales vía UDP socket trick, sin dependencias |
| `MAXIMIZED` | `components/systemInfo/Info.svelte` / estado de ventana | Comando `window.is_maximized()`; y `MAXIMIZE` debe alternar + emitir `MAIN{MAXIMIZED}` como en Electron |

`BACKUP` ya está implementado (`BACKUPS`/`DELETE_BACKUP`/`RESTORE`, ver
`commands/backup.rs`).

### Eliminar (canal → destinatario inexistente)

| Canal | Motivo |
| --- | --- |
| `LANGUAGE` | Su destinatario era `setGlobalMenu` (menú nativo de Electron). PulseFlow no tiene menú nativo |
| `OUTPUT` (este canal, no `TOGGLE_OUTPUTS`) | En Electron hacía un `send()` a la ventana de salidas; las respuestas acá llegan por eventos `OUTPUT`/`OUTPUT_STATE` |
| `AI_*` (9 canales: `IMAGE`, `STYLES`, `SCRIPTURE`, `SUGGESTION`, `SUGGESTION2`, `TEXT`, `TRANSLATION`, `TRANSCRIPTION`, `VIDEO`) | Sin uso en el frontend; la feature AI no existe en PulseFlow |
| `PCO_PUSHER_AUTH` | Sin uso (integración Planning Center está en pausa) |

### Posponer (57 canales)

Responden `undefined` inmediato vía F7.2. Nombre real de cada canal:

- **Permisos / sistema** (7): `DEVICE_ID`, `GET_DEVICE_NAME`, `CHECK_RAM_USAGE`,
  `ACCESS_CAMERA_PERMISSION`, `ACCESS_MICROPHONE_PERMISSION`, `ACCESS_SCREEN_PERMISSION`,
  `GET_GRAPHICS_DEVICES`.
- **Now Playing / spotlight** (4): `NOW_PLAYING`, `NOW_PLAYING_UNSET`, `OPEN_NOW_PLAYING`,
  `LOG_ERROR`.
- **Config del navegador** (2): `SPELLCHECK`, `AUTO_UPDATE` (updater de Electron).
- **Media / descargas** (7): `DOWNLOAD_LESSONS_MEDIA`, `MEDIA_DOWNLOAD`,
  `MEDIA_IS_DOWNLOADED`, `MEDIA_FOLDER_COPY`, `GET_SIMILAR`, `CHECK_MEDIA_LICENSE`,
  `CAPTURE_SLIDE` (requiere el engine de render; ver `docs/VERIFICAR-F7.md`).
- **PPT/slideshow externo** (4): `PPT_TO_PDF`, `SLIDESHOW_GET_APPS`, `START_SLIDESHOW`,
  `PRESENTATION_CONTROL`.
- **MIDI realtime / timecode** (5): `SEND_MIDI` (stubeado en `commands/midi.rs`, requiere
  crate MIDI), `RECEIVE_MIDI`, `CLOSE_MIDI`, `TIMECODE_AUDIO_DATA`, `TIMECODE_STATUS`.
- **Lyrics / recorder / OSC** (5): `GET_LYRICS`, `SEARCH_LYRICS`, `RECORDER`,
  `API_TRIGGER`, `EMIT_OSC`.
- **Cloud / providers** (12): `CLOUD_SYNC`, `RESTORE_CLOUD_BACKUP`, `GET_CONVERSATION_ID`,
  `SEND_SOCKET_MESSAGE`, `PROVIDER_LOAD_SERVICES`, `PROVIDER_CONNECTIONS`,
  `PROVIDER_DISCONNECT`, `PROVIDER_STARTUP_LOAD`, `PROVIDER_FETCH_FOLDERS`,
  `GET_CONTENT_PROVIDERS`, `GET_CONTENT_LIBRARY`, `GET_PROVIDER_CONTENT`.
- **Planning Center / OnStage** (6): `PCO_LIVE_GET`, `PCO_FETCH_SERVICE_TREE`,
  `PCO_LOAD_PLAN`, `ONSTAGE_LOAD_SERVICE`, `ONSTAGE_GET_TEAMS`, `ONSTAGE_SWITCH_TEAM`.
- **Spotify / ffmpeg / RTMP** (4): `SPOTIFY_GET_STATE`, `SPOTIFY_COMMAND`, `FFMPEG_DOWNLOAD`,
  `ENCODER_DETECT`, `SET_RTMP_ENCODER`.
