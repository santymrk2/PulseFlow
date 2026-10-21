# GPU compartida, video zero-copy nativo y workers de I/O — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Los pasos usan checkbox (`- [ ]`). Un commit por tarea, mensaje en español con el id (`F17.1: ...`), según `AGENTS.md`.

**Meta:** que todas las pantallas compartan un único `wgpu::Device`, que el video llegue a la GPU sin pasar por la CPU (VideoToolbox en macOS, Media Foundation en Windows) y que la carga de medios corra en workers fuera del hilo de render.

**Arquitectura:** (F17) un `GpuContext` único guarda Instance/Adapter/Device/Queue; las texturas de medios viven en un `MediaStore` compartido y el video se sube **una sola vez** por archivo, no una por pantalla. (F18) un trait `VideoDecoder` con backends nativos (AVFoundation/CoreVideo → Metal; Media Foundation → D3D11 → D3D12) y el ffmpeg actual como fallback; los frames NV12 se convierten a RGB en un shader. (F19) un pool de workers decodifica imágenes y las sube a la GPU compartida sin bloquear el bucle de render.

**Stack:** wgpu 30.0.1 (`wgpu::hal::metal` / `wgpu::hal::dx12`), `objc2` + `objc2-av-foundation` + `objc2-core-video` + `objc2-core-media` + `objc2-metal` (macOS), crate `windows` con Media Foundation/D3D11/D3D12/DXGI (Windows), `tauri::async_runtime::spawn_blocking`.

**Spec:** conversación del 2026-10-20 (checklist de arquitectura de motor de presentación) + relevamiento de `src-tauri/src/render/`. No hay documento de diseño aparte; F18.1 produce `docs/design/zero-copy.md`.

## Restricciones globales

- Sólo macOS (Apple Silicon e Intel) y Windows 10/11 x64. Nada de Linux ni ramas `cfg` para Linux.
- Prohibido `.unwrap()`/`.expect()` fuera de `#[cfg(test)]`. Errores como `AppResult<T>`; locks con `render/sync.rs` (`lock_safe`, `read_safe`, `write_safe`).
- Todo `unsafe` lleva un comentario `// SAFETY:` con el invariante.
- Sólo bun para JS. Rust: `cd src-tauri && cargo check && cargo test --lib`. **No** correr `cargo fmt` global: sólo sobre los archivos tocados.
- Ningún archivo nuevo de `render/` pasa de ~600 líneas. `screens.rs` ya tiene 1606: no se le suma lógica nueva (ver F17.3).
- Dependencias pesadas autorizadas por el usuario para F18 (2026-10-20). Cada una se agrega en la tarea que la usa, no antes.
- Los tests golden existentes (`render/golden.rs`) tienen que seguir pasando sin regenerar imágenes, salvo que la tarea lo diga.
- `Backends` fijos: `METAL` en macOS, `DX12` en Windows (el interop de F18 lo exige).

## Foco de revisión

Casos que la meta implica y ninguna tarea listaba explícitamente (cada uno tiene su test en la tarea dueña):

1. Cerrar una pantalla mientras otra sigue usando el video compartido → la otra sigue viendo frames (F17.4).
2. Dos pantallas con distinto tamaño/formato de surface sobre el mismo Device → ambas dibujan bien (F17.2).
3. Archivo de video corrupto, 0×0 o con códec no soportado por el backend nativo → cae a ffmpeg y, si también falla, queda sin fondo sin colgar el render (F18.4).
4. Video cuya resolución cambia a mitad de reproducción o loop con salto de timestamps → el decodificador reinicia sin leak de texturas (F18.4).
5. Imagen que no existe, es enorme (>16384 px) o se pide 50 veces seguidas → un solo decode, estado `Failed` estable, el render nunca espera (F19.1).

---

## Fase A — Device compartido (F17)

> Orden recomendado: hacer **F15.3 (partir `screens.rs`) antes de F17.3**. F17.3 toca ~350 líneas de `spawn_render_loop`; sobre un archivo de 1606 líneas el diff es ilegible y choca con cualquier agente en paralelo.

### Task F17.1: `GpuContext`

**Archivos:**
- Crear: `src-tauri/src/render/gpu.rs`
- Modificar: `src-tauri/src/render/mod.rs` (declarar el módulo y migrar los helpers de test que hoy hacen `Instance::default()` + `request_device`, líneas ~45, 90, 132)

**Interfaces:**
- Produce:
  ```rust
  pub struct GpuContext {
      pub instance: wgpu::Instance,
      pub adapter: wgpu::Adapter,
      pub device: wgpu::Device,
      pub queue: wgpu::Queue,
  }
  impl GpuContext {
      pub fn new() -> AppResult<Arc<Self>>;                 // compatible_surface: None, HighPerformance
      pub fn supports_surface(&self, s: &wgpu::Surface) -> bool; // get_capabilities no vacío
  }
  pub fn shared(app: &tauri::AppHandle) -> AppResult<Arc<GpuContext>>; // OnceLock; misma Arc siempre
  ```

- [ ] **Paso 1: test que falla** — en `gpu.rs`: `shared_context_is_singleton` (dos llamadas a una `shared_for_tests()` devuelven `Arc::ptr_eq == true`) y `context_creates_offscreen_texture` (crea una textura `Rgba8Unorm` 4×4 con `ctx.device`). Si no hay adaptador en el entorno, el test se marca `#[ignore]` con el motivo, igual que hoy los golden.
- [ ] **Paso 2:** `cargo test --lib render::gpu` → FAIL (módulo no existe).
- [ ] **Paso 3:** implementar `GpuContext::new` con `InstanceDescriptor { backends }` según `cfg!(target_os)`; `shared` con `std::sync::OnceLock<Arc<GpuContext>>` (no `Mutex<Option>`).
- [ ] **Paso 4:** migrar los tres helpers de test de `mod.rs` a `GpuContext::new()`. `cargo test --lib` → todo verde, goldens incluidos.
- [ ] **Paso 5: commit** `F17.1: GpuContext único (Instance/Adapter/Device/Queue)`.

### Task F17.2: `MediaStore` compartido y pipelines por formato

**Archivos:**
- Modificar: `src-tauri/src/render/media.rs` (`MediaPool` → `MediaStore`), `render/golden.rs`, `render/mod.rs`
- Test: en `media.rs`

**Interfaces:**
- Consume: `GpuContext` (F17.1).
- Produce:
  ```rust
  pub struct MediaStore { /* RwLock<HashMap<String, Arc<MediaTexture>>> + PipelineCache */ }
  impl MediaStore {
      pub fn new(gpu: Arc<GpuContext>) -> Arc<Self>;
      pub fn get(&self, id: &str) -> Option<Arc<MediaTexture>>;
      pub fn load_image(&self, path: &Path) -> AppResult<Arc<MediaTexture>>;      // misma firma lógica que hoy, sin &mut ni device/queue
      pub fn update_video_frame(&self, id: &str, w: u32, h: u32, rgba: &[u8]) -> AppResult<Arc<MediaTexture>>;
      pub fn pipeline(&self, format: wgpu::TextureFormat) -> Arc<BackgroundPipeline>; // uno por formato
  }
  ```

- [ ] **Paso 1: tests que fallan**: `same_image_two_callers_share_texture` (dos `load_image` del mismo PNG de `tests/fixtures` → `Arc::ptr_eq`), `pipeline_is_cached_per_format` (mismo formato → `ptr_eq`; formato distinto → no), `two_sizes_render_on_one_device` (dos texturas offscreen de 64×64 y 128×72 renderizadas con el mismo `MediaStore`, píxel central ≠ negro en ambas).
- [ ] **Paso 2:** correr los tres → FAIL.
- [ ] **Paso 3:** reemplazar `MediaPool` por `MediaStore` (interior mutable con `RwLock`, vía `read_safe`/`write_safe`). `update_video_frame` conserva la actualización in-place por `write_texture` cuando el tamaño coincide.
- [ ] **Paso 4:** adaptar `golden.rs` y `mod.rs`; `cargo test --lib` verde sin regenerar goldens.
- [ ] **Paso 5: commit** `F17.2: MediaStore compartido y pipelines por formato`.

### Task F17.3: Las pantallas usan el Device compartido

**Archivos:**
- Modificar: `src-tauri/src/render/screens.rs` (`spawn_render_loop`, líneas ~997–1030 y el uso de `media_pool`), `lib.rs` (si hace falta manejar `Arc<GpuContext>` como estado)
- Test: `screens.rs` (módulo de tests existente)

**Interfaces:**
- Consume: `gpu::shared`, `MediaStore::{get, load_image, pipeline}`.
- Produce: `spawn_render_loop(gpu: Arc<GpuContext>, store: Arc<MediaStore>, window, kind, …)`; `ScreenManager` guarda `store: Arc<MediaStore>` (uno solo).

- [ ] **Paso 1: test que falla**: `second_screen_does_not_create_device` — un contador atómico `DEVICES_CREATED` (solo `#[cfg(test)]`, incrementado en `GpuContext::new`) permanece en 1 tras construir dos contextos de pantalla offscreen vía una función `build_screen_gpu_state(&GpuContext, format)` extraída del loop.
- [ ] **Paso 2:** correrlo → FAIL.
- [ ] **Paso 3:** extraer `build_screen_gpu_state` y hacer que `spawn_render_loop` cree sólo `Surface` (con `gpu.instance`), `TextEngine` y `TransitionEngine` por pantalla; validar `gpu.supports_surface(&surface)` y devolver un `AppError` claro si no. `request_adapter`/`request_device` desaparecen de `screens.rs`.
- [ ] **Paso 4:** `cargo check && cargo test --lib`. **Verificación manual en la app** (`bun run dev:tauri`): abrir Audiencia + Stage a la vez, cambiar slide con crossfade en ambas, cerrar una y confirmar que la otra sigue dibujando. Si no se pudo levantar la app, decirlo en el informe.
- [ ] **Paso 5: commit** `F17.3: pantallas sobre el Device compartido`.

### Task F17.4: El video se sube una sola vez por archivo

**Archivos:**
- Modificar: `screens.rs` (hub: `video_hub_acquire`, `VideoSubscriber`, `SharedVideo`, `VideoFrame`), `render/media.rs`
- Test: `screens.rs`

**Interfaces:**
- Consume: `MediaStore::update_video_frame`.
- Produce: el callback del decodificador llama **una vez** a `store.update_video_frame(&path, w, h, bytes)`; el id de textura del video pasa a ser la **ruta** del archivo y el bucle de render la busca con `store.get(&bg.path)`. Se eliminan `VideoFrame` (tupla), `ScreenHandle.video_frame` y el `bytes.to_vec()` por suscriptor.

- [ ] **Paso 1: test que falla**: `video_broadcast_uploads_once` — con dos suscriptores simulados, N frames sintéticos producen N subidas (contador en el store de prueba), no 2N.
- [ ] **Paso 2:** correrlo → FAIL.
- [ ] **Paso 3:** el hub mantiene sólo `subscribers` como conteo de referencias (el decodificador vive mientras haya ≥1). Test adicional `releasing_one_subscriber_keeps_frames_flowing` (foco de revisión #1).
- [ ] **Paso 4:** `cargo test --lib`; manual: video de fondo en Audiencia y Stage a la vez, cerrar una, la otra sigue reproduciendo.
- [ ] **Paso 5: commit** `F17.4: una subida de video por archivo, textura compartida`.

---

## Fase B — Video zero-copy nativo (F18)

### Task F18.1: Spike de importación nativa (macOS) y decisión de Windows

**Archivos:**
- Crear: `docs/design/zero-copy.md`, `src-tauri/src/render/video/native_probe.rs` (sólo `#[cfg(test)]`)

**Objetivo:** demostrar en este hardware, con la API real de wgpu 30, el camino `CVPixelBuffer (IOSurface, NV12) → CVMetalTextureCache → MTLTexture ×2 → wgpu::Texture` y dejar por escrito el camino de Windows. Los puntos de entrada verificados en el registro de cargo son `wgpu_hal::metal::Device::texture_from_raw(Retained<ProtocolObject<dyn MTLTexture>>, format, raw_type, array_layers, mip_levels, copy_size, drop_callback)` y `wgpu_hal::dx12::Device::texture_from_raw(ID3D12Resource, …)`, más `wgpu::Device::create_texture_from_hal`. Si `Features::TEXTURE_FORMAT_NV12` no está disponible en Metal, se usan dos texturas separadas `R8Unorm` (Y) y `Rg8Unorm` (CbCr), que es lo que da `CVMetalTextureCache` por plano.

- [ ] **Paso 1: test `#[cfg(all(test, target_os = "macos"))]` `imported_nv12_samples_expected_color`**: crea un `CVPixelBuffer` NV12 IOSurface-backed de 64×64 relleno con un color conocido, lo importa a wgpu y renderiza un píxel con el shader de F18.2 (si F18.2 aún no existe, con un shader mínimo de lectura de planos). Assert: color central dentro de ±3/255.
- [ ] **Paso 2:** correrlo → FAIL (importación no implementada).
- [ ] **Paso 3:** agregar `objc2`, `objc2-core-video`, `objc2-metal` (versiones exactas fijadas en `Cargo.toml`, `[target.'cfg(target_os = "macos")'.dependencies]`) e implementar el mínimo para pasar.
- [ ] **Paso 4:** escribir `docs/design/zero-copy.md` con: (a) el camino macOS probado, (b) el camino Windows elegido (Media Foundation `IMFSourceReader` + `IMFDXGIDeviceManager` → textura NV12 D3D11 con `D3D11_RESOURCE_MISC_SHARED_NTHANDLE` → `ID3D12Device::OpenSharedHandle` → `texture_from_raw`) y el mecanismo de sincronización D3D11→D3D12 (fence compartido vs. keyed mutex), (c) qué contenedores cubre cada backend, (d) qué no se pudo verificar. **Si el spike muestra que algo del diseño de F18.2–F18.6 no cierra, se corrige este plan antes de seguir.**
- [ ] **Paso 5: commit** `F18.1: spike zero-copy macOS y decisión de diseño Windows`.

### Task F18.2: Pipeline NV12 → RGB en el shader

**Archivos:**
- Crear: `src-tauri/src/render/shaders/video_nv12.wgsl`, `src-tauri/src/render/video/nv12.rs`
- Test: `nv12.rs` + un golden en `render/golden.rs`

**Interfaces:**
- Produce:
  ```rust
  pub enum YuvMatrix { Bt601, Bt709, Bt2020 }
  pub struct Nv12Frame { pub y: wgpu::TextureView, pub uv: wgpu::TextureView, pub width: u32, pub height: u32,
                         pub matrix: YuvMatrix, pub full_range: bool, keepalive: Box<dyn Send + Sync> }
  pub struct Nv12Pipeline { /* RenderPipeline + layout */ }
  impl Nv12Pipeline { pub fn render(&self, queue: &Queue, pass: &mut RenderPass, frame: &Nv12Frame,
                                     target_w: u32, target_h: u32, opacity: f32, aspect_mode: u32); }
  ```
  `keepalive` retiene el `CVMetalTexture`/handle hasta que la GPU termine (lo usa F18.5/F18.6).

- [ ] **Paso 1: tests que fallan** (puros, sin decodificador, subiendo planos con `write_texture`): `nv12_bt709_limited_red` (Y=63, Cb=102, Cr=240 → rojo ≈ (255,0,0) ±3), `nv12_bt709_limited_white`, `nv12_full_range_differs_from_limited` y `nv12_odd_dimensions` (3×3: el plano UV es 2×2, no desborda).
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 3:** shader con matrices BT.601/709/2020 y rango limitado/completo como uniform; reutilizar el layout de `LayerUniforms` (cover/contain/stretch) de `composite.wgsl`.
- [ ] **Paso 4:** tests verdes; `cargo test --lib` completo.
- [ ] **Paso 5: commit** `F18.2: pipeline NV12→RGB en GPU`.

### Task F18.3: `VideoDecoder` y reorganización de `video.rs`

**Archivos:**
- Mover: `render/video.rs` → `render/video/mod.rs` (trait + selección) y `render/video/ffmpeg.rs` (backend actual, sin cambiar comportamiento)
- Modificar: `screens.rs` (hub usa el trait)

**Interfaces:**
- Produce:
  ```rust
  pub struct DecodedFrame { pub pts: Duration, pub pixels: FramePixels }   // pts: tiempo dentro del archivo, acumulado a través de los loops
  pub enum FramePixels { Rgba { w: u32, h: u32, bytes: Vec<u8> }, Nv12Cpu { w: u32, h: u32, y: Vec<u8>, uv: Vec<u8>, matrix: YuvMatrix, full_range: bool }, Native(Nv12Frame) }
  pub trait FrameSink: Send + Sync { fn push(&self, frame: DecodedFrame); }
  pub trait VideoDecoder: Send { fn stop(&mut self); }
  pub fn start(app: &AppHandle, path: &str, sink: Arc<dyn FrameSink>) -> AppResult<Box<dyn VideoDecoder>>;
  // orden: nativo → ffmpeg HW → ffmpeg SW
  ```
  `MediaStore` gana `update_video_frame_nv12(&self, id, &Nv12Frame)` (guarda el frame vigente por id; las pantallas lo toman con `store.get_video(id)`).

- [ ] **Paso 1: tests que fallan**: `backend_selection_by_extension` (`.mp4/.mov/.m4v` → candidato nativo; `.webm/.mkv/.avi` → ffmpeg directo), `ffmpeg_backend_frame_size_nv12` (`w*h*3/2`), `ffmpeg_frames_carry_monotonic_pts` (el n-ésimo frame de un video de 30 fps tiene `pts ≈ n/30 s`, creciente también al dar la vuelta del loop) y los tests del reloj de abajo.
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 2b: reloj del show (opción B, acordada 2026-10-20).** Crear `src-tauri/src/render/clock.rs` con `pub trait ShowClock: Send + Sync { fn now(&self) -> Duration; }` y `pub struct WallClock` (implementación por `Instant`, la única de hoy). Tests: `wall_clock_is_monotonic` y `wall_clock_advances` (tras `sleep(20 ms)` avanza ≥ 20 ms). **Nadie lo consume todavía**: es el punto de enganche para que, cuando exista un motor de audio en Rust, un `AudioClock` basado en el contador de muestras reemplace a `WallClock` sin tocar a los consumidores. El PTS que llevan los frames es la otra mitad de ese contrato.
- [ ] **Paso 3:** mover el código; cambiar el backend ffmpeg a `-pix_fmt nv12` y poner el PTS en cada frame (`n / fps`, más la duración del archivo por cada vuelta del loop; el fps sale de `ffprobe`) y emitir `Nv12Cpu` (mitad del ancho de banda que RGBA; es también la red de seguridad en ambas plataformas). El `start_video_playback` actual queda como wrapper delgado hasta que F17.4/F18.3 se integren.
- [ ] **Paso 4:** `cargo test --lib`; manual: un `.mp4` y un `.webm` reproducen en Audiencia.
- [ ] **Paso 5: commit** `F18.3: trait VideoDecoder, ffmpeg en NV12`.

### Task F18.4: Decodificador nativo macOS (AVFoundation)

**Archivos:**
- Crear: `src-tauri/src/render/video/avf.rs` (`#[cfg(target_os = "macos")]`), `src-tauri/tests/fixtures/video/solid_red_64.mp4` (generado con ffmpeg: 64×64, 30 fps, 2 s, color rojo sólido, H.264)
- Dependencias nuevas: `objc2-av-foundation`, `objc2-core-media`, `block2` (macOS)

**Interfaces:**
- Consume: `FrameSink`, `DecodedFrame::Native`, importación de F18.5.
- Produce: `pub fn start_avf(path: &str, sink: Arc<dyn FrameSink>) -> AppResult<Box<dyn VideoDecoder>>`: `AVAssetReader` + `AVAssetReaderTrackOutput` con `kCVPixelBufferPixelFormatTypeKey = 420YpCbCr8BiPlanarVideoRange`, `kCVPixelBufferMetalCompatibilityKey = true` e IOSurface properties; hilo propio con pacing por PTS; loop re-creando el reader al EOF.

- [ ] **Paso 1: tests que fallan**: `avf_decodes_fixture_frames` (≥10 `Native` en 1 s, 64×64), `avf_loops_after_eof` (se reciben frames después del final del archivo), `avf_rejects_corrupt_file` (archivo truncado → `Err`, y `start()` de F18.3 cae a ffmpeg — foco #3), `avf_stop_joins_thread` (stop devuelve en <500 ms).
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 3:** implementar; ante cambio de resolución (foco #4) descartar el reader y arrancar otro.
- [ ] **Paso 4:** tests verdes (en la Mac).
- [ ] **Paso 5: commit** `F18.4: decodificador nativo AVFoundation`.

### Task F18.5: Importación Metal sin copias y cableado al render

**Archivos:**
- Crear: `src-tauri/src/render/video/metal_import.rs`
- Modificar: `screens.rs` (la capa de fondo elige `Nv12Pipeline` cuando el frame es nativo), `render/media.rs`

**Interfaces:**
- Produce: `pub fn import_cv_pixel_buffer(gpu: &GpuContext, pb: &CVPixelBuffer, cache: &CVMetalTextureCache) -> AppResult<Nv12Frame>` (usa el resultado del spike F18.1; `keepalive` retiene los `CVMetalTexture` y el `CVPixelBuffer`).

- [ ] **Paso 1: test que falla**: `native_frame_renders_red` (decodifica `solid_red_64.mp4` con F18.4, importa, renderiza offscreen con `Nv12Pipeline`, centro ≈ rojo ±4) y `native_path_does_not_copy_pixels` (contador `#[cfg(test)]` de `write_texture`/`to_vec` en la ruta nativa == 0).
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 3:** implementar; `CVMetalTextureCache` se crea una vez por `GpuContext` (campo opcional en macOS).
- [ ] **Paso 4:** `cargo test --lib`; **medición** (reemplaza a F8.3 para este camino): reproducir un video 4K H.264 durante 60 s y anotar CPU% y frame-time del proceso antes (ffmpeg RGBA) y después (nativo) en `docs/informes/f18.md`.
- [ ] **Paso 5: commit** `F18.5: import CVPixelBuffer→Metal sin copia, cableado al render`.

### Task F18.6: Decodificador e importación nativos Windows

**Archivos:**
- Crear: `src-tauri/src/render/video/mf.rs` y `render/video/d3d_import.rs` (`#[cfg(target_os = "windows")]`)
- Dependencia: crate `windows` (features `Win32_Media_MediaFoundation`, `Win32_Graphics_Direct3D11`, `Win32_Graphics_Direct3D12`, `Win32_Graphics_Dxgi_Common`, `Win32_Foundation`)

**Interfaces:**
- Produce: `start_mf(path, sink) -> AppResult<Box<dyn VideoDecoder>>` y `import_shared_nv12(gpu, handle) -> AppResult<Nv12Frame>` con el camino definido en `docs/design/zero-copy.md`.

- [ ] **Paso 1: tests** equivalentes a F18.4/F18.5 con `#[cfg(target_os = "windows")]` (misma fixture): `mf_decodes_fixture_frames`, `d3d_frame_renders_red`.
- [ ] **Paso 2–4:** implementar siguiendo el documento de diseño. **No se puede verificar desde esta Mac**: la tarea se marca `[ ] pendiente de verificar en Windows` en el roadmap y el informe lo dice. Se agrega un punto a F13.4 (prueba en hardware real) con los tests de arriba más 4K durante 60 s.
- [ ] **Paso 5: commit** `F18.6: decodificador Media Foundation + import D3D12 (sin verificar en Windows)`.

---

## Fase C — Workers de I/O (F19)

### Task F19.1: Carga de imágenes fuera del hilo de render

**Archivos:**
- Crear: `src-tauri/src/render/workers.rs`
- Modificar: `render/media.rs` (`MediaStore`), `screens.rs` (reemplazar `failed_images` y los `load_image` síncronos de las tres capas: fondo, medios de slide, medios de overlay)

**Interfaces:**
- Consume: `MediaStore` y `GpuContext` (la subida se hace desde el worker: `Device` y `Queue` son `Send + Sync`).
- Produce:
  ```rust
  pub enum MediaState { Loading, Ready(Arc<MediaTexture>), Failed(String) }
  impl MediaStore {
      pub fn request_image(self: &Arc<Self>, path: &Path) -> MediaState; // no bloquea; encola una sola vez
      pub fn state(&self, path: &Path) -> MediaState;
  }
  ```
  Pool de tamaño `max(2, núcleos/2)` sobre `tauri::async_runtime::spawn_blocking`; dedupe por ruta; tope de lado 16384 px → `Failed`.

- [ ] **Paso 1: tests que fallan**: `request_returns_immediately_while_loading` (primera llamada devuelve `Loading` en <5 ms con una imagen grande de fixture), `fifty_requests_one_decode` (contador de decodes == 1; foco #5), `missing_file_is_failed_and_stable` (`Failed` y no se reencola), `oversized_image_fails` (cabecera 20000×20000 → `Failed` sin reservar memoria), `ready_after_worker_finishes` (tras esperar con timeout de 2 s → `Ready`).
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 3:** implementar; el worker lee dimensiones primero (`image::ImageReader::into_dimensions`) para rechazar antes de decodificar; mientras está `Loading` el bucle de render simplemente no dibuja esa capa (o mantiene el frame anterior vía la transición).
- [ ] **Paso 4:** `cargo test --lib`; manual: cambiar entre slides con fondos de 20+ MP, la UI y el render no se congelan.
- [ ] **Paso 5: commit** `F19.1: workers de carga de imágenes sobre la GPU compartida`.

### Task F19.2: Precarga al aplicar la escena y de las siguientes slides

**Archivos:**
- Modificar: `src-tauri/src/commands/output.rs` (`RENDER_SCENE`: pedir `request_image` para todo medio de la escena en cuanto llega, antes del primer frame), `lib.rs`
- Crear: comando `RENDER_PREFETCH` + struct `PrefetchPayload { paths: Vec<String> }` en `render/types.rs`, espejo en `src/types/` y llamada desde el frontend de salida (`src/frontend/helpers/output.ts`) con los medios de las 2 slides siguientes.
- Test: `output.rs` (mock_app) + test de (de)serialización de `PrefetchPayload` con JSON de ejemplo (regla de IPC de `AGENTS.md`)

- [ ] **Paso 1: tests que fallan**: `scene_apply_requests_media` (al aplicar una escena con 3 imágenes, el store pasa a tener 3 pedidos) y `prefetch_payload_roundtrip`.
- [ ] **Paso 2:** correrlos → FAIL.
- [ ] **Paso 3:** implementar el comando como adaptador fino (valida, llama a `store.request_image`); cablear el frontend. Primer sub-paso: leer `helpers/output.ts` para ubicar dónde se conoce la slide siguiente; si no hay un punto limpio, parar y consultar al usuario.
- [ ] **Paso 4:** `cargo test --lib`, `bun run test:unit`, `bun run test:svelte` (los 56 errores heredados **no aumentan**), prettier sólo sobre los archivos de `src/` tocados.
- [ ] **Paso 5: commit** `F19.2: precarga de medios al aplicar escena y de slides siguientes`.

### Task F19.3: Miniaturas y cierre

**Archivos:** `src-tauri/src/commands/media.rs` (generación de miniaturas), `docs/informes/f19.md`, `docs/ROADMAP.md`

- [ ] **Paso 1:** revisar cómo `commands/media.rs` genera miniaturas hoy; si ya corre fuera del hilo principal, documentarlo y no tocar nada. Si bloquea comandos de Tauri, moverlo al mismo pool con un test `thumbnail_request_does_not_block_command` (el comando devuelve antes de que termine el decode).
- [ ] **Paso 2:** registrar F17–F19 en `docs/ROADMAP.md` con los checkboxes y fechas, y escribir `docs/informes/f19.md` (qué se verificó, qué no — en particular Windows).
- [ ] **Paso 3: commit** `F19.3: miniaturas fuera del hilo de comandos y cierre del roadmap`.

---

## Autorrevisión

- **Cobertura de la meta:** Device compartido → F17.1–F17.4; zero-copy nativo → F18.1–F18.6; workers → F19.1–F19.3. Reuso de un solo decode/subida de video entre salidas → F17.4.
- **Consistencia de tipos:** `GpuContext` (F17.1) lo consumen F17.2, F17.3, F18.5, F19.1; `MediaStore` (F17.2) lo extienden F18.3 (`update_video_frame_nv12`) y F19.1 (`request_image`); `Nv12Frame` (F18.2) lo producen F18.5/F18.6 y lo consume `DecodedFrame::Native` (F18.3).
- **Riesgos abiertos, dichos sin maquillaje:**
  1. El diseño de F18.5/F18.6 depende de lo que demuestre F18.1; es un spike deliberado.
  2. Windows no es verificable desde este equipo.
  3. AVFoundation no abre `.webm/.mkv/.avi`: esos siguen por ffmpeg (ahora en NV12, no RGBA), de modo que "zero-copy" aplica a `.mp4/.mov/.m4v`.
  4. `TextEngine` (glyphon) sigue siendo por pantalla; compartir `FontSystem` queda fuera de este plan.
  5. **Reloj maestro (decisión del 2026-10-20: opción B).** Sólo se agrega el PTS en los frames y el trait `ShowClock` con `WallClock`. Presentar frames por PTS (cola corta, descartar atrasados), el contador de muestras de audio y la compensación de latencia por salida quedan para cuando exista un motor de audio en Rust. Hasta entonces el hub sigue con "gana el último frame" y no hay riesgo de desincronización porque no hay audio ni cues con tiempo en el engine.
