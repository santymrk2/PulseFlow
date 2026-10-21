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

- [x] **F10.0a Barra superior sin indicador rojo ni título.**
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

- [x] **F10.0b Mover la ventana desde la barra superior.**
  *Archivos:* `Top.svelte`, `src-tauri/capabilities/default.json` (ya tiene
  `core:window:allow-start-dragging`).
  *Causa:* la barra usa `-webkit-app-region: drag`, que es de Electron; Tauri lo ignora.
  *Pasos:* agregar `data-tauri-drag-region` al contenedor `.top` y a sus zonas vacías
  (los `span` de los costados), borrar las reglas `-webkit-app-region`. Los botones no
  deben arrastrar. Doble clic en la barra = maximizar/restaurar (lo hace Tauri).
  *Aceptación:* en macOS se arrastra la ventana desde cualquier parte vacía de la barra
  y los botones siguen funcionando.

- [x] **F10.0c Monitores en coordenadas lógicas e identidad estable.**
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

- [x] **F10.0d La salida cubre la pantalla asignada (como ProPresenter).**
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

- [x] **F10.0e Disposición de monitores que no se rompe.**
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

- [x] **F10.0f IPC sin ruido: mensajes al remoto/stage web y avisos únicos.** ✅ 2026-10-14.
  `REMOTE`/`STAGE`/`CONTROLLER`/`OUTPUT_STREAM` ahora van al comando Rust `SERVER_SEND`
  (broadcast por sala websocket, con test unitario); avisos de comandos desconocidos
  sólo con `localStorage.pulseflowIpcDebug = "1"`. Verificado con app corriendo 4 min
  sin ninguna línea `[webview] WARN` (antes salía a los 3 s y en cada evento de idioma).
  *Archivos:* `src/frontend/IPC/tauri.ts` (+ `tauri.test.ts`), `src-tauri/src/commands/servers.rs`,
  `src-tauri/src/lib.rs`, `src/frontend/utils/updateSettings.ts`, `src/frontend/utils/language.ts`.
  *Causa:* `tauri.ts` convierte en `invoke()` todo lo que se manda por los canales
  `REMOTE`, `STAGE`, `CONTROLLER` y `OUTPUT_STREAM` (`SCRIPTURE`, `SHOW_DATA`,
  `AUDIO_ROUTING`, `TIMERS`, `FOLDERS`, `THEME_COLORS`, …). En Electron esos mensajes
  iban por websocket a las apps web de control remoto y stage; acá fallan como
  "Command not found". Además el canal `OUTPUT` loguea cada comando descartado en cada
  actualización, y `LOADED` (`window.api.send("LOADED")`) y `LANGUAGE`
  (`sendMain(Main.LANGUAGE)`) no tienen comando.
  *Pasos:*
  1. Comando Rust `SERVER_SEND { channel, message }` que llama a
     `server::broadcast_to_room(<sala del canal>, message)` (ver qué nombre de sala usa
     `server/mod.rs` para remote/stage/controller/output_stream) y no hace nada si el
     servidor no está corriendo. Struct serde + test.
  2. En `tauri.ts`: los canales `REMOTE`/`STAGE`/`CONTROLLER`/`OUTPUT_STREAM` van a
     `SERVER_SEND`, nunca a `invoke(<nombre del mensaje>)`.
  3. Avisos de comandos descartados o pospuestos: **una sola vez por nombre** y sólo si
     `localStorage.pulseflowIpcDebug === "1"`.
  4. `LOADED`: comando Rust trivial que devuelve `()` (o quitar el envío si nada lo
     usa); `LANGUAGE`: quitar el `sendMain` de `language.ts` si el canal está marcado
     "eliminar" en el inventario F7.1, si no, comando trivial.
  5. Test en `tauri.test.ts`: un `send("REMOTE", {channel:"SCRIPTURE"})` llama a
     `SERVER_SEND` y no a `invoke("SCRIPTURE")`.
  *Aceptación:* abrir la app, abrir un show y pasar 10 slides: en la terminal **no
  aparece ninguna línea `[webview] WARN: [tauri]`**. Con el remoto web abierto en el
  celular, sigue recibiendo los cambios de slide.

## F10 — Pantallas y Looks como en ProPresenter (rediseño)

Especificación completa, con bocetos: [`docs/design/pantallas-y-looks.md`](design/pantallas-y-looks.md).
**Leerla entera antes de empezar cualquier tarea de F10.**

Decisión central: **el Look reemplaza al Estilo.** El concepto "Estilo" desaparece de
la UI; lo que configuraba se reparte entre la Pantalla (hardware) y la celda
Look × Pantalla (qué se ve y cómo). La configuración de pantallas y los Looks pasan a
dos ventanas propias, no pestañas de Settings.

Orden y paralelismo: **primero F10.0a–f** (correcciones urgentes). Después F10.1 → F10.2 (un solo agente, son la base). Después pueden ir en
paralelo, en carpetas/ramas separadas: **A** = F10.3 → F10.4 → F10.5, **B** = F10.6,
**C** = F10.7. Al final, un agente: F10.8 → F10.9.

- [x] **F10.1 Modelo de datos y migración.**
  *Archivos:* `src/types/Output.ts`, `src/types/Settings.ts`, `utils/updateSettings.ts`,
  `helpers/looks.ts`, test nuevo `helpers/looks.migration.test.ts`.
  *Pasos:* tipos `Output` (`kind`, `stageLayout`, `screenType`, `mirrorOf`, `target`,
  `aspectRatio`, `cropping`), `Look` (`transitionMs`, `screens: {[id]: LookScreen}`) y
  `LookScreen` como en la especificación; migración idempotente descrita en
  "Migración" (incluye `stylesLegacyBackup`). Sin cambios de UI.
  *Aceptación:* test con un `settings.json` real de FreeShow como fixture (con 2
  salidas, 1 stage, 3 estilos y 2 looks) que verifica el resultado y que correr la
  migración dos veces da lo mismo.

- [x] **F10.2 Puente Look → render.**
  *Archivos:* `helpers/looks.ts`, `stores.ts` (sólo lo necesario).
  *Pasos:* `lookScreenToStyle()`; al cambiar `looks` o `activeLook`, regenerar las
  entradas internas `__look__<outputId>` en `styles` y apuntar `output.style` a ellas.
  `applyLook` usa `transitionMs` (pasa la transición al Scene Graph).
  *Aceptación:* test unitario del puente; con `RENDER_SNAPSHOT`, dos looks distintos
  producen escenas distintas para la misma pantalla. El resto de la app no cambia.

- [x] **F10.3 Ventana "Configuración de pantallas": estructura y Hardware.** (agente A)
  *Archivos:* nueva carpeta `src/frontend/components/screens/` (`ScreenConfig.svelte`,
  `ScreenList.svelte`, `ScreenDetail.svelte`, `SystemDisplays.svelte`), registro del
  popup en `utils/popup.ts`.
  *Pasos:* **modal** (crear antes el componente base `components/main/Modal.svelte`
  según "Modales" en la especificación) con columna izquierda (Audiencia/Stage con interruptor, `+`,
  lista, punto "en vivo"; Sistema con monitores detectados y NDI) y panel derecho con
  nombre, resolución, lienzo clicable y pestaña **Hardware** (Salida, Destino, ficha).
  Reutilizar la lógica de `Screens.svelte` (detección, posiciones, identificar) en vez
  de reescribirla. Usar componentes de `lib/components/ui` (F6.5) y tokens del tema.
  *Aceptación:* desde la ventana se crea una pantalla, se le asigna un monitor, se
  identifica y se la pone en vivo, sin tocar Settings. Pasos de prueba en
  `docs/VERIFICAR.md`.

- [x] **F10.4 Pestañas Recorte y Envío; panel de Stage.** (agente A; completada en integración + F10.4b)
  *Pasos:* mover desde `settings/tabs/Outputs.svelte` (sin cambiar comportamiento) los
  bloques de recorte/relación de aspecto y de NDI/OMT/Blackmagic/RTMP/WebRTC a pestañas
  de `ScreenDetail`. Panel de stage con dropdown de layout + "Editar layout".
  *Aceptación:* todo lo que se podía configurar en Settings → Outputs se puede
  configurar en la ventana nueva (checklist en el commit).

- [x] **F10.5 Tipos de pantalla: Única, Espejo, Edge blend.** (agente A)
  *Pasos:* dropdown "Tipo". *Espejo*: el frontend manda a la pantalla espejo la misma
  escena que a `mirrorOf` (en `sendOutputScenes`), sin cambios en Rust. *Edge blend*:
  muestra los controles de blending existentes. "Agrupada" no se ofrece.
  *Aceptación:* una pantalla en espejo muestra lo mismo que su origen (golden o prueba
  manual anotada).

- [x] **F10.6 Modal "Looks".** (agente B; mismo estilo y comportamiento que el modal de
  pantallas — ver "Modales" en la especificación; si `Modal.svelte` todavía no existe en
  tu rama, creá uno con la misma API en `components/looks/` y se unifica al integrar)
  *Archivos:* `src/frontend/components/looks/` (`LooksWindow.svelte`, `LookGrid.svelte`,
  `LookAdvanced.svelte`), reemplaza a `settings/tabs/Looks.svelte`.
  *Pasos:* lista de presets con "En vivo", grilla pantallas × (Presentación/tema, Slide,
  Media, Overlays), "Más opciones" colapsable con el resto de `LookScreen`, Guardar,
  slider de transición y "Poner en vivo"; deshacer en el historial. Textos con claves
  de traducción (en `en.json` y `es.json`), botones con ícono.
  *Aceptación:* crear "Sólo letras" (Media apagado en Principal), ponerlo en vivo y
  volver a "Default"; con `RENDER_SNAPSHOT` se verifica que el fondo desaparece y vuelve.
  *Estado:* hecho (`df01772a`). El cambio de capas del look en vivo se verificó
  inspeccionando `styles['__look__out1'].layers`; la verificación visual con
  `RENDER_SNAPSHOT` queda pendiente del usuario (ver `docs/informes/looks.md`).

- [x] **F10.7 Menú "Pantallas", atajos y selector en la barra superior.** (agente C)
  *Archivos:* `src-tauri/src/lib.rs` (menú nativo macOS con `tauri::menu`),
  `components/main/MenuBar.svelte` (Windows), `components/main/Top.svelte`,
  `utils/shortcuts.ts`.
  *Pasos:* menú como en la tabla "Dónde se accede"; los ítems emiten eventos que el
  frontend ya sabe manejar (abrir popups, `toggleOutputs` por grupo, `applyLook`).
  Selector compacto "Look: X ▾" junto al botón de salida.
  *Aceptación:* en macOS el menú aparece en la barra del sistema; `⌘1` muestra/oculta
  audiencia y `⌘2` stage.
  *Verificación (carril C):* `src-tauri/src/menu.rs` instala el menú nativo en `setup`
  (sólo macOS) con el submenu "Pantallas" (audiencia `CmdOrCtrl+1`, stage
  `CmdOrCtrl+2`, Configurar pantallas…, Gestionar looks…, submenu "En vivo" poblado
  desde el frontend por `update_live_menu`). Los ítems emiten `menu-action` y
  `utils/shortcuts.ts::initMenuActions()` los despacha a `toggleOutputs` por grupo,
  `activePopup.set("choose_screen" | "looks")` y `applyLook`. `Top.svelte` agrega el
  selector "Look: X" (`MaterialDropdown`); `MenuBar.svelte` (Windows) tiene el mismo
  menú "Pantallas" con items locales. La app compila y corre 4 min sin errores ni
  panic (menú instalado sin excepciones); no se pudo capturar pantalla del menú por
  falta de permiso de grabación de pantalla. `⌘1`/`⌘2` los intercepta el menú nativo
  en macOS; en Windows Ctrl+1/Ctrl+2 siguen cambiando de pestaña del drawer (los items
  de "Pantallas" no registran aceleradores). Commits `831f2a93`, `f43d0cd2`.

- [x] **F10.8 Quitar la UI vieja.**
  *Pasos:* eliminar Settings → Outputs, Styles y Looks (y sus `*Tabs`/`*Buttons`), los
  popups "Elegir pantalla" y "Cambiar valores de salida", y las entradas en
  `values/tabs.ts`; en Settings dejar un botón "Configurar pantallas…". Antes de borrar,
  `grep` de cada componente para demostrar que nada más lo usa.
  *Aceptación:* `test:svelte` no sube; no quedan referencias a los componentes borrados.

- [x] **F10.8b Recuperar lo que se perdió al quitar Settings → Outputs (revisión 2026-10-20).**
  F10.8 borró `settings/tabs/Outputs.svelte` (ver su versión en `git show 8f233a0^:src/frontend/components/settings/tabs/Outputs.svelte`)
  pero `components/screens/ScreenDetail.svelte` no tiene todas sus opciones. Agregar al
  modal de pantallas, copiando la lógica del archivo borrado:
  1. **Pantalla:** `invisible` (salida sin ventana, p. ej. sólo NDI), `transparent`,
     `forcedResolution`, `hideFromPreview`, `color` de la salida.
  2. **Envío:** NDI `framerate` y `alphaKey`; OMT `quality`; Blackmagic `deviceId`,
     `displayMode`, `pixelFormat` y `alphaKey` (con la lista de dispositivos de
     `BLACKMAGIC_DEVICES`); RTMP `fps`, `bitrate`, `encoder`, `rateControl`; WebRTC
     `fps` y `bitrate`.
  3. **Espejo real** (pendiente de F10.5): en `helpers/sceneGraph.ts`
     (`sendOutputScenes`), una pantalla con `screenType: "mirror"` recibe la escena de
     `mirrorOf`. Test de vitest.
  4. Reemplazar los 19 `<select>`/`<input>` HTML crudos de `ScreenDetail.svelte` por
     los componentes del proyecto (`MaterialDropdown`, `MaterialTextInput`,
     `MaterialNumberInput`, `MaterialToggleSwitch`) y los textos fijos en español por
     claves de traducción (`screens.*` en `en.json` y `es.json`).
  *Aceptación:* cada clave de la lista se puede editar desde el modal y se guarda;
  marcar también F10.3 y F10.5.

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

- [x] **F11.1 Barra superior como ProPresenter.** (2026-10-20, carril C:
  `main/Top.svelte` reorganizado en cápsulas Buscar/Texto/Tema · Show/Edit/Biblia/⋯ ·
  Media/Look/Live · Audiencia/Stage (redondos, rojos en vivo) · Estado; botón único de
  salida reemplazado por toggles por grupo; accesos reubicados (QuickSearch, formato de
  texto, drawer templates/scripture/overlays/media, settings display). Checks: test:unit 86/86,
  test:svelte 56 = baseline, build OK, app ~4 min sin errores. Clic derecho → Configurar
  pantallas… abre `choose_screen` (popup legacy). Verificación visual del menú no posible
  (sin permisos de captura).) (tabla "Barra superior" en
  `docs/design/pantallas-y-looks.md` → "Distribución general"; archivos
  `main/Top.svelte`, `main/TopButton.svelte`) Botones con ícono + etiqueta debajo,
  agrupados en cápsulas: Buscar/Texto/Tema · Show/Edit/Biblia/⋯ (menú con Editor de
  stage, de temas y de overlays) · Media/Look/Live · Audiencia/Stage (redondos, rojos
  en vivo; clic derecho → Configurar pantallas…) · Estado. Reemplaza al botón único de
  salida y a las pestañas actuales. Sólo reubica accesos que ya existen.
- [x] **F11.2 Cajón inferior como "media bin".** (2026-10-20, carril D:
  `drawer/breadcrumb.ts` (+test vitest) calcula las migas; `Drawer.svelte` con handle de
  4 px, pestañas solo-icono, barra de migas y pie (+ / filtro 256 px / toggle
  grilla-lista / slider de columnas); `Media.svelte` pierde los controles flotantes
  duplicados (MaterialZoom oculto conserva Ctrl+rueda); filas de 32 px en
  `MaterialDrawerTab`/`Navigation`; lang `ui.filter`. Chequeos: test:unit 68/68,
  svelte-check 60 errores (mismo set que HEAD limpio; la línea base documentada de 58
  quedó obsoleta por la migración), build OK, Prettier limpio.)
- [x] **F11.3 Panel izquierdo (proyectos y navegación).** (2026-10-20, carril D:
  filas de 32 px redondeadas con hover `--hover` y activa `--primary-lighter` en
  `ProjectList`/`Projects`/`ProjectContentList`; títulos de sección en mayúsculas
  pequeñas atenuados en `NavigationSections` y en los proyectos; menús contextuales sin
  cambios. Chequeos: test:unit 83/83, svelte-check 57 errores (línea base post-merge),
  build OK, Prettier limpio.)
- [x] **F11.4 Cabecera del show.** (2026-10-20, carril D: `ShowHeader.svelte` a 44 px
  con icono de layout, nombre, '· layout', contador de diapositivas y botones Añadir
  (ghost) y Proyectar (secundario) usando las acciones ya existentes. Chequeos:
  test:unit 83/83, svelte-check 57 errores (línea base), build OK, Prettier limpio.)
- [x] **F11.5 Grilla de slides y miniaturas.** (2026-10-20, carril D: `Slides.svelte`
  con gap 12 px y pie (+ / vista / slider); `Slide.svelte` marco redondeado
  var(--radius) y barra inferior con número + grupo; seleccionada con borde de acento
  2 px. Chequeos: test:unit 83/83, svelte-check 57 errores (línea base), build OK,
  Prettier limpio.)
- [x] **F11.6 Panel derecho como ProPresenter.** (2026-10-20, carril D: ShowTools
  con pestañas solo-icono; la tira vertical ClearButtons y el selector de salida
  MultiOutputs del Preview se mantienen. Chequeos: test:unit 83/83, svelte-check 57
  errores (línea base), build OK, Prettier limpio.)
- [x] **F11.10 Columna izquierda como ProPresenter: Biblioteca, Playlist y Media.**
  (2026-10-20, carril D: MainLayout.svelte columna izquierda con secciones
  BIBLIOTECA (categorías de shows -> cajon), PLAYLIST (Projects sin cambios) y MEDIA.
  Chequeos: test:unit 83/83, svelte-check 56 errores (linea base), build OK,
  Prettier limpio.)
- [x] **F11.7 Página de Settings.** (referencia `SettingsTabs.tsx`, `SettingsTools.tsx`;
  archivos `settings/SettingsTabs.svelte`, `settings/Settings.svelte`) **después de
  F10.8**: lista de pestañas como la izquierda de la referencia, contenido con ancho
  máximo 640 px, filas de inputs de 44 px con separador.
- [x] **F11.8 Popups, menús contextuales y tooltips.** (2026-10-20, carril D: Tooltip.svelte
  re-estilizado con variables del tema; Popup.svelte ya usaba var(--radius)/var(--border-color).
  context/** no se tocó (alcance). Chequeos: test:unit 83/83, svelte-check 57 errores
  (línea base), build OK, Prettier limpio.)
- [x] **F11.9 Repaso final.** (2026-10-20: reemplazada por F12.10, parcial; ver `docs/VERIFICAR-F12.md`.) Recorrer todas las pantallas (Show, Edit, Stage,
  Settings, cada pestaña del cajón, popups principales) y corregir inconsistencias
  de espaciado/colores; lista de capturas antes/después en `docs/VERIFICAR-F11.md`.

---

## F11b — Lo que el carril D dejó a medias (revisión 2026-10-20)

El carril D re-estilizó bien cajón, panel izquierdo, cabecera y grilla, pero en tres
tareas se quedó en lo mínimo. Estas tareas son **cambios de lugar y de estructura**, no
sólo de estilo: está permitido mover componentes existentes siempre que no se pierda
ninguna función (verificar cada función movida y listarla en el commit).

- [x] **F11.6b Panel derecho de verdad como ProPresenter.** (2026-10-20, carril D:
  movidos Audio/Overlay/Timers desde Preview.svelte a pestañas de ShowTools.svelte;
  Preview conserva MediaControls y Show. Pestañas stage/acciones no creadas (sin
  componente existente). Chequeos: test:unit 83/83, svelte-check 56 errores (linea base),
  build OK, Prettier limpio.) (F11.6 sólo pasó las
  pestañas de `ShowTools` a íconos: 1 línea.) Archivos: `output/preview/Preview.svelte`,
  `output/preview/ClearButtons.svelte`, `output/preview/MultiOutputs.svelte`,
  `show/ShowTools.svelte`, `MainLayout.svelte` (columna derecha).
  1. `ClearButtons` pasa a ser una **tira vertical** de 32 px a la derecha de la vista
     previa (un botón de ícono por capa, resaltado si la capa tiene contenido) y el
     "limpiar todo" es una **ⓧ circular** superpuesta al borde derecho de la vista previa.
  2. Debajo de la vista previa, **"Pantalla 1 ▾"** (el selector de `MultiOutputs`) en
     una sola línea.
  3. Debajo, el transporte de medios/audio que ya existe (sin cambios de lógica).
  4. **Barra de pestañas de controles** con estas pestañas, en este orden, cada una con
     el contenido que ya existe en la app en otro lugar: Audio (reproductor/listas de
     audio), Stage (vista/selección de layout de stage), Timers (lista de timers con
     play/reset), Overlays/Mensajes (overlays activos), Acciones (acciones/macros).
     Las 3 pestañas actuales de `ShowTools` (grupos, metadatos, medios) siguen como
     pestañas extra al final. Si una pestaña no tiene contenido existente que reubicar,
     no se crea: anotarlo en el informe.
  *Aceptación:* captura comparada con la de ProPresenter de la especificación; cada
  función que antes estaba en el panel derecho sigue accesible.

- [x] **F11.8b Menús contextuales.** (2026-10-20, carril D: ContextMenu/ContextItem/
  ContextChild re-estilizados con variables del tema, ítems 32px, hover --hover.
  Chequeos: test:unit 83/83, svelte-check 56 errores (linea base), build OK, Prettier limpio.) (F11.8 no tocó `context/**`.) Archivos:
  `context/ContextMenu.svelte`, `context/ContextItem.svelte`, `context/ContextChild.svelte`.
  Fondo `--primary-darker`, borde 1 px `--border-color`, radio `--radius`, sombra,
  ítems de 32 px con ícono 14 px, separadores de 1 px, submenús igual. Sin cambiar
  ninguna entrada ni su orden.

- [x] **F11.10b Ítems del proyecto en la columna izquierda.** (2026-10-20, carril D:
  ProjectContentList movido fuera de Projects.svelte a MainLayout.svelte (columna
  izquierda): BIBLIOTECA · PLAYLIST · 'N ÍTEMS' · MEDIA. Chequeos: test:unit 83/83,
  svelte-check 56 errores (linea base), build OK, Prettier limpio.) (F11.10 dejó la lista
  dentro de `Projects`.) Mover `ProjectContentList` fuera de `Projects` para que la
  columna quede: BIBLIOTECA · PLAYLIST (lista de proyectos) · "N ÍTEMS +" (contenido
  del proyecto seleccionado, con Filtro abajo) · MEDIA. Mantener arrastrar/soltar,
  reordenar, menú contextual y doble clic igual que hoy.

## F12 — Coherencia visual (plan detallado en `docs/PLAN-F12.md`)

Hoy conviven tres maneras de hacer interfaz (CSS heredado + `Material*`, shadcn-svelte
de `lib/components/ui/` y HTML suelto) y se nota: modales donde no entra el contenido,
cosas encimadas, una barra superior con tres estilos y textos mezclados. Se arma **un
kit base** con Tailwind + shadcn-svelte (ya instalados) y se rehacen con él las
pantallas más visibles, una por tarea. **No es una migración global a Tailwind.**

- [x] **F12.0** Preparación y capturas "antes". (2026-10-20, parcial: `antes-show`, `antes-pantallas`, `antes-look-menu` en `docs/capturas/f12/`; sin "antes" de Looks ni de Settings en Linux.)
- [x] **F12.1** Modales de pantalla completa fuera de la tarjeta de `Popup.svelte`; una sola base `main/Modal.svelte` (se borra `looks/Modal.svelte`). (2026-10-20, commit 63f2c5f3.)
- [x] **F12.2** Kit base: botón, cápsula, encabezado de sección, fila de lista, campo, menú; medidas en `docs/design/kit.md`. (2026-10-20, commit 256a4be0; falta captura en tema claro.)
- [x] **F12.3** Modal de pantallas con el kit; los monitores escalan al panel. (2026-10-20, commit 4588b2e6; 1920×1080 sin captura.)
- [x] **F12.4** Modal de Looks con el kit. (2026-10-20, commit ec98bc7f; LookGrid sigue con Material.)
- [x] **F12.5** Barra superior unificada; menú de Look con "Editar looks…". (2026-10-20, commit 94586d6a.)
- [x] **F12.6** Columna izquierda: encabezados y filas del kit, categorías traducidas, sin título duplicado. (2026-10-20, commit 58e57c5b; incluye reset de `global.css` en `@layer base`.)
- [ ] **F12.7** Panel derecho: tira vertical de limpiar y ⓧ de limpiar todo. **Movida a F14.9** (2026-10-20): requiere reorganizar el layout de `Preview.svelte`; ver `docs/informes/f12.md`.
- [x] **F12.8** Textos fijos a traducciones. (2026-10-20, commit 9d338907, parcial: pantallas de F12 y Settings; pestaña activa de Configuración sin revisar.)
- [x] **F12.9** Pantalla de inicio con el logo. (2026-10-20, commit a8d5045d; ProfileSelector sin cambios.)
- [ ] **F12.10** Repaso final con capturas (reemplaza a F11.9). **Parcial** (2026-10-20): ver `docs/VERIFICAR-F12.md`. **Reemplazada por F14.10.**
- [x] **F12.11** Roadmap e informe. (2026-10-20, `docs/informes/f12.md`, estado PARCIAL por F12.7.)
- [x] **F12.12** Tema fijo: se quita la pestaña "Tema" de Configuración (y el menú
  contextual, duplicar/borrar/exportar/importar temas). Al arrancar siempre se aplica
  `defaultThemes.default` (PulseFlow); los temas guardados del usuario no se borran del
  archivo, sólo dejan de usarse. (2026-10-20)
- [x] **F12.13** Quitar la integración con Planning Center (PCO). El backend Rust nunca
  la implementó (venía de Electron): se quitan conexión en Configuración → Conexión,
  selector de servicios, sincronizar carpetas, timers "PCO Live", sincronizar proyecto,
  desvincular ítems, canales IPC `PCO_*`/`PROVIDER_FETCH_FOLDERS` y la carpeta de datos
  "Planning Center". Shows y proyectos importados antes siguen abriendo igual. (2026-10-20)

## Diagnóstico al 2026-10-20 (base de F13–F16)

Relevamiento abstracto del proyecto (medido en el repo, commit `81c1f6eb`):

| Área | Hallazgo |
| --- | --- |
| CI | `ci.yml` y `build.yml` sólo con `workflow_dispatch`: nada corre solo. Formato y svelte-check con `continue-on-error`. |
| Verificación | F11/F12 se verificaron en Linux (Xvfb), plataforma que no se distribuye. F2.8 (2 monitores reales) y F8.3 (medición de video) siguen pendientes. |
| Tests | 9 archivos de test JS para ~180k líneas de frontend; 76 `#[test]` en Rust; sin E2E. |
| Tipos | 2535 `any` en `src/`; 56 errores heredados de svelte-check. |
| Observabilidad | Sin log a archivo: 15 `println!`/`eprintln!` y 4 `log::` en todo el backend. |
| Errores silenciosos | 96 `let _ =` en Rust, algunos sobre I/O de datos del usuario (ej. `commands/files.rs:840`, `tokio::fs::copy`). `requestMain` devuelve `undefined` tras 15 s sin avisar. |
| Tamaño | `render/screens.rs` 1606 líneas; `menuClick.ts` 2492; `helpers/output.ts` 2117. |
| UI | Acento azul `#1447e6` (248 usos de `var(--secondary)`); 240 archivos importan `Material*` y 12 usan el kit; 420 hex + 490 `rgb()` sueltos en `.svelte`; 46 `border-radius` distintos; degradés violetas y botón flotante. |
| Distribución | Sin firma/notarización ni updater. |
| Docs | Planes y verificaciones sueltos (`PLAN-HAIKU`, `PLAN-NOCHE`, 4 × `VERIFICAR*`), borrador en `docs/drafts/`. |

---

## F13 — Red de seguridad

Primero se pone la red, después se hace el lavado de cara: si no, cada pantalla que se
toque en F14 puede romper algo sin que nadie se entere.

- [ ] **F13.1 CI automático.**
  *Archivo:* `.github/workflows/ci.yml`.
  *Pasos:* disparar en `pull_request` y en `push` a `main` y `feature/tauri-rust-migration`
  (dejar `workflow_dispatch`). Prettier: chequear **sólo** los archivos de `src/` que
  cambian respecto de la base (`git diff --name-only --diff-filter=ACMR <base>... -- src/`),
  bloqueante. svelte-check sigue no bloqueante hasta F13.2.
  *Aceptación:* un PR de prueba con un archivo mal formateado en `src/` falla el job; uno
  limpio pasa. Los jobs de Rust corren en macOS y Windows.

- [ ] **F13.2 Trinquete de calidad.**
  *Archivos:* nuevo `scripts/quality-budget.ts`, nuevo `config/quality-budget.json`,
  `package.json` (script `test:budget`), `ci.yml`.
  *Pasos:* el script cuenta (1) errores de `svelte-check`, (2) `: any` / `as any` en `src/`,
  (3) hex y `rgb()` en `.svelte` (excluyendo los que están en datos de ejemplo/plantillas
  listadas en el json). Compara con el json: si algún número **sube**, falla; si baja,
  imprime el valor nuevo para actualizar el json en el mismo commit. Reemplaza el
  `continue-on-error` de svelte-check.
  *Aceptación:* agregar un `as any` hace fallar `bun run test:budget`; borrarlo lo hace pasar.
  Valores iniciales anotados en el json (56 / 2535 / 910 al 2026-10-20, re-medir).

- [ ] **F13.3 Log a archivo.**
  *Archivos:* `src-tauri/Cargo.toml` (`tauri-plugin-log`, oficial y liviano), `lib.rs`,
  los archivos con `println!`/`eprintln!`, `src/frontend/IPC/tauri.ts`, pestaña "Otros" de
  Configuración.
  *Pasos:* registrar el plugin con salida a `app_log_dir` (rotación por tamaño, 5 archivos),
  nivel `info` en release y `debug` en dev. Reemplazar `println!`/`eprintln!` por `log::`.
  En el frontend, enviar `console.error` y los `unhandledrejection` al log. Botón
  "Abrir carpeta de registros" en Configuración → Otros.
  *Aceptación:* en macOS, abrir un medio inexistente deja una línea con fecha, nivel y
  ruta en el archivo de log; el botón abre la carpeta. Sin `println!` fuera de tests.

- [ ] **F13.4 Prueba en hardware real (usuario).** Ejecutar F2.8 y F8.3 en una Mac y en
  una PC con Windows, con 2 monitores. Es requisito para dar por sólida la salida; los
  resultados se anotan en `docs/VERIFICAR.md`.
  *Agregado por F18.6:* en Windows, reproducir un `.mp4` 4K en la audiencia y confirmar (a) que se ve, (b) en los logs
  que no aparece "decodificador nativo no disponible" (si aparece, cayó a ffmpeg y el motivo está ahí), (c) CPU y
  frame-time con el benchmark de `docs/informes/f18.md`, (d) 60 s sin artefactos al rotar el anillo de texturas.

---

## F14 — Lavado de cara: estilo herramienta de desarrollo

**Dirección (decidida 2026-10-20):** diseño utilitario y elegante, inspirado en las
herramientas para desarrolladores. Tipografía clara, escala de grises con contrastes
definidos, espacios delimitados con **bordes finos** y no con fondos. **Monocromo puro**
y **sólo tema oscuro**.

Reglas que valen para todas las tareas de F14:

- La acción principal es **blanco sobre negro** (`--text` como fondo, `--textInvert` como
  texto). No hay color de marca.
- El color es **sólo semántico**: rojo = EN VIVO / destructivo, verde = conectado,
  ámbar = aviso. Nada más tiene color (el contenido del usuario, como colores de grupos o
  de slides, sí).
- Un solo fondo de aplicación. Las zonas se separan con bordes de 1 px. Hay superficie
  elevada (otro gris + sombra) **sólo** en menús, popovers y modales.
- Sin degradés, sin botones flotantes, sin cápsulas de radio completo. Radio de 6 px en
  controles y de 8 px en modales.
- Íconos en gris (`--text-muted`); el ícono activo o seleccionado va en `--text`.
- Números, tiempos y timecodes en Geist Mono con `tabular-nums`.
- Cada tarea: capturas antes/después **en macOS** a 1280 y 1920 en `docs/capturas/f14/`.

- [x] **F14.1 Especificación.**
  *Archivos:* `docs/design/kit.md` (reescribir la sección de medidas).
  *Pasos:* tabla de tokens con valores (gris 50→950, `--border` 8 % y `--border-strong`
  16 % de blanco, `--text`, `--text-muted`, `--text-subtle`, semánticos), escala de texto
  (11 / 12 / 13 / 15 / 20 px, base 13), espaciado (4 / 8 / 12 / 16 / 24), estados (hover,
  activo, seleccionado, foco, deshabilitado) y la lista de reglas de arriba. Capturas
  "antes" de Show, Edit, Configuración, Pantallas, Looks y el cajón inferior.
  *Aceptación:* el documento alcanza para maquetar una pantalla nueva sin preguntar.
  (2026-10-20) Especificación en `docs/design/kit.md`; capturas "antes" en macOS de Show,
  Edit, menú ⋯, cajón de plantillas, Configuración, Pantallas y Looks en
  `docs/capturas/f14/`.

Las tareas F14.1a–c (decididas 2026-10-20) cambian la estructura de la interfaz y van
antes de los tokens: así F14.2 en adelante estiliza el layout definitivo.

- [x] **F14.1a Configuración como modal.**
  *Archivos:* `components/settings/Settings.svelte`, `SettingsTools.svelte`,
  `MainLayout.svelte`, `utils/popup.ts`, `components/main/Modal.svelte` (base de F12.1),
  y los que hacen `activePage.set("settings")` (`quicksearch.ts`, `SceneTools.svelte`,
  `menuClick.ts`, `responsesMain.ts`, `Top.svelte`).
  *Pasos:* registrar el popup `settings`, igual que `screen_config` y `looks`: pestañas a
  la izquierda, contenido a la derecha y los botones de `SettingsTools` ("Manage metadata",
  fuentes, íconos, colores…) como sección del modal. `settingsTab` sigue eligiendo la
  pestaña. Se quita la página `settings` de `MainLayout`, `TopViews` y los atajos de
  página (`shortcuts.ts`, `menus`; `quicksearch.ts`, `top`). Las referencias a la pestaña
  inexistente `display_settings` (`quicksearch.ts:341`, `:648`, `menuClick.ts:1342`,
  `Top.svelte` `openOutputSettings`/`openLiveSettings`) pasan a abrir `screen_config`.
  Que Esc cierre el modal sin limpiar la salida (regla de F12.1).
  *Aceptación:* en macOS, Configuración se abre como modal sobre Show y sobre Edit, se
  cierra con Esc y la página de atrás no cambia. Todas las pestañas muestran contenido.
  `rg 'activePage.set\("settings"\)' src/frontend` = 0; `display_settings`/`styles` sólo
  quedan como argumento de `openSettings(...)`, que redirige a Pantallas/Looks.
  **Hecho** (2026-10-20). *Decisión:* Configuración no es un valor de `activePopup` sino
  un store propio (`settingsOpen`) montado en `App.svelte` antes de `<Popup />`; así los
  ~20 popups que se abren desde sus pestañas (conexión, restaurar, alertas…) quedan
  encima en vez de reemplazarla, y Esc cierra primero el de arriba. Punto de entrada único:
  `components/settings/openSettings.ts`. Verificado: `test:unit` 89/89, `test:svelte`
  56 errores (línea base), prettier. **No verificado en la app** (no se levantó):
  apertura, Esc, popups encima y cada pestaña quedan para probar en macOS.

- [x] **F14.1b Configuración al menú de la app; barra superior sin botones de más.**
  *Archivos:* `src-tauri/src/menu.rs`, `components/main/MenuBar.svelte` (Windows),
  `utils/shortcuts.ts`, `components/main/Top.svelte`.
  *Pasos:* macOS: submenú de la app (`PulseFlow`) con "Configuración…" `CmdOrCtrl+,`
  (más los ítems estándar Acerca de, Ocultar y Salir con `PredefinedMenuItem`), que emite
  `app.settings`. Windows: el mismo ítem en `MenuBar.svelte` con `Ctrl+,`. En ambos casos
  se respeta el permiso de perfil (`settingsDisabled` de `Top.svelte`): sin permiso, el
  ítem queda deshabilitado. En la barra superior se quitan **Configuración**, **Dibujo**,
  **Texto** (el modo sigue con `Ctrl+Shift+T` y la pestaña "Text edit" del editor),
  **Estilos** (duplica la pestaña Plantillas del cajón) y **Live** (abría una pestaña que
  no existe). Las cápsulas que queden vacías se borran.
  *Aceptación:* en macOS, `⌘,` y el menú PulseFlow → Configuración… abren el modal; en
  Windows, `Ctrl+,` y el menú. La barra no muestra esos cinco botones. Test del struct del
  menú si viaja algo nuevo por IPC.
  **Hecho** (2026-10-20). *Decisiones:* (1) hasta ahora el primer submenú de macOS era
  "Pantallas" y macOS lo usaba como menú de la app; ahora el primero es `app`
  ("PulseFlow": Acerca de, Configuración… `⌘,`, Servicios, Ocultar, Salir `⌘Q`) y
  "Pantallas" es el segundo. (2) "Salir" es un ítem propio (`app.quit`) que pasa por
  `initializeClosing()` (guardado), no el `quit` predefinido. (3) El permiso de perfil
  vive en `openSettings()` (no hace nada si está bloqueado); el ítem de Windows sí se
  deshabilita (`ContextItem`), el nativo de macOS no (haría falta un comando Rust sólo
  para eso). (4) Windows: "Configuración" en el menú Archivo con `Ctrl+,`. (5) El botón
  Dibujo sale de la barra; la función se borra en F14.1c. Verificado: `test:unit` 89/89,
  `test:svelte` 56 errores (línea base), prettier. **No verificado:** `menu.rs` **no se
  compiló** (`cargo check` pendiente) y nada se probó en la app.

- [x] **F14.1c Borrar la función Dibujo.**
  *Pasos:* quitar `components/draw/` (7 archivos), la página `draw` de `MainLayout`,
  `TopViews`, `shortcuts.ts` y `quicksearch.ts`, el listener `DRAW` de `listeners.ts`, los
  stores `drawTool`, `drawSettings`, `paintCache` y sus usos (12 archivos con `rg`), el
  ícono de `TopButton`, las traducciones `menu.draw` y los tipos asociados. Si algún dato
  de usuario guarda ajustes de dibujo, se deja de leer sin borrarlo del archivo (regla de
  "no cambiar el formato sin migración").
  *Aceptación:* `rg -n 'drawTool|drawSettings|paintCache|"draw"' src/` = 0; `bun run test:unit`,
  `test:svelte` (sin errores nuevos) y `build` pasan; la app arranca y Show/Edit funcionan.
  **Hecho** (2026-10-20). Se borró `components/draw/` (7 archivos), `types/Draw.ts`, los
  stores `drawTool`/`draw`/`paintCache`/`paintCacheSlide`/`drawSettings`, los 3 listeners
  que mandaban `DRAW*` a las salidas, el zoom de dibujo de `Output`/`Zoomed`, el manejo de
  `FOCUS`/`clear_painting` de `controllerTalk.ts` y los íconos `draw` y `pointer`.
  *Cambios de contrato:* (1) salen de la API de acciones `clear_drawing` y
  `change_draw_zoom` (y su entrada en `actionData`/`CustomInput`): una macro guardada con
  esas acciones no hace nada (`API_ACTIONS[id]` desconocido se ignora, comprobado). (2)
  `drawSettings` deja de guardarse en el archivo de ajustes: al próximo guardado la clave
  desaparece; si llega en un archivo viejo se ignora (`console.info`, comprobado en
  `updateSettings`). *Se dejó a propósito:* las traducciones `draw.*` (la clave `draw.glow`
  la usa el editor de efectos) y los íconos `focus`/`zoom`/`fill`/`paint`/`particles`
  (se usan en otros contextos). Verificado: `test:unit` 89/89, `test:svelte` 56 errores
  (línea base), prettier. `build` y la app **no se corrieron**.

- [x] **F14.2 Tokens monocromo.**
  *Archivos:* `src/frontend/components/settings/tabs/defaultThemes.ts` (tema `default`),
  `public/global.css` (`:root`), `src/frontend/app.css` (mapeo `--shui-*` y `@theme`).
  *Pasos:* `--secondary` pasa a ser la acción blanca y `--secondary-opacity` un gris de
  selección (blanco 10–12 %); `--accent` (`#818cf8`) a gris; `--radius` a 6 px; agregar
  `--text-muted`, `--text-subtle`, `--border-strong`, `--warning` y la escala de grises;
  `--shui-ring` a blanco al 40 %. Geist Mono vía `@fontsource-variable/geist-mono` y
  `--font-mono`. Como F12.12 aplica siempre el tema `default`, no hace falta migrar
  temas del usuario.
  *Aceptación:* `rg -i '1447e6|20, ?71, ?230|818cf8' src public` = 0. Las capturas de
  Show y Configuración no muestran azul.
  **Hecho** (2026-10-20). Los tokens nuevos (`--bg`, `--border`, `--text-muted`,
  `--action`, `--danger`, … y la escala `--gray-*`) viven en `public/global.css`; los
  heredados (`--primary*`, `--secondary*`, `--text`, `--hover`, `--focus`) conservan su
  nombre y toman el valor nuevo, en `global.css` y en `defaultThemes.ts` (el tema los
  reaplica al arrancar, por eso llevan los mismos literales). `--accent`, `--connected` y
  `--disconnected` pasan a alias de `--text-muted`/`--success`/`--danger`. Radios:
  `--radius` 6 px, `--radius-chip` 4 px, `--radius-modal` 8 px (`Modal.svelte` los usa).
  El botón `live` del kit pasa de relleno rojo a contorno rojo (texto blanco sobre rojo da
  3.9:1). Se agregó `@fontsource-variable/geist-mono`. *Quedan* azules que son **datos** de
  usuario (series de `Chart`, colores de calendario) y `OBS.svelte` (F14.3). Se revisó que
  ninguna regla ponga texto claro sobre fondo `--secondary` (ahora claro). Verificado:
  `test:unit` 89/89, `test:svelte` 56 errores (línea base), prettier. **No verificado
  visualmente:** hay que mirar la app (lo que más puede notarse: texto o íconos que
  dependían de que `--secondary` fuera oscuro/azul).

- [x] **F14.3 Colores sueltos a tokens.** En tres commits: (a) `components/main/`,
  `show/`, `settings/`; (b) `drawer/`, `edit/`; (c) el resto.
  *Pasos:* reemplazar hex/`rgb()` de interfaz por tokens. Quedan sólo los que son
  **datos** (colores de grupos, presets de color, plantillas), cada uno con un comentario.
  *Aceptación:* el contador de colores de F13.2 baja en cada commit; no hay regresión
  visual en las capturas.
  **Hecho, con alcance recortado** (2026-10-20, commits F14.3a/b/c): 573 → 488 literales
  de interfaz (−85, 62 archivos tocados con un script que sólo lee `<style>` y `style=""`,
  nunca `<script>`). Se reemplazó lo que tiene token inequívoco: blancos translúcidos
  → `--bg-hover`/`--bg-selected`/`--border`/`--border-strong` según la propiedad, rojo →
  `--danger`, verde → `--success`, ámbar → `--warning`, texto `#fff`/`#000` →
  `--text`/`--action-text`. **Fuera de alcance** (contenido o previsualización de
  contenido): `slide/`, `export/`, `output/effects/`, `edit/editbox/`, `Stagebox` y los
  popups `MediaFit`, `MetadataDisplay` y `Transition`. *Lo que queda (488) no es "color de
  interfaz suelto"* y se resuelve en otras tareas: rellenos oscuros translúcidos
  (`rgb(0 0 20 / 0.08)`…, ~35) → **F14.4**; `box-shadow` (47) → **F14.5**; scrims sobre
  miniaturas (`rgb(0 0 0 / 0.6)`, 15); colores de medidores de audio y de marcas (OBS);
  colores de grupo (datos); y ~160 literales en el marcado y ~67 en `<script>` (props y
  valores de datos) que el script no toca a propósito. **El contador de F13.2 debe medir
  sólo la interfaz en alcance, no un `rg` global.** Verificado: `test:svelte` 56 errores
  (línea base), `test:unit` 89/89, prettier (`MaterialButton.svelte` ya venía mal
  formateado y se dejó limpio). No verificado visualmente.

- [x] **F14.4 Bordes en lugar de fondos.**
  *Archivos:* contenedores de layout (`components/main/`), filas de Configuración,
  pestañas del cajón, panel derecho.
  *Pasos:* un solo fondo de aplicación; los paneles se separan con `border` de 1 px (los
  divisores redimensionables también). Las filas de Configuración pasan a ser una lista
  con separadores finos, no tarjetas. Los labels flotantes estilo Material pasan a
  label a la izquierda (`Field` del kit).
  *Aceptación:* en las capturas de Show y Configuración hay a lo sumo dos grises de fondo
  (app y elevado).
  **Lote 1 hecho** (2026-10-20, a partir de las capturas `docs/capturas/f14/tokens-*.png`):
  `--primary-darker` y `--primary-darkest` = `--bg` (un solo fondo); divisores de panel de
  1 px (`Resizeable`, antes una barra gris de 4 px); `Modal` y la **tarjeta común de
  `Popup.svelte` (la usan ~89 diálogos, entre ellos "New show")** pasan a superficie
  elevada con borde de 1 px, `--radius-modal` y `--shadow-float`, cabecera de 44 px,
  título de 15 px y texto base 1em (antes 1.2em, borde 2 px y sombra de 5 px); pista del
  slider visible (`--border-strong`); botones `red` ("Clear all") pasan de relleno a
  texto + borde rojos (`--danger-border`); contornos de foco → anillo de 1 px (`--ring`,
  10 casos) y de activo/seleccionado → `--text-muted` en vez de blanco puro (17 casos).
  **Lote 2 hecho** (2026-10-20; causa de "algunas cosas no se achicaron": los `Material*`
  fijaban `1rem`/`1.1rem`/`0.75rem`, y `rem` cuelga de la raíz de 16 px, no del
  `--font-size` de 13 px). Los 10 campos `Material*` (texto, número, área de texto,
  desplegable, botón de popup, archivo, carpeta, hora, selector radial y color) comparten
  ahora un solo aspecto: **borde de 1 px, 38 px de alto, etiqueta siempre arriba, chica y
  gris** (11 px, `--text-subtle`; se acabó el salto de tamaño estilo Material), sin fondo
  propio ni subrayado animado, foco = borde `--border-strong`. Interruptor y checkbox
  pasan a **filas de 36 px con separador de 1 px** (interruptor de 32×18, checkbox de
  16 px con borde de 1 px). `MaterialButton`: 28 px de alto (24 en `small`), 13 px, borde
  `--border-strong` en `outlined`, sin fondo propio, pestaña activa con barra de 2 px.
  Título de página de Configuración 20 px/600. Los 19 `font-size` en `rem` restantes (fuera
  de `slide/` y `export/`) pasaron a la escala. *Defectos de las capturas:* el ✕ que se
  pisaba con "None" (reserva de ancho del botón de borrar en Dropdown, PopupButton,
  FilePicker, TextInput, NumberInput y TimePicker); en Pantallas se quitó el mapa
  duplicado de "System" (quedan Refresh/Identify) y con él el texto superpuesto, y
  "Asignado:" ahora es la clave `screen_config.assigned` (`en`/`es`); `DisplayLayout` pierde
  la prop `selectable` (ya nadie la usaba en falso). *Lección:* Svelte **elimina** los
  selectores que no puede ver en el marcado del componente (por ejemplo `:has(.remove
  button)` cuando el botón lo pinta un hijo): hay que escribirlos con `:global(button)`.

- [x] **F14.5 Quitar decoración.**
  *Pasos:* borrar degradés (`rg -n 'gradient' src/frontend`), el `+` flotante de la
  columna izquierda (su acción va al encabezado de sección, como en el kit), los radios
  completos y las sombras fuera de flotantes. El reloj del cajón: Geist Mono, `--text`,
  tamaño acotado, sin acento.
  *Aceptación:* `rg -n 'linear-gradient|radial-gradient' src/frontend` sólo deja casos
  justificados (vista previa de contenido) con un comentario.
  **Hecho** (2026-10-20). *Degradés:* el violeta salía de pocas fuentes centrales y se
  cortó ahí: `Icon` pierde toda la maquinaria de degradé (relleno sólido `--text-muted`;
  `white` = `currentColor`; se sacó `gradient`/`gradientColor` y el atributo de 11
  llamadores; el aviso de `Tip` usa `--warning`), `MaterialButton` pierde la variante
  `gradient`, `Tipbar` y `ProgressPanel` (borde y barra), waveform del editor de audio y
  compresor. *Botón flotante:* `FloatingInputs` pasa de píldora de 50 px con borde
  degradé a barra rectangular de 32 px (`--radius`, borde `--border-strong`,
  `--shadow-float`) y se quitaron los 50 px en línea de los 4 botones `+`; los menús
  "agregar" de Edit, Projects y ProjectContentList (radio 25 px, desenfoque, filas "outlined"
  apiladas de 35 px) pasan a superficie elevada con filas de 28 px sin fondo. *Sombras:*
  19 flotantes unificadas en `--shadow-float`; 19 decorativas borradas (cabeceras, brillo
  de pestaña activa, sombra al hover del botón, bandas del cajón, thumb del slider).
  *Ripple* de `MaterialButton` eliminado (kit: sólo transiciones de color). *Quedan a
  propósito:* medidores de nivel de audio (cian→rojo, semánticos), vista previa de colores
  del usuario, portada de Spotify, relleno monocromo del slider, esquinas de pestañas,
  sombras de la línea de tiempo y de los nodos de audio (diagramas). `Tipbar` es el aviso de
  **"Donate" de FreeShow**: sólo se le sacó el degradé, quitarlo es decisión del usuario.
  El reloj del cajón en mono va con F14.6. Verificado: `test:svelte` 56 (línea base),
  `test:unit` 89/89, prettier. **No verificado visualmente.**

- [x] **F14.6 Escala tipográfica.**
  *Pasos:* exponer la escala de F14.1 como utilidades de Tailwind (`text-xs` … ) y como
  variables; reemplazar los `font-size` en `em` de los componentes de layout por la
  escala. Números en mono (`tabular-nums`): timers, timecodes, contadores, inputs
  numéricos.
  *Aceptación:* en las pantallas de F14.1 no quedan tamaños fuera de la escala.
  **Hecho, con alcance recortado** (2026-10-20). *Se hizo:* tamaño base 16 → **13 px**
  (`--font-size` en `global.css` y en `defaultThemes.ts`; todo lo escrito en `em` escala solo,
  unos 366 casos), escala `--text-2xs/xs/sm/md/lg` (11/12/13/15/20 px) como variables y como
  utilidades de Tailwind, y **Geist Mono con `tabular-nums`** en 12 reglas de números de
  interfaz (contadores de categorías y proyectos, duración y número de `ShowButton`, tiempo
  de la línea de tiempo, del audio, del calendario y de los historiales, número de monitor).
  *No se hizo a propósito:* reemplazar los 366 `font-size` en `em` por valores absolutos:
  los `em` se componen al anidarse y pasarlos a px fijos agranda a los hijos y puede romper
  layouts sin poder verlo; por eso **el criterio "ningún tamaño fuera de la escala" no se
  cumple**. Los 53 `rem` quedan en 16 px de base (0.75rem = 12 px, coincide con la escala).
  El reloj del cajón (`Clock.svelte`) **no** pasó a mono: el mismo componente dibuja el
  reloj de los slides, que es contenido. Verificado: `test:svelte` 56 (línea base),
  `test:unit` 89/89, prettier. **No verificado visualmente: el cambio de base afecta a toda
  la app y es lo primero que hay que mirar.**

- [x] **F14.7/F14.8 Una sola librería de componentes.** *(Reabierta el 2026-10-20 por
  decisión del usuario: no puede haber tres librerías, `Material*`, el kit y los `Button`/
  `TextInput`/… legacy.)* **Meta:** todo vive en `src/frontend/lib/components/ui/`, con un
  solo nombre por concepto y sin prefijo `Material`; `components/inputs/` se borra.
  *Decisiones de diseño:*
  1. **Contrato de eventos:** las piezas compuestas **conservan `on:click`/`on:change`**
     (dispatcher con `detail`) y además aceptan el atributo nativo `onclick` (lo que usa hoy
     el kit). No se reescriben ~1.200 manejadores a ciegas, y AGENTS.md prohíbe migrar a runes
     de forma masiva. Es un contrato único y documentado en `kit.md`.
  2. **Un botón:** `button` unifica el `MaterialButton` (638 usos en 200 archivos), el
     `Button` legacy (~100 usos), `HoverButton` y el `button` del kit (12 archivos). Variantes
     canónicas del kit (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link`,
     `live`); `contained`→`default`, `outlined`→`outline`, `text`→`ghost`. Tamaños: `xs` 24,
     `sm` 28, `default` 32, `icon`, `icon-sm`.
  3. **Primitivas del kit sin uso** (`input`, `select`, `switch`, `tabs`, `scroll-area`,
     `skeleton`, `label`, `separator`: verificado con `rg`) se borran; las piezas compuestas
     las reemplazan.
  4. **Nombres:** carpeta por pieza en minúsculas (`text-input/text-input.svelte`),
     importadas con ruta relativa, como el resto del kit. Los usos se migran con un script
     que renombra la importación y las etiquetas (respeta alias como `MaterialSlider`).
  5. **Seguridad:** cada paso se verifica con `svelte-check` (línea base 56 errores),
     `test:unit` y prettier; un paso = un commit; el usuario prueba en la app entre pasos.
  *Pasos:*
  - [x] **F14.8a Botón único.** Reemplaza `MaterialButton`, `Button` legacy y el `button`
    del kit (adapta `KitDemo` y reescribe `svelte5-smoke.test.ts`). `HoverButton` **no es un
    botón** (es una capa de "play" sobre miniaturas): pasa a F14.8e.
    **Hecho** (2026-10-20): `lib/components/ui/button/button.svelte`, 229 archivos
    migrados con script (637 etiquetas `MaterialButton`, 104 del `Button` legacy, 37 del kit),
    `MaterialButton.svelte` y `Button.svelte` borrados. *Contrato:* variante `ghost` y tamaño
    `sm` (28 px) **por defecto** (de 638 usos, ~437 no declaraban variante: no hubo que
    tocarlos); variantes `default/secondary/outline/ghost/destructive/link/live`; tamaños
    `xs/sm/md/icon/icon-sm`; banderas `isActive`, `showOutline`, `tab`, `red`, `redHover`,
    `bold`, `align="start"`, `icon`/`iconSize`/`info`/`title`; `on:click`/`on:dblclick` con
    `detail {ctrl, shift, alt, doubleClick, target}` **y** `onclick` nativo. El CSS va en
    `@layer components` (las utilidades de Tailwind y los CSS de los padres le ganan) y el
    orden de capas se declara en la primera línea de `public/global.css`. *Migración:*
    `contained→default`, `outlined→outline`, `text→ghost`, `small→size="xs"`; en el legacy,
    `active→isActive`, `outline→showOutline`, `center` pasa a ser el comportamiento por
    defecto y su ausencia a `align="start"`, `dark`/`border` se quitaron. *Rotura de
    contrato atrapada:* el `Button` legacy reenviaba el evento DOM y el nuevo entrega
    `detail`; una auditoría del código original encontró **6 manejadores** que leían
    `e.ctrlKey`/`shiftKey`/`altKey` (AudioEffect, AudioFile ×2, Mic, Actions, NumberInput ×2)
    y se pasaron a `e.detail.ctrl/shift/alt`; también se quitaron atributos huérfanos
    (`{zoom}` en 5 archivos, `center` en `MaterialZoom`). *Verificado:* `svelte-check`
    **45 errores (base 56), 0 nuevos** (comparado contra la lista de errores de `HEAD` en
    un worktree temporal), `test:unit` 93/93 (el smoke test se reescribió para el contrato
    nuevo), prettier. `src/server/remote/` conserva su propio `MaterialButton`: es un cliente
    web aparte. **No verificado a ojo:** revisar tarjetas de audio (AudioEffect, AudioStreams,
    Mic), que usaban estilos que el `Button` legacy imponía a sus `div` hijos.
  - [x] **F14.8b Texto y número.** **Convención de nombres** (decidida acá): `Input` = `<input>`
    pelado; `*Field` = control **con etiqueta** y valor/restablecer (`TextField`,
    `NumberField`, `TextareaField`, y en los pasos siguientes `SelectField`, `ToggleField`…);
    `Stepper` = −/+ con repetición al mantener. Los `TextInput`/`NumberInput` legacy **no eran
    duplicados** de los `Material*` (un `<input>` pelado que reenvía eventos DOM y un
    stepper), por eso no se fundieron: se mudaron con su nombre propio.
    **Hecho** (2026-10-20): `MaterialTextInput`→`text-field/`, `MaterialNumberInput`→
    `number-field/`, `MaterialTextarea`→`textarea-field/`, `TextInput`→`input/` (reemplaza al
    `input` shadcn sin uso, borrado), `NumberInput`→`stepper/`; 91 archivos reescritos con
    una herramienta de mudanza que mueve el archivo y reescribe **todos** los imports
    relativos (los de quienes lo importan y los internos del movido) y renombra etiquetas e
    identificadores. API sin cambios (`on:change`/`on:input` con `detail`). *Un bug que
    `svelte-check` no atrapó:* `components/input/inputs.ts` usaba los componentes como
    identificadores en un mapa (`string: MaterialTextInput`); la herramienta sólo renombraba
    etiquetas y se corrigió (ahora renombra también identificadores). *Verificado:*
    `svelte-check` 45 errores (base 56), 0 nuevos; `test:unit` 93/93; prettier.
  - [x] **F14.8c Listas y pickers.** **Hecho** (2026-10-20): `MaterialDropdown`→`select-field/`,
    `MaterialPopupButton`→`popup-field/`, `MaterialFilePicker`→`file-field/`,
    `MaterialFolderPicker`→`folder-field/`, `MaterialTimePicker`→`time-field/`,
    `MaterialDatePicker`→`date-field/`, `MaterialRadialPicker`→`radial-field/`,
    `MaterialColorInput`→`color-field/`, `MaterialColorsInput`→`colors-field/`,
    `MaterialFontDropdown`→`font-field/`; el `Dropdown` legacy (desplegable pelado, `on:click`
    con el ítem) conserva su nombre: `dropdown/` (`Dropdown` = pelado, `SelectField` = con
    etiqueta). Se borró el `select` shadcn sin uso. 73 archivos reescritos. Aparecieron 3
    errores por atributos huérfanos que el botón anterior ignoraba en silencio: `center`
    (se quitó) y `label="actions.delete"` en dos botones de borrar, que era un tooltip y
    pasó a `title`. *Verificado:* `svelte-check` 42 errores (base 56), 0 nuevos; `test:unit`
    93/93; prettier.
  - [x] **F14.8d Interruptores y demás.** **Hecho** (2026-10-20): `MaterialToggleSwitch`→
    `toggle-field/`, `MaterialCheckbox`→`checkbox-field/`, `MaterialMultiChoice`→
    `choice-grid/` (fichas grandes con ícono), `MaterialMultiButtons`→`segmented-field/`
    (selección única), `MaterialToggleButtons`→`toggle-group-field/` (selección múltiple),
    `MaterialZoom`→`zoom-control/` (no es un campo: es el control +/- con rueda), `Slider`→
    `slider/` (el alias `MaterialSlider` de `LooksWindow` se renombró bien). *Verificado:*
    `svelte-check` 42 errores (base 56), 0 nuevos; `test:unit` 93/93; prettier.
  - [x] **F14.8e Restos y cierre.** **Hecho** (2026-10-20). *A la librería:* `Link`,
    `HiddenInput`, `CombinedInput` y, de `components/input/` (singular, otra carpeta de UI
    genérica que el plan no contemplaba), `FloatingInputs`→`FloatingBar`, `InputRow`, `HRule`,
    `Title`, `List`, `DynamicList`, `Tabs`. *A su dominio:* `ShowButton` y `MediaPicker`
    (`components/show/`), `TopButton` (`components/main/`), `HoverButton`→`HoverPlay`
    (`components/helpers/`: **no era un botón**, es una capa de "play" sobre miniaturas) y el
    constructor de formularios por esquema (`components/form/`: `Input`→`FormInput`,
    `Inputs`→`FormInputs`, `inputs.ts`), renombrado porque `Input` ya es el input pelado de
    la librería. `MaterialDrawerTab`→`DrawerTab`. *Borrado:* las carpetas `components/inputs/`
    y `components/input/`, las primitivas shadcn sin uso (`input`, `select`, `switch`, `tabs`,
    `scroll-area`, `skeleton`, `label`, `separator`, `field`), cuatro dependencias sin
    consumidor (`bits-ui`, `tailwind-variants`, `@lucide/svelte`, `tw-animate-css`), sus
    helpers de tipos y el código comentado que nombraba `Material*`. `KitDemo` muestra ahora
    los campos reales. Documentación reescrita (`docs/design/kit.md` y el README de la
    librería). *Un efecto colateral atrapado:* la herramienta renombró el **tipo** `Input` de
    `import type { Input as TInput }` en `FormInputs`; `svelte-check` lo marcó y se corrigió.

  **Resultado final de F14.7/F14.8** (verificado el 2026-10-20). `fd . components/inputs` y
  `components/input` ya no existen; `rg 'Material[A-Z]' src/frontend` = **0**; la librería
  tiene 40 componentes en 39 carpetas; `svelte-check` **42 errores (base 56), 0 nuevos**
  (cada paso se comparó contra la lista de errores de `HEAD`); `test:unit` 93/93; prettier.
  7 commits: `6e6dccdc` (a), `b0ed5cfa` (b), `ffec5075` (c), `a67f5afb` (d) y el de este cierre.
  *Pendiente a propósito:* `src/server/remote/` conserva su propia copia de `MaterialButton`
  (cliente web aparte, ver "Deuda registrada"). **No verificado a ojo:** los 229 archivos del
  botón y los 3 pasos de mudanza se verificaron con tipos y tests, no mirando la app; lo
  primero a revisar es el botón (variante por defecto `ghost`, `@layer components`) y las
  tarjetas de audio.

- [x] **F14.9 Panel derecho (antes F12.7).** **Hecho con otro alcance** (2026-10-20). La captura
  `despues-edit.png` mostró el defecto real: fuera de Show, la barra de controles (`‹ › ↻ 🔒`)
  se posicionaba de forma **absoluta** sobre las miniaturas de salida, con fondo translúcido y
  desenfoque (`.section.float`, herencia de FreeShow). Se quitó ese modo: la barra queda
  siempre en el flujo (junto con `light`, `isSplitted` y tres imports que sólo la servían).
  *No se hizo* la tira vertical de limpiar con ⓧ sobre la vista previa: el diseño actual (una
  fila "Clear all" con contorno rojo y una tira de 5 íconos) ya es de dos filas y es
  consistente con el resto; si se la quiere igual, es una tarea propia con captura.

- [ ] **F14.10 Repaso final (reemplaza F12.10).** **Parcial** (2026-10-20). Hay 7 capturas en
  macOS de Show, Edit, Pantallas, Looks y el menú de Looks (`docs/capturas/f14/despues-*.png`);
  **faltan Windows y la prueba a 1280×800.** Lo que mostraron y se corrigió en este repaso:
  íconos de sección de Edit en rosa/violeta/naranja/verde (`sectionColors`, borrado), íconos
  de menús contextuales con `iconColor` (ahora grises), pestañas activas de Pantallas como
  píldora blanca (ahora `isActive`), glifos `●` de Audiencia/Stage (ahora íconos que se ponen
  rojos en vivo), "Proyectar" y "diapositiva(s)" fijos en español (claves `ui.present`,
  `ui.slide`, `ui.slides`), contorno de énfasis más suave y el panel flotante (F14.9).
  *Decisiones pendientes del usuario:* (1) el color de cada **salida** (azul, rosa) **no** se
  neutralizó porque es funcional: marca qué salida muestra cada slide (`helpers/output.ts`);
  (2) los íconos de **categorías y shows** (`customIconsColors`: Songs azul, Scripture naranja)
  siguen en color; (3) `Tipbar` ("Donate" de FreeShow) sigue; (4) los botones "New collection"
  / "New category" se ven con borde claro (contorno de énfasis `showOutline`).

- [ ] **F14.11 Ajustes de estructura tras el repaso** (pedidos del usuario, 2026-10-20).
  *Hecho:* (1) **`+` de LIBRARY** (`components/show/LibraryAddMenu.svelte`): un solo ícono sin
  texto que abre New show, New category, New project, New folder e Import; se escondió la
  **pestaña Shows del cajón** (se entra por LIBRARY; `Ctrl+1` sigue abriéndola) y se quitó el `+`
  del pie del cajón con su lógica por pestaña (`addClick`, `showAddButton`): Media/Audio
  (`MediaTabs`/`AudioTabs`), Scripture, overlays y templates ya tienen su propio botón de crear.
  (2) **Vista previa de una sola salida** (`MultiOutputs.svelte`): store `previewOutputId`, barra
  con el estado de la salida y un dropdown (`Dropdown arrow`) para cambiar de pantalla; se
  quitaron la grilla, el zoom con rueda (`outputPreviewGrid`) y los títulos de las ocultas;
  `hideFromPreview` ahora significa "no aparece en el selector". El borde de color de la
  salida en la vista previa se sacó (el color sigue en la línea inferior de la etiqueta y en
  los slides: es funcional). `OutputPreviewLabel` pierde las props del botón legacy
  (`active=`) y sus hex de estado pasan a `--danger/--success/--warning`. (3) **`Capsule`**:
  radio `--radius` (6 px) como los botones normales, sin fondo propio, botones internos a 4 px.
  (4) **Íconos de la barra:** Audiencia = `display` (monitor liso), Stage = `stage` (monitor con
  ondas, el que ya usan las etiquetas de salida; antes usaba `user`).
  (5) **Se eliminó el `Filter` del pie del cajón** (decisión del usuario, 2026-10-20, tomada
  sabiendo el costo). Se borró el campo, el pie completo (la vista lista/grilla y el slider de
  tamaño pasaron a la derecha de la fila de pestañas) y su plomería en 20 archivos
  (`Content`, `Shows`, `Media`, `Audio`, `Scripture`, `Overlays`, `Templates`, `Scenes`,
  `Timers`, `Actions`, `Variables`, `Calendar`, `Effects`, `Windows`, `PlayerVideos`,
  `ContentLibraryBrowser`, `Canva`, `OBS`, `Interactions`, `ShowButton`), el popup
  `drawer_search_options`, el paso de la guía y la entrada de atajos. `Ctrl+F` ahora abre el
  buscador rápido de la barra superior. `utils/search.ts` **se conserva** (lo usan el
  buscador rápido, `SelectShow` y el control remoto). *Funciones que se pierden:* filtrar por
  texto dentro de cada pestaña; **crear un show escribiendo un nombre y Enter**; el resaltado
  de coincidencias y su barra de porcentaje; la **entrada de versículos por referencia**
  ("Genesis 1:1", con autocompletado; se borraron `referenceSearch` y
  `parseMultiChapterReference`; queda la búsqueda de texto de la propia pestaña Scripture y la
  navegación por libros/capítulos/versículos). *Se conservó a propósito:* la **búsqueda de
  imágenes online de Pixabay y Unsplash**, que usaba el filtro como consulta a la API: ahora
  tiene un campo propio dentro de esas dos vistas (confirma con Enter). *Un error propio
  atrapado por `svelte-check`:* al cortar la búsqueda por referencia se borraron también las
  declaraciones del estado de la búsqueda de texto de Scripture (`contentSearchValue`…); se
  restauraron del código original. *Verificado:* `svelte-check` 41 errores (base 56), 0
  nuevos; `test:unit` 93/93; prettier.

---

## F15 — Robustez y orden

- [ ] **F15.1 Errores silenciosos en Rust.**
  *Pasos:* clasificar los 96 `let _ =`. Los que escriben, copian o borran datos del
  usuario (ej. `commands/files.rs:840`) devuelven `AppResult` o, si es *best-effort*,
  hacen `log::warn!` con la ruta. Las limpiezas de temporales quedan con un comentario.
  *Aceptación:* ningún `let _ =` sobre I/O de datos del usuario sin log o propagación.

- [ ] **F15.2 Contrato de IPC.**
  *Archivos:* `src/frontend/IPC/main.ts`, nuevo test en `src/frontend/IPC/`.
  *Pasos:* `requestMain` hace `log` (F13.3) con el nombre del canal cuando vence el
  timeout. Test que compara los canales `Main.*` que usa el frontend con los comandos
  registrados en `src-tauri/src/lib.rs` y falla si aparece un canal nuevo sin comando
  (lista de excepciones explícita).
  *Aceptación:* agregar un `requestMain` a un canal inexistente hace fallar el test.

- [x] **F15.3 Partir `render/screens.rs`.** (2026-10-20: `screens/` con `mod`, `monitors`, `lifecycle`, `identify`, `scene_state`, `video_hub`, `render_loop` y `tests`; 76/76 tests, mayor archivo 369 líneas.)
  *Pasos:* separar por responsabilidad (ciclo de vida de ventanas, monitores y
  coordenadas, loop de frames) en submódulos, sin cambiar comportamiento.
  *Aceptación:* `cargo test --lib` (incluidos los golden) pasa igual; ningún archivo de
  `render/` supera ~600 líneas.

- [ ] **F15.4 Tests de dominio del frontend.** Cubrir con fixtures los conversores de
  importación (`src/frontend/converters/`: datos del usuario) y los helpers de
  `helpers/output.ts` y `showActions.ts` que usa la salida.
  *Aceptación:* un test por conversor con un archivo real de ejemplo.

- [ ] **F15.5 Ordenar la documentación.**
  *Pasos:* mover a `docs/archivo/` los planes y verificaciones ya cerrados
  (`PLAN-HAIKU`, `PLAN-NOCHE`, `VERIFICAR-F6`, `VERIFICAR-F7`); borrar
  `docs/drafts/render_screens.rs` si `rg` no lo referencia; índice corto en
  `docs/README.md`.
  *Aceptación:* en `docs/` sólo queda lo vigente, y cada archivo aparece en el índice.

---

## F16 — Distribución

- [ ] **F16.1 Firma.** macOS: Developer ID + notarización en `build.yml` (secretos en
  GitHub). Windows: firma de código (certificado o Azure Trusted Signing). Requiere las
  cuentas del usuario.
  *Aceptación:* el `.dmg` abre sin aviso de Gatekeeper y el instalador NSIS sin
  SmartScreen "editor desconocido".

- [ ] **F16.2 Actualizaciones.** `tauri-plugin-updater` con manifiesto firmado en GitHub
  Releases. Depende de F16.1.
  *Aceptación:* una versión instalada detecta la siguiente y se actualiza en macOS y
  Windows.

---

## F17 — GPU compartida

Plan: `docs/superpowers/plans/2026-10-20-gpu-compartida-zero-copy-workers.md`.

- [x] **F17.1 `GpuContext`.** Un solo Instance/Adapter/Device/Queue (`render/gpu.rs`), Metal en macOS y DX12 en Windows. (2026-10-20, commit d625c64e.)
- [x] **F17.2 `MediaStore` compartido.** Texturas y pipelines por formato compartidos entre pantallas; los uniforms pasan a una `LayerArena` por pantalla con offset dinámico. **Corrige un bug latente:** con fondo + item en la misma slide todas las capas usaban los uniforms de la última (test `golden_fondo_e_item_conservan_sus_uniforms`).
- [x] **F17.3 Pantallas sobre el Device compartido.** `spawn_render_loop` ya no pide adaptador ni device propios. Hecha junto con F17.2 (no compilan por separado). **Sin verificar en la app real** (dos pantallas abiertas con crossfade): queda para F13.4.
- [x] **F17.5 Eliminar y duplicar pantallas** (regresión de F10.8, 2026-10-20; hecha antes de F17.4). F10.8 borró la lista vieja con `context #output_screen` y la nueva no podía quitar ni duplicar. Ahora `ScreenDetail` tiene Duplicar y Eliminar (Eliminar deshabilitado en la última audiencia: el historial recrearía una "default" sola). `REMOVE_SCREEN` (Rust) cierra la ventana y olvida la escena; antes `send(OUTPUT, ["REMOVE"])` se descartaba en `tauri.ts` porque ningún comando Rust se llamaba así, y borrar una audiencia en vivo habría dejado la ventana abierta. Renombrar ya existía (input del nombre). **Sin verificar en la app real.**
- [x] **F17.4 Una subida de video por archivo.** (2026-10-20: el hub publica cada frame una sola vez a la textura compartida, con la ruta como id; las pantallas sólo se suscriben por etiqueta de ventana y no hay `to_vec()` por suscriptor. Tests `subscribers_*` y `video_frames_are_uploaded_once_*`. Sin verificar en la app real.) El hub sube el frame una vez a la textura compartida (hoy copia `bytes.to_vec()` por suscriptor).

---

## F18 — Video zero-copy nativo · F19 — Workers de I/O

Plan: `docs/superpowers/plans/2026-10-20-gpu-compartida-zero-copy-workers.md`. Diseño: `docs/design/zero-copy.md`.

- [x] **F18.1 Spike de importación nativa.** macOS verificado: `CVPixelBuffer` NV12 → `CVMetalTextureCache` → `wgpu::Texture` sin copiar (`render/video/metal_import.rs`, test que lee de vuelta los planos). Diseño de Windows documentado, sin verificar.
- [x] **F18.2** Pipeline NV12 → RGB en el shader (`video/nv12.rs`, `shaders/video_nv12.wgsl`; el mapeo de aspecto pasó a `layer_common.wgsl`, compartido con `composite.wgsl`). Tests: rojo BT.709 limitado, blanco, rango completo vs limitado, matrices, dimensiones impares.
- [x] **F18.3** Trait `VideoDecoder`/`FrameSink`, `video/ffmpeg.rs` en NV12 con **PTS** en cada frame (contador global: no se reinicia al dar la vuelta del loop) y `render/clock.rs` (`ShowClock` + `WallClock`, sin consumidores todavía). `MediaStore` guarda un frame NV12 por video (`get_video`, `update_video_nv12_cpu`, `set_video_native`); el render lo dibuja con `Nv12Pipeline`. Cambio de comportamiento: el video ya no se estira a 16:9, se escala a 1920×1080 conservando la proporción. Probado con el ffmpeg real (frames NV12 del tamaño exacto).
- [x] **F18.4** Decodificador nativo macOS (`video/avf.rs`: `AVAssetReader` con VideoToolbox, NV12 + IOSurface + `CVMetalTextureCache`). Pacing por PTS, loop continuo con PTS acumulado, reapertura ante errores del lector y fallback a ffmpeg si no abre el archivo. Fixture `tests/fixtures/video/solid_red_64.mp4`. Tests: frames nativos 64×64, loop, archivo corrupto/inexistente, stop < 500 ms.
- [x] **F18.5** Importación Metal sin copias cableada al render + medición (`docs/informes/f18.md`). Tests: un frame nativo se ve rojo; el camino nativo hace 0 subidas desde la CPU. **Medición en M4, 4K H.264, 10 s:** ffmpeg→RGBA 1080p ≈ 80 % de un núcleo, ffmpeg→NV12 ≈ 57 %, nativo 4K ≈ 5 % (una corrida; sin Windows).
- [x] **F18.6** Media Foundation + D3D12 en Windows (`video/mf.rs`, `video/d3d_import.rs`, `video/pacing.rs`). **Implementado y type-checkeado, NO ejecutado en Windows**: `scripts/check-windows-video.sh` compila los archivos reales para `x86_64-pc-windows-msvc` con `-D warnings` (la app completa no se puede compilar para Windows desde macOS: falta `llvm-rc`). La ejecución real (decodificar, copiar GPU→GPU, abrir el recurso en DX12, sincronizar) queda en F13.4. `GpuContext` pide `TEXTURE_FORMAT_NV12` si el adaptador lo soporta; si no, o si algo falla, `video::start` cae a ffmpeg.
- [x] **F19.1** Workers de carga de imágenes sobre la GPU compartida (`render/workers.rs`: pool de ½ núcleos, 2–8 hilos, resiste panics; `MediaStore::request_image` → `MediaState::{Loading, Ready, Failed}`, un decode por ruta, rechaza imágenes de más de 16384 px por lado leyendo sólo el encabezado). El bucle de render ya no decodifica: la capa aparece en el primer frame tras cargarse.
- [ ] **F19.2** Precarga al aplicar la escena y de las slides siguientes (`RENDER_PREFETCH`).
- [ ] **F19.3** Miniaturas fuera del hilo de comandos y cierre.

---

## F20 — Columna izquierda: LIBRARIES · PLAYLISTS · ÍTEMS

Diseño: `docs/superpowers/specs/2026-10-20-columna-izquierda-library-playlist-items-design.md`.
Sin documento de plan aparte (el usuario pidió ejecutar directo).

- [x] **F20.1** Lógica pura de la fuente de ÍTEMS (`show/leftSource.ts`: fuente válida/inicial, filtro sin acentos, selección múltiple, shows de una biblioteca) y store `leftSource`.
- [x] **F20.2** Una sola library por defecto, `general` ("General"), en `default_synced_settings` (Rust) y traducciones. Los usuarios existentes conservan las suyas.
- [x] **F20.3** `show/projectTree.ts`: el árbol de playlists de `Projects.svelte` como función pura con tests.
- [x] **F20.4** Paneles `show/left/` (`LeftColumn`, `LibrariesPanel`, `PlaylistsPanel`, `ItemsPanel`, `LeftPanel` con barra de título/contador/pastilla), modal "Agregar shows" (`add_shows`) y divisores arrastrables (`panelSizes.ts`, 18 · 22 · resto, guardados en `resized`). `openProject` marca la fuente.
- [x] **F20.5** Cajón sin la vista Shows, pestañas con texto, arranca en Media; `Ctrl+1` enfoca el buscador de la biblioteca.
- [x] **F20.6** Armar un servicio: arrastrar un show de ÍTEMS a una playlist (`dropActions.projects`) y clic derecho → "Agregar a playlist" (`LOAD_add_to_playlist`). `LibrariesPanel` conserva mover shows entre bibliotecas arrastrando (`DropArea id="navigation"`).
- [x] **F20.7** "Importar" en el `+` de ÍTEMS (con biblioteca) y opciones de playlists (nombre por defecto, lista al inicio) en un modal.
- [ ] **F20.8 Verificación en la app real (usuario).** No se pudo mirar la pantalla (extensión de Chrome sin conexión). Falta probar: elegir biblioteca/playlist, buscar, modal Agregar shows, arrastrar, divisores, renombrar y menú contextual de una biblioteca, pestañas del cajón con poco ancho, perfil con acceso restringido.

*Decisiones propias:* ÍTEMS no tiene "⋯ más" en el cajón (la tira de pestañas se desplaza); "Agregar a playlist" muestra todas las playlists; la library virtual "Sin etiqueta" aparece sólo si hay shows sin categoría; `Projects.svelte` quedó sin usar (se conserva): su lista de "usadas recientemente" y la vista de edición de plantillas de proyecto ya no tienen acceso.

---

## Deuda registrada (sin tarea)

- **Cliente `src/server/controller`** todavía tiene la interfaz de Dibujo (Focus, Zoom,
  Paint…) y manda mensajes `FOCUS`/`clear_painting` que el frontend ya no atiende (F14.1c).
  Como esos clientes no se compilan, no se tocó; se resuelve al decidir qué hacer con ellos.
- **Clientes web de `src/server/`** (remote, stage, controller, cam, output_stream;
  ~21.7k líneas): no se compilan (no están en `vite.config.mjs` ni hay script) ni se
  empaquetan (`tauri.conf.json` no declara `resources`). Los servidores Axum
  (`src-tauri/src/server/`, puertos 5510–5513) levantan pero sirven carpetas vacías. Se
  decidió (2026-10-20) dejarlos como están. Revivirlos requiere build propio, bundling,
  tipar los mensajes del server (hoy `serde_json::Value`) y prueba desde un celular.

## Fuera de alcance por ahora

Renombrar masivamente archivos de FreeShow · crates o procesos nuevos · reescribir todo
`window.api` · migrar todo a runes · cambiar el formato de shows/bibliotecas · cambiar
el motor de video sin mediciones (F8.3) · soporte Linux.
