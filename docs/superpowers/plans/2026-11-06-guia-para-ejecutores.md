# Guía para el agente que ejecuta los planes

Vale para los dos planes del 2026-11-06:

- `2026-11-06-f23-nucleo-engine-y-backend.md`: arreglar el engine wgpu, el backend Rust y la seguridad.
- `2026-11-06-f24-migracion-react.md`: migrar la UI de Svelte a React, de a una pantalla por vez.

Está escrita para un modelo que **ejecuta**, no que diseña: las decisiones ya están tomadas en el plan. Si una tarea
te obliga a decidir algo que el plan no dice, **parás y preguntás**.

**Decisiones del usuario (2026-11-06):** la app sigue en **Tauri v2**; **no** se migra a GPUI ni a ningún otro framework
nativo; la UI se migra **a React**; el engine wgpu y el backend Rust se arreglan y se quedan.

## 1. Cómo trabajar una tarea

1. Leé `AGENTS.md`, esta guía y la tarea **completa** (con sus *Interfaces*) antes de tocar nada.
2. Hacé **una tarea por vez**, en el orden del plan. No adelantes trabajo de otra tarea "porque ya estabas ahí".
3. Seguí los pasos en orden. En los de test: primero escribís el test, lo corrés y **tiene que fallar**, y recién ahí
   implementás.
4. Al terminar, corré la verificación de la tarea **y** los chequeos generales (sección 3).
5. Marcá los `- [ ]` del plan como `- [x]` y la casilla de la tarea en `docs/ROADMAP.md`.
6. Un commit por tarea con el mensaje que da el plan. En español, con el id (`F23.4: …`). Sin `Co-Authored-By` ni
   menciones a IA.

## 2. Cuándo parar y preguntar

| Situación | Qué hacer |
| --- | --- |
| Un archivo, una línea o una función que cita el plan no existe o cambió | Parar y avisar con lo que encontraste (`rg -n "<nombre>"`). No adivinar. |
| Un test que el plan da como "tiene que fallar" pasa antes de implementar | Parar: el comportamiento ya existe o el test está mal. |
| Hay que tocar un archivo que la tarea no lista | Si son importaciones o firmas que exige el compilador, seguí y anotalo en el commit. Si es lógica, parar. |
| Hace falta una dependencia que el plan no nombra | Parar. Nunca agregar crates ni paquetes por tu cuenta. |
| La verificación dice "en la app" y no podés abrirla ni ver la pantalla | Hacer todo lo demás, **no** marcar la tarea y escribir en el reporte qué falta verificar. |
| Un chequeo general empeora (más errores de svelte-check, menos tests, budget en rojo) | Arreglarlo antes de commitear. Si no sabés cómo, parar. |
| La tarea es mucho más grande de lo que dice el plan | Parar y reportar. No recortar alcance en silencio. |

Reporte al parar: qué tarea, en qué paso, qué esperabas, qué pasó (con la salida exacta del comando) y qué proponés.

## 3. Comandos

| Qué | Comando | Pasa si |
| --- | --- | --- |
| Instalar | `bun install` | sin errores |
| Tests JS/TS/React | `bun run test:unit` | todo verde |
| Tipos Svelte | `bun run test:svelte` | no sube del número anotado en `config/quality-budget.json` (hoy 40) |
| Tipos React (desde F24.1) | `bun run test:react` | 0 errores |
| Presupuesto de calidad | `bun run test:budget` | `OK` |
| Formato | `bunx prettier --config config/formatting/.prettierrc.yaml --check <archivos tocados en src/>` | sin diferencias |
| Rust | `cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test --lib` | todo verde (clippy desde F23.2) |
| Código de Windows desde macOS | `bash scripts/check-windows-video.sh` | OK |
| App | `bun run dev:tauri` (una sola instancia: puerto 1420) | abre |
| Un test JS | `bunx vitest run --config config/testing/vitest.config.mts <ruta>` | — |
| Un test Rust | `cd src-tauri && cargo test --lib <ruta::del::test>` | — |
| Goldens | se regeneran con la variable `UPDATE_ENV` de `src-tauri/src/render/golden.rs`, **sólo** si la tarea lo pide | — |

Herramientas: `rg` para buscar texto, `fd` para buscar archivos, `bat` para leer. Nada de `grep`, `find` ni `cat`.
Sólo **bun** (nunca npm, yarn, pnpm ni npx).

## 4. Trabajo en paralelo

- Cada agente trabaja en su carpeta: `git worktree add ../PulseFlow-<x> -b <rama>`. Nunca dos agentes en la misma.
- Prohibido `git checkout`/`git switch` a otra rama, `git stash`, `git reset --hard` y `git push --force` sin pedido.
- Sólo un agente corre `bun run dev` o `bun run dev:tauri` (el puerto 1420 es fijo).

| Se puede en paralelo | Condición |
| --- | --- |
| F23 (Rust y helpers TS) con F24 (pantallas React) | **después** de F23.1, F23.2 y F24.1. Las tres tocan `AGENTS.md`, `package.json` o el formato global. |
| F24.18 (slides) | **después** de F23.17, que cambia `SlideProgress.svelte`, `DynamicEvents.svelte` y `Variable.svelte`. |
| F24.19 (stage) | **después** de F23.19. |
| Dos tareas de F23 entre sí | no: van en orden, porque muchas tocan `render/screens/render_loop.rs`. |

## 5. Errores típicos (ya pasaron en este proyecto)

- **Svelte:** un componente que recibe `on:click` del padre queda con `export let`. Pasarlo a runes (`$props`) rompe
  los clics sin aviso. Mientras conviva con React, el padre Svelte le pasa **callbacks como props** a la isla React
  (`props={{ onClick: … }}`), no `on:click`.
- **Rust:** `.unwrap()`/`.expect()` sólo dentro de `#[cfg(test)]`. En producción: `?` con `AppResult<T>`; locks con
  `lock_safe()` / `read_safe()` / `write_safe()` de `render/sync.rs`.
- **Formato:** nunca `cargo fmt` ni `prettier --write` sobre todo el proyecto. Sólo sobre los archivos de la tarea.
- **Colores:** nada de hex sueltos en `.svelte`, `.tsx` ni `className`. Se usan los tokens del tema.
- **Datos del usuario:** nunca cambiar el formato de `.show`, proyectos ni settings. Si una tarea parece pedirlo, parar.
- **`docs/design-reference/`** es sólo referencia visual del intento anterior en React. No se importa nada de ahí.
- **`src/server/`** (clientes web viejos) no se compila ni se migra. No tocar.

## 6. Glosario del dominio

| Término | Qué es | Dónde está |
| --- | --- | --- |
| **Show** | Una canción o presentación. Archivo `<Shows>/<nombre>.show` con el JSON `[id, Show]`. | `src/types/Show.ts:18` |
| **Slide** | Diapositiva: lista de `items`, grupo, color, notas. Vive en `show.slides[id]`. | `Show.ts:89` |
| **Item** | Elemento de una slide (texto, medio, timer, reloj, …) con posición y estilo en `style` (CSS). | `Show.ts:110` (tipos en `Show.ts:671`) |
| **Line** | Línea de texto de un item, con tramos (`text: [{ value, style }]`). | `Show.ts:284` |
| **Layout** | Orden en que se muestran las slides de un show. | `Show.ts:312` |
| **Proyecto / Playlist** | Un servicio: lista ordenada de shows y medios. Store `projects`. | `src/types/Projects.ts:6` |
| **Pantalla (output)** | Una salida (audiencia o stage) con monitor y relación de aspecto. Store `outputs`. | `src/types/Output.ts:8` |
| **Look** | Cómo se ve una pantalla. Modelo F10. | `src/types/Settings.ts:13`, `docs/design/pantallas-y-looks.md` |
| **Stage** | Pantalla para los músicos. Su diseño es un *stage layout* con items. Store `stageShows`. | `src/types/Stage.ts:14` |
| **Overlay** | Capa encima de la slide (logo, zócalo). | `Show.ts:523` |
| **Escena (`ScenePayload`)** | Lo que el frontend manda al engine por pantalla: items en píxeles, fondo, transición. | `src/types/SceneGraph.ts`, `src-tauri/src/render/scene.rs:56` |
| **Engine** | El render nativo wgpu que dibuja las pantallas (sin webview). | `src-tauri/src/render/` |
| **Golden** | Imagen de referencia de un test de render. | `src-tauri/tests/golden/scene/` |
| **Kit** | La librería de componentes de UI (botón, campos, …). | `src/frontend/lib/components/ui/`, `docs/design/kit.md` |
| **Isla** | Un componente de un framework montado dentro del otro durante la migración (`ReactIsland`, `SvelteIsland`). | F24.3, F24.4 |

## 7. Mapa rápido

| Busco… | Está en… |
| --- | --- |
| Puente IPC (`send`, comandos de salida descartados, canales pospuestos) | `src/frontend/IPC/tauri.ts` |
| Respuestas del backend (`Main.X` → función) | `src/frontend/IPC/responsesMain.ts` |
| Armado de la escena para el engine | `src/frontend/components/helpers/sceneGraph.ts`, `sceneStyle.ts`, `sceneGraphPayload.ts` |
| Cuándo se reenvía la escena | `src/frontend/utils/listeners.ts` |
| Guardado y cierre | `src/frontend/utils/save.ts` (`initializeClosing`, `closeApp`) |
| Stores globales | `src/frontend/stores.ts` |
| Traducciones | `src/frontend/utils/language.ts` (`translateText`), `components/helpers/T.svelte`, `public/lang/{en,es}.json` |
| Menú contextual (lee clases `.context` y `#id` del DOM) | `src/frontend/components/context/ContextMenu.svelte:44-64` |
| Popups (`activePopup`) | `src/frontend/components/main/Popup.svelte` |
| Comandos Rust | `src-tauri/src/commands/*.rs`, registrados en `src-tauri/src/lib.rs` |
| Pantallas nativas y loop de render | `src-tauri/src/render/screens/` (`render_loop.rs`, `lifecycle.rs`, `video_hub.rs`) |
| GPU compartida | `src-tauri/src/render/gpu.rs` |
| Texturas e imágenes | `src-tauri/src/render/media.rs` |
| Texto en GPU | `src-tauri/src/render/text.rs` (glyphon 0.12 + cosmic-text 0.19) |
| Video | `src-tauri/src/render/video/` (`avf.rs` macOS, `mf.rs` Windows, `ffmpeg.rs` respaldo, `pacing.rs`) |
| Persistencia | `src-tauri/src/domain/data/store.rs`, `src-tauri/src/utils/files.rs` (`write_file` es atómica) |
