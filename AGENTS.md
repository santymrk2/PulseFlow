# AGENTS.md — Reglas para agentes (opencode, Claude, etc.)

PulseFlow es un fork de FreeShow: UI de control en **Svelte 5** (`src/frontend/`) +
backend **Tauri v2 / Rust** (`src-tauri/`) con un **engine de render nativo WGPU**
(`src-tauri/src/render/`) como única salida. No existe salida web/webview.

El plan de trabajo está en [`docs/ROADMAP.md`](docs/ROADMAP.md). Ejecutá **una tarea
por vez**, en el orden indicado, y marcá su checkbox al terminarla.

## Plataformas

Sólo **macOS** (Apple Silicon e Intel) y **Windows 10/11 x64**. No agregues código,
dependencias, ramas `cfg` ni pasos de CI específicos de Linux. Si algo necesita
diferenciarse, usá `cfg(target_os = "macos")` / `cfg(target_os = "windows")`.

## Comandos

| Qué | Comando |
| --- | --- |
| Instalar | `bun install` |
| Frontend dev | `bun run dev` |
| App completa | `bun run dev:tauri` (requiere `bun run setup:sidecars --only-host` una vez) |
| Tests JS | `bun run test:unit` |
| Tipos Svelte | `bun run test:svelte` (hay ~220 errores heredados: **no aumentar**) |
| Formato | `bunx prettier --config config/formatting/.prettierrc.yaml --check <archivos tocados>` |
| Rust | `cd src-tauri && cargo check && cargo test --lib` |
| Build | `bun run build` |

Sólo **bun** (nunca npm, yarn, pnpm ni npx). El lockfile es `bun.lock`.

## Definición de terminado (cada tarea)

1. Los comandos de la tabla pasan, o no empeoran respecto de la línea base anotada en
   `docs/ROADMAP.md` (sección F0).
2. Se cumplen los criterios de aceptación de la tarea, verificados de verdad (si la
   tarea dice "probar en la app", hay que levantar la app; si no se pudo, decirlo).
3. Un commit por tarea, mensaje en español, con el id de la tarea (`F2.3: ...`).
4. Sin código muerto nuevo, sin `TODO` sin tarea asociada en el roadmap.

## Reglas de Rust

- Prohibido `.unwrap()` / `.expect()` fuera de `#[cfg(test)]`. Errores como
  `AppResult<T>` (`src-tauri/src/error.rs`); para locks usar `render/sync.rs`
  (`lock_safe`, `read_safe`, `write_safe`).
- Los `#[tauri::command]` son **adaptadores finos**: validan, llaman a una función de
  `render/` o `domain/` y devuelven el resultado. Nada de lógica de negocio ni parseo
  manual de `serde_json::Value` en los comandos: usá structs con `serde`.
- Todo struct que viaja por IPC tiene su espejo exacto en TypeScript (`src/types/`) y
  un test de (de)serialización en Rust con un JSON de ejemplo.
- Los comandos se registran en `src-tauri/src/lib.rs` (se queda así).
- Crear archivos nuevos está permitido cuando una responsabilidad no encaja en uno
  existente; no fuerces código en un archivo sólo para no crear otro.

## Reglas de Svelte

- **No migrar componentes a runes (`$props`) masivamente.** Un componente que recibe
  `on:click`/`on:*` de sus padres debe quedarse en modo legacy (`export let`) o
  reenviar el evento explícitamente. Pasarlo a runes rompe esos handlers sin aviso
  (pasó con `Button.svelte` y `HoverButton.svelte`).
- La apariencia sale de las variables CSS del tema (`--primary`, `--secondary`,
  `--text`, …) definidas en `src/frontend/components/settings/tabs/defaultThemes.ts`
  y `public/global.css`. No hardcodear colores en componentes.
- `docs/design-reference/` es **sólo referencia visual** (React, no se compila). No
  importar nada de ahí.

## Qué no hacer sin preguntar

- Borrar código cuyo uso no esté demostrado como nulo (`grep` en `src/` y `src-tauri/`).
- Cambiar el formato de archivos de usuario (shows, proyectos, settings) sin migración.
- Cambiar `identifier` de `src-tauri/tauri.conf.json` (cambia la carpeta de datos).
- Renombres masivos de archivos/carpetas heredados de FreeShow.
- Agregar dependencias pesadas (ffmpeg-next, gstreamer, crates de UI, etc.).
