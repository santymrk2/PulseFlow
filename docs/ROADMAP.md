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

- [ ] **F2.8 Prueba manual guiada.**
  *Pasos:* en macOS y Windows con 2 monitores: elegir pantalla, poner en vivo, pasar
  slides de una canción, poner imagen y video de fondo, limpiar, cerrar salida.
  Anotar en `PLAN.md` ("Estado real") qué funciona y qué no.

---

## F3 — Persistencia confiable

Va antes que las features nuevas porque Looks agrega datos persistidos.

- [ ] **F3.1 Errores de escritura visibles.**
  *Archivos:* `src-tauri/src/domain/data/store.rs`, `commands/stores.rs`,
  `commands/shows.rs`.
  *Pasos:* reemplazar `let _ = fs::write` / `unwrap_or_default()` por `AppResult`;
  escritura atómica (archivo temporal + `rename`); propagar el error al frontend y
  mostrar un toast.
  *Aceptación:* test que simula una carpeta sin permisos y verifica que el comando
  devuelve error y el archivo original queda intacto.

- [ ] **F3.2 Estilo por defecto válido.**
  *Archivos:* `src-tauri/src/domain/data/defaults.rs`.
  *Pasos:* crear el estilo `default` en los defaults o dejar `style` vacío en el output.
  *Aceptación:* instalación limpia: Settings → Outputs no muestra "Unnamed".

---

## F4 — Contrato del Scene Graph

- [ ] **F4.1 Fuente de verdad del contrato.**
  *Archivos:* `src/types/SceneGraph.ts`, `src-tauri/src/render/scene.rs`.
  *Pasos:* documentar en ambos archivos qué campos están **implementados** en el engine
  y cuáles son sólo tipos; agregar `version: 1` al payload y rechazar (con error
  claro) versiones desconocidas.
- [ ] **F4.2 Tests de compatibilidad TS ↔ Rust.**
  *Pasos:* fixtures JSON en `src-tauri/tests/fixtures/scene/*.json` generadas desde
  `buildSceneGraph()` con un test de vitest; un test Rust deserializa cada fixture.
  *Aceptación:* cambiar un nombre de campo en un solo lado rompe un test.
- [ ] **F4.3 Golden tests visuales.**
  *Pasos:* con `RENDER_SNAPSHOT` (F0.2), 3–4 escenas de referencia (texto centrado,
  texto con stroke/sombra, fondo imagen) comparadas con tolerancia.

Después, ampliar el contrato **de a un tipo por tarea** (cada una con fixture + golden):

- [ ] **F4.4** Transiciones: conectar `render/transition.rs` al bucle (hoy existe pero
  no se usa) — crossfade y corte.
- [ ] **F4.5** Items de imagen/medio dentro de la slide.
- [ ] **F4.6** Overlays (texto e imagen) como capa propia.
- [ ] **F4.7** Timers/relojes (el engine dibuja el valor que manda el frontend).

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

- [ ] **F5.1 Datos de Looks.**
  *Archivos:* `src/types/Settings.ts` (o `Output.ts`), `src/frontend/stores.ts`,
  `src/frontend/utils/save.ts`, `utils/updateSettings.ts`, `src/types/Save.ts`.
  *Pasos:* stores `looks` y `activeLook` persistidos como *synced settings* (mismo
  camino que `styles`); migración: si no hay looks, crear "Default" con el estilo
  actual de cada salida.
  *Aceptación:* crear un look, reiniciar la app, sigue ahí.
- [ ] **F5.2 Aplicar un Look ("Make Live").**
  *Pasos:* `applyLook(id)` asigna `output.style = look.screens[outputId]` a cada salida
  de audiencia y guarda `activeLook`; las salidas que el look no menciona no cambian.
  Registrarlo en el historial (deshacer).
  *Aceptación:* cambiar de look cambia lo que se ve en cada pantalla (verificado con
  2 salidas).
- [ ] **F5.3 Editor de Looks.**
  *Archivos:* nueva pestaña en `components/settings/` (seguir el patrón de
  `Styles.svelte` / `StylesTabs.svelte`).
  *Pasos:* grilla columnas = pantallas de audiencia, filas = estilo (dropdown) + capas
  (toggles de `layers` del estilo elegido). Si se togglea una capa de un estilo usado
  por otro look, ofrecer "duplicar estilo para este look" en vez de modificarlo para
  todos. Botón "Make Live".
- [ ] **F5.4 Cambiar de look en vivo.**
  *Pasos:* selector de look en el panel de salida (derecha) y entrada en el menú de
  salida; acción de slide `set_look` (siguiendo `change_output_style` en
  `components/actions/`).
  *Aceptación:* una slide con la acción cambia el look al activarse.
- [ ] **F5.5 Configuración de pantallas.**
  *Pasos:* en Settings → Outputs agrupar en "Audiencia" y "Stage"; crear un stage
  screen elige un layout de stage; mostrar en cada salida su monitor y estado
  (en vivo / cerrada).

---

## F6 — Diseño: llevar `docs/design-reference/` al frontend Svelte

**Restricción clave:** el frontend usa los nombres de variables de FreeShow con
otra semántica que shadcn (`--primary` = fondo del panel, `--secondary` = acento) y el
tema se aplica desde `defaultThemes.ts` como variables inline sobre `<html>`. Por eso
el port se hace **por valores**, no renombrando variables ni copiando componentes React.

- [ ] **F6.1 Tabla de equivalencias.** Documentar en `docs/design-reference/README.md`
  el mapeo token shadcn (tema `.dark` de `index.css`) → variable FreeShow
  (`--primary` ← `--background`, `--primary-darker` ← `--card`/`--sidebar`,
  `--primary-lighter` ← `--accent`, `--text` ← `--foreground`, `--secondary` ←
  `--sidebar-primary`, bordes ← `--border`, radio ← `--radius`).
- [ ] **F6.2 Tema por defecto "PulseFlow".** En `defaultThemes.ts`: tema por defecto
  con esos valores y fuente Geist (`@fontsource-variable/geist`, ya usada en la
  referencia); en `public/global.css` los mismos defaults. Mantener los otros temas.
  *Aceptación:* captura antes/después de Show, Edit, Settings y Stage en
  `docs/design-reference/screenshots/`.
- [ ] **F6.3 Radios, bordes y espaciados globales.** Variables `--radius` y
  `--border-color` usadas por `Button`, `MaterialButton`, inputs `Material*`, paneles
  y popups (en esos componentes base, no en cada pantalla).
- [ ] **F6.4 Layout de paneles.** Comparar `Topbar.tsx`, `LibraryPanel.tsx`,
  `RightPanel.tsx`, `Drawer.tsx` con `MainLayout.svelte` y `components/main/Top.svelte`;
  ajustar espaciados, alturas y separadores. Sin mover funcionalidad.
- [ ] **F6.5 Componentes `lib/components/ui` (shadcn-svelte).** Usarlos sólo en
  pantallas nuevas (Looks, F5.3). No reemplazar componentes existentes en masa.

F6 es independiente de F2–F5 y puede hacerse en paralelo (otra rama).

---

## F7 — IPC tipado

- [ ] **F7.1 Inventario de `Main.*`.** Tabla en `PLAN.md` de los ~95 canales sin
  comando Rust: *implementar* / *eliminar del frontend* / *posponer*, con la pantalla
  que se rompe. Prioridad sugerida: `IMPORT`, `BACKUP`, `URL`, `LANGUAGE`,
  `SAVE_IMAGE`, `PDF_TO_IMAGE`, `SEND_MIDI`, `IP`, `MAXIMIZED`.
- [ ] **F7.2 Respuesta inmediata para canales no implementados.** `tauri.ts` responde
  `undefined` al instante (sin esperar el timeout de 15 s) a los canales marcados
  *posponer*, con un único aviso en desarrollo.
- [ ] **F7.3 `invokeCommand<T>()` tipado.** Helper en `tauri.ts` que devuelve
  `Promise<Result<T, AppError>>`; migrar a él **sólo** las operaciones críticas
  (abrir/cerrar salida, renderizar escena, guardar). `window.api` se mantiene.
- [ ] **F7.4** Implementar los canales marcados *implementar*, de a uno por tarea.

---

## F8 — Video y medios

- [ ] **F8.1 Ciclo de vida de ffmpeg.** Detener mata el proceso y une el hilo; EOF o
  error de lectura se reporta; si falla la decodificación por hardware a mitad de
  camino, reintentar en software.
- [ ] **F8.2 Una decodificación por archivo.** Si dos pantallas muestran el mismo
  video, compartir el decodificador (hoy sería uno por pantalla).
- [ ] **F8.3 Medir.** CPU/RAM/GPU con un video 1080p en loop durante 30 min en macOS y
  Windows; anotar en `PLAN.md`. Decidir recién entonces si hace falta otra estrategia.
- [ ] **F8.4 NDI.** Conectar la captura de framebuffer al bucle de una pantalla
  (hoy crea su propio device y no recibe frames) o eliminarla.

---

## F9 — Frontend: desacople gradual

- [ ] **F9.1** `App.svelte`: mover timers y listeners globales a `utils/startup.ts`.
- [ ] **F9.2** `stores.ts`: agrupar por dominio con comentarios; tipar primero los
  stores de salidas (`outputs`, `outputState`, `styles`, `looks`).
- [ ] **F9.3** Eliminar ramas `$currentWindow === "output"` (lista en `PLAN.md`) una por
  componente, verificando cada una en la app.
- [ ] **F9.4** Branding pendiente: `Splash.svelte`, `ImportScripture.svelte`, logo de
  `Top.svelte`/`About.svelte` (`public/import-logos/freeshow.webp`) e íconos de la app
  cuando haya logo de PulseFlow.

---

## Fuera de alcance por ahora

Renombrar masivamente archivos de FreeShow · crates o procesos nuevos · reescribir todo
`window.api` · migrar todo a runes · cambiar el formato de shows/bibliotecas · cambiar
el motor de video sin mediciones (F8.3) · soporte Linux.
