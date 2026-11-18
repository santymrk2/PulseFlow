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
| Tipos React | `bun run test:react` |
| Presupuesto de calidad | `bun run test:budget` |
| Formato | `bunx prettier --config config/formatting/.prettierrc.yaml --check <archivos tocados en src/>` |
| Rust | `cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test --lib` |
| Build | `bun run build` |

Sólo **bun** (nunca npm, yarn, pnpm ni npx). El lockfile es `bun.lock`.

El chequeo de formato aplica **sólo** a archivos tocados dentro de `src/`. No correr
prettier sobre `.md`, `docs/` ni el resto de la configuración.

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

## Reglas de UI

- La apariencia sale de las variables CSS del tema (`--primary`, `--secondary`,
  `--text`, …) definidas en `src/frontend/components/settings/tabs/defaultThemes.ts`
  y `public/global.css`. No hardcodear colores en componentes.
- `docs/design-reference/` es **sólo referencia visual** (React, no se compila). No
  importar nada de ahí.
- **Svelte retirado (F24.24):** no quedan componentes `.svelte` ni dependencias de
  Svelte; los stores son propios (`src/frontend/lib/store.ts`).

## Reglas de React (F24, decidido 2026-11-06)

- La UI se migra de Svelte a React **de a un componente**, siguiendo
  `docs/superpowers/plans/2026-11-06-f24-migracion-react.md`. Nada de reescrituras paralelas (`src-react/` se
  abandonó por eso).
- El código React vive en `src/frontend/react/`. Un componente por archivo `PascalCase.tsx` y su test al lado
  (`Nombre.test.tsx`, primera línea `// @vitest-environment happy-dom`).
- React 19 con React Compiler: **prohibidos** `useMemo`, `useCallback` y `memo`. Imports nombrados
  (`import { useState } from "react"`), nunca `import React` ni `import * as React`. `ref` es una prop: sin
  `forwardRef`. Es una SPA de Vite: no hay Server Components ni `"use client"`.
- Estado: los stores de `src/frontend/stores.ts` se leen con `useStore(store)` (`react/hooks/useStore.ts`) y se
  escriben con `store.set`/`store.update`. No se crean stores ni contextos nuevos para algo que ya existe.
- Estilos: clases semánticas de Tailwind (`bg-background`, `text-foreground`, `border-border`, …). Prohibido
  `var()` y colores hex/rgb en `className`. `cn()` sólo para clases condicionales o para mezclar con un
  `className` recibido. Los `<style>` de un componente Svelte se portan **tal cual** a `Nombre.module.css`.
- TypeScript: nada de `any` (usar `unknown` y guardas de tipo); `import type` para tipos; interfaces planas (un
  objeto anidado tiene su propia interface); valores fijos como `const X = { … } as const` y
  `type X = (typeof X)[keyof typeof X]`, no uniones de strings sueltas.
- Eventos: lo que en Svelte era `dispatch("x", detail)` / `on:x` pasa a la prop `onX(detail)`. Un padre Svelte le
  pasa callbacks a una isla React por `props`.
- `dangerouslySetInnerHTML` sólo donde el Svelte original tenía `{@html}`, con la misma fuente ya saneada. Nunca en
  código nuevo.

## Varios agentes en paralelo

- Cada agente trabaja en **su propia carpeta** (`git worktree add ../PulseFlow-<x> <rama>`)
  y en su propia rama. Nunca dos agentes en la misma carpeta.
- Prohibido `git checkout`/`git switch` a otra rama, `git stash`, `git reset --hard` y
  `git push --force` sin que el usuario lo pida.
- Sólo uno corre `bun run dev` / `bun run dev:tauri` (puerto 1420 fijo).
- **No correr `cargo fmt` ni `prettier --write` sobre todo el proyecto**: sólo sobre
  los archivos que la tarea modifica. Un reformateo global genera conflictos en todos
  los archivos de los demás agentes.

## Qué no hacer sin preguntar

- Borrar código cuyo uso no esté demostrado como nulo (`grep` en `src/` y `src-tauri/`).
- Cambiar el formato de archivos de usuario (shows, proyectos, settings) sin migración.
- Cambiar `identifier` de `src-tauri/tauri.conf.json` (cambia la carpeta de datos).
- Renombres masivos de archivos/carpetas heredados de FreeShow.
- Agregar dependencias pesadas (ffmpeg-next, gstreamer, crates de UI, etc.).
