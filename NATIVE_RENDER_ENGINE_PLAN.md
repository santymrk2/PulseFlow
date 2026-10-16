# FreeShow Native Render Engine — Plan de Migración e Implementación

## Arquitectura Objetivo

```
┌────────────────────────────────────────────────────────┐
│             UI de Control (Tauri / Frontend)           │
│         (El operador hace clics, busca canciones)      │
└──────────────────────────┬─────────────────────────────┘
                           │ IPC binario / Tauri Command
                           │ (Envía un "Scene Graph" ligero)
                           ▼
┌────────────────────────────────────────────────────────┐
│            FreeShow GPU Pipeline (Rust Core)           │
│                                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐  │
│  │ HW Video Decoder│ │  Glyphon / Text │ │ Shaders  │  │
│  │ (VideoToolbox / │ │  (Rasterizado a │ │ (Fades,  │  │
│  │ MediaFoundation)│ │  Texturas VRAM) │ │ Blurs)   │  │
│  └────────┬────────┘ └────────┬────────┘ └────┬─────┘  │
│           └───────────────────┼───────────────┘        │
│                               ▼                        │
│                 WGPU Render Pass (Metal / DX12)        │
└───────────────┬───────────────────┬────────────────┬───┘
                │                   │                │
                ▼                   ▼                ▼
        [Proyector Sala]     [Stage Display]    [NDI / SDI Framebuffer]
         (Pantalla 1)         (Pantalla 2)       (OBS / Broadcast)
```

### Stack Tecnológico Recomendado en Rust

| Componente | Crate Rust | Función técnica |
| :--- | :--- | :--- |
| **Gráficos GPU** | `wgpu` | Estándar moderno de WebGPU para Rust. Abstrae Metal (macOS) y DirectX 12/Vulkan (Windows) sin overhead. |
| **Render de Texto** | `glyphon` + `cosmic-text` | Renderizador de texto de ultra alto rendimiento en WGPU. Cachea glifos en un atlas de texturas en VRAM. Permite sombras, bordes y ajuste automático sin tocar la CPU. |
| **Video en GPU** | Integración nativa / `ffmpeg-next` | Decodificación por hardware (Zero-Copy) que sube los fotogramas directamente como texturas a la VRAM. |
| **Manejo de Ventanas** | Tauri v2 `raw-window-handle` | Tauri crea la ventana del monitor secundario sin Webview y le pasa el puntero de la ventana nativa (NSWindow / HWND) a `wgpu::Surface`. |

### Contrato de Comunicación: El Scene Graph

```rust
pub struct SceneGraph {
    pub display_id: u32,
    pub background: Option<BackgroundMedia>, // Video o imagen en VRAM
    pub text_blocks: Vec<TextBlock>,        // Letras, citas bíblicas, acordes
    pub overlays: Vec<OverlayItem>,          // Relojes, avisos, tercios inferiores
    pub transition: TransitionEffect,       // Crossfade, Wipe, etc. (duración en ms)
}
```

---

## Fases del Plan

### Fase 1: Ventana Nativa y Swapchain WGPU (Fundación)
- **Objetivo**: Abrir una ventana secundaria en pantalla completa sin Webview que pinte un fondo limpio a 60 fps mediante la GPU.
- **Acciones**:
  - [x] En `tauri-app/src-tauri/Cargo.toml`, agregar dependencias base: `wgpu`, `raw-window-handle`, `pollster`.
  - [x] En `commands/output.rs`, crear un comando `OPEN_NATIVE_OUTPUT(display_index)` que cree una ventana nativa de Tauri sin motor Webview asociado (`WindowBuilder`).
  - [x] Inicializar `wgpu::Instance`, seleccionar el adaptador (GPU integrada o dedicada) y configurar el `Surface` enlazado al handle nativo del monitor seleccionado.
  - [x] Implementar un bucle de renderizado básico que limpie la pantalla en negro puro (`Color::BLACK`) con sincronización vertical (VSync).

### Fase 2: Motor de Texto y Tipografías en GPU
- **Objetivo**: Proyectar diapositivas de texto (canciones, versículos) con calidad tipográfica perfecta, sombras y contornos generados por hardware.
- **Acciones**:
  - [x] Integrar `cosmic-text` y `glyphon` en el pipeline de Rust.
  - [x] Implementar un atlas de fuentes: carga de fuentes del sistema y personalizadas de FreeShow (.ttf, .otf).
  - [x] Implementar un shader simple en WGSL para efectos de texto:
    - [x] Contorno del texto (stroke).
    - [x] Sombra arrojada (drop shadow) sin coste de CPU.
  - [x] Conectar el evento de cambio de diapositiva (`SELECT_SLIDE`) para que actualice el buffer de texto de la GPU en menos de 1 milisegundo.

### Fase 3: Capa de Video e Imágenes en VRAM
- **Objetivo**: Reproducir fondos en bucle (motion backgrounds) e imágenes estáticas sin consumir CPU ni duplicar decodificación.
- **Acciones**:
  - [ ] Pipeline de carga de texturas: subida asíncrona de imágenes (`image` crate) a texturas `wgpu::Texture`.
  - [ ] Decodificación de video acelerada por hardware: decodificar frames a un formato YUV/RGBA y transferirlos directamente a una textura de video.
  - [ ] Implementar shaders de mezcla:
    - [ ] Capa inferior: Video/Imagen de fondo.
    - [ ] Capa intermedia: Texto y glifos.
    - [ ] Capa superior: Relojes y alertas.
  - [ ] Reutilización de texturas: si 2 pantallas muestran el mismo fondo, usar la misma textura de VRAM para ambas salidas.

### Fase 4: Transiciones por Shaders de GPU
- **Objetivo**: Reemplazar las transiciones CSS por shaders de hardware libres de tirones.
- **Acciones**:
  - [ ] Implementar un buffer doble (Texture A y Texture B).
  - [ ] Crear shaders en WGSL para transiciones:
    - [ ] Crossfade suave: Interpolación lineal entre texturas A y B durante N milisegundos.
    - [ ] Dip to Black: Desvanecimiento a negro y aparición del nuevo contenido.
    - [ ] Push / Wipe: Desplazamientos geométricos instantáneos.
  - [ ] Controlar la curva de animación (easing) directamente en el shader mediante uniforms de tiempo.

### Fase 5: Multi-Salida Simultánea (Auditorio + Stage Display + NDI)
- **Objetivo**: Soportar la configuración clásica de eventos en vivo: 3 salidas independientes.
- **Acciones**:
  - [ ] Auditorio (Main Output): Renderiza fondo + texto principal.
  - [ ] Stage Display (Retorno para músicos/pastor): El engine renderiza otra vista usando la misma fuente de datos pero con un layout distinto (alto contraste, diapositiva actual + siguiente + reloj).
  - [ ] Salida NDI / DeckLink directa: En lugar de capturar la pantalla, extraer el framebuffer resultante de la GPU (`copy_texture_to_buffer`) y enviarlo directamente por la red local mediante el comando NDI de Rust existente en `commands/ndi.rs`.

### Fase 6: Conmutador (Feature Flag) en la UI
- **Objetivo**: Transición transparente sin romper el software actual.
- **Acciones**:
  - [ ] En la configuración de pantallas de FreeShow (`Settings -> Displays`), añadir una opción:
    - [ ] Motor de Render: `[ Web (Legacy) | Nativo GPU (Pro Engine) ]`.
  - [ ] Si está en Nativo, Tauri invoca los nuevos comandos Rust de WGPU. Si está en Legacy, usa las ventanas Webview actuales.
