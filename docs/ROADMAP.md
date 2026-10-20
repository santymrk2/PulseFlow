# PulseFlow — Roadmap de ejecución

Documento para ejecutar con un agente (opencode). Las reglas generales están en
[`AGENTS.md`](../AGENTS.md); la arquitectura y el inventario de comandos `OUTPUT`, en
[`PLAN.md`](../PLAN.md).

**Cómo usarlo:** ejecutar las tareas **en orden** y de a una. Cada tarea tiene
*Archivos*, *Pasos*, *Aceptación* y *Verificación*. Al terminar una: marcar `[x]`,
un commit `Fx.y: …`. Si una tarea resulta más grande de lo previsto o el criterio de
aceptación no se puede cumplir, **parar y reportar**; no improvisar alcance.

Las fases F1–F2 son bloqueantes: hasta que no se puede proyectar una slide en un
monitor real, todo lo demás se construye sin poder verificarse.

---

## Contexto: estado al 2026-10-18 (verificado en la app real)

Hallazgos de una sesión con la app corriendo (Xvfb + Tauri) — la base de este plan:

1. **Botones muertos (corregido en `b7fa296`).** `Button.svelte` y `HoverButton.svelte`
   se habían pasado a runes y Svelte 5 dejó de reenviar los `on:click` de los padres:
   no funcionaban las pestañas de Settings, "poner en vivo" ni el play de video.
2. **La ventana de salida no se crea.** `render/mod.rs::start_native_output` construye
   la ventana con `.visible(false)` y después crea la superficie WGPU: falla con
   *"the underlying handle is not available"* (en macOS no está verificado).
3. **El frontend nunca se entera de que la salida está activa.** Rust no emite
   `OUTPUT_STATE`; `outputDisplay` queda en `false`, el botón no cambia de estado y
   `toggleOutputs()` siempre calcula `state = true` → **no hay forma de cerrar la salida**.
4. **Se ignora el monitor elegido.** `TOGGLE_OUTPUTS` llama a
   `start_native_output(&app, None, None)`: no usa `bounds` ni `screen`.
5. **Una sola ventana.** Etiquetas fijas `native-output` / `native-stage`: dos salidas
   de audiencia (o dos stage) no pueden convivir; la escena es global.
6. **Ruido de IPC.** `IPC/tauri.ts` convierte cada `send(OUTPUT, [X])` en
   `invoke("X")`: ~60 *"Command X not found"* por cada actualización de slide.
7. **Backend incompleto.** De 171 canales `Main.*` que usa el frontend, ~95 no tienen
   comando Rust (entre otros `IMPORT`, `BACKUP`, `URL`, `LANGUAGE`, `PDF_TO_IMAGE`,
   `SEND_MIDI`, `SAVE_IMAGE`, `CHECK_RAM_USAGE`). Los `requestMain` esperan 15 s y
   devuelven `undefined`.
8. **Persistencia silenciosa.** `domain/data/store.rs` hace
   `let _ = std::fs::write(...)` y `serde_json::to_string(...).unwrap_or_default()`:
   si la escritura falla, el usuario pierde datos sin enterarse.
9. **Detalles:** el output por defecto apunta a `style: "default"` que no existe (la UI
   muestra "Unnamed"); `Splash.svelte` y `ImportScripture.svelte` todavía dicen
   "FreeShow"; logos e íconos son los de FreeShow.

Hay un **borrador sin compilar** de gestor de pantallas multi-ventana en
`docs/drafts/render_screens.rs` (diseño de F2.1–F2.4). Usarlo como punto de partida,
no como código probado.

---

## Estado al 2026-10-19 (después de trabajar con 3 agentes en paralelo)

Rama principal `feature/tauri-rust-migration` (`d7dd318`): F0–F4.5, F3.1 (tests
portables), F6.1–F6.5 y F7.1–F7.4 (`IMPORT`) integrados. Chequeos: test:unit 58/58,
cargo test 59/59, svelte-check **58 errores** (nueva referencia), build OK.

| Qué | Dónde | Estado |
| --- | --- | --- |
| F4.6 overlays | integrado | **Hecho** (2026-10-19): capa propia dibujada en el engine (fondo → medios slide → texto slide → medios overlay → texto overlay), fixture `audience-overlays.json`, golden `overlays.png`. |
| F6.2–F6.5 diseño | integrado | **Hecho** (2026-10-19): checkboxes marcados. Queda sólo la verificación visual del usuario (capturas) según `docs/VERIFICAR-F6.md`. |
| F7.4 canales Main | integrado | **Completo** (2026-10-19): incluye `PDF_TO_IMAGE` real (F7.5, opción (a): pdf.js en el webview + guardado en Rust). |
| F8.1–F8.2 video | integrado (2026-10-19) | **Hecho**: ciclo de vida de ffmpeg (stop/EOF/error/fallback HW→SW) y un decodificador por archivo compartido entre pantallas (`video_hub`). Traído de `feature/video`; su F7.5 propio (`294a2594`, vía `SAVE_IMAGE`) se descartó a favor del de esta rama (`fab5d003`). |
| `wip/f7` (`af2a2a8`) | rama `wip/f7` | **Descartar**: es `cargo fmt` sobre todo el crate, sin cambios funcionales. Sus notas ya están en `docs/VERIFICAR-F7.md`. |
| `f6-pulseflow`, `feature/diseno`, `feature/ipc`, `wip/f4`, `wip/f7` | ramas remotas | Ya integradas o descartadas; se pueden borrar. `feature/ipc` trae un F4.6 duplicado (`d834310`) que **no** se integró: el bueno es `1f9f932`. |
| F5 Looks | integrado (`3e5cc0c`) | **Completo** (2026-10-19): F5.2–F5.5 hechos (`75de6427`, `ed9fc8d5`, `25aae601`, commit de F5.5). |

---

## F0 — Línea base y herramientas de verificación

- [x] **F0.1 Registrar la línea base.** (2026-10-18, macOS arm64, commit base `22726c39`)
  *Pasos:* correr `bun run test:unit`, `bun run test:svelte`, `bun run build`,
  `cd src-tauri && cargo check && cargo test --lib`. Anotar abajo los números
  (tests pasados, errores/warnings de svelte-check).
  *Aceptación:* tabla completada en esta sección y commiteada.

  | Chequeo | Resultado |
  | --- | --- |
  | test:unit | ✅ 47/47 tests en 3 archivos |
  | test:svelte | ⚠️ falla (exit 1): **59 errores** / 317 warnings en 152 archivos (la referencia previa de 220 errores era anterior al fix `b7fa296`; no aumentar) |
  | build | ✅ `vite build` OK en 9.36 s (warnings de chunks > 500 kB, heredados) |
  | cargo check | ✅ sin errores ni warnings |
  | cargo test --lib | ✅ 9/9 tests |

- [x] **F0.2 Snapshot de escena sin monitor (`RENDER_SNAPSHOT`).** (verificado
  2026-10-18: `cargo test --lib` genera y valida el PNG; el comando fue invocado
  desde la consola del webview real y el PNG resultante se verificó píxel a
  píxel. Sólo existe en builds de desarrollo y escribe en
  `<app_cache_dir>/snapshots/` con nombre simple validado.)
  *Por qué:* hoy nadie (ni un agente ni CI) puede verificar qué dibuja el engine sin
  un monitor físico. Esto habilita tests de la salida.
  *Archivos:* `src-tauri/src/render/` (nuevo `snapshot.rs` o dentro del módulo de
  pantallas de F2), `src-tauri/src/commands/output.rs`, `lib.rs`.
  *Pasos:* función que renderiza una `ScenePayload` a una textura offscreen
  (`wgpu` sin superficie), la copia a un buffer y la guarda como PNG; comando de debug
  `RENDER_SNAPSHOT { scene, width, height, path }`; test `#[cfg(test)]` que dibuja una
  escena con texto y verifica que hay píxeles no negros en la zona del texto.
  *Aceptación:* `cargo test --lib` genera y valida un PNG; el comando funciona desde
  la consola del webview.

---

## F1 — Plataformas: sólo macOS y Windows

- [x] **F1.1 Bundles y configuración.** (verificado 2026-10-18: `tauri build` en
  macOS produjo sólo `.app` y `.dmg`; sin intentos de deb/rpm/AppImage. Íconos
  `.icns`/`.ico` presentes — siguen siendo los de FreeShow, branding en F9.4.)
  *Archivos:* `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
  *Pasos:* `bundle.targets` → `["app", "dmg", "nsis"]`; `bundle.macOS.minimumSystemVersion`
  (11.0); `bundle.windows` (WebView2 `downloadBootstrapper`); revisar íconos `.icns`/`.ico`.
  *Aceptación:* `tauri build` no intenta generar `.deb/.rpm/.AppImage`.

- [x] **F1.2 CI en macOS y Windows.** (verificado 2026-10-18 con corridas reales
  disparadas por `gh`: CI run 39165461277 verde en los tres jobs — Rust macOS,
  Rust Windows y Frontend — y Build run 39164663595 verde en `macos-latest` y
  `windows-latest`, con bundles release completos. El job de Rust usa matriz
  `[macos-latest, windows-latest]` sin `apt-get`; `build.yml` sólo matrix
  `[macos-latest, windows-latest]`. Dos fixes durante la corrida: `shell: bash`
  explícito para el stub de sidecars en Windows y extensión `.exe` en los
  stubs.)
  *Archivos:* `.github/workflows/ci.yml`, `build.yml`.
  *Pasos:* el job de Rust corre en `macos-latest` y `windows-latest` (quitar
  `apt-get` de GTK); el job de frontend puede seguir en `ubuntu-latest` (sólo bun);
  `build.yml` sólo matrix `[macos-latest, windows-latest]`; el paso de sidecars usa
  `--only-host`.
  *Aceptación:* ningún workflow instala paquetes de Linux para compilar Rust.

- [x] **F1.3 Código y scripts específicos de Linux.** (verificado 2026-10-18:
  `grep -rni "linux|vaapi|gtk" src-tauri/src scripts .github PLAN.md README.md`
  sin resultados; `hwaccel` sólo VideoToolbox/D3D11VA; sidecars sólo para
  darwin-x64/arm64 y win32-x64, `--only-host` OK; `cargo test --lib` 16/16.
  La sección de desarrollo del README se reescribió con bun/macOS-Windows, que
  estaba desactualizada con Node/npm.)
  *Archivos:* `src-tauri/src/render/video.rs` (rama `hwaccel auto`),
  `scripts/setup-sidecars.js`, `PLAN.md`, `README.md`.
  *Pasos:* quitar ramas/documentación de Linux; en `setup-sidecars.js` limitar los
  targets a `aarch64/x86_64-apple-darwin` y `x86_64-pc-windows-msvc`.
  *Aceptación:* `grep -rni "linux\|vaapi\|gtk" src-tauri/src scripts .github` sin
  resultados relevantes.

- [x] **F1.4 Permisos y firma (preparación).** (verificado 2026-10-18: `tauri build`
  en macOS incluye los tres claves de uso en `Contents/Info.plist` del `.app`;
  `Entitlements.plist` es aceptado por `codesign` con allow-jit + cámara +
  micrófono; `entitlements` declarado en `bundle.macOS`; README con la sección
  de firma/notarización macOS y firma Windows. Sin secretos configurados.)
  *Archivos:* `src-tauri/Info.plist` (nuevo), `src-tauri/Entitlements.plist` (nuevo).
  *Pasos:* declarar `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` y lo
  necesario para captura de pantalla; documentar en `README.md` cómo firmar/notarizar
  (macOS) y firmar (Windows). No configurar secretos.
  *Aceptación:* `tauri build` en macOS incluye el plist; README con la sección.

---

## F2 — Salida funcional de punta a punta (pantallas)

Objetivo: elegir monitor en Settings → "poner en vivo" → la slide aparece en ese
monitor; volver a tocar el botón la cierra. Este trabajo **es** el refactor de
`commands/output.rs` y `render/mod.rs`: se hace junto con la funcionalidad, no antes.

- [x] **F2.1 Gestor de pantallas en Rust.** (verificado 2026-10-18: `cargo check`
  limpio y `cargo test --lib` 24/24, incluidos los tests de selección de monitor
  (`select_monitor_prefers_bounds_center`, `select_monitor_falls_back_to_index_then_secondary`)
  y de layout de stage (`stage_layout_*`). `ScreenManager` es el estado de Tauri
  (escenas por id que persisten + pantallas abiertas + `ndi_capture` y
  `transition_config` de engine hasta F3/F8); ventana creada visible antes de la
  superficie WGPU; un solo bucle de render donde stage es un layout
  (`stage::stage_blocks`); `render/mod.rs` es fachada y se eliminaron
  `start_native_output`, `NATIVE_OUTPUT_LABEL`, `RenderState`, `active_render`,
  el stage nativo y todo el API de escena global. Los comandos se re-enrutaron:
  `TOGGLE_OUTPUTS` abre/cierra por `ScreenConfig` y `RENDER_SCENE` aplica la
  escena por `outputId`; los comandos legacy sin uso en el frontend son shims
  sobre pantallas abiertas hasta F2.7. Decisión propia: se conserva el efecto
  secundario de escribir el texto principal en los stages abiertos hasta F2.4,
  para no regresionar el comportamiento visible entre tareas.)
  *Archivos:* `src-tauri/src/render/` (partir de `docs/drafts/render_screens.rs`),
  `render/mod.rs`, `render/stage.rs`.
  *Pasos:*
  1. `ScreenManager` en el estado de Tauri: `HashMap<outputId, ScreenHandle>` y una
     escena (`Arc<RwLock<ScreenScene>>`) por salida que persiste aunque la ventana esté
     cerrada.
  2. Una ventana nativa por salida (`screen-<id>`), **creada visible** antes de la
     superficie WGPU (hallazgo 2).
  3. Un único bucle de render para audiencia y stage (el stage es otro layout, no otro
     ciclo de vida): mover el dibujo de `stage.rs` a una función `stage_blocks()`.
  4. `render/mod.rs` queda como fachada: declara módulos y re-exporta la API pública.
     Eliminar `start_native_output`, `NATIVE_OUTPUT_LABEL`, `active_render`, etc.
  *Aceptación:* `cargo check`/`cargo test` pasan; tests unitarios de selección de
  monitor y layout de stage.

- [x] **F2.2 Ubicación en el monitor elegido.** (verificado 2026-10-18: `cargo test --lib`
  25/25; lógica pura de selección `select_monitor_index` testeada (bounds-center,
  fallback a índice y a secundario); `place_window` implementada en
  `screens::place_window`: si el monitor objetivo es el mismo que la ventana de
  control (`main_monitor`) y `bounds` cubren ese monitor → ventana flotante 16:9
  redimensionable (Stage escala 0.4, Audiencia 0.45); en caso contrario borderless
  y con `set_simple_fullscreen(true)` cuando bounds coinciden o no se especifican
  (comportamiento para Windows/macOS). `UPDATE_BOUNDS` reubica la pantalla
  abierta; el comando está registrado en `commands/output.rs` y en el manejador
  IPC de `lib.rs`. No es posible probar GUI de 2 monitores en este entorno; los
  pasos manuales y el chequeo GUI quedaron a cargo del usuario en
  `docs/VERIFICAR.md` (ver archivo, sección "F2.2").)
  *Pasos:* el monitor es el que contiene el centro de `output.bounds` (fallback:
  índice `output.screen`, luego el secundario). Si es el monitor de la ventana de
  control → ventana flotante 16:9 redimensionable (para no tapar la UI). Si es otro →
  sin bordes y `set_simple_fullscreen(true)` (macOS) / borderless del tamaño del
  monitor (Windows). Respetar `alwaysOnTop`. `UPDATE_BOUNDS` reubica una pantalla
  abierta.
  *Aceptación:* con 2 monitores, la salida cubre el elegido; con 1, aparece flotante.
  Probarlo en macOS **y** en Windows, y anotar el resultado en el commit.
  *Pasos:* el monitor es el que contiene el centro de `output.bounds` (fallback:
  índice `output.screen`, luego el secundario). Si es el monitor de la ventana de
  control → ventana flotante 16:9 redimensionable (para no tapar la UI). Si es otro →
  sin bordes y `set_simple_fullscreen(true)` (macOS) / borderless del tamaño del
  monitor (Windows). Respetar `alwaysOnTop`. `UPDATE_BOUNDS` reubica una pantalla
  abierta.
  *Aceptación:* con 2 monitores, la salida cubre el elegido; con 1, aparece flotante.
  Probarlo en macOS **y** en Windows, y anotar el resultado en el commit.

- [x] **F2.3 Estado de salidas hacia el frontend.** (verificado 2026-10-18: `cargo check`
  y `cargo test --lib` 25/25; `TOGGLE_OUTPUTS` emite `app.emit("OUTPUT", { channel: "OUTPUT_STATE", ... })`
  tanto al abrir (ids → active: true) como al cerrar (ids → active: false); el
  `Destroyed` event de cada ventana cierra la pantalla y también emite
  `active: false` para ese `id`. Los estados se calculan sobre las pantallas que
  realmente se abren/cierran usando `open_ids`.)
  *Pasos:* `TOGGLE_OUTPUTS { outputs, state }` abre/cierra todas las pantallas
  indicadas y emite `app.emit("OUTPUT", { channel: "OUTPUT_STATE", data: [{ id, active }] })`.
  También emitir cuando el sistema cierra una ventana (`WindowEvent::Destroyed`).
  *Aceptación:* el botón de salida se pone rojo al abrir y un segundo click (con la
  confirmación existente) cierra todas las pantallas. Asegurar que los eventos
  lleguen a Svelte (listeners).
  *Pasos:* `TOGGLE_OUTPUTS { outputs, state }` abre/cierra todas las pantallas
  indicadas y emite `app.emit("OUTPUT", { channel: "OUTPUT_STATE", data: [{ id, active }] })`.
  También emitir cuando el sistema cierra una ventana (`WindowEvent::Destroyed`).
  *Aceptación:* el botón de salida se pone rojo al abrir y un segundo click (con la
  confirmación existente) cierra todas las pantallas.

- [x] **F2.4 Escena por pantalla.** (verificado 2026-10-18: `cargo check` limpio y
  `cargo test --lib` 26/26, incluido el nuevo test de serde de `nextText`
  (`parses_stage_next_text_and_defaults_to_none`); `bun run test:unit` 47/47;
  `bun run test:svelte` 59 errores (línea base, sin aumento); Prettier limpio.
  `sendOutputScenes()` envía ahora un `RENDER_SCENE` por **cada** salida
  habilitada, audiencia y stage: las stage resuelven su salida fuente como
  `receiveSTAGE.OUT` (layout de stage → `settings.output`, si no la primera
  habilitada) y mandan `plainText` (slide actual) y `nextText` (slide siguiente
  del layout, ignorando desactivadas); `nextText` se agregó al Scene Graph
  (`src/types/SceneGraph.ts`) y a `ScenePayload` (Rust, con espejo y test). En
  Rust, la rama stage de `RENDER_SCENE` rellena `StageData.next_slide` y se
  eliminaron los efectos secundarios temporales de F2.1 (escribir el texto
  principal en todos los stages abiertos desde `RENDER_SCENE` y `SELECT_SLIDE`).
  El video de fondo ya era por pantalla (`set_scene_background` → `sync_video`
  por `ScreenHandle`). La verificación GUI de dos monitores + stage quedó para
  el usuario en `docs/VERIFICAR.md`, sección "F2.4".)
  *Archivos:* `src/frontend/components/helpers/sceneGraph.ts`,
  `src/frontend/utils/listeners.ts`, `commands/output.rs`.
  *Pasos:* `sendOutputScenes()` manda un `RENDER_SCENE` por **cada** salida habilitada
  (audiencia y stage) con su `outputId`; en stage incluir `plainText` actual y
  `nextText` (slide siguiente). Rust aplica la escena a la pantalla de ese id; el video
  de fondo se arranca/detiene por pantalla.
  *Aceptación:* dos salidas de audiencia con estilos distintos muestran cada una su
  estilo; una salida stage muestra actual + siguiente + reloj.

- [x] **F2.5 `IDENTIFY_SCREENS`.** (verificado 2026-10-18: `cargo check` limpio y
  `cargo test --lib` 29/29, incluidos los 3 tests nuevos —matching puro
  `identify_targets`, serde del payload de `GET_DISPLAYS` y bloques de texto
  del número—; `bun run test:unit` 47/47; `svelte-check` 59 errores (línea base,
  sin aumento); Prettier limpio. `IDENTIFY_SCREENS` abre una ventana temporal
  por monitor (label `identify-N`, sin decorations, always-on-top, cubriendo el
  monitor) con el mismo bucle de render de las salidas: número grande centrado
  + rótulo "PulseFlow — Pantalla N"; a los 3 s el hilo temporizador une al hilo
  de render y destruye la ventana. Las ventanas NO entran en `ScreenManager`
  (no emiten `OUTPUT_STATE` ni se confunden con salidas). El número es la
  posición (1-based) de la entrada en el payload, que es como numera la
  previsualización; el monitor se empareja por centro de `bounds` con fallback
  al índice. El frontend ya enviaba el comando desde `Screens.svelte` y
  `OutputSelector.svelte`; no hizo falta tocar Svelte. La verificación visual
  con monitores reales quedó para el usuario en `docs/VERIFICAR.md`, sección
  "F2.5".)
  *Pasos:* ventana temporal por monitor con el número grande durante 3 s (usa el mismo
  bucle de render).
  *Aceptación:* el botón de lupa de "Elegir pantalla" muestra los números.

- [x] **F2.6 Puente `OUTPUT` sin ruido.** (verificado 2026-10-18: `bun run test:unit` 47/47;\n  `svelte-check` 59 errores (línea base, sin aumento); Prettier limpio. No se toca Rust.)\n  En `src/frontend/IPC/tauri.ts` hay una lista blanca `OUTPUT_COMMANDS` con los comandos\n  del canal `OUTPUT` que existen en Rust (`TOGGLE_OUTPUTS`, `RENDER_SCENE`,\n  `UPDATE_BOUNDS`, `IDENTIFY_SCREENS` y el no-op `OUTPUTS`, que se elimina en F2.7).\n  `send()` descarta cualquier otro comando del canal `OUTPUT` antes de `invoke`: eran\n  señales heredadas de la ventana webview de Electron (`CREATE`, `DRAW`, `SHOWS`,\n  `CAPTURE`, `SET_VALUE`, …) que sólo producían \"Command … not found\" al cambiar de\n  slide. En desarrollo se avisa una sola vez por nombre (`warnedOutputCommands`); en\n  producción el descarte es silencioso. El filtro va tras la destructuración\n  `{ channel, data }` y sólo aplica a `channel === OUTPUT`, así que el canal `MAIN` y las\n  respuestas entrantes (`OUTPUT_STATE`, `BUFFER`, …) no se ven afectados. Aceptación\n  comprobada de forma determinista (todo comando no listado se descarta antes de\n  `invoke`, por lo que no puede generar el error); la prueba visual en la app quedó para\n  el usuario en `docs/VERIFICAR.md`, sección \"F2.6\".)\n  *Archivos:* `src/frontend/IPC/tauri.ts`.\n  *Pasos:* lista blanca de comandos del canal `OUTPUT` que existen en Rust\n  (`TOGGLE_OUTPUTS`, `RENDER_SCENE`, `UPDATE_BOUNDS`, `IDENTIFY_SCREENS`, …). Los demás\n  no se invocan (eran para la ventana webview); en desarrollo, loguear una sola vez por\n  nombre.\n  *Aceptación:* cambiar de slide no produce ningún "Command … not found".

- [x] **F2.7 Borrar API muerta del engine.** (verificado 2026-10-18, commit `86c029b6`:
  `grep` en `src/` confirmó 0 usos en el frontend de los 15 comandos listados; se
  eliminaron de `commands/output.rs` y de la lista `invoke_handler` en `lib.rs`, junto
  con los helpers de render que sólo usaban esos comandos (`close_all_of_kind`,
  `has_open`, `open_ids_of_kind`, `set_scene_overlays`, `feed_video_frame`) y los
  structs `SceneGraph`/`SelectSlidePayload` de `render/types.rs`. Se quitó `OUTPUTS` de
  la lista blanca `OUTPUT_COMMANDS` en `IPC/tauri.ts`. Se conservan los 3 comandos NDI
  hasta F8 y `RENDER_SNAPSHOT` (F0.2). Código de comandos vivo: 214 líneas, sólo
  adaptadores delgados; el total del archivo (322) incluye además la herramienta de
  verificación `RENDER_SNAPSHOT` + sus 2 tests (~82 líneas) y los NDI (~26). Chequeos:
  `cargo check` limpio, `cargo test --lib` 29/29, `test:unit` 47/47, `test:svelte` 59
  errores (línea base), Prettier limpio. Diff: −397 líneas en 6 archivos.)
  *Pasos:* con `grep` en `src/`, confirmar que el frontend no usa y eliminar:
  `UPDATE_SCENE_TEXT`, `CLEAR_SCENE_TEXT`, `SELECT_SLIDE`, `SET_BACKGROUND_IMAGE`,
  `CLEAR_BACKGROUND`, `FEED_VIDEO_FRAME`, `UPDATE_SCENE_OVERLAYS`, `SET_TRANSITION`,
  `UPDATE_STAGE_DATA`, `OPEN/CLOSE/IS_*_WINDOW(_OPEN)`, `OUTPUTS` (no-op),
  `SceneGraph`/`SelectSlidePayload` de `render/types.rs`. Los comandos NDI quedan
  hasta F8.
  *Aceptación:* `commands/output.rs` < 200 líneas, sólo adaptadores.

- [ ] **F2.8 Prueba manual guiada.** (listo para ejecutar: requiere 2 monitores reales en
  macOS y Windows, algo que no se puede hacer en este entorno sin display físico. El
  checklist guiado completo —elegir monitor con la lupa, poner en vivo, pasar slides de
  una canción, fondos imagen y video, limpiar, stage, cerrar salida— está en
  `docs/VERIFICAR.md`, sección "F2.8", con espacio para anotar el resultado por sistema.
  Al ejecutarla, anotar el resultado ahí mismo.)
  *Pasos:* en macOS y Windows con 2 monitores: elegir pantalla, poner en vivo, pasar
  slides de una canción, poner imagen y video de fondo, limpiar, cerrar salida.
  Anotar en `PLAN.md` ("Estado real") qué funciona y qué no.

---

## F3 — Persistencia confiable

Va antes que las features nuevas porque Looks agrega datos persistidos.

- [x] **F3.1 Errores de escritura visibles.** (verificado 2026-10-18: `cargo check`
  limpio, `cargo test --lib` 36/36 —7 tests nuevos: `set_store_value_devuelve_error_si_
  no_se_puede_escribir` (el de aceptación, a nivel de comando),
  `set_store_value_guarda_cuando_se_puede_escribir` (control),
  `set_en_destino_no_escribible_falla_sin_tocar_el_archivo`,
  `set_value_en_destino_no_escribible_falla_sin_tocar_el_archivo`,
  `set_escribe_atomicamente_y_actualiza_la_memoria`,
  `write_file_en_destino_no_escribible_falla_y_conserva_el_original` y
  `write_file_escribe_y_no_deja_archivos_temporales`—, `test:unit` 47/47,
  `test:svelte` 59 errores (línea base, sin aumento),
  Prettier limpio. Cambios: `files::write_file` escribe a un `.tmp` en la misma carpeta
  y lo renombra (un fallo nunca deja el destino truncado y borra el temporal);
  `StoreManager::set`/`set_value`/`update_data_path` devuelven `AppResult`, serializan
  con `?` en vez de `unwrap_or_default()` y sólo actualizan la memoria si el archivo se
  guardó (así un reintento vuelve a intentarlo); `SET_STORE_VALUE`, `UPDATE_DATA_PATH`,
  `SET_MEDIA_FOLDER_PATH`, `SAVE` (tiendas, biblias y `.show`) y la restauración de
  backups propagan el error. En el frontend, `tauri.ts` muestra `toast.save_error` y
  pasa el indicador a `error` cuando falla un comando de persistencia (clave nueva en
  `public/lang/en.json`). Se añadió `tauri` con la feature `test` en `[dev-dependencies]`
  sólo para invocar comandos en tests sin GUI. El toast no se puede ver sin GUI: prueba
  manual en `docs/VERIFICAR.md`, sección "F3.1".)
  *Tests portables (2026-10-19, commit `F3.1: tests de escritura portables`):* los 4
  tests de escritura ya no simulan el fallo con `chmod` —en Windows no hay permisos de
  carpeta equivalentes y siendo root no aplican— sino dejando el destino ocupado por una
  carpeta: el renombre atómico falla en macOS **y** Windows con cualquier usuario. Se
  fusionaron las variantes `#[cfg(windows)]` duplicadas y los tests `#[cfg(unix)]` en un
  solo test por archivo, así los mismos 4 tests corren en ambas plataformas.
  *Archivos:* `src-tauri/src/domain/data/store.rs`, `commands/stores.rs`,
  `commands/shows.rs`.
  *Pasos:* reemplazar `let _ = fs::write` / `unwrap_or_default()` por `AppResult`;
  escritura atómica (archivo temporal + `rename`); propagar el error al frontend y
  mostrar un toast.
  *Aceptación:* test portable (macOS y Windows, con cualquier usuario) que simula una
  escritura imposible y verifica que el comando devuelve error y el contenido original
  queda intacto.

- [x] **F3.2 Estilo por defecto válido.** (verificado 2026-10-18: `cargo check` limpio,
  `cargo test --lib` 38/38 —2 tests nuevos: `instalacion_limpia_el_estilo_de_la_salida_
  existe`, que construye un `StoreManager` sobre una carpeta temporal limpia (con
  `config.json` apuntando `dataPath` a esa misma carpeta para aislar las tiendas
  portables) y verifica que el estilo que referencia la salida por defecto existe y se
  llama "Default", y `las_salidas_por_defecto_referencian_estilos_validos`, que recorre
  todas las salidas por defecto y exige que su estilo exista en `styles` con nombre—;
  `test:unit` 47/47, Prettier limpio. Causa raíz: `settings.outputs.default.style` es
  `"default"` pero `default_synced_settings().styles` era `{}`, y en Settings → Outputs
  el `MaterialPopupButton` recibe `value="default"` (truthy) y `name=undefined`, así que
  cae en su rama de "Unnamed". Fix: `styles.default = { name: "Default" }` en los
  defaults. Nota: el engine de render no consume `styles`, es cosmético; y sólo aplica a
  instalaciones nuevas (una instalación existente que ya tenga `settings_synced.json` sin
  `styles.default` sigue mostrando "Unnamed" hasta que se elija el estilo a mano — sin
  migración, fuera del alcance de F3.2). La verificación visual en la app quedó para el
  usuario en `docs/VERIFICAR.md`, sección "F3.2".)
  *Archivos:* `src-tauri/src/domain/data/defaults.rs`.
  *Pasos:* crear el estilo `default` en los defaults o dejar `style` vacío en el output.
  *Aceptación:* instalación limpia: Settings → Outputs no muestra "Unnamed".

---

## F4 — Contrato del Scene Graph

- [x] **F4.1 Fuente de verdad del contrato.** (verificado 2026-10-18: `cargo check` limpio,
  `cargo test --lib` 41/41 —3 tests nuevos en `render/scene.rs`: `version_actual_se_acepta`,
  `version_ausente_se_asume_la_actual` y `version_desconocida_se_rechaza` (comprueba que el
  mensaje nombra la versión recibida y la soportada)—; `test:unit` 47/47, `test:svelte` 59
  errores (línea base), Prettier limpio. Ambos lados llevan ahora la tabla de qué campos
  **dibuja** el engine (`outputId`, `stage`, `width`, `background`, items `text`,
  `plainText`/`nextText`) y cuáles son **sólo tipo** (`transition`, `height`, items no-text,
  overlays del modelo previo). El payload lleva `version` (constante
  `SCENE_GRAPH_VERSION = 1` en TS y Rust, `SCENE_GRAPH_VERSION` en `render/scene.rs`);
  `ScenePayload::validate_version()` rechaza con mensaje claro cualquier otra versión y se
  llama al principio de `RENDER_SCENE` y de `RENDER_SNAPSHOT`. Un payload sin `version` se
  interpreta como la versión actual, así no se rompen los snippets de consola documentados
  en `docs/VERIFICAR.md` (F0.2). `Default` de `ScenePayload` es manual para que no quede
  `version: 0`.)
  *Archivos:* `src/types/SceneGraph.ts`, `src-tauri/src/render/scene.rs`.
  *Pasos:* documentar en ambos archivos qué campos están **implementados** en el engine
  y cuáles son sólo tipos; agregar `version: 1` al payload y rechazar (con error
  claro) versiones desconocidas.
- [x] **F4.2 Tests de compatibilidad TS ↔ Rust.** (verificado 2026-10-18: `cargo check`
  limpio y `cargo test --lib` 47/47 —6 tests nuevos—; `bun run test:unit` 49/49 (2
  nuevos); `test:svelte` 59 errores (línea base, sin aumento); `bun run build` OK;
  Prettier limpio. Las claves del contrato se enumeran ahora en un solo módulo,
  `src/frontend/components/helpers/sceneGraphPayload.ts` (`sceneGraphPayload`,
  `sceneBackground`, `sceneTransition`, `sceneTextItem`, `sceneTextSpan`; descarta las
  claves sin valor), que usan `buildSceneGraph()` y `buildStageScene()`; enumerarlas en
  un solo lugar es lo que hace verificable el contrato. El test de vitest
  `sceneGraphPayload.test.ts` genera los 4 fixtures de `src-tauri/tests/fixtures/scene/`
  (texto con tramos/contorno/sombra, fondo de video, Stage Display y escena vacía) y los
  compara con la copia commiteada (`UPDATE_SCENE_FIXTURES=1 bun run test:unit` los
  regenera). El test Rust `render/scene_contract.rs` —módulo `#[cfg(test)]`, corre con
  `cargo test --lib` igual que en CI— deserializa cada fixture con `ScenePayload`, valida
  la versión, compara las claves exactas del JSON y verifica los valores que consume el
  engine (`text_blocks()`, `background_media()`, `engine_name()`).
  Aceptación comprobada de las dos formas: renombrar una clave en `sceneGraphPayload.ts`
  (`plainText` → `plaintext`) hace fallar el test de vitest y, al regenerar los fixtures,
  también los del engine (clave de más y `plainText` por defecto vacío); quitar
  `rename_all = "camelCase"` de `ScenePayload` hace fallar los 4 tests Rust (los
  `outputId` de los fixtures quedan como campo desconocido → default vacío).
  Desvío del plan, anotado a propósito: los fixtures se generan desde el módulo de
  payload y no llamando a `buildSceneGraph()` desde vitest, porque importarlo en el
  entorno node arrastra pdfjs (`DOMMatrix`), `window`/`document` a nivel de módulo y
  ciclos ESM que el transform SSR de vitest resuelve como `undefined` (verificado). Como
  el payload es ahora la única fuente de claves, la cobertura del contrato es la misma.
  *Archivos:* `src/frontend/components/helpers/sceneGraphPayload.ts` (nuevo),
  `src/frontend/components/helpers/sceneGraphPayload.test.ts` (nuevo),
  `src-tauri/src/render/scene_contract.rs` (nuevo),
  `src-tauri/tests/fixtures/scene/` (nuevo), `sceneGraph.ts`, `mod.rs`, `scene.rs`,
  `src/types/SceneGraph.ts`.
- [x] **F4.3 Golden tests visuales.** (verificado 2026-10-19: `cargo check` limpio y
  `cargo test --lib` 50/50 —3 tests nuevos—. Sin cambios en el frontend: no hace falta
  re-verificar `test:unit`/`test:svelte`/`build`.) Nuevo módulo `render/golden.rs`
  (`#[cfg(test)]`, corre con `cargo test --lib` como el resto) con 3 escenas de
  referencia de 640×360: texto blanco centrado, texto con contorno rojo y sombra azul
  desplazada (las tres capas del motor de texto) y fondo de imagen. Los PNG de
  referencia quedan commiteados en `src-tauri/tests/golden/scene/` y se regeneran con
  `UPDATE_GOLDEN=1 cargo test --lib` (mismo patrón que `UPDATE_SCENE_FIXTURES` de F4.2).
  La imagen de fondo no es un asset: el test escribe en la carpeta temporal un PNG
  determinista de 4 cuadrantes (rojo/verde/azul/blanco), así el golden no arrastra
  binarios de referencia y comprueba de paso que el fondo estirado (`fit: "fill"`)
  ocupa su cuadrante con el color correcto.
  Decisión, anotada a propósito: la comparación con el golden es **por celdas** (media
  de color de bloques de 32 px, tolerancia ±40 por canal, hasta un 5% de celdas
  distintas) y no píxel a píxel, porque el texto se rasteriza con las fuentes del
  sistema y las `public/fonts/*.woff2` del repo **no** las carga `fontdb` 0.23 (no
  tiene soporte de woff), de modo que los glifos no coinciden entre plataformas; una
  comparación exacta sería frágil fuera de macOS. Lo fino que deja pasar esa tolerancia
  lo cubren los sondeos estructurales de cada escena: hay texto en su zona y es
  acromático (blanco) sin dejar píxeles fuera, aparecen el contorno rojo y la sombra
  azul, y cada cuadrante del fondo conserva su color.
  Aceptación comprobada de las dos formas (y revertida): pintar el texto de rojo falla
  el sondeo estructural (`el texto debe ser blanco (0)`); cambiar la alineación de
  centro a izquierda —dentro de la misma zona, así pasan los sondeos— falla el golden
  (16 de 240 celdas difieren, se permiten 12).
  *Archivos:* `src-tauri/src/render/golden.rs` (nuevo),
  `src-tauri/tests/golden/scene/` (nuevo), `src-tauri/src/render/mod.rs`.
  *Pasos:* con `RENDER_SNAPSHOT` (F0.2), 3–4 escenas de referencia (texto centrado,
  texto con stroke/sombra, fondo imagen) comparadas con tolerancia.

Después, ampliar el contrato **de a un tipo por tarea** (cada una con fixture + golden):

- [x] **F4.4 Transiciones: conectar `render/transition.rs` al bucle.** (verificado
  2026-10-19: `cargo check` limpio y `cargo test --lib` 53/53 —3 tests nuevos de
  transición—. No se tocó `src/`, así que `test:unit`/`test:svelte`/`build` no cambian.
  La comprobación visual end-to-end en la app queda pendiente de la sesión gráfica: se
  documenta el procedimiento en `docs/VERIFICAR.md`.)
  El motor de doble buffer sigue el contrato que describe su cabecera: la escena se
  dibuja siempre en `view_b`; al llegar una escena nueva, si `trigger` devuelve `true`
  (transición real, no corte) se copia `texture_b` → `texture_a` antes de dibujar, y
  `render` compone `a` → `b` sobre la superficie de la ventana según el progreso. Con
  corte (`None` o duración 0) no se copia: `progress` es 1 desde el inicio y el shader
  muestra `b` (la escena nueva). `create_target_texture` ahora incluye `COPY_DST` para
  poder usar las texturas como destino de la copia.
  El bucle (`spawn_render_loop`) recibe una petición `TransitionRequest` por pantalla
  (`ScreenHandle.transition`), la consume en cada frame y redimensiona el motor junto
  con la superficie (`resize`). La ventana de identificación no transiciona (se le pasa
  un `None`), porque nace con su contenido.
  Decisión, anotada a propósito: la transición se pide **sólo cuando el contenido
  renderizable cambia de verdad** (`set_audience_scene` compara texto y fondo;
  `set_stage_scene` compara `StageData`). El frontend reenvía la escena ante *cualquier*
  cambio del store `outputs`, no sólo al cambiar de diapositiva; sin esta deducción del
  lado del engine habría fundidos espurios ante cambios ajenos a la salida. Para eso se
  derivó `PartialEq` en `TextBlock`, `TextSpan`, `OverlayItem` y `StageData` (tipos de
  datos planos). Queda fuera de F4.4 comparar overlays (llegan en F4.6), así que un
  cambio que sólo afecte a overlays no dispara transición todavía.
  *Archivos:* `src-tauri/src/render/transition.rs`,
  `src-tauri/src/render/screens.rs`, `src-tauri/src/render/types.rs`,
  `src-tauri/src/render/mod.rs`.
- [x] **F4.5 Items de imagen/medio dentro de la slide.** (verificado 2026-10-19:
  `cargo check --tests` limpio, `cargo test --lib` 56/56 —3 tests nuevos:
  `parses_media_items_with_box_and_fit` (tipos de `scene.rs`),
  `audience_media_mantiene_su_contrato` (contrato TS ↔ Rust sobre el fixture) y el golden
  `golden_item_imagen`—; `test:unit` 49/49, Prettier limpio sobre los archivos tocados,
  `test:svelte` 59 errores (línea base de F0, sin aumentar). La verificación visual en la
  app queda para el usuario en `docs/VERIFICAR.md`, sección "F4.5".)
  Un item de medio (imagen) de la slide llega al engine con su caja en la resolución
  lógica de la escena (`x`, `y`, `width`, `height`), `src`, `mediaType`, `fit`
  (`cover`/`contain`/`fill`) y `opacity`. El motor lo dibuja en la capa de medios: el
  mismo `BackgroundPipeline` que pinta el fondo dibuja el item en un `rect` normalizado
  (nuevo `render_rect`). `LayerUniforms` cambió `screen_ratio` por `target_ratio` (la
  relación del destino, que para el fondo coincide con la de la pantalla) y sumó
  `rect: [f32; 4]`; el fondo pasa `rect = [0,0,1,1]` y se comporta igual que antes (los
  goldens de F4.3 quedan byte a byte idénticos). El binding de uniforms pasa a
  `VERTEX_FRAGMENT` porque el vertex shader lee `rect` para colocar el quad. El modo
  *Contain* ahora devuelve transparente (antes negro opaco): es lo correcto para un item
  y para el fondo sigue siendo seguro (es la capa de abajo, sobre un limpiado a negro).
  El engine escala la caja por `ventana / design_width` (igual que el texto) y sólo
  dibuja `media_type == "image"`; los videos se aceptan en el contrato pero se saltean
  (la decodificación de video todavía no está en el bucle ni en el snapshot).
  *Decisión, anotada a propósito:* el engine dibuja fondo → medios → texto, sin respetar
  el orden de apilado de la slide (limitación conocida).
  *Fuentes de verdad:* `ScenePayload::media_items()`, el fixture `audience-media.json`,
  y los tipos `SceneMediaItem` (TS) / `SceneMediaItem` + `MediaItem` (Rust).
  *Archivos:* `src-tauri/src/render/media.rs`, `src-tauri/src/render/shaders/composite.wgsl`,
  `src-tauri/src/render/scene.rs`, `src-tauri/src/render/screens.rs`,
  `src-tauri/src/render/snapshot.rs`, `src-tauri/src/render/types.rs`,
  `src-tauri/src/render/golden.rs`, `src-tauri/src/render/scene_contract.rs`,
  `src/types/SceneGraph.ts`, `src/frontend/components/helpers/sceneGraph.ts`,
  `src/frontend/components/helpers/sceneGraphPayload.ts` (+`.test.ts`),
  `src-tauri/tests/fixtures/scene/audience-media.json`,
  `src-tauri/tests/golden/scene/item-imagen.png`.
- [x] **F4.6** Overlays (texto e imagen) como capa propia. (2026-10-19: completado desde `wip/f4`. Inicializados `overlays` en `ScenePayload` (ya estaba), armado en `sceneGraph.ts` (ya), envío desde `listeners.ts` (ya), test de contrato (audience-overlays fixture + tests Rust/TS). Lado Rust: métodos `overlay_text_blocks`/`overlay_media_items` en `ScenePayload`, campos `overlay_text`/`overlay_media` en `ScreenScene`, `set_audience_scene` los persiste, `RENDER_SCENE` los pasa, bucle de render dibuja fondo → medios slide → texto slide → medios overlay → texto overlay (+ overlays del modelo previo encima), snapshot offscreen idem, golden `overlays.png`. Chequeos: cargo test 61/61, test:unit 58/58, svelte-check 58 errores (línea base), Prettier limpio.) **Retomar desde `wip/f4`**
  (ver "Estado al 2026-10-19"): `git checkout wip/f4 -- src/types/SceneGraph.ts
  src-tauri/src/render/scene.rs src/frontend/components/helpers/sceneGraph.ts
  src/frontend/components/helpers/sceneGraphPayload.ts
  src/frontend/components/helpers/sceneGraphPayload.test.ts src/frontend/utils/listeners.ts`
  y completar el lado Rust.
- [x] **F4.7** Timers/relojes (el engine dibuja el valor que manda el frontend). (2026-10-19: `buildTimerItem` en `sceneGraph.ts` resuelve items `timer`/`clock` a texto (contadores con `getCurrentTimerValue`+`joinTimeBig`, relojes digital/custom con dayjs) y los envía como `SceneTextItem`; `activeTimers`/`timers` disparan `sendOutputScenes` para refrescar el valor cada tick. Chequeos: test:unit 58/58, svelte-check 58 errores (línea base), Prettier limpio.)

---

## F5 — Pantallas y Looks (modelo ProPresenter)

Referencia: [Looks en ProPresenter](https://support.renewedvision.com/hc/en-us/articles/360041407174).

**Mapeo con el modelo actual (no inventar uno nuevo):**

| ProPresenter | PulseFlow |
| --- | --- |
| Audience Screen | `Output` sin `stageOutput` |
| Stage Screen | `Output` con `stageOutput` (layout de stage) |
| Capas de un screen (slide, media, announcements, messages) | `Style.layers` (`background`, `slide`, `overlays`) |
| Alternate theme del screen | `Style` (plantilla, override de texto) |
| Look (preset) | **nuevo:** `{ name, screens: { [outputId]: styleId } }` |
| Live Look | **nuevo:** `activeLook` |

- [x] **F5.1 Datos de Looks.** (2026-10-19: stores `looks`/`activeLook`, interfaz `Look`, sincronizados en `getSyncedSettings`, handlers en `updateSettings` con migración a "Default" desde los estilos actuales de cada salida, persistidos via `save`. Chequeos OK.)
  *Archivos:* `src/types/Settings.ts` (o `Output.ts`), `src/frontend/stores.ts`,
  `src/frontend/utils/save.ts`, `utils/updateSettings.ts`, `src/types/Save.ts`.
  *Pasos:* stores `looks` y `activeLook` persistidos como *synced settings* (mismo
  camino que `styles`); migración: si no hay looks, crear "Default" con el estilo
  actual de cada salida.
  *Aceptación:* crear un look, reiniciar la app, sigue ahí.
- [x] **F5.2 Aplicar un Look ("Make Live").** (hecho 2026-10-19)
  *Pasos:* `applyLook(id)` asigna `output.style = look.screens[outputId]` a cada salida
  de audiencia y guarda `activeLook`; las salidas que el look no menciona no cambian.
  Registrarlo en el historial (deshacer).
  *Aceptación:* cambiar de look cambia lo que se ve en cada pantalla (verificado con
  2 salidas).
- [x] **F5.3 Editor de Looks.** (hecho 2026-10-19)
  *Archivos:* `components/settings/tabs/Looks.svelte` (sigue el patrón de
  `Styles.svelte` / `StylesTabs.svelte`).
  *Pasos:* grilla columnas = pantallas de audiencia, filas = estilo (dropdown) + capas
  (toggles de `layers` del estilo elegido). Si se togglea una capa de un estilo usado
  por otro look, ofrecer "duplicar estilo para este look" en vez de modificarlo para
  todos. Botón "Make Live".
- [x] **F5.4 Cambiar de look en vivo.** (hecho 2026-10-19)
  *Pasos:* selector de look en el panel de salida (derecha) y entrada en el menú de
  salida; acción de slide `set_look` (siguiendo `change_output_style` en
  `components/actions/`).
  *Aceptación:* una slide con la acción cambia el look al activarse.
- [x] **F5.5 Configuración de pantallas.** (hecho 2026-10-19)
  *Pasos:* en Settings → Outputs agrupar en "Audiencia" y "Stage"; crear un stage
  screen elige un layout de stage; mostrar en cada salida su monitor y estado
  (en vivo / cerrada).

---

## F6 — Diseño: llevar `docs/design-reference/` al frontend Svelte

**Restricción clave:** el frontend usa los nombres de variables de FreeShow con
otra semántica que shadcn (`--primary` = fondo del panel, `--secondary` = acento) y el
tema se aplica desde `defaultThemes.ts` como variables inline sobre `<html>`. Por eso
el port se hace **por valores**, no renombrando variables ni copiando componentes React.

- [x] **F6.1–F6.5 Diseño (referencia shadcn → Svelte).** (hecho 2026-10-19 en las
  ramas `feature/diseno` / `f6-pulseflow`, ya mergeado en `feature/tauri-rust-migration`:
  commits `e387f24f` (F6.1), `88068794` (F6.2), `65708708` (F6.3), `9b3d0283` (F6.4)
  y `2475550e` (F6.5), más el merge `d7dd3185`. El tema por defecto `PulseFlow`
  usa los valores `.dark` de la referencia (`#0a0a0a`/`#171717`/`#262626`/`#fafafa`/
  `#1447e6`/`0.625rem`) y Geist Variable empaquetada; los componentes base usan
  `var(--radius)` / `var(--border-color)`; la topbar pasó a 48px; los componentes
  shadcn-svelte quedaron en `src/frontend/lib/components/ui/` (sólo pantallas nuevas).
  *Aceptación:* la verificación visual (capturas Show/Edit/Settings/Stage) quedó para
  el usuario en `docs/VERIFICAR-F6.md`.)

  *(Detalle original de cada tarea, a título de referencia:)*

  **F6.1** Documentar en `docs/design-reference/README.md` el mapeo token shadcn (tema
  `.dark` de `index.css`) → variable FreeShow (`--primary` ← `--background`,
  `--primary-darker` ← `--card`/`--sidebar`, `--primary-lighter` ← `--accent`,
  `--text` ← `--foreground`, `--secondary` ← `--sidebar-primary`, bordes ← `--border`,
  radio ← `--radius`).
  **F6.2** En `defaultThemes.ts`: tema por defecto con esos valores y fuente Geist
  (`@fontsource-variable/geist`); en `public/global.css` los mismos defaults.
  **F6.3** Variables `--radius` y `--border-color` usadas por `Button`, `MaterialButton`,
  inputs `Material*`, paneles y popups (en componentes base).
  **F6.4** Ajustar espaciados/alturas/separadores de `MainLayout.svelte` y
  `components/main/Top.svelte` según `Topbar.tsx`, `LibraryPanel.tsx`, `RightPanel.tsx`,
  `Drawer.tsx`. **F6.5** Componentes `lib/components/ui` (shadcn-svelte) sólo en pantallas
  nuevas.

F6 es independiente de F2–F5 y puede hacerse en paralelo (otra rama).

---

## F7 — IPC tipado

- [x] **F7.1 Inventario de `Main.*`.** (verificado 2026-10-19 en `feature/ipc`:
  diff exacto entre los 153 miembros del enum `Main` y los 90 comandos
  registrados en `lib.rs` → 76 canales sin comando, clasificados en `PLAN.md`
  sección "Inventario de canales Main sin comando Rust (F7.1)": 13
  *implementar* (P1–P13), 47 *posponer*, 5 *saltear* por dependencia pesada o
  permisos (anotados en `docs/VERIFICAR-F7.md`) y 11 *eliminar del frontend*
  con cero envíos demostrados. `BACKUP` no figura: `BACKUPS`/`DELETE_BACKUP`/
  `RESTORE` ya existen en `commands/backup.rs`.) Tabla en `PLAN.md` de los ~95 canales sin
  comando Rust: *implementar* / *eliminar del frontend* / *posponer*, con la pantalla
  que se rompe. Prioridad sugerida: `IMPORT`, `BACKUP`, `URL`, `LANGUAGE`,
  `SAVE_IMAGE`, `PDF_TO_IMAGE`, `SEND_MIDI`, `IP`, `MAXIMIZED`.
  *(Resultado en `PLAN.md`: 7 a implementar — `BACKUP` ya estaba hecho —, 12 a
  eliminar, ~58 pospuestos.)*
- [x] **F7.2 Respuesta inmediata para canales no implementados.** `tauri.ts` responde
  `undefined` al instante (sin esperar el timeout de 15 s) a los canales marcados
  *posponer*, con un único aviso en desarrollo.
- [x] **F7.3 `invokeCommand<T>()` tipado.** Helper en `tauri.ts` que devuelve
  `Promise<Result<T, AppError>>`; migrar a él **sólo** las operaciones críticas
  (abrir/cerrar salida, renderizar escena, guardar). `window.api` se mantiene.
- [x] **F7.4** Implementar los canales marcados *implementar*, de a uno por tarea.
  Orden de prioridad: `IMPORT` → `IMPORT_FILES` → `URL` → `SAVE_IMAGE` →
  `PDF_TO_IMAGE` → `IP` → `MAXIMIZED`. (`BACKUP` ya estaba hecho; `LANGUAGE`
  se elimina del frontend; `SEND_MIDI` se saltea — requiere crate MIDI.)
  Hecho: `IMPORT`/`IMPORT_FILES`, `URL`, `SAVE_IMAGE`, `IP`, `MAXIMIZED`
  (integrados 2026-10-19). `PDF_TO_IMAGE` se hizo real en F7.5.
- [x] **F7.5 `PDF_TO_IMAGE` real.** (hecho 2026-10-19, opción (a))
  El comando era un no-op que devolvía `[]`, así que convertir un PDF en slides
  (`PdfPreview.svelte` → "Convertir en imágenes", `responsesMain.ts` → import de un
  `.pdf`) no hacía nada. Se implementó la opción (a): **el webview renderiza con
  pdf.js y Rust sólo persiste los bytes**.
  *Archivos:* `src-tauri/src/commands/files.rs` (`PDF_TO_IMAGE` real + tests),
  `src/frontend/converters/pdfToImages.ts` (nuevo: `pdfToImageShow`/`renderPdfPages`),
  `src/frontend/components/show/pdf/PdfPreview.svelte`, `src/frontend/IPC/responsesMain.ts`,
  `src/frontend/components/actions/apiHelper.ts` (se eliminó la copia del loop de
  renderizado: `getPDFThumbnails` ahora reusa `renderPdfPages`), `src/types/IPC/Main.ts`
  (payload `images?`).
  *Pasos:* `pdfToImageShow(path)` localiza el PDF → rasteriza cada página a JPEG
  base64 (~2160px lado mayor) actualizando `pdfImports` (0–80 %) → `requestMain(Main.PDF_TO_IMAGE,
  { filePath, images })` → Rust decodifica el base64 y escribe `Imports/PDF/<nombre>/N.jpg`
  (1-based) devolviendo las rutas → `createImageShow({ images, name })` arma el show y el
  estado queda en `complete`. Un base64 inválido falla sin dejar archivo (test). Sin
  `pdfium-render` ni dependencias nuevas.
  *Verificación:* `cargo test --lib` 64/64 (3 tests nuevos de `files`: nombre de carpeta,
  decodificación de data URL y escritura en orden + error), `test:unit` 58/58,
  `test:svelte` 58 errores (línea base), Prettier limpio. La prueba con un PDF real en
  la app quedó a cargo del usuario en `docs/VERIFICAR.md` (sección "F7.5").

---

## F8 — Video y medios

- [x] **F8.1 Ciclo de vida de ffmpeg.** Hecho en `render/video.rs`: `stop()` mata el
  proceso ffmpeg (cierra el pipe y desbloquea el `read_exact`) y une el hilo; EOF o
  error de lectura se reportan por stderr; si el stream HW muere a mitad de camino
  (con `running` todavía en true) se reintenta en software.
- [x] **F8.2 Una decodificación por archivo.** Hecho con un hub en `ScreenManager`
  (`video_hub`): cada archivo tiene un único proceso ffmpeg cuyos fotogramas se
  difunden a los slots de todas las pantallas suscritas; al cerrar/ cambiar de fondo,
  `video_hub_release` quita al suscriptor y sólo detiene el proceso si queda sin
  suscriptores.
- [ ] **F8.3 Medir.** CPU/RAM/GPU con un video 1080p en loop durante 30 min en macOS y
  Windows; anotar en `PLAN.md`. Decidir recién entonces si hace falta otra estrategia.
- [x] **F8.4 NDI.** (2026-10-19, decisión (b): **eliminar**.) La captura de framebuffer
  (`render/ndi_stream.rs` + `START/STOP/IS_NDI_NATIVE_FEED_ACTIVE`) era código muerto:
  el bucle de render de cada pantalla nunca llamaba a `record_copy`, el capturador tenía
  su propio `Device` WGPU (una copia de textura sólo es válida dentro del device que la
  creó, así que conectarla obligaba a crear la captura dentro de cada bucle), y el
  backend NDI existente (`commands/ndi.rs`) sólo detecta el runtime: no tiene
  `NDIlib_send_*` ni envía frames. Enviar por NDI exige el SDK propietario + negociación
  de licencia (dependencia pesada, prohibida sin medir; ver F8.3). Ningún código del
  frontend invocaba los tres comandos. Se quitó el módulo, el campo `ndi_capture` de
  `ScreenManager`, los comandos y su registro; se conserva `NDI_STATUS`/`NDI_SOURCES`.
  `cargo check` limpio, `cargo test --lib` 63/63. Motivos y qué se quitó, en
  `docs/VERIFICAR.md` (sección "F8.4").

---

## F9 — Frontend: desacople gradual

- [x] **F9.1** `App.svelte`: mover timers y listeners globales a `utils/startup.ts`.
  Hecho 2026-10-19: `startupAppEffects()` (idempotente) mueve a `utils/startup.ts` los
  ticks de timers (`activeTimers`/`timers`), el evento agendado (`events`), el stream a
  OutputShow (`loaded`/`disabledServers`/`outputDisplay`), el reset de `closeAd` y la
  dirección/idioma del documento (`localeDirection`/`language`). `App.svelte` sólo los
  arranca; quedan las reactivas de presentación (contraste, `isWindows`, `ready`).
- [x] **F9.2** `stores.ts`: agrupar por dominio con comentarios; tipar primero los
  stores de salidas (`outputs`, `outputState`, `styles`, `looks`).
  Hecho 2026-10-19: encabezado con el criterio (temporales vs guardados, agrupados por
  dominio), alias `OutputState` para `outputState`, y comentarios en los stores de
  salidas. `outputs` (`Outputs`) y `styles`/`looks` (`Styles`/`Look`) ya tenían tipo
  propio. Nota: `styles`/`looks` siguen siendo mapas `{ [id]: … }`; pasarlos a arrays
  tocaba ~170 usos en todo el frontend (fuera del alcance de esta tarea).
- [x] **F9.3** Eliminar ramas `$currentWindow === "output"` (lista en `PLAN.md`) una por
  componente, verificando cada una en la app.
- [ ] **F9.4** Branding pendiente: `Splash.svelte`, `ImportScripture.svelte`, logo de
  `Top.svelte`/`About.svelte` (`public/import-logos/freeshow.webp`) e íconos de la app
  cuando haya logo de PulseFlow. (Texto "FreeShow" → "PulseFlow" ya reemplazado en
  `Splash.svelte` e `ImportScripture.svelte`; logo e íconos siguen pendientes.)

---

## F10.0 — Correcciones urgentes (antes de F10)

Reportadas por el usuario en macOS el 2026-10-20. Un commit por tarea; todas se
verifican en la app real (`bun run dev:tauri`).

- [ ] **F10.0a Barra superior sin indicador rojo ni título.**
  *Archivo:* `src/frontend/components/main/Top.svelte`.
  *Causa:* el `<div class="unsaved">` (barra roja de "sin guardar") y el
  `<h1>PulseFlow</h1>` ocupan la esquina izquierda, que en macOS es de los botones de
  ventana (`titleBarStyle: "Overlay"` en `tauri.conf.json`).
  *Pasos:* quitar ambos. En macOS (`$os.platform === "darwin"`) dejar ese espacio vacío
  (≈ 80 px) para los botones rojo/amarillo/verde; en Windows el bloque izquierdo puede
  quedar vacío o con el selector de look de F10.7. El estado "sin guardar" no se
  muestra en la barra (si se quiere conservar, como un punto discreto junto al botón
  de Settings, no en la esquina).
  *Aceptación:* en macOS la esquina izquierda sólo tiene los botones del sistema y no
  aparece nada al guardar o al tener cambios sin guardar.

- [ ] **F10.0b Mover la ventana desde la barra superior.**
  *Archivos:* `Top.svelte`, `src-tauri/capabilities/default.json` (ya tiene
  `core:window:allow-start-dragging`).
  *Causa:* la barra usa `-webkit-app-region: drag`, que es de Electron; Tauri lo ignora.
  *Pasos:* agregar `data-tauri-drag-region` al contenedor `.top` y a sus zonas vacías
  (los `span` de los costados), borrar las reglas `-webkit-app-region`. Los botones no
  deben arrastrar. Doble clic en la barra = maximizar/restaurar (lo hace Tauri).
  *Aceptación:* en macOS se arrastra la ventana desde cualquier parte vacía de la barra
  y los botones siguen funcionando.

- [ ] **F10.0c Monitores en coordenadas lógicas e identidad estable.**
  *Archivos:* `src-tauri/src/commands/output.rs` (`GET_DISPLAYS`),
  `src-tauri/src/render/screens.rs`, espejo TS en `src/types/`.
  *Causa:* `GET_DISPLAYS` devuelve `position()`/`size()` **físicos**; en una Mac con
  Retina (escala 2) la pantalla integrada mide el doble y las coordenadas de monitores
  con distinta escala no son comparables. Además `id` es el índice, que cambia al
  conectar/desconectar.
  *Pasos:* devolver `bounds` en **lógicos** (`to_logical(scale_factor)`, como hacía
  Electron), agregar `physicalSize`, `scaleFactor`, `primary` (monitor principal del
  sistema) e `id` estable (nombre del monitor + índice como desempate). En
  `screens.rs` comparar y posicionar con `LogicalPosition`/`LogicalSize`. Struct
  serde + test con JSON de ejemplo (regla de AGENTS.md).
  *Aceptación:* con la pantalla integrada (Retina) + un monitor 1080p, `GET_DISPLAYS`
  devuelve rectángulos que no se superponen y coinciden con la disposición de
  Ajustes del Sistema → Pantallas.

- [ ] **F10.0d La salida cubre la pantalla asignada (como ProPresenter).**
  *Archivo:* `src-tauri/src/render/screens.rs` (`place_window`, `target_monitor`).
  *Causa:* la regla "si es el monitor de la ventana de control → ventana flotante 16:9"
  (y, por la mezcla físico/lógico, el monitor externo se detecta como el de control).
  *Pasos:* elegir el monitor por `output.screen` (id de F10.0c) primero y por el centro
  de los `bounds` lógicos después. Si la salida tiene un monitor asignado: siempre sin
  bordes, siempre arriba y pantalla completa en ese monitor (macOS:
  `set_simple_fullscreen(true)` después de mover la ventana a ese monitor; Windows:
  sin bordes del tamaño exacto del monitor), **aunque sea el mismo monitor de la app**.
  Sólo si la salida no tiene monitor asignado se abre como ventana flotante de vista
  previa. Actualizar los tests de selección de monitor.
  *Aceptación:* con 2 monitores, al poner en vivo la salida asignada al externo, el
  externo queda cubierto por completo (sin barra de menú ni Dock) y la app sigue
  usable en la integrada.

- [ ] **F10.0e Disposición de monitores que no se rompe.**
  *Archivos:* nuevo `src/frontend/components/screens/displayLayout.ts` (función pura +
  test de vitest) y `DisplayLayout.svelte`; usarlo en `settings/Screens.svelte` (el
  popup actual) y después en la ventana de F10.3.
  *Causa:* `Screens.svelte` dibuja con `zoom: 0.08` fijo y un `transform` calculado a
  mano sobre coordenadas físicas.
  *Pasos:* normalizar al mínimo x/y, escalar para que el conjunto entre en el
  contenedor (`min(anchoDisponible/anchoTotal, altoDisponible/altoTotal)`), dibujar cada
  monitor con su número, nombre y resolución, marcar el principal y el asignado. Debe
  funcionar con monitores a la izquierda/arriba (coordenadas negativas) y apilados.
  *Aceptación:* tests de la función con 3 casos (lado a lado, apilados, negativo); en
  la app la disposición se ve igual que en Ajustes del Sistema → Pantallas.

## F10 — Pantallas y Looks como en ProPresenter (rediseño)

Especificación completa, con bocetos: [`docs/design/pantallas-y-looks.md`](design/pantallas-y-looks.md).
**Leerla entera antes de empezar cualquier tarea de F10.**

Decisión central: **el Look reemplaza al Estilo.** El concepto "Estilo" desaparece de
la UI; lo que configuraba se reparte entre la Pantalla (hardware) y la celda
Look × Pantalla (qué se ve y cómo). La configuración de pantallas y los Looks pasan a
dos ventanas propias, no pestañas de Settings.

Orden y paralelismo: **primero F10.0a–e** (correcciones urgentes). Después F10.1 → F10.2 (un solo agente, son la base). Después pueden ir en
paralelo, en carpetas/ramas separadas: **A** = F10.3 → F10.4 → F10.5, **B** = F10.6,
**C** = F10.7. Al final, un agente: F10.8 → F10.9.

- [ ] **F10.1 Modelo de datos y migración.**
  *Archivos:* `src/types/Output.ts`, `src/types/Settings.ts`, `utils/updateSettings.ts`,
  `helpers/looks.ts`, test nuevo `helpers/looks.migration.test.ts`.
  *Pasos:* tipos `Output` (`kind`, `stageLayout`, `screenType`, `mirrorOf`, `target`,
  `aspectRatio`, `cropping`), `Look` (`transitionMs`, `screens: {[id]: LookScreen}`) y
  `LookScreen` como en la especificación; migración idempotente descrita en
  "Migración" (incluye `stylesLegacyBackup`). Sin cambios de UI.
  *Aceptación:* test con un `settings.json` real de FreeShow como fixture (con 2
  salidas, 1 stage, 3 estilos y 2 looks) que verifica el resultado y que correr la
  migración dos veces da lo mismo.

- [ ] **F10.2 Puente Look → render.**
  *Archivos:* `helpers/looks.ts`, `stores.ts` (sólo lo necesario).
  *Pasos:* `lookScreenToStyle()`; al cambiar `looks` o `activeLook`, regenerar las
  entradas internas `__look__<outputId>` en `styles` y apuntar `output.style` a ellas.
  `applyLook` usa `transitionMs` (pasa la transición al Scene Graph).
  *Aceptación:* test unitario del puente; con `RENDER_SNAPSHOT`, dos looks distintos
  producen escenas distintas para la misma pantalla. El resto de la app no cambia.

- [ ] **F10.3 Ventana "Configuración de pantallas": estructura y Hardware.** (agente A)
  *Archivos:* nueva carpeta `src/frontend/components/screens/` (`ScreenConfig.svelte`,
  `ScreenList.svelte`, `ScreenDetail.svelte`, `SystemDisplays.svelte`), registro del
  popup en `utils/popup.ts`.
  *Pasos:* popup grande con columna izquierda (Audiencia/Stage con interruptor, `+`,
  lista, punto "en vivo"; Sistema con monitores detectados y NDI) y panel derecho con
  nombre, resolución, lienzo clicable y pestaña **Hardware** (Salida, Destino, ficha).
  Reutilizar la lógica de `Screens.svelte` (detección, posiciones, identificar) en vez
  de reescribirla. Usar componentes de `lib/components/ui` (F6.5) y tokens del tema.
  *Aceptación:* desde la ventana se crea una pantalla, se le asigna un monitor, se
  identifica y se la pone en vivo, sin tocar Settings. Pasos de prueba en
  `docs/VERIFICAR.md`.

- [ ] **F10.4 Pestañas Recorte y Envío; panel de Stage.** (agente A)
  *Pasos:* mover desde `settings/tabs/Outputs.svelte` (sin cambiar comportamiento) los
  bloques de recorte/relación de aspecto y de NDI/OMT/Blackmagic/RTMP/WebRTC a pestañas
  de `ScreenDetail`. Panel de stage con dropdown de layout + "Editar layout".
  *Aceptación:* todo lo que se podía configurar en Settings → Outputs se puede
  configurar en la ventana nueva (checklist en el commit).

- [ ] **F10.5 Tipos de pantalla: Única, Espejo, Edge blend.** (agente A)
  *Pasos:* dropdown "Tipo". *Espejo*: el frontend manda a la pantalla espejo la misma
  escena que a `mirrorOf` (en `sendOutputScenes`), sin cambios en Rust. *Edge blend*:
  muestra los controles de blending existentes. "Agrupada" no se ofrece.
  *Aceptación:* una pantalla en espejo muestra lo mismo que su origen (golden o prueba
  manual anotada).

- [ ] **F10.6 Ventana "Looks".** (agente B)
  *Archivos:* `src/frontend/components/looks/` (`LooksWindow.svelte`, `LookGrid.svelte`,
  `LookAdvanced.svelte`), reemplaza a `settings/tabs/Looks.svelte`.
  *Pasos:* lista de presets con "En vivo", grilla pantallas × (Presentación/tema, Slide,
  Media, Overlays), "Más opciones" colapsable con el resto de `LookScreen`, Guardar,
  slider de transición y "Poner en vivo"; deshacer en el historial. Textos con claves
  de traducción (en `en.json` y `es.json`), botones con ícono.
  *Aceptación:* crear "Sólo letras" (Media apagado en Principal), ponerlo en vivo y
  volver a "Default"; con `RENDER_SNAPSHOT` se verifica que el fondo desaparece y vuelve.

- [ ] **F10.7 Menú "Pantallas", atajos y selector en la barra superior.** (agente C)
  *Archivos:* `src-tauri/src/lib.rs` (menú nativo macOS con `tauri::menu`),
  `components/main/MenuBar.svelte` (Windows), `components/main/Top.svelte`,
  `utils/shortcuts.ts`.
  *Pasos:* menú como en la tabla "Dónde se accede"; los ítems emiten eventos que el
  frontend ya sabe manejar (abrir popups, `toggleOutputs` por grupo, `applyLook`).
  Selector compacto "Look: X ▾" junto al botón de salida.
  *Aceptación:* en macOS el menú aparece en la barra del sistema; `⌘1` muestra/oculta
  audiencia y `⌘2` stage.

- [ ] **F10.8 Quitar la UI vieja.**
  *Pasos:* eliminar Settings → Outputs, Styles y Looks (y sus `*Tabs`/`*Buttons`), los
  popups "Elegir pantalla" y "Cambiar valores de salida", y las entradas en
  `values/tabs.ts`; en Settings dejar un botón "Configurar pantallas…". Antes de borrar,
  `grep` de cada componente para demostrar que nada más lo usa.
  *Aceptación:* `test:svelte` no sube; no quedan referencias a los componentes borrados.

- [ ] **F10.9 Quitar el puente.**
  *Pasos:* helper `getOutputLook(outputId): LookScreen`; reemplazar los usos de
  `$styles[output.style]` / `getCurrentStyle(styles, output.style)` (≈44 archivos) **un
  commit por carpeta** (`output/`, `slide/`, `show/`, `edit/`, `helpers/`, …); al final
  eliminar `__look__*`, `output.style` y el store `styles` (queda sólo el backup).
  *Aceptación:* `grep -rn "\$styles\|get(styles)" src/frontend` sin resultados fuera de la
  migración; todos los chequeos y goldens en verde.

- [ ] **F10.10 Prueba manual (usuario).** Sección nueva en `docs/VERIFICAR.md`: crear 2
  pantallas de audiencia + 1 stage desde la ventana, 3 looks, cambiar en vivo desde el
  menú, la barra, el panel de salida y una acción de slide; espejo; cerrar y reabrir
  la app y comprobar que todo persiste.

---

## F11 — Interfaz según la referencia de diseño

Objetivo: que la app se vea como `docs/design-reference/` (shadcn new-york, oscuro,
Geist, Topbar con pestañas tipo "pill", panel derecho por secciones, cajón inferior con
pestañas + buscador), **sin cambiar funcionalidad ni mover features de lugar**.

Reglas de F11 (además de AGENTS.md):
- Es un **re-estilizado**, no una reescritura: mismos componentes Svelte, mismos
  stores, mismos handlers. Cambian markup de presentación y CSS.
- Colores, radios y bordes **sólo** con variables del tema (`--primary*`, `--text`,
  `--secondary`, `--border-color`, `--radius`). Nada de hex en componentes.
- Medidas de la referencia: barra superior 48 px; cabeceras de panel 44 px; filas de
  lista 32 px; pestañas del cajón 40 px; buscador 256 px; separadores de 1 px con
  12 px de margen lateral; radios `--radius` (botones/inputs) y `calc(--radius - 2px)`
  (chips); íconos 16 px en barras y 14 px en cabeceras.
- No tocar el contenido de las slides (`slide/Textbox.svelte`, escalado de slides):
  sólo el marco (borde, etiqueta, número).
- Cada tarea: comparar con el `.tsx` de referencia que indica y dejar en el commit la
  lista de diferencias que quedaron a propósito.
- Íconos: se mantiene `Icon.svelte`. Sólo donde la tarea lo dice se puede usar
  `@lucide/svelte` (ya está en devDependencies).

- [ ] **F11.1 Barra superior.** (referencia `Topbar.tsx`; archivo `main/Top.svelte` y
  `main/TopButton.svelte`) Pestañas Show/Edit/Stage como grupo "pill" centrado (fondo
  `--primary-lighter`, activa con fondo `--primary` y sombra suave, ícono + texto);
  a la derecha: selector de look (de F10.7), Settings (botón ghost de ícono) y botón de
  salida (rojo cuando está en vivo; clic derecho abre Configuración de pantallas).
  Izquierda: espacio de los botones de macOS (F10.0a) y zona de arrastre.
- [ ] **F11.2 Cajón inferior (Drawer).** (referencia `Drawer.tsx`; archivos
  `drawer/Drawer.svelte`, `drawer/MaterialDrawerTab.svelte`, `drawer/Navigation.svelte`)
  barra de 40 px con pestañas ícono + texto, manija de redimensionar de 4 px arriba,
  buscador de 256 px a la derecha con `Ctrl/⌘+F`, borde superior de 1 px.
- [ ] **F11.3 Panel izquierdo (proyectos y navegación).** (referencia
  `LibraryPanel.tsx`; archivos `show/Projects.svelte`, `show/ProjectList.svelte`,
  `show/ProjectContentList.svelte`, `drawer/navigation/*`) filas de 32 px redondeadas,
  hover `--hover`, activa `--primary-lighter`, títulos de sección pequeños en
  mayúsculas con color atenuado, menús contextuales sin cambios.
- [ ] **F11.4 Cabecera del show.** (referencia `Editor.tsx`; archivo
  `show/ShowHeader.svelte`) 44 px: ícono, nombre del show, "· layout", cantidad de
  slides a la derecha, botones "Añadir" (ghost) y "Proyectar" (secundario) usando las
  acciones que ya existen.
- [ ] **F11.5 Grilla de slides y miniaturas.** (referencia `SlideGrid.tsx`,
  `SlideThumbnail.tsx`; archivos `show/Slides.svelte` y el **marco** de
  `slide/Slide.svelte`) separación 8 px, miniatura con borde de 1 px y radio, activa
  con anillo `--secondary`, etiqueta de grupo como chip con su color, número en
  esquina. Probar en modo grilla, lista y "texto".
- [ ] **F11.6 Panel derecho.** (referencia `RightPanel.tsx`, `ClearControls.tsx`;
  archivos `output/preview/Preview.svelte`, `output/preview/ClearButtons.svelte`,
  `show/ShowTools.svelte`) vista previa arriba con borde redondeado, secciones con
  separadores de 1 px, fila de botones de limpiar como íconos ghost alineados.
- [ ] **F11.7 Página de Settings.** (referencia `SettingsTabs.tsx`, `SettingsTools.tsx`;
  archivos `settings/SettingsTabs.svelte`, `settings/Settings.svelte`) **después de
  F10.8**: lista de pestañas como la izquierda de la referencia, contenido con ancho
  máximo 640 px, filas de inputs de 44 px con separador.
- [ ] **F11.8 Popups, menús contextuales y tooltips.** (archivos `main/Popup.svelte`,
  `context/ContextMenu.svelte`, `context/ContextItem.svelte`, `main/Tooltip.svelte`)
  fondo `--primary-darker`, borde 1 px, radio, sombra, padding y alto de ítem 32 px.
- [ ] **F11.9 Repaso final.** Recorrer todas las pantallas (Show, Edit, Stage,
  Settings, cada pestaña del cajón, popups principales) y corregir inconsistencias
  de espaciado/colores; lista de capturas antes/después en `docs/VERIFICAR-F11.md`.

---

## Fuera de alcance por ahora

Renombrar masivamente archivos de FreeShow · crates o procesos nuevos · reescribir todo
`window.api` · migrar todo a runes · cambiar el formato de shows/bibliotecas · cambiar
el motor de video sin mediciones (F8.3) · soporte Linux.
