# FreeShow — Plan del proyecto (Svelte + Tauri v2 + engine Rust)

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
        Proyector (sala)   Stage Display     NDI (framebuffer)
```

Decisiones de diseño:

- **No existe modo legacy web de salida.** La salida (audiencia, stage, NDI) es
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
- Transiciones por shader WGSL (crossfade, dip-to-black, push/wipe) con easing por uniforms.
- Stage display: ventana nativa propia.
- Captura de framebuffer (`copy_texture_to_buffer`) para NDI: existe `render/ndi_stream.rs`.
- `OPEN_OUTPUT_WINDOW` / `TOGGLE_OUTPUTS` abren el engine nativo.

Limitaciones reales:

- **Video:** se decodifica con **ffmpeg por pipe** (CPU) y se sube cada frame a una
  textura. NO es decodificación por hardware ni zero-copy. Sin sincronización
  audio/video ni control fino de reproducción.
- **Stage:** muestra texto plano (slide actual/siguiente), no los layouts reales de stage de FreeShow.
- **NDI:** captura de framebuffer existe, pero falta integración completa (múltiples
  fuentes, alpha, gestión de ciclo de vida, UI).
- **Overlays, timers y alertas** no se renderizan en el engine.
- Antes de la Fase 2 el comando `OUTPUTS` concatenaba todo el texto de la slide con
  fuente 56 fija y un rect 1720x700 fijo (se perdían posiciones y estilos).

## Fases

### Fase 1 — Limpieza del repo
- [x] Referencia de diseño React movida a `docs/design-reference/`; `src-react/` eliminado.
- [x] Scaffold de ejemplo `tauri-app/` eliminado; `tauri-app/src-tauri` pasa a `src-tauri/`.
- [x] `@tauri-apps/cli` en devDependencies raíz; scripts `tauri`, `dev:tauri`, `build:tauri`.
- [x] `package-lock.json` eliminado; sólo `bun.lock`.
- [x] Planes viejos eliminados; este `PLAN.md` es la fuente de verdad.
- [x] Crate renombrado a `freeshow` / `freeshow_lib`.

### Fase 2 — Un solo modo de salida: engine Rust
- [ ] API única de ventanas: `OPEN/CLOSE/IS_OUTPUT_WINDOW(_OPEN)` y `OPEN/CLOSE/IS_STAGE_WINDOW(_OPEN)` (sin duplicados `*_NATIVE_*`).
- [ ] Sin `.unwrap()` de locks en `render/` de producción.
- [ ] Scene Graph real desde Svelte (`RENDER_SCENE`) en lugar de la concatenación de texto.
- [ ] Eliminar el camino de la ventana webview de salida (`MainOutput`, `currentWindow === "output"`).
- [ ] Inventario de comandos `send(OUTPUT, ...)` (ver sección más abajo).

### Fases siguientes (pendientes)
- [ ] Overlays (imágenes, texto, tercios inferiores) en el Scene Graph y en el engine.
- [ ] Timers / relojes / countdowns renderizados por el engine.
- [ ] Transiciones del show (tipo, duración, easing por slide/output) aplicadas desde el Scene Graph.
- [ ] Video sincronizado (reproducción, pausa, seek, loop, volumen, tiempo) y evaluar decodificación por hardware.
- [ ] Stage con layouts reales (items de stage configurados por el usuario).
- [ ] NDI completo (fuentes por output, alpha, ciclo de vida, UI).
- [ ] Inventario de comandos OUTPUT: implementar los "pendientes" y eliminar los obsoletos.
- [ ] Portar la estética de `docs/design-reference/` al frontend Svelte.
