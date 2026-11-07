# F23 — Núcleo: engine wgpu, backend y seguridad · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).
> Leer antes `docs/superpowers/plans/2026-11-06-guia-para-ejecutores.md`.

**Objetivo:** que PulseFlow no se cierre ni pierda datos durante un servicio, que el proyector muestre lo que el
operador armó y que la app no tenga agujeros de seguridad. Todo lo de este plan vive en Rust o en módulos TS sin UI,
así que **sobrevive a la migración a React** (plan F24).

**Arquitectura:** sin piezas nuevas grandes. Se endurece el engine (`src-tauri/src/render/`), se completa el contrato
de escena (`ScenePayload` ↔ `src/types/SceneGraph.ts`), se corrigen los servidores y el cierre, y se agrega la CSP.

**Stack:** Rust edición 2024 (Tauri 2.12, wgpu 30.0.1, glyphon 0.12, cosmic-text 0.19, image 0.25, Axum 0.8),
TypeScript, Vitest.

**Spec:** no hay spec aparte (el usuario decidió el 2026-11-06 seguir en Tauri, migrar la UI a React y arreglar el
engine). La base es la auditoría de abajo, hecha sobre el commit `ce97e756`.

---

## Auditoría 2026-11-06

### Línea base

| Chequeo | Resultado |
| --- | --- |
| `cargo check` | ✅ sin warnings |
| `cargo test --lib` | ✅ 177 ok, 1 ignorado (`bench_native_playback`, manual) |
| `cargo clippy --all-targets` | ⚠️ 60 warnings (51 con arreglo automático) |
| `bun run test:unit` | ✅ 201/201 (34 archivos) |
| `bun run test:svelte` | ⚠️ 40 errores (línea base) |
| `bun run test:budget` | ✅ 40 · 2652 `any` · 568 hex · 408 `rgb()` |

Los tests están en verde y aun así la app tiene los problemas de abajo: **ninguno lo cubre un test**.

### A. Engine: la app se puede cerrar sola en vivo

| # | Hallazgo | Evidencia | Tarea |
| --- | --- | --- | --- |
| A1 | Nadie registra `on_uncaptured_error`. El handler por defecto de wgpu 30 hace `panic!`, y el release usa `panic = "abort"`: **cualquier error de validación de la GPU cierra la app**. Además, con `abort` el `catch_unwind` de los workers no hace nada. | `~/.cargo/registry/.../wgpu-30.0.1/src/backend/wgpu_core.rs:692`; `src-tauri/Cargo.toml:65`; `render/workers.rs:44` | F23.3 |
| A2 | **Un solo renderer de texto para cuatro capas** en el mismo frame: slide, overlays, texto viejo de la transición y ✕. glyphon escribe los vértices en offset 0 y se aplican en el `submit`: las capas se pisan. Si el segundo texto es más largo, glyphon destruye el buffer que el primer draw ya grabó: error de validación, que con A1 cierra la app. Los goldens no lo ven porque `snapshot.rs:228` usa otro `TextEngine` para los overlays. | `render/screens/render_loop.rs:271,308,327,372`; `glyphon-0.12/src/text_render.rs:329-333` | F23.4 |
| A3 | Errores de texto descartados con `let _ =` y el atlas de glyphon nunca se recorta (no hay `atlas.trim()`). Cuando se llena, **el texto desaparece del proyector sin log**. | `render_loop.rs:271,308,327,372`; `render/text.rs` | F23.5 |
| A4 | `Rect::apply_to` pone el scissor sin recortarlo al destino. Un rect fuera del destino es error de validación (A1). | `render/frame.rs:45-48` | F23.6 |
| A5 | Se aceptan imágenes de hasta 16384 px por lado y se suben a resolución completa (16384² RGBA = 1 GiB de VRAM). Las texturas **nunca se liberan**. | `render/media.rs:191,397-410`; sólo existen `request_image` y `remove_video` | F23.7 |
| A6 | Un pánico en el hilo de render (`PulseFlow-Screen-*`) no se atrapa. | `render_loop.rs:41` | F23.3 |

### B. Datos y backend

| # | Hallazgo | Evidencia | Tarea |
| --- | --- | --- | --- |
| B1 | **Cerrar la ventana no guarda.** Botón rojo de macOS, ✕ de Windows o "Salir" del Dock cierran sin pasar por `initializeClosing`: no hay handler de `CloseRequested` ni de `ExitRequested`. Lo que no llegó al autosave (cada 15 min) se pierde. | `rg CloseRequested src-tauri/src` sin resultados; `src/frontend/utils/save.ts:342` | F23.8 |
| B2 | Servidores de red con la lógica invertida: abren `controller` (5512) y `output_stream` (5513) en `0.0.0.0`, que el usuario tiene **deshabilitados**, y no abren `remote`/`stage`. Sirven `resource_dir` o `public/` (los clientes web no se empaquetan). `/api/data` expone `password`. | `src-tauri/src/server/mod.rs:98-133,238`; `src/frontend/stores.ts:414` | F23.9 |
| B3 | La sincronización en la nube dice estar disponible (`CAN_SYNC` → `true`) y no hace nada. Hay 54 canales pospuestos que la UI llama y no hacen nada, sin aviso. | `commands/sync.rs`; `src/frontend/IPC/tauri.ts:106-160` | F23.22 |

### C. Seguridad

| # | Hallazgo | Evidencia | Tarea |
| --- | --- | --- | --- |
| C1 | XSS: el texto bíblico va con `{@html}` y `sanitizeVerseText` no saca etiquetas. Con CSP `null` y `assetProtocol.scope: ["**"]`, una biblia con `<img onerror>` puede leer cualquier archivo con `READ_FILE`. | `drawer/bible/scripture.ts:1763`; `Scripture.svelte:820,838,943`; `tauri.conf.json:26` | F23.10, F23.12 |
| C2 | `new Function("return " + valor)` en 4 lugares; en `apiHelper.ts:449` el valor viene de una acción de API. | `apiHelper.ts:449`, `timers.ts:132`, `stepper.svelte:29`, `number-field.svelte:50` | F23.11 |
| C3 | 56 `{@html}` en 43 archivos sin CSP. | `rg "\{@html" src/frontend` | F23.12 |
| C4 | **Los errores de los usuarios se envían al Sentry de FreeShow.** `main.ts` inicializa `@sentry/browser` en producción con el DSN que puso el autor de FreeShow (commit `118b1e37`, FreeShow 1.5.3), sin que el usuario lo pueda desactivar: el `autoErrorReporting` del comentario ya no existe. Los mensajes pueden llevar rutas con el nombre de usuario y nombres de shows. | `src/frontend/main.ts:3,19-28`; `git log -S o4510419080445952` | F23.23 |

### D. El proyector no muestra lo que armó el operador

| # | Hallazgo | Evidencia | Tarea |
| --- | --- | --- | --- |
| D1 | **Pausar o mover el video sólo afecta al audio.** El audio lo reproduce un `<audio>` del webview y el engine decodifica la imagen aparte. `SceneBackground` no tiene `paused` ni posición, y `UPDATE_VIDEO` se descarta. El proyector sigue corriendo y se desincroniza. | `render/scene.rs:101-117`; `tauri.ts:47,220`; `components/media/video/videoPlayer.ts:273` | F23.13, F23.14 |
| D2 | Un ítem reloj se calcula al armar la escena y nada la reenvía cada segundo si no hay un timer activo: es probable que **el reloj quede congelado** en el proyector. | `sceneGraph.ts:173-230`; `listeners.ts:167-173` | F23.15 |
| D3 | El engine ignora fondo, borde, esquinas redondeadas, opacidad y padding de los cuadros. | `SceneTextItem` en `render/scene.rs:189-219` | F23.16 |
| D4 | De 19 tipos de ítem (`Show.ts:671`), el engine dibuja `text`, `media` y `timer`/`clock` (como texto). `slide_tracker`, `events` y `variable` (legado) no salen. | `sceneGraph.ts:71,153,174` | F23.17 |
| D5 | Ignora espaciado entre letras, subrayado y tachado. | `sceneStyle.ts` sólo lee `font-style`, `line-height`, `text-shadow`, `text-transform` | F23.18 |
| D6 | El stage ignora los layouts del usuario: siempre dibuja reloj + slide actual + siguiente. | `render/stage.rs:15`; `sceneGraph.ts:462-495` | F23.19 |
| D7 | Un video **dentro** de una slide (ítem `media` de tipo video) no se reproduce: el engine sólo dibuja imágenes en ítems. | `render/scene.rs:175` ("el engine sólo dibuja imágenes por ahora") | F23.20 |
| D8 | Las transiciones `blur`, `scale` y `spin` caen a crossfade. | `render/scene.rs:143-146`; `render/transition.rs:30-38` | F23.21 |

### Fuera de este plan (van a "Deuda registrada" en F23.1)

Ítems `qr_code`, `icon`, `camera`, `web`, `visualizer`, `captions`, `metronome`, `current_output`, `chart`, `table`,
`weather`, `button` y el reloj analógico en el proyector · rotación de ítems · acordes en la salida · efectos
(`effectRenderer.ts`) · fondos PDF, PPT, captura de pantalla, NDI, cámara y reproductor (YouTube/Vimeo) · MIDI, OSC,
timecode, NDI y Blackmagic reales (hoy los comandos devuelven listas vacías o sólo guardan la configuración) ·
sincronización en la nube real · grabador · RTMP · clientes web de control remoto · color de fondo del stage ·
autoajuste de texto medido por el engine · lógica de negocio dentro de `commands/` (viola `AGENTS.md`; `files.rs` tiene
1081 líneas).

---

## Global Constraints

- Las reglas de `AGENTS.md` y de la guía para ejecutores.
- Sólo macOS y Windows. Sólo bun.
- Rust: nada de `unwrap`/`expect` fuera de `#[cfg(test)]`; `AppResult<T>`; locks de `render/sync.rs`.
- Todo struct que viaja por IPC tiene su espejo en `src/types/` y un test de (de)serialización en Rust con un JSON de
  ejemplo.
- **Campos nuevos del contrato de escena:** siempre opcionales, con `#[serde(default)]` y
  `skip_serializing_if` cuando valen el default. Así los fixtures de `src-tauri/tests/fixtures/scene/` y los goldens
  existentes **no cambian**.
- Un commit por tarea: `F23.n: …`. svelte-check ≤ 40; `test:budget` en verde; prettier sobre lo tocado.
- No cambiar el formato de archivos de usuario.
- Los `.svelte` sólo se tocan donde la tarea lo dice (la UI se migra en F24).

## Review Focus

1. **Overlay largo sobre una slide corta, con el mouse sobre la pantalla de salida** (para que aparezca la ✕): las
   tres capas se ven bien y no hay error de validación. Lo cubre `capas_de_texto_no_se_pisan` de F23.4.
2. **Laptop que se suspende con la salida abierta** (pérdida del device): la salida vuelve sola. Ya está implementado
   (`gpu.rs:71-90`); lo verifica la guía de F23.24 §2.
3. **Servicio de dos horas con muchas imágenes 4K distintas:** la memoria de video se estabiliza y nada desaparece
   del proyector. Lo cubren `presupuesto_expulsa_la_menos_usada` (F23.7) y la guía §3.
4. **Cerrar sin guardar con el popup "sin guardar" activado:** aparece el popup y, si se cancela, la app sigue
   abierta. Lo cubren F23.8 Step 6 y la guía §5.
5. **Biblia con palabras de Jesús en rojo y subtítulos:** se ven igual después del saneado. Lo cubre
   `verseHtml.test.ts` (F23.10).

---

### Task F23.1: Registrar los planes y poner al día la documentación

**Files:**
- Modify: `docs/ROADMAP.md` (tareas F10.9 l.952, F12.7 l.1106, F12.10 l.1109, F14.10 l.1570; "Deuda registrada"
  l.1742; secciones nuevas F23 y F24 antes de "Deuda registrada")
- Modify: `PLAN.md:58-100`
- Modify: `docs/README.md`

- [x] **Step 1:** en F10.9, F12.7, F12.10 y F14.10 cambiar `- [ ]` por `- [x]` y agregar al título:
  `**Cancelada (2026-11-06):** se resuelve al migrar esa pantalla a React (F24).` No borrar el texto existente.
  **F16.1 y F16.2 siguen vigentes** (la app sigue en Tauri).
- [x] **Step 2:** agregar `## F23 — Núcleo: engine, backend y seguridad` con
  `Plan: docs/superpowers/plans/2026-11-06-f23-nucleo-engine-y-backend.md` y un checkbox por tarea F23.1–F23.25
  (sólo el título). Después, `## F24 — Migración de la UI a React` con
  `Plan: docs/superpowers/plans/2026-11-06-f24-migracion-react.md` y un checkbox por tarea de ese plan.
- [x] **Step 3:** en "Deuda registrada" agregar una viñeta por cada punto de "Fuera de este plan" de arriba, copiando
  el texto.
- [x] **Step 4:** en `PLAN.md`, reemplazar el cuerpo de "Estado real (honesto)" y "Limitaciones reales" (desde l.58
  hasta antes de `## Fases`) por:
  `> Esta sección describía el estado al 2026-10-18 y quedó vieja. El estado vigente está en docs/ROADMAP.md (F23 y F24).`
- [x] **Step 5:** en `docs/README.md`, la fila de `PLAN-F12.md` pasa a
  `Plan de coherencia visual (F12), cerrado; lo pendiente se hace en React (F24).`. Agregar a "Dónde empezar" filas
  para los tres documentos de `superpowers/plans/` con fecha 2026-11-06.
- [x] **Step 6:** Run: `rg -n "^- \[ \] \*\*F(10\.9|12\.7|12\.10|14\.10)" docs/ROADMAP.md`. Expected: sin
  resultados. Run: `rg -c "2026-11-06-f2[34]" docs/ROADMAP.md docs/README.md`. Expected: ≥ 1 en cada uno.
- [x] **Step 7:** commit `F23.1: planes de F23 y F24 registrados y documentación al día`.

---

### Task F23.2: Clippy en cero y bloqueante en CI

**Files:** los de `src-tauri/src/` que toque `clippy --fix` (~30); `.github/workflows/ci.yml` (job Rust, después de
"Cargo check", ~l.85); `AGENTS.md` (fila "Rust" de la tabla de comandos)

- [x] **Step 1:** Run: `git worktree list`. Expected: sólo la carpeta principal. Si hay otras, **parar y preguntar**.
- [x] **Step 2:** Run: `cd src-tauri && cargo clippy --fix --lib --tests -p pulseflow --allow-dirty`.
- [x] **Step 3:** Run: `cd src-tauri && cargo clippy --all-targets 2>&1 | rg "^warning" | sort | uniq -c`. Expected:
  ~9 avisos.
- [x] **Step 4:** regla para cada aviso que queda: si el arreglo toca 10 líneas o menos, se arregla; si no,
  `#[allow(clippy::<lint>)]` sobre el ítem con un comentario de una línea que diga por qué. `too_many_arguments` en
  `render/` va con `allow`.
- [x] **Step 5:** Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test --lib && bash ../scripts/check-windows-video.sh`.
  Expected: todo verde, 177 tests.
- [x] **Step 6:** en `ci.yml`, después de "Cargo check":

  ```yaml
              - name: Cargo clippy
                working-directory: src-tauri
                run: cargo clippy --all-targets --locked -- -D warnings
  ```

  En `AGENTS.md`, fila Rust: `cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test --lib`.
- [x] **Step 7:** commit `F23.2: clippy sin avisos y bloqueante en CI`. Al subir, el job de **Windows** tiene que pasar;
  si clippy marca código `cfg(windows)`, se arregla con la regla del Step 4 en un commit `F23.2: …` aparte.

---

### Task F23.3: Un error de la GPU o un pánico no cierran la app

**Files:**
- Create: `src-tauri/src/render/guard.rs` (+ `pub mod guard;` en `render/mod.rs`)
- Modify: `src-tauri/src/render/gpu.rs` (en `with_device`, después de `set_device_lost_callback`, ~l.75)
- Modify: `src-tauri/src/render/screens/render_loop.rs` (cuerpo del hilo, l.41-385)
- Modify: `src-tauri/Cargo.toml:65` (`panic = "abort"` → `panic = "unwind"`)

**Interfaces:**
- Produce: `pub fn should_log(count: u64) -> bool` en `guard.rs`: `true` para los primeros 20 y después cada 100.
- Produce: `pub fn run_guarded(name: &str, body: impl FnOnce()) -> bool` en `guard.rs`: corre `body` con
  `std::panic::catch_unwind(AssertUnwindSafe(..))`. Si hubo pánico, `log::error!("[render] pánico en {name}: {msg}")`
  y devuelve `false`.
- Produce: `GpuContext::uncaptured_errors(&self) -> u64` (contador `Arc<AtomicU64>` dentro de `GpuContext`).

- [x] **Step 1: Tests que fallan** (en `guard.rs` y en `gpu.rs`):

```rust
// guard.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_log_limita_la_repeticion() {
        assert!((1..=20).all(should_log));
        assert!(!should_log(21));
        assert!(should_log(100));
        assert!(!should_log(150));
        assert!(should_log(200));
    }

    #[test]
    fn run_guarded_atrapa_el_panico() {
        assert!(run_guarded("test", || {}));
        assert!(!run_guarded("test", || panic!("boom")));
    }
}

// gpu.rs, dentro del mod tests existente (o uno nuevo con #[cfg(test)])
#[test]
fn un_error_de_validacion_no_panica_y_se_cuenta() {
    let gpu = GpuContext::new().expect("GPU");
    let before = gpu.uncaptured_errors();
    // MAP_READ | MAP_WRITE juntos es inválido sin la feature MAPPABLE_PRIMARY_BUFFERS: error de validación.
    let _buffer = gpu.device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("inválido a propósito"),
        size: 4,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::MAP_WRITE,
        mapped_at_creation: false,
    });
    assert_eq!(gpu.uncaptured_errors(), before + 1);
}
```

- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::guard render::gpu`. Expected: FAIL (no existen
  `guard`, `uncaptured_errors`; el test de GPU **panica** con "wgpu error").
- [x] **Step 3: Implementar.**
  - `gpu.rs`: `device.on_uncaptured_error(Arc::new(move |err: wgpu::Error| { let n = counter.fetch_add(1, SeqCst) + 1; if guard::should_log(n) { log::error!("[gpu] error no capturado #{n}: {err}"); } }))`.
    La firma en wgpu 30 es `on_uncaptured_error(&self, handler: Arc<dyn UncapturedErrorHandler>)` (`wgpu-30.0.1/src/api/device.rs:506`).
  - `Cargo.toml`: `panic = "unwind"`. Así `catch_unwind` funciona en release (también el de `workers.rs`).
  - `render_loop.rs`: todo el cuerpo del `spawn(move || { … })` pasa a `run_guarded(&label, || { … })`. Si devuelve
    `false`, se llama a la misma función `close()` que usa la ✕ (l.~118): la ventana se cierra, `Destroyed` emite
    `OUTPUT_STATE` y el operador ve la salida apagada y la puede reabrir.
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib && cargo clippy --all-targets -- -D warnings`. Expected: 180
  tests ok.
- [x] **Step 5:** commit `F23.3: los errores de GPU y los pánicos del render no cierran la app`.

---

### Task F23.4: Un renderer de texto por capa

**Files:**
- Modify: `src-tauri/src/render/text.rs` (`TextEngine`, l.64-215)
- Modify: `src-tauri/src/render/screens/render_loop.rs:271,308,327,372`
- Modify: `src-tauri/src/render/snapshot.rs:221-229` (usar un solo `TextEngine` con dos capas)
- Test: `src-tauri/src/render/text.rs` (`#[cfg(test)]`)

**Interfaces:**
- Produce: `pub enum TextLayer { Slide, Overlay, Previous, Chrome }` (`#[derive(Clone, Copy, Debug, PartialEq, Eq)]`).
- Produce: `TextEngine` con `renderers: [TextRenderer; 4]` (uno por capa, el mismo `TextAtlas`) y
  `pub fn render(&mut self, layer: TextLayer, device: &Device, queue: &Queue, render_pass: &mut RenderPass<'_>, screen_width: u32, screen_height: u32, blocks: &[TextBlock]) -> AppResult<()>`.
  La firma vieja (sin `layer`) desaparece.

Por qué: glyphon escribe los vértices de un `TextRenderer` con `queue.write_buffer(buffer, 0, …)`
(`glyphon-0.12/src/text_render.rs:329`), y eso se aplica en el `submit`. Dos `prepare` del mismo renderer en un frame
hacen que los dos draws usen los datos del último, y si el último es más grande, `vertex_buffer.destroy()` invalida
el primer draw.

- [x] **Step 1: Test que falla.** `capas_de_texto_no_se_pisan`: con `gpu::shared()`, una textura offscreen de
  320×180 (`Rgba8UnormSrgb`, `RENDER_ATTACHMENT | COPY_SRC`) y **un** render pass:
  - capa `Slide`: bloque "A" de 60 px, blanco, en x 10..60, y 10..80;
  - capa `Overlay`: bloque "OVERLAY LARGO" de 40 px, rojo, en x 10..310, y 110..170.

  Leer con `test_util::read_texture_bytes` y verificar que en la caja de la slide hay píxeles blancos (algún píxel
  con R, G, B > 200) y en la del overlay píxeles rojos (R > 200, G < 80). Además,
  `gpu.uncaptured_errors()` no cambió. Hasta que exista la API con `layer`, el test se escribe llamando dos veces a la
  `render` actual: tiene que fallar (o faltan los blancos o sube el contador).
- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::text::tests::capas_de_texto_no_se_pisan`. Expected: FAIL.
- [x] **Step 3: Implementar.** Crear los 4 `TextRenderer` en `TextEngine::new` y, en `render`, usar
  `self.renderers[layer as usize]`. Asignación en `render_loop.rs`: l.271 → `Slide`, l.308 → `Overlay`,
  l.327 → `Previous`, l.372 → `Chrome`. En `snapshot.rs`, un solo `TextEngine`, con `Slide` y `Overlay`.
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib`. Expected: todo verde, **goldens incluidos sin regenerar**.
- [ ] **Step 5: En la app:** un show con texto corto ("Amén") y un overlay con texto largo encendido; pasar el mouse
  sobre la pantalla de salida para que aparezca la ✕. Expected: se ven los tres textos y la app no se cierra.
- [x] **Step 6:** commit `F23.4: cada capa de texto tiene su renderer y no se pisan`.

---

### Task F23.5: El atlas de texto se recorta y los errores de texto se registran

**Files:** `src-tauri/src/render/text.rs`, `src-tauri/src/render/screens/render_loop.rs` (después de
`queue.present(frame)`, l.376; los cuatro `let _ = text_engine.render(…)`)

**Interfaces:**
- Consume: `guard::should_log` (F23.3), `TextLayer` (F23.4).
- Produce: `pub fn end_frame(&mut self)` en `TextEngine`, que llama a `self.atlas.trim()` (`glyphon-0.12/src/text_atlas.rs:334`).

- [x] **Step 1: Test que falla.** `muchos_tamanos_no_llenan_el_atlas`: con `gpu::shared()` y la misma textura
  offscreen de F23.4, 200 iteraciones (un pass y un `submit` por iteración) con un texto distinto
  (`format!("Texto {i}")`) a un tamaño distinto (`8.0 + i as f32 * 1.5`), llamando a `end_frame()` después de cada
  submit. Todas las llamadas a `render` devuelven `Ok`. Antes de implementar falla porque `end_frame` no existe.
- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::text::tests::muchos_tamanos_no_llenan_el_atlas`.
  Expected: FAIL al compilar.
- [x] **Step 3: Implementar** `end_frame`. En `render_loop.rs`, llamarla después de `queue.present(frame)`. Cambiar
  cada `let _ = text_engine.render(…)` por un `if let Err(err) = … { text_errors += 1; if should_log(text_errors) { log::error!("[render] texto ({layer:?}) en {label}: {err}"); } }`,
  con `text_errors: u64` local del hilo.
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib`. Expected: verde.
- [x] **Step 5:** commit `F23.5: el atlas de texto se recorta cada frame y los errores de texto quedan en el log`.

---

### Task F23.6: Viewport y scissor siempre dentro del destino

**Files:** `src-tauri/src/render/frame.rs:45-48` y sus llamadores (`rg -n "apply_to\(" src-tauri/src/render`)

**Interfaces:**
- Produce: `pub fn clamped(&self, target_width: u32, target_height: u32) -> Option<Rect>` (`None` si queda vacío).
- Produce: `pub fn apply_to(&self, pass: &mut wgpu::RenderPass<'_>, target_width: u32, target_height: u32) -> bool`:
  aplica el rect recortado y devuelve `false` si quedó vacío (el llamador no dibuja esa capa).

- [x] **Step 1: Tests que fallan** en `frame.rs`:

```rust
#[test]
fn clamped_recorta_lo_que_sale_del_destino() {
    let r = Rect { x: 100, y: 50, width: 300, height: 200 };
    assert_eq!(r.clamped(320, 180), Some(Rect { x: 100, y: 50, width: 220, height: 130 }));
}

#[test]
fn clamped_devuelve_none_si_queda_afuera_o_vacio() {
    assert_eq!(Rect { x: 400, y: 0, width: 10, height: 10 }.clamped(320, 180), None);
    assert_eq!(Rect { x: 0, y: 0, width: 0, height: 10 }.clamped(320, 180), None);
}
```

  Si `Rect` no deriva `PartialEq` y `Debug`, agregarlos.
- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::frame`. Expected: FAIL.
- [x] **Step 3: Implementar** y actualizar los llamadores pasando el tamaño del destino (`config.width/height` en el
  loop, el de la textura en `snapshot.rs`).
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib`. Expected: verde, goldens iguales.
- [x] **Step 5:** commit `F23.6: viewport y scissor se recortan al destino`.

---

### Task F23.7: Imágenes con tamaño máximo y presupuesto de memoria de video

**Files:** `src-tauri/src/render/media.rs` (`MediaTexture` l.40-48, `MAX_IMAGE_SIDE` l.191, `get` l.309,
`request_image` l.334, `decode_and_upload` l.397)

**Interfaces:**
- Produce: `const MAX_UPLOAD_SIDE: u32 = 4096;` La imagen se reduce (conservando la proporción, filtro `Triangle` de
  `image::imageops::resize`) si su lado mayor pasa de 4096. `MAX_IMAGE_SIDE` (16384) sigue como límite de lectura.
- Produce: `const DEFAULT_IMAGE_BUDGET: u64 = 1 << 30;` (1 GiB, decisión del planificador) y
  `pub fn with_image_budget(gpu: Arc<GpuContext>, budget_bytes: u64) -> Arc<Self>` (constructor para tests);
  `MediaStore::new` usa el default.
- Produce: `MediaTexture` con `pub bytes: u64` (`width * height * 4`) y `last_used: AtomicU64` (ms desde la creación
  del store); `get` y `request_image` lo actualizan.
- Produce: `fn evict_to_budget(&self)`, que se llama al final de cada `decode_and_upload`. Saca, de la menos usada a
  la más usada, las entradas con `Arc::strong_count == 1` (nadie más las tiene) hasta quedar dentro del presupuesto.
  Las que están en uso no se tocan, aunque el total quede por encima.

- [x] **Step 1: Tests que fallan** en `media.rs`, con el estilo de los tests existentes (`wait_until_settled`, l.875):
  - `imagen_grande_se_reduce_a_4096`: PNG de 6000×10 en una carpeta temporal → `Ready` con textura de 4096×7.
  - `presupuesto_expulsa_la_menos_usada`: `with_image_budget(gpu, 40 * 1024)`; cargar A, B y C de 64×64 (16 KiB cada
    una, sin guardar los `Arc`). A ya no está en `get`; B y C sí. Pedir A de nuevo hace subir `decodes()` en 1.
  - `no_expulsa_texturas_en_uso`: igual, pero guardando el `Arc` de A. Se expulsa B y A sigue.
- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::media`. Expected: FAIL.
- [x] **Step 3: Implementar.**
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib`. Expected: verde.
- [x] **Step 5:** commit `F23.7: las imágenes se reducen a 4096 px y las texturas tienen presupuesto de memoria`.

---

### Task F23.8: Cerrar la ventana o salir siempre pasa por el guardado

**Files:**
- Create: `src-tauri/src/app_close.rs` (+ `mod app_close;` en `lib.rs`)
- Modify: `src-tauri/src/lib.rs` (`tauri::Builder`: `.on_window_event(app_close::on_window_event)`; el final
  `.run(tauri::generate_context!())` de l.179 pasa a `.build(tauri::generate_context!())` + `.run(app_close::on_run_event)`,
  conservando el manejo de error actual)
- Modify: `src-tauri/src/commands/window.rs:17-21` (`CLOSE`)
- Modify: `src-tauri/src/state.rs` (`pub close_requested_at: Mutex<Option<Instant>>` en `AppState`)

**Interfaces:**
- Produce: `pub enum CloseDecision { AskFrontend, AllowNow }` y
  `pub fn close_decision(now: Instant, last_request: Option<Instant>) -> CloseDecision`: `AllowNow` si hubo otro
  pedido hace menos de 10 s (el frontend no respondió: no se puede dejar al usuario sin poder cerrar); si no,
  `AskFrontend`.
- Produce: `pub fn is_main_window(label: &str) -> bool` (`label == "main"`, la etiqueta de la ventana de
  `tauri.conf.json`).
- Produce: `pub fn exit_now(app: &AppHandle)`: `render::close_all_screens(app)` (detiene los decodificadores de video y
  cierra las salidas) y después `app.exit(0)`.

Flujo:
- `WindowEvent::CloseRequested` de la ventana `main`: siempre `api.prevent_close()`. Con `AskFrontend`, guardar
  `now` en `close_requested_at` y emitir `app.emit("MAIN", json!({ "channel": "CLOSE", "data": false }))` (mismo
  patrón que `commands/backup.rs:82`). El frontend ya lo atiende: `responsesMain.ts:190` → `initializeClosing`. Con
  `AllowNow`, `exit_now`.
- `RunEvent::ExitRequested { code: None, api, .. }` (Cmd+Q del Dock, apagado del sistema): igual. Con `code: Some(_)`
  (lo pidió `app.exit`), dejar salir.
- `CLOSE` (lo invoca `closeApp()` después de guardar, `save.ts:366`) pasa de `window.close()` a `exit_now(&app)`.
  Recibe `app: AppHandle` en vez de `WebviewWindow`.
- Las ventanas de salida (etiquetas distintas de `main`) no se interceptan.

- [x] **Step 1: Tests que fallan** en `app_close.rs`:

```rust
#[test]
fn primer_pedido_pregunta_al_frontend() {
    assert!(matches!(close_decision(Instant::now(), None), CloseDecision::AskFrontend));
}

#[test]
fn segundo_pedido_cercano_cierra_sin_esperar() {
    let now = Instant::now();
    let hace_3s = now.checked_sub(Duration::from_secs(3)).expect("reloj");
    assert!(matches!(close_decision(now, Some(hace_3s)), CloseDecision::AllowNow));
}

#[test]
fn pedido_viejo_vuelve_a_preguntar() {
    let now = Instant::now();
    let hace_15s = now.checked_sub(Duration::from_secs(15)).expect("reloj");
    assert!(matches!(close_decision(now, Some(hace_15s)), CloseDecision::AskFrontend));
}

#[test]
fn solo_la_ventana_principal() {
    assert!(is_main_window("main"));
    assert!(!is_main_window("native-output-abc"));
}
```

- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib app_close`. Expected: FAIL.
- [x] **Step 3: Implementar** el flujo de arriba.
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib && cargo clippy --all-targets -- -D warnings`. Expected: verde.
- [ ] **Step 5: En la app (macOS):** renombrar un show y cerrar **enseguida** con el botón rojo. Reabrir: el nombre
  nuevo está. Repetir con "Salir" del Dock. Con una salida de video abierta, después de cerrar,
  `pgrep -l ffmpeg` no muestra procesos.
- [ ] **Step 6: En la app:** activar el aviso de cambios sin guardar (`special.showClosePopup`) y cerrar con el botón
  rojo: aparece el popup; "Cancelar" deja la app abierta.
- [ ] **Step 7 (usuario, Windows):** repetir el Step 5 con la ✕ de la ventana; en el Administrador de tareas no queda
  ningún `ffmpeg.exe`.
- [x] **Step 8:** commit `F23.8: cerrar la ventana o salir pasa por el guardado`.

---

### Task F23.9: Servidores de red que respetan "deshabilitado"

**Files:** `src-tauri/src/server/mod.rs` (`static_root` l.98-119, `is_disabled` l.130-133, bucle de `start`
l.158-181, `api_data` l.238-240; nuevo `#[cfg(test)] mod tests` al final, hoy no tiene); `docs/ROADMAP.md`
("Deuda registrada")

**Interfaces:**
- Produce: `fn is_disabled(disabled: &Value, room: &str) -> bool` (true **sólo** si `disabled[room] == true`).
- Produce: `fn static_roots(app: &AppHandle) -> Vec<PathBuf>` (`resource_dir` y `current_dir`, en ese orden).
- Produce: `fn room_static_dir(roots: &[PathBuf], room: &str) -> Option<PathBuf>`.
- Produce: `fn public_room_data(data: &Value) -> Value`.

- [x] **Step 1: Tests que fallan:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn is_disabled_trata_true_como_deshabilitado() {
        let d = json!({ "remote": false, "stage": false, "controller": true, "output_stream": true });
        assert!(!is_disabled(&d, "remote"));
        assert!(!is_disabled(&d, "stage"));
        assert!(is_disabled(&d, "controller"));
        assert!(is_disabled(&d, "output_stream"));
        assert!(!is_disabled(&d, "sala_sin_configurar"));
    }

    #[test]
    fn room_static_dir_exige_index_html_de_la_sala() {
        let root = std::env::temp_dir().join("pulseflow-server-static");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("public/remote")).expect("public/remote");
        std::fs::write(root.join("public/remote/index.html"), "<html></html>").expect("index remote");
        std::fs::create_dir_all(root.join("stage")).expect("stage vacío");
        std::fs::write(root.join("index.html"), "<html></html>").expect("index raíz");
        let roots = vec![root.clone()];
        assert_eq!(room_static_dir(&roots, "remote"), Some(root.join("public/remote")));
        assert_eq!(room_static_dir(&roots, "stage"), None);
        assert_eq!(room_static_dir(&roots, "controller"), None);
    }

    #[test]
    fn public_room_data_no_expone_password() {
        assert_eq!(public_room_data(&json!({ "password": "1234", "name": "Iglesia" })), json!({ "name": "Iglesia" }));
        assert_eq!(public_room_data(&json!(null)), json!(null));
    }
}
```

- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib server::tests`. Expected: FAIL.
- [x] **Step 3: Implementar.**
  - `is_disabled` → `Some(true)`, y corregir el comentario.
  - `static_root` pasa a `static_roots` (sin los fallbacks a `build/`, a `public/` pelado ni a la raíz) más
    `room_static_dir`, que prueba `<root>/public/<room>` y después `<root>/<room>`, y acepta sólo carpetas con
    `index.html`.
  - En `start`, sin carpeta: `log::info!("[server] {room}: sin cliente web empaquetado, no se abre el puerto {port}")`
    y `continue`.
  - `api_data` → `Json(public_room_data(&shared.data))` (quita `password` del primer nivel).
  - `WEBSOCKET_START` pasa por `start` y hereda la regla.
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib`. Expected: verde.
- [ ] **Step 5: En la app:** con la app abierta, Run: `lsof -nP -iTCP -sTCP:LISTEN | rg ":551[0-3]"` (macOS) o
  `netstat -ano | findstr ":551"` (Windows). Expected: nada escuchando. En `pulseflow.log`, dos líneas
  `[server] remote: sin cliente web…` y `[server] stage: …`.
- [x] **Step 6:** en "Deuda registrada":
  `- WEBSOCKET_START ignora password y nadie escucha SERVER_MESSAGE. Al revivir los clientes web o Companion: autenticar en Rust antes de emitir (F23.9).`
- [x] **Step 7:** commit `F23.9: los servidores respetan deshabilitado y no abren puertos sin cliente web`.

---

### Task F23.10: El texto bíblico sólo deja pasar etiquetas conocidas

**Files:**
- Create: `src/frontend/components/drawer/bible/verseHtml.ts` (sin imports) y `verseHtml.test.ts`
- Modify: `src/frontend/components/drawer/bible/scripture.ts` (borrar `tokenizeHtml` l.1624-1636 y
  `sanitizeVerseText` l.1763-1774; importarlas de `./verseHtml`; agregar
  `export { sanitizeVerseText } from "./verseHtml"`, porque la importa `Scripture.svelte:25`)

**Interfaces:**
- Produce: `export function sanitizeVerseText(input: unknown): string` y
  `export function tokenizeHtml(value: string): VerseToken[]`, con
  `export interface VerseToken { type: VerseTokenType; value: string }` y
  `export const VERSE_TOKEN_TYPE = { TEXT: "text", TAG: "tag" } as const` (patrón de constantes de
  `AGENTS.md`/TypeScript).

- [x] **Step 1: Test que falla:**

```ts
import { describe, expect, it } from "vitest"
import { sanitizeVerseText } from "./verseHtml"

describe("sanitizeVerseText", () => {
    it("conserva las palabras de Jesús y los subtítulos", () => {
        expect(sanitizeVerseText('<span class="wj">Yo soy</span>')).toBe('<span class="wj">Yo soy</span>')
        expect(sanitizeVerseText("<h4>Título</h4> En el principio")).toBe('<span class="undertitle">Título </span>En el principio')
    })
    it("convierte <q> en comillas y <br> en espacio", () => {
        expect(sanitizeVerseText("dijo: <q>Hola</q><br>fin")).toBe("dijo: “Hola” fin")
    })
    it("quita etiquetas no permitidas y deja su texto", () => {
        expect(sanitizeVerseText("Hola <img src=x onerror=alert(1)>mundo")).toBe("Hola mundo")
        expect(sanitizeVerseText("<script>alert(1)</script>Juan")).toBe("alert(1)Juan")
        expect(sanitizeVerseText('<span class="wj" onclick="x">a</span>')).toBe("a")
        expect(sanitizeVerseText('<a href="javascript:x">b</a>')).toBe("b")
    })
    it("escapa < y > sueltos", () => {
        expect(sanitizeVerseText("a <img src=x onerror=alert(1)//")).toBe("a &lt;img src=x onerror=alert(1)//")
        expect(sanitizeVerseText("1 < 2 > 0")).toBe("1 &lt; 2 &gt; 0")
    })
    it("permite énfasis sin atributos", () => {
        expect(sanitizeVerseText("<i>Señor</i> <sup>3</sup>")).toBe("<i>Señor</i> <sup>3</sup>")
    })
    it("devuelve vacío para valores vacíos", () => {
        expect(sanitizeVerseText(undefined)).toBe("")
        expect(sanitizeVerseText(null)).toBe("")
    })
})
```

- [x] **Step 2:** Run: `bunx vitest run --config config/testing/vitest.config.mts src/frontend/components/drawer/bible/verseHtml.test.ts`.
  Expected: FAIL.
- [x] **Step 3: Implementar.**
  - `tokenizeHtml`: como la actual, pero con la regex `/<\/?[a-z][^>]*>/gi`: sólo es etiqueta lo que empieza con letra.
  - `sanitizeVerseText`: primero las transformaciones de hoy, en el mismo orden (`<br>` → espacio, ` ` →
    espacio, `<q>` → comillas, `<h4>` → `<span class="undertitle">`, espacios múltiples → uno). Después recorre los
    tokens:
    - `/^<\/?(i|em|b|strong|sup|sub)>$/i`: se conserva;
    - `<span class="wj">` o `<span class="undertitle">` exactos: se conservan y suman 1 a la profundidad;
    - `</span>`: sólo si la profundidad es mayor que 0 (y resta 1);
    - cualquier otra etiqueta: se descarta y queda su texto;
    - en los tramos de texto, `<` → `&lt;` y `>` → `&gt;` (`&` no se toca);
    - al final, `trim()`.
  - Si una biblia real pierde un formato legítimo, se agrega **su etiqueta exacta** a la lista, con su caso en el
    test. Nunca un comodín.
- [x] **Step 4:** Run: `bun run test:unit && bun run test:svelte && bun run test:budget` y prettier sobre los 3 archivos.
  Expected: 207 tests; svelte-check ≤ 40.
- [ ] **Step 5: En la app:** Scripture con una biblia con palabras en rojo → el rojo se ve; crear una slide desde un
  versículo → el texto está. Si no hay una biblia así, anotarlo en el commit.
- [x] **Step 6:** commit `F23.10: el texto bíblico sólo deja pasar etiquetas conocidas`.

---

### Task F23.11: Cálculos sin `new Function`

**Files:**
- Create: `src/frontend/utils/safeMath.ts` y `safeMath.test.ts`
- Modify: `src/frontend/components/actions/apiHelper.ts:446-449`, `src/frontend/components/drawer/timers/timers.ts:131-135`,
  `src/frontend/lib/components/ui/stepper/stepper.svelte:27-31`,
  `src/frontend/lib/components/ui/number-field/number-field.svelte:50`

**Interfaces:**
- Produce: `export function evaluateArithmetic(expression: string): number | null`

- [x] **Step 1: Test que falla:**

```ts
import { describe, expect, it } from "vitest"
import { evaluateArithmetic } from "./safeMath"

describe("evaluateArithmetic", () => {
    it("calcula con precedencia y paréntesis", () => {
        expect(evaluateArithmetic("2+3*4")).toBe(14)
        expect(evaluateArithmetic("(2+3)*4")).toBe(20)
        expect(evaluateArithmetic("-3+5")).toBe(2)
        expect(evaluateArithmetic("10/4")).toBe(2.5)
        expect(evaluateArithmetic("7%3")).toBe(1)
        expect(evaluateArithmetic(" 1.5 * 2 ")).toBe(3)
        expect(evaluateArithmetic(".5+.5")).toBe(1)
        expect(evaluateArithmetic("1920/2")).toBe(960)
        expect(evaluateArithmetic("--2")).toBe(2)
    })
    it("devuelve null ante cualquier cosa que no sea aritmética", () => {
        for (const bad of ["", "2+", "alert(1)", "2**3", "((1)", "1)", "1e3", "a+1", "1/0", "0/0", "constructor"]) {
            expect(evaluateArithmetic(bad)).toBeNull()
        }
    })
})
```

- [x] **Step 2:** Run: `bunx vitest run --config config/testing/vitest.config.mts src/frontend/utils/safeMath.test.ts`.
  Expected: FAIL.
- [x] **Step 3: Implementar** por descenso recursivo. Los espacios entre tokens se ignoran; cualquier otro carácter,
  entrada sobrante o resultado no finito devuelve `null`:

  ```
  expr   := term (("+" | "-") term)*
  term   := factor (("*" | "/" | "%") factor)*
  factor := ("+" | "-") factor | number | "(" expr ")"
  number := digits ("." digits)? | "." digits
  ```

- [x] **Step 4:** en los 4 lugares, `new Function(`return ${x}`)()` → `evaluateArithmetic(String(x))`. **Regla:** el
  `null` sigue exactamente el camino que hoy sigue el `catch` (o el valor inválido) de ese lugar: leer cada
  `try/catch` antes de cambiarlo. Borrar los `// eslint-disable-next-line` que queden sin uso.
- [x] **Step 5:** Run: `rg -n "new Function\(" src/frontend`. Expected: nada. Correr los chequeos JS y prettier sobre
  los 6 archivos.
- [ ] **Step 6: En la app:** en un campo numérico con stepper, `1920/2` + Enter → `960`; `abc` → vuelve al valor
  anterior.
- [x] **Step 7:** commit `F23.11: los cálculos de campos y acciones no ejecutan código`.

---

### Task F23.12: Content Security Policy

**Files:** `src-tauri/tauri.conf.json:25-33`

**Interfaces:**
- Consume: F23.11 (sin `new Function` no hace falta `unsafe-eval`).

- [x] **Step 1:** reemplazar `"csp": null` por la política de abajo. `devCsp` es igual, salvo `connect-src`, que
  suma `ws://127.0.0.1:1420 ws://localhost:1420` para la recarga de Vite (el `devUrl` es `http://127.0.0.1:1420`).

  ```json
  "csp": {
      "default-src": "'self' ipc: http://ipc.localhost",
      "script-src": "'self'",
      "style-src": "'self' 'unsafe-inline'",
      "img-src": "'self' asset: http://asset.localhost data: blob: https:",
      "media-src": "'self' asset: http://asset.localhost data: blob: https:",
      "font-src": "'self' asset: http://asset.localhost data:",
      "connect-src": "'self' ipc: http://ipc.localhost asset: http://asset.localhost https: wss:",
      "worker-src": "'self' blob:",
      "frame-src": "https:",
      "object-src": "'none'"
  }
  ```

  `assetProtocol.scope: ["**"]` se queda: los medios están donde el usuario los elija. Lo que frena un `{@html}`
  inyectado es que `script-src` no tiene `unsafe-inline`.
- [ ] **Step 2: En la app (obligatorio):** `bun run dev:tauri` con DevTools abiertas y la consola filtrada por
  `Content Security Policy`. Recorrer: un show con fondo de imagen y otro con video (vista previa y salida),
  miniaturas del cajón de medios, búsqueda en Pixabay o Unsplash, descargar una biblia, importar un PDF, una fuente
  personalizada y un ítem web si hay. Expected: todo carga y **no hay violaciones**. Si un uso legítimo choca, sumar
  el origen mínimo a la directiva y anotarlo en el commit. **Nunca** `unsafe-inline` ni `unsafe-eval` en
  `script-src`.
- [ ] **Step 3:** `bun run build`, abrir el build de release y repetir 2 o 3 puntos del Step 2 (en release el origen
  cambia).
- [x] **Step 4:** commit `F23.12: la app declara una Content Security Policy`.

---

### Task F23.13: Video: pausa, posición y salto en los decodificadores

**Files:**
- Modify: `src-tauri/src/render/video/mod.rs:50-53` (trait), `video/pacing.rs`, `video/ffmpeg.rs`, `video/avf.rs`,
  `video/mf.rs`, `render/screens/video_hub.rs` (`SharedVideo`)
- Create: `src-tauri/tests/fixtures/video/solid_red_64_3s.mp4` con
  `ffmpeg -f lavfi -i color=red:s=64x64:d=3:r=30 -c:v libx264 -pix_fmt yuv420p -movflags +faststart src-tauri/tests/fixtures/video/solid_red_64_3s.mp4`

**Interfaces:**

```rust
pub trait VideoDecoder: Send {
    fn stop(&mut self);
    fn set_paused(&mut self, paused: bool);
    fn seek(&mut self, position_ms: u64) -> AppResult<()>;
    /// PTS en ms del último frame entregado.
    fn position_ms(&self) -> u64;
}
```

`SharedVideo` (video_hub) expone los mismos tres métodos y se los pasa a su `playback`.

Cómo, por decodificador:
- `pacing.rs`: estado `paused: Arc<AtomicBool>` y `position_ms: Arc<AtomicU64>`. En pausa, el bucle de entrega espera
  de a 10 ms sin entregar frames, y el origen del reloj se corre lo que duró la pausa (al reanudar no salta).
  `position_ms` se actualiza en cada frame entregado.
- `ffmpeg.rs`: `seek` detiene el proceso y lo relanza con `-ss <segundos>` **antes** de `-i`; el contador de PTS sigue
  desde la posición pedida.
- `avf.rs`: `seek` reabre el `AVAssetReader` con `timeRange` desde la posición hasta el final. El loop sigue igual.
- `mf.rs`: `seek` llama a `IMFSourceReader::SetCurrentPosition` con la posición en unidades de 100 ns
  (`position_ms * 10_000`) y `GUID_NULL`. No se puede ejecutar desde macOS: se valida con `check-windows-video.sh` y en
  la guía (F23.24 §2).

- [x] **Step 1: Tests que fallan** (en `ffmpeg.rs` y en `avf.rs`, con un `FrameSink` de test que cuenta frames, como
  los tests existentes de esos archivos; si no hay ffmpeg, se saltan como los demás):
  - `pausa_detiene_los_frames`: arrancar con el fixture de 3 s; a los 300 ms, `set_paused(true)`; anotar la cuenta;
    esperar 300 ms → la cuenta no cambió; `set_paused(false)`; esperar 300 ms → subió.
  - `seek_salta_a_la_posicion`: `seek(1500)`; en menos de 1 s, `position_ms()` está entre 1500 y 2500.
  - `position_avanza_en_tiempo_real`: después de 1 s reproduciendo, `position_ms()` está entre 750 y 1250.
- [x] **Step 2:** Run: `cd src-tauri && cargo test --lib render::video`. Expected: FAIL (los métodos no existen).
- [x] **Step 3: Implementar** según "Cómo".
- [x] **Step 4:** Run: `cd src-tauri && cargo test --lib && bash ../scripts/check-windows-video.sh`. Expected: verde.
- [x] **Step 5:** commit `F23.13: los decodificadores de video se pausan, saltan y reportan su posición`.

---

### Task F23.14: El video del proyector sigue al transporte

**Files:**
- Modify: `src-tauri/src/render/scene.rs:101-117` (`SceneBackground`) y donde se arma `BackgroundMedia`
  (`scene.rs:336`, `render/types.rs:140-176`)
- Modify: `src-tauri/src/render/screens/video_hub.rs` (`sync_video`, l.9)
- Create: `src/frontend/components/helpers/videoSync.ts` y `videoSync.test.ts`
- Modify: `src/types/SceneGraph.ts` (`SceneBackground`), `src/frontend/components/helpers/sceneGraphPayload.ts:50`
  (`sceneBackground`), `src/frontend/components/helpers/sceneGraph.ts:290`, `src/frontend/utils/listeners.ts`

**Interfaces:**
- Rust: en `SceneBackground`, `#[serde(default, skip_serializing_if = "std::ops::Not::not")] pub paused: bool` y
  `#[serde(default, skip_serializing_if = "Option::is_none")] pub position_ms: Option<u64>` (JSON `positionMs`).
- Rust: `pub fn sync_action(decoder_ms: u64, wanted_ms: Option<u64>, threshold_ms: u64) -> Option<u64>` en
  `video_hub.rs`: `Some(wanted)` si la diferencia pasa el umbral. Umbral: `const SYNC_THRESHOLD_MS: u64 = 300;`.
- TS: `export interface SceneBackground` suma `paused?: boolean` y `positionMs?: number`.
- TS: `export function videoSyncFields(state: PlayingVideoState | undefined): VideoSyncFields`, con
  `export interface VideoSyncFields { paused?: boolean; positionMs?: number }` (`{}` si no hay estado;
  `positionMs = Math.round(state.currentTime * 1000)`; `paused` sólo si es `true`).
- TS: `export function shouldResendForVideo(prev: VideoSyncFields | undefined, next: VideoSyncFields, lastSentAt: number, now: number): boolean`:
  `true` si cambió `paused`, o si pasaron 1000 ms o más desde el último envío y hay `positionMs`.

Reloj maestro: **el audio del webview**. El engine lo sigue: en cada escena con video, `set_paused(paused)` y, si
`sync_action` devuelve `Some(ms)`, `seek(ms)`. Esto corrige a la vez los saltos de la línea de tiempo y la deriva.
La clave de `playingVideoState` es `` `${path}_${outputId}` `` (`videoPlayer.ts:512`).

- [x] **Step 1: Tests que fallan.**
  - Rust `sync_action_respeta_el_umbral`: `(1000, Some(1100), 300)` → `None`; `(1000, Some(2000), 300)` →
    `Some(2000)`; `(1000, None, 300)` → `None`.
  - Rust `fondo_con_pausa_y_posicion_se_deserializa`:
    `{"path":"a.mp4","type":"video","paused":true,"positionMs":1500}` → `paused == true`, `position_ms == Some(1500)`;
    sin esos campos → `false` y `None`; serializar el default no escribe ninguno de los dos.
  - TS `videoSync.test.ts`: `videoSyncFields(undefined)` → `{}`;
    `videoSyncFields({ currentTime: 1.5, duration: 3, paused: true, loop: false, muted: false })` →
    `{ paused: true, positionMs: 1500 }`; `shouldResendForVideo` → `true` al cambiar `paused`, `false` a los 400 ms
    sin cambios, `true` a los 1000 ms.
- [x] **Step 2:** correr los tres. Expected: FAIL.
- [x] **Step 3: Implementar.** `sceneGraph.ts:290` suma `...videoSyncFields(get(playingVideoState)[`${path}_${outputId}`])`
  a `sceneBackground({...})`. En `listeners.ts`, `playingVideoState.subscribe` → para cada salida con video, si
  `shouldResendForVideo(...)` da `true`, `sendOutputScenes()` (el último envío y los últimos campos se guardan en un
  `Map` del módulo).
- [x] **Step 4:** chequeos Rust y JS en verde; los fixtures de escena sin cambios (`git diff --stat src-tauri/tests`
  vacío).
- [ ] **Step 5: En la app:** un video de fondo con sonido en vivo. Pausa → la imagen se congela; play → sigue; mover
  la línea de tiempo → la imagen salta al mismo lugar; después de 5 minutos, el audio y la imagen siguen juntos.
- [x] **Step 6:** commit `F23.14: el video del proyector sigue la pausa y la posición del transporte`.

---

### Task F23.15: El reloj del proyector avanza

**Files:** `src/frontend/components/helpers/sceneGraph.ts` (`buildTimerItem` l.173, `sendOutputScenes` l.530),
`src/frontend/utils/listeners.ts`

**Interfaces:**
- Produce: `export function scenesHaveClock(): boolean` en `sceneGraph.ts`. Lo devuelve una variable del módulo que
  `sendOutputScenes` pone en `false` al empezar y `buildTimerItem` pone en `true` cuando arma un ítem `clock`.

- [ ] **Step 1: Reproducir antes de tocar nada.** En la app, una slide con un ítem reloj digital (sin timers
  corriendo), en vivo. Esperar 70 s. Si **cambia el minuto** en el proyector, el bug no existe: anotarlo en el
  roadmap y cerrar la tarea sin código.
- [x] **Step 2: Implementar** (sólo si se congeló). `scenesHaveClock` y, en `listeners.ts`,
  `setInterval(() => { if (scenesHaveClock()) sendOutputScenes() }, 1000)`.
- [ ] **Step 3:** repetir el Step 1. Expected: el reloj avanza. `bun run test:unit` y `test:svelte` en verde.
- [x] **Step 4:** commit `F23.15: el reloj del proyector se actualiza cada segundo`.

---

### Task F23.16: Fondo, borde, esquinas, opacidad y padding de los cuadros

**Files:**
- Create: `src-tauri/src/render/shapes.rs` (pipeline de rectángulos redondeados) y
  `src-tauri/src/render/shaders/rounded_rect.wgsl`
- Modify: `src-tauri/src/render/scene.rs` (`SceneTextItem` l.189, `SceneMediaItem`), `render/screens/render_loop.rs`
  (dibujar la caja antes del contenido de cada ítem), `render/golden.rs` (golden nuevo)
- Modify: `src/types/SceneGraph.ts`, `src/frontend/components/helpers/sceneStyle.ts` (+ `sceneStyle.test.ts`),
  `sceneGraphPayload.ts` (`sceneTextItem` l.71, `sceneMediaItem` l.95), `sceneGraph.ts` (`buildTextItem` l.70,
  `buildMediaItem` l.152)

**Interfaces:**
- TS: `export interface SceneBoxStyle { background?: SceneColor; borderColor?: SceneColor; borderWidth?: number; radius?: number; opacity?: number; padding?: ScenePadding }`
  y `export interface ScenePadding { top: number; right: number; bottom: number; left: number }`. `SceneTextItem` y
  `SceneMediaItem` suman `box?: SceneBoxStyle`.
- TS: `export function parseBoxStyle(style: string | undefined): SceneBoxStyle | undefined` (`undefined` si no hay
  ninguna propiedad), con `parseCssColor` (`sceneStyle.ts:20`) para los colores. Lee: `background-color` y
  `background` (sólo el color), `border` (`<n>px <estilo> <color>`; todo estilo se trata como `solid`),
  `border-radius` (un valor en px), `opacity` (0–1), `padding` (1 a 4 valores en px, orden CSS).
- Rust: `pub struct SceneBox` (mismos campos, `#[serde(rename_all = "camelCase")]`, todos `Option`) y en los dos
  ítems `#[serde(default, rename = "box", skip_serializing_if = "Option::is_none")] pub box_style: Option<SceneBox>`.
- Rust `shapes.rs`: `pub struct ShapePipeline` con
  `pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self` y
  `pub fn draw_rounded_rect(&self, device: &wgpu::Device, queue: &wgpu::Queue, arena: &mut LayerArena, pass: &mut wgpu::RenderPass<'_>, rect: [f32; 4], fill: [f32; 4], border: [f32; 4], border_width: f32, radius: f32, target: (u32, u32))`.
  Los uniforms van en la `LayerArena` (como las capas de `media.rs`).
- Shader (función de distancia de una caja redondeada; `p` = píxel − centro, `b` = medio tamaño, `r` = radio):

  ```
  q = abs(p) - b + r
  d = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r
  outer = clamp(0.5 - d, 0.0, 1.0)
  inner = clamp(0.5 - (d + border_width), 0.0, 1.0)
  color = mix(border, fill, inner); alpha = color.a * outer
  ```

- Semántica: la caja se dibuja antes del texto o del medio del ítem; `opacity` multiplica el alfa de la caja, del
  texto y del medio; `padding` achica el rect del texto (la caja ocupa el rect completo).

- [ ] **Step 1: Tests que fallan.**
  - `sceneStyle.test.ts` `parseBoxStyle`:
    `"background-color: rgba(255,0,0,0.5);border: 4px solid #00ff00;border-radius: 20px;opacity: 0.8;padding: 10px 20px;"` →
    `{ background: [1,0,0,0.5], borderColor: [0,1,0,1], borderWidth: 4, radius: 20, opacity: 0.8, padding: { top: 10, right: 20, bottom: 10, left: 20 } }`;
    `"top: 10px; left: 5px;"` → `undefined`.
  - Rust `caja_se_deserializa_y_se_omite_si_falta`: un ítem con `"box": { "background": [1,0,0,1], "radius": 8 }`
    deserializa; uno sin `box` serializado no escribe la clave.
  - Rust golden `golden_caja_con_fondo_borde_y_esquinas`: escena de 320×180 con un ítem de texto "Hola" en
    `x 40, y 40, w 240, h 100`, fondo rojo, borde verde de 4 px y radio 20. Además del golden, píxeles exactos: centro
    de la caja rojo, `(42, 90)` verde, `(40, 40)` (la esquina) del color de fondo de la escena.
- [ ] **Step 2:** correr los tests. Expected: FAIL.
- [ ] **Step 3: Implementar** y generar el golden nuevo con `UPDATE_ENV` (sólo ese). Los goldens viejos **no se
  regeneran**: si alguno cambia, hay un bug.
- [ ] **Step 4:** todos los chequeos en verde.
- [ ] **Step 5: En la app:** un cuadro con fondo semitransparente, borde y esquinas redondeadas se ve igual en la vista
  previa y en el proyector.
- [ ] **Step 6:** commit `F23.16: el proyector dibuja fondo, borde, esquinas, opacidad y padding de los cuadros`.

---

### Task F23.17: Contador de slides, eventos y variables en el proyector

**Files:**
- Create: `src/frontend/components/helpers/dynamicItemText.ts` y `dynamicItemText.test.ts`
- Modify: `src/frontend/components/slide/views/SlideProgress.svelte`, `views/DynamicEvents.svelte`,
  `views/Variable.svelte` (usan las funciones nuevas en vez de su cálculo interno; el marcado y los estilos no cambian)
- Modify: `src/frontend/components/helpers/sceneGraph.ts` (`buildSlideItems` l.310: los tres tipos se arman como
  `SceneTextItem` con la caja y el estilo de texto del ítem, igual que `buildTimerItem`)

**Interfaces (los parámetros salen de lo que hoy lee cada `.svelte`; si cada uno lee algo más, se suma como
parámetro, nunca como `get(store)` dentro de la función pura):**
- `export function slideTrackerText(tracker: SlideTrackerOptions, current: number, total: number): string | null`
  (`null` para los modos que no son texto, por ejemplo una barra: ese modo queda en "Deuda registrada").
- `export function eventsText(events: DynamicEventsOptions, list: CalendarEvent[], now: Date): string`
- `export function variableText(variable: VariableValue | undefined): string`

Los tipos `SlideTrackerOptions`, `DynamicEventsOptions`, `CalendarEvent` y `VariableValue` se definen en el mismo
archivo (o se importan de `src/types/` si ya existen), como interfaces planas.

- [ ] **Step 1: Inventario.** Leer los tres `.svelte` y anotar en el encabezado de `dynamicItemText.ts` qué calcula cada
  uno y con qué datos.
- [ ] **Step 2: Tests que fallan** en `dynamicItemText.test.ts`: por lo menos 3 casos por función, con los formatos
  exactos que muestra hoy la vista previa (por ejemplo, la slide 3 de 12 con el formato numérico da el mismo texto
  que muestra `SlideProgress.svelte`).
- [ ] **Step 3: Implementar**, mover los `.svelte` a las funciones y armar los ítems en `sceneGraph.ts`.
- [ ] **Step 4:** chequeos JS en verde; svelte-check ≤ 40.
- [ ] **Step 5: En la app:** los tres ítems se ven en la vista previa **igual que antes** y ahora también en el
  proyector.
- [ ] **Step 6:** commit `F23.17: contador de slides, eventos y variables llegan al proyector`.

---

### Task F23.18: Espaciado entre letras, subrayado y tachado

**Files:** `src-tauri/src/render/text.rs` (`block_attrs` l.284, layout), `render/scene.rs` / `render/types.rs`
(`TextSpan`, `TextBlock`), `src/types/SceneGraph.ts` (`SceneTextSpan`, `SceneTextItem`),
`src/frontend/components/helpers/sceneStyle.ts` (+ test)

**Interfaces:**
- TS: `SceneTextSpan` suma `underline?: boolean` y `strike?: boolean`; `SceneTextItem` suma `letterSpacing?: number`
  (px). `parseTextStyle` lee `letter-spacing` (px) y `text-decoration` / `text-decoration-line` (`underline`,
  `line-through`).
- Rust: los mismos campos (opcionales, se omiten si faltan).
- Espaciado: `Attrs::letter_spacing(px / font_size)`. cosmic-text 0.19 lo recibe en **em** (verificado en docs.rs).
- Subrayado y tachado: glyphon 0.12 **no** los dibuja. Se dibujan con `ShapePipeline` (F23.16) como rectángulos sin
  radio. Cada tramo se marca con `Attrs::metadata(índice del tramo)`. Al recorrer `buffer.layout_runs()`, los glifos
  seguidos del mismo tramo decorado forman un rectángulo de `glyph.x` al final del último glifo:
  - subrayado: `y = run.line_y + font_size * 0.12`;
  - tachado: `y = run.line_y - font_size * 0.30`;
  - grosor `max(1.0, font_size / 16.0)`, del color del tramo.

- [ ] **Step 1: Tests que fallan:** `sceneStyle.test.ts` (`"letter-spacing: 4px; text-decoration: underline;"` →
  `letterSpacing: 4` y tramos con `underline: true`); Rust `golden_texto_subrayado` (texto "Hola" subrayado, 320×180:
  hay píxeles del color del texto en la franja de 3 px debajo de la línea base, y no los hay sin subrayado).
- [ ] **Step 2:** correr. Expected: FAIL.
- [ ] **Step 3: Implementar.** Golden nuevo con `UPDATE_ENV` (sólo ese).
- [ ] **Step 4:** chequeos en verde; goldens viejos sin cambios.
- [ ] **Step 5:** commit `F23.18: el proyector dibuja espaciado entre letras, subrayado y tachado`.

---

### Task F23.19: El stage usa los layouts del usuario

**Files:**
- Create: `src/frontend/components/helpers/stageScene.ts` y `stageScene.test.ts`
- Modify: `src/frontend/components/helpers/sceneGraph.ts:462-495` (`buildStageScene`)
- Modify: `src-tauri/src/render/screens/render_loop.rs:267` (la rama `ScreenKind::Stage`)

**Interfaces:**
- `export function buildStageItems(layout: StageLayout, ctx: StageContext): SceneItem[]`, con
  `export interface StageContext { resolution: SceneResolution; slideTexts: string[]; slideNotes: string[]; currentIndex: number; clockText: string; timerTexts: Record<string, string>; variableTexts: Record<string, string>; trackerText: string | null }`
  (`slideTexts[i]` es el texto plano de la slide `i` del layout activo, ya armado con `plainTextOf`).
- Tipo de cada ítem del layout: `item.type`; si falta, se deduce de la clave igual que
  `src/frontend/components/stage/stage.ts:40-95`.

| Tipo | Qué dibuja |
| --- | --- |
| `slide_text` | `slideTexts[currentIndex + (slideOffset ?? 0)]`; con `lineCount`, sólo esas líneas |
| `slide_notes` | `slideNotes[currentIndex + (slideOffset ?? 0)]` |
| `clock` | `clockText` |
| `timer` | `timerTexts[timer.id]` |
| `variable` | `variableTexts[variable.id]` (con `variableText` de F23.17) |
| `slide_tracker` | `trackerText` (de F23.17) |
| `text` o sin tipo, con `lines` | el texto fijo de sus `lines` |
| `media` con `src` | un ítem de medio |
| cualquier otro | nada (queda en "Deuda registrada") |

Caja y estilo con `parseItemBox` / `parseTextStyle` sobre `item.style`. Ítems con `enabled === false` o sin texto, no
se dibujan. Si `settings.labels` es `true`, cada ítem con `label` suma un texto de 28 px con `settings.labelColor`
pegado arriba de su caja. Si el layout no tiene ítems, se mantiene el comportamiento de hoy (`plainText`/`nextText`).

- Engine: si la escena de un stage trae `items`, la rama `ScreenKind::Stage` dibuja esos ítems con el mismo camino que
  la audiencia; si no, sigue con `stage_blocks`.

- [ ] **Step 1: Tests que fallan** en `stageScene.test.ts`, con un layout de ejemplo de 4 ítems (actual, siguiente con
  `slideOffset: 1`, reloj y notas): textos y cajas esperados; la última slide con `slideOffset: 1` no genera ese ítem;
  `enabled: false` no aparece; `labels: true` suma las etiquetas.
- [ ] **Step 2:** correr. Expected: FAIL.
- [ ] **Step 3: Implementar** en TS y la rama del engine. Test de Rust `stage_con_items_no_usa_stage_blocks`, con el
  estilo de `screens/tests.rs`.
- [ ] **Step 4:** chequeos en verde.
- [ ] **Step 5: En la app:** armar un layout de stage con slide actual, siguiente, reloj y notas, y asignarlo a una
  salida stage. Expected: el monitor de stage muestra ese diseño.
- [ ] **Step 6:** commit `F23.19: el stage dibuja el layout que diseñó el usuario`.

---

### Task F23.20: Video dentro de una slide

**Files:** `src-tauri/src/render/screens/{scene_state.rs,video_hub.rs,render_loop.rs}`, `src-tauri/src/render/media.rs`,
`render/scene.rs:175`

**Interfaces:**
- Consume: video hub (`video_hub_acquire` / `video_hub_release`) y `Nv12Pipeline` (los mismos que el fondo).
- Un `SceneMediaItem` con `media_type == "video"` se suscribe al hub con el id `` `${etiqueta de la pantalla}:${item.id}` ``.
  Se dibuja en el rect del ítem con su `fit` y opacidad. La suscripción se libera cuando el ítem deja de estar en la
  escena o se cierra la pantalla. Pausa y posición, igual que el fondo (F23.14), desde `playingVideoState` con la
  misma clave.

- [ ] **Step 1: Test que falla** en `screens/tests.rs` (`video_item_se_suscribe_y_se_libera`), con el patrón de los
  tests `subscribers_*`: una escena con un ítem de video suma un suscriptor para esa ruta; una escena sin el ítem lo
  saca.
- [ ] **Step 2:** correr. Expected: FAIL.
- [ ] **Step 3: Implementar** y actualizar el comentario de `scene.rs:175`.
- [ ] **Step 4:** chequeos en verde.
- [ ] **Step 5: En la app:** una slide con un ítem de video ocupando un cuarto de la pantalla: se reproduce en el
  proyector, y al pasar de slide se detiene.
- [ ] **Step 6:** commit `F23.20: los videos dentro de una slide se reproducen en el proyector`.

---

### Task F23.21: Transiciones `scale` y `blur`

**Files:** `src-tauri/src/render/transition.rs:30-50`, `render/shaders/transition.wgsl`, `render/scene.rs:140-147`

**Interfaces:**
- `TransitionType` suma `Scale = 7` y `Blur = 8`; `from_str` mapea `"scale"` y `"blur"`.
- `scene.rs`: `"scale"` → `"scale"`, `"blur"` → `"blur"`; `"spin"` sigue en crossfade (queda en "Deuda registrada").
- Shader, con `p` = progreso con easing (0 → 1):
  - **scale:** la imagen nueva se muestrea en `0.5 + (uv - 0.5) / (0.92 + 0.08 * p)` (va de 92 % a 100 %) con alfa `p`
    sobre la vieja.
  - **blur:** las dos se desenfocan con 9 muestras en cruz y radio `(1 - abs(2p - 1)) * 6` px (máximo en la mitad) y se
    mezclan con `p`.

- [ ] **Step 1: Tests que fallan** con el patrón de los tests de `transition.rs`: para `scale` y `blur`, con `p = 0` el
  centro es el color de la imagen vieja y con `p = 1` el de la nueva; `from_str("scale")` y `from_str("blur")` dan
  los tipos nuevos.
- [ ] **Step 2:** correr. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** chequeos en verde.
- [ ] **Step 5:** commit `F23.21: transiciones de escala y desenfoque en el engine`.

---

### Task F23.22: Las funciones no disponibles lo dicen

**Files:** `src/frontend/IPC/tauri.ts` (después de `POSTPONED_COMMANDS`, l.160, y en `send`, l.250),
`src/frontend/IPC/tauri.test.ts`, `src-tauri/src/commands/sync.rs`, `public/lang/en.json`, `public/lang/es.json`

**Interfaces:**
- `const POSTPONED_NOTIFY = new Set<Main>([...])`: subconjunto de `POSTPONED_COMMANDS`. No reemplaza a
  `POSTPONED_COMMANDS`, que lee `ipcContract.ts` con una regex.
- Al enviar un canal de `POSTPONED_NOTIFY`, además del `dispatch` de hoy:
  `newToast("toast.feature_unavailable")` **una sola vez por canal** por sesión.
- `CAN_SYNC` devuelve `Ok(false)`. Se borra `success` (`sync.rs`, con `#[allow(dead_code)]`: código muerto).
- Traducciones: `"feature_unavailable"` dentro de `"toast"`. En inglés: `"This feature is not available in PulseFlow yet."`;
  en español: `"Esta función todavía no está disponible en PulseFlow."`.

Lista inicial de `POSTPONED_NOTIFY` (los que dispara el usuario): `OPEN_NOW_PLAYING`, `DOWNLOAD_LESSONS_MEDIA`,
`MEDIA_DOWNLOAD`, `MEDIA_FOLDER_COPY`, `GET_SIMILAR`, `CAPTURE_SLIDE`, `PPT_TO_PDF`, `START_SLIDESHOW`,
`PRESENTATION_CONTROL`, `SEND_MIDI`, `GET_LYRICS`, `SEARCH_LYRICS`, `RECORDER`, `EMIT_OSC`, `CLOUD_SYNC`,
`RESTORE_CLOUD_BACKUP`, `PROVIDER_LOAD_SERVICES`, `ONSTAGE_LOAD_SERVICE`, `GET_CONTENT_LIBRARY`,
`GET_PROVIDER_CONTENT`, `SPOTIFY_COMMAND`, `FFMPEG_DOWNLOAD`, `SET_RTMP_ENCODER`.
**Regla de verificación:** para cada uno, `rg -n "Main\.<NOMBRE>" src/frontend`. Si **alguna** llamada está en
`startup.ts`, en `listeners.ts`, en un `subscribe` o en un temporizador (no la dispara el usuario), se saca de la
lista (si no, el aviso saldría solo al arrancar) y se anota en el commit.

- [ ] **Step 1: Tests que fallan** en `tauri.test.ts`: (a) todo `POSTPONED_NOTIFY` está en `POSTPONED_COMMANDS`;
  (b) enviar dos veces un canal de la lista llama a `newToast` una sola vez (mock de `newToast`, como los mocks
  existentes del archivo).
- [ ] **Step 2:** correr. Expected: FAIL.
- [ ] **Step 3: Implementar.** Para (a), exportar los dos sets sólo para el test.
- [ ] **Step 4:** chequeos JS y Rust en verde.
- [ ] **Step 5: En la app:** Configuración → sincronización en la nube ya no la ofrece como disponible; tocar una
  función pospuesta (por ejemplo, buscar letras) muestra el aviso una vez.
- [ ] **Step 6:** commit `F23.22: las funciones que todavía no existen avisan en vez de fallar en silencio`.

---

### Task F23.23: Los errores no salen de la máquina del usuario

**Files:** `src/frontend/main.ts:3,17-28`, `package.json` (dependencia `@sentry/browser`), `bun.lock`

Decisión del planificador: se **quita** el envío a Sentry. Los errores ya quedan en el log local (`pulseflow.log`,
F13.3: el frontend reenvía `console.error` y los errores sin capturar) y el usuario lo puede abrir desde
Configuración. Si algún día se quiere reportar errores, tiene que ser con un proyecto propio de PulseFlow, con
consentimiento explícito y en una tarea aparte.

- [ ] **Step 1:** Run: `rg -n "@sentry" src package.json`. Expected: sólo `src/frontend/main.ts` y `package.json`. Si
  aparece otro uso, parar.
- [ ] **Step 2:** borrar de `main.ts` el `import * as Sentry …`, el bloque `if (import.meta.env.PROD) { Sentry.init(…) }`
  con su comentario, y el import de `ERROR_FILTER` si queda sin uso (si `ERROR_FILTER` queda sin usuarios en todo
  `src/`, verificarlo con `rg -n "ERROR_FILTER" src` y borrarlo también).
- [ ] **Step 3:** Run: `bun remove @sentry/browser`.
- [ ] **Step 4:** Run: `rg -n "sentry" -i src/frontend package.json`. Expected: sin resultados. `bun run test:unit`,
  `test:svelte`, `test:budget` y `bun run build` en verde.
- [ ] **Step 5: En la app:** con DevTools → Red, provocar un error (por ejemplo, abrir un medio que no existe).
  Expected: ningún pedido a `sentry.io`, y la línea del error en `pulseflow.log`.
- [ ] **Step 6:** commit `F23.23: los errores ya no se envían al Sentry de FreeShow`.

---

### Task F23.24: Guía única de prueba en hardware (agente)

**Files:** Create `docs/VERIFICAR-BETA.md`; Modify `docs/ROADMAP.md` (en F2.8, F8.3, F10.10, F13.4, F20.8 y F22.13:
`→ ver docs/VERIFICAR-BETA.md §N`)

- [ ] **Step 1:** encabezado con el equipo: Mac Apple Silicon, PC con Windows 10/11, **2 monitores**, un `.mp4` 4K
  H.264, un 1080p en loop, un show con fondos de imagen y de video, 50 imágenes 4K distintas y una biblia con palabras
  en rojo. Secciones, **en este orden**:
  1. Salida en 2 monitores (F2.8; incluye F2.2–F2.5 de `docs/VERIFICAR.md`).
  2. Video: nativo en macOS, **Media Foundation en Windows** (F8.3, F13.4, F18.6 a–d), pausa y salto (F23.14), video
     dentro de una slide (F23.20) y la laptop suspendida con la salida abierta (pérdida del device).
  3. Memoria: pasar las 50 imágenes 4K en vivo; anotar la memoria de video y del proceso al principio y al final
     (F23.7).
  4. Texto: overlay largo sobre slide corta con la ✕ visible (F23.4); cajas, espaciado y subrayado (F23.16, F23.18).
  5. Cierre y guardado (F23.8, Steps 5–7).
  6. Stage con layout propio (F23.19), reloj (F23.15), transiciones (F23.21).
  7. Dos pantallas con crossfade; duplicar y eliminar pantallas (F17.3, F17.5); encuadre (F21.1–F21.2); Looks (F10.10).
  8. Columna izquierda (F20.8) y correcciones de F22 (F22.13).
  9. Seguridad: puertos (F23.9 Step 5), CSP (F23.12 Step 2) y ningún pedido a `sentry.io` (F23.23 Step 5).

  Cada punto lleva **Pasos**, **Esperado**, casillas `Mac [ ]` y `Windows [ ]` y un renglón de **Notas**. El
  contenido se copia de las tareas y de `docs/VERIFICAR.md`: **no se inventan pasos**.
- [ ] **Step 2:** enlazar cada tarea de verificación pendiente del roadmap. Run: `rg -c "VERIFICAR-BETA" docs/ROADMAP.md`.
  Expected: ≥ 6.
- [ ] **Step 3:** commit `F23.24: guía única de prueba en hardware`.

---

### Task F23.25: Ejecutar la guía (usuario) y convertir fallas en tareas

- [ ] **Step 1 (usuario):** ejecutar `docs/VERIFICAR-BETA.md` completo en Mac y en Windows y marcar las casillas.
- [ ] **Step 2 (agente):** por cada falla, una tarea nueva en el roadmap `F23.n Corregir: <qué falla>`, con la
  reproducción copiada de las notas, el sistema operativo y las líneas de `pulseflow.log` que correspondan.
- [ ] **Step 3:** marcar como hechas las verificaciones del roadmap que quedaron verdes en los dos sistemas.
- [ ] **Step 4:** commit `F23.25: resultados de la prueba en hardware`.
