# División del repo en módulos — plan ejecutable (después de F24)

> **Estado:** propuesta. No se movió ningún archivo, no se cambió ningún import, no se tocó código.
> **Base medida:** rama local `main`, commit `2575770f` (F23 + F24 hasta F24.15e + limpieza de código muerto
> y archivado de los clientes web viejos).
> **Precondición:** ejecutar recién después de `F24.25` (aceptación de la UI React). Antes de arrancar,
> hay que registrar las tareas `F25.x` en `docs/ROADMAP.md`: este documento no crea tareas en el roadmap
> y `AGENTS.md` no permite `TODO` sin tarea asociada.
> **Fuera de alcance:** `docs/archivo/clientes-web-viejos/` (clientes web viejos, archivados el
> 2026-11-17). No se compilan ni se migran; no revivirlos sin una tarea en el ROADMAP.

---

## 1. Decisión de layout

Cinco capas, con nombres propios, **dentro de las dos raíces que ya existen** (`src/` para TypeScript y
`src-tauri/` para Rust):

```
src/
├── core/                       stores, IPC, tipos (sin UI, sin dominio)
│   ├── stores.ts                   ← src/frontend/stores.ts
│   ├── store.ts                    ← src/frontend/lib/store.ts (lo crea F24.24)
│   ├── ipc/                        ← src/frontend/IPC/ (8 archivos)
│   └── types/                      ← src/types/ (28 archivos; IPC/ queda como types/ipc/)
├── domain/                     lógica de show, valores, converters, audio
│   ├── show/                       ← src/frontend/show/
│   ├── values/                     ← src/frontend/values/
│   ├── converters/                 ← src/frontend/converters/
│   ├── audio/                      ← src/frontend/audio/
│   ├── classes/                    ← src/frontend/classes/
│   ├── media/                      ← src/frontend/media/
│   └── helpers/                    ← .ts puros hoy en components/helpers, edit/scripts, … (§4, F25.3)
├── ui/                         toda la UI React
│   ├── (todo lo de react/ post-F24, con sus .module.css y .test.tsx)
│   ├── app/                        ← main.tsx, App.tsx, MainLayout.tsx
│   └── styles/                     ← app.css, global.css de componentes
└── server/                     ← NO TOCAR (deuda registrada)

src-tauri/
├── src/
│   ├── engine/                 ← src-tauri/src/render/ (35 .rs + 6 .wgsl + submódulos)
│   ├── platform/
│   │   ├── commands/               ← src-tauri/src/commands/ (18 .rs)
│   │   ├── server/                 ← src-tauri/src/server/ (Rust: websocket/axum)
│   │   ├── domain/                 ← src-tauri/src/domain/data/ (StoreManager, backup, ZIP)
│   │   ├── types/                  ← src-tauri/src/types/ (espejo IPC de src/core/types/ipc/)
│   │   ├── state.rs, app_close.rs, menu.rs
│   ├── lib.rs, main.rs         bootstrap del crate (se queda en la raíz)
│   ├── error.rs, utils/        compartidos por engine y platform (se quedan en la raíz, §5.3)
├── tests/                      fixtures y goldens (se quedan; §6, riesgo 4)
└── tauri.conf.json             identifier `com.pulseflow.app` INTACTO
```

**Por qué no carpetas en la raíz del repo.** Un layout con `/engine` y `/platform` como crates
independientes exigiría un workspace Cargo nuevo, mover `build.rs`, `tauri.conf.json`, `capabilities/`
e `icons/`, y arreglar `beforeDevCommand`/`frontendDist` (que hoy se resuelven relativos a `src-tauri/`).
Además rompería los `include_str!("../../tests/…")` de `render/scene_contract.rs` y el
`CARGO_MANIFEST_DIR` de `render/golden.rs`. El layout elegido da los cinco nombres con **cero riesgo de
build system**: Cargo, Vite y Tauri siguen apuntando a las mismas raíces.

**Regla de oro:** cada bloque de `git mv` se commitea **junto con** sus rewrites de imports y de
configuración de §5, con el build en verde al final de cada commit (nunca un commit con imports rotos
"a la espera" del siguiente). La única excepción es el desacople de los 121 imports inversos (§3.1),
que va **antes** de F25.1 como commit separado: toca imports, no mueve archivos.

---

## 2. Inventario medido

Medición: `bun` script de lectura sobre el commit `7644d6fe`; "líneas" = cantidad de `\n` (`wc -l`),
sólo extensiones de código (`.ts`, `.tsx`, `.svelte`, `.css`, `.js`, `.rs`, `.wgsl`, `.json`). Los assets
binarios se cuentan como archivos pero no aportan líneas de código. Total medido de código en
`src/frontend + src/types + src-tauri/src`: **204.146 líneas**.

### 2.1 Por carpeta de origen

| Carpeta | Archivos | Líneas de código | Detalle |
| --- | ---: | ---: | --- |
| `src/frontend/` (total) | 1073 | 182.349 | `.ts` 328/75.821 · `.svelte` 376/67.671 · `.tsx` 264/32.777 · `.css` 88/5.395 · otros 17/685 |
| `src/frontend/react/` | 372 | 39.015 | `.tsx` 264/32.777 · `.css` 87/5.298 · `.ts` 18/900 · `.svelte` 2/39 (puentes F24.3–4) |
| `src/frontend/components/` | 506 | 106.993 | `.svelte` 332/60.899 · `.ts` 173/45.625 · `.js` 1/469 |
| `src/frontend/IPC/` | 8 | 1.467 | `ipcContract.ts|test`, `main.ts`, `pickerEvents.ts|test`, `responsesMain.ts`, `tauri.ts|test` |
| `src/frontend/audio/` | 25 | 5.572 | 25 `.ts` |
| `src/frontend/converters/` | 58 | 10.645 | 45 `.ts` + 13 assets (xml/sng/chordpro/…) |
| `src/frontend/utils/` | 41 | 8.774 | 41 `.ts`; 19 importan `components/`, 25 importan `stores` (§4, F25.3) |
| `src/frontend/values/` | 7 | 757 | 7 `.ts` |
| `src/frontend/show/` | 1 | 1.038 | `slides.ts` |
| `src/frontend/classes/` | 1 | 51 | `Show.ts` |
| `src/frontend/media/` | 1 | 361 | 1 `.ts` |
| `src/frontend/lib/` | 46 | 6.515 | 40 `.svelte`/6.458 (kit viejo) + 5 `.ts` + 1 `.md` |
| `src/frontend/` (raíz) | 7 | 1.014 | `stores.ts` 543 · `main.ts` 22 · `App.svelte` 94 · `MainLayout.svelte` 181 · `app.css` 97 · `global.d.ts` 45 · `tsconfig.json` 32 |
| `src/types/` | 28 | 3.243 | incluye `src/types/IPC/` 3/536 (`Main.ts` 428, `ToMain.ts` 96, `ServerSend.ts` 12) |
| `src/server/` | 138 | 22.687 | **NO TOCAR** |
| `src-tauri/src/` (total) | 79 | 19.239 | `.rs` 73/18.833 · `.wgsl` 6/406 |
| `src-tauri/src/render/` | 41 | 11.648 | `.rs` 35/11.242 · `.wgsl` 6/406; `media.rs` 1.060, `scene.rs` 788, `transition.rs` 659 |
| `src-tauri/src/commands/` | 18 | 4.569 | 18 `.rs`; `files.rs` es el más grande (deuda documentada en ROADMAP) |
| `src-tauri/src/domain/data/` | 6 | 1.023 | `store.rs` 430 · `backup.rs` 292 · `defaults.rs` 219 · `zip.rs` 69 · `mod.rs` 6 |
| `src-tauri/src/types/` | 2 | 214 | `mod.rs` 6 · `main.rs` 208 (espejo de `Main`) |
| `src-tauri/src/server/` | 1 | 374 | `mod.rs` (Rust, distinto de `src/server/`) |
| `src-tauri/src/utils/` | 5 | 678 | `ffmpeg.rs`, `files.rs`, `helpers.rs`, `native.rs`, `mod.rs` |
| `src-tauri/src/` (raíz) | 6 | 733 | `menu.rs` 209 · `lib.rs` 191 · `app_close.rs` 176 · `error.rs` 100 · `state.rs` 51 · `main.rs` 6 |
| `src-tauri/tests/` | 17 | — | 6 `.json`/228 líneas + 7 `.png` + 4 `.mp4` (fixtures y goldens) |
| `public/` | 194 | — | assets estáticos (Vite `publicDir`) |

### 2.2 Por capa destino (cifras de hoy, pre-F24)

| Capa | Archivos | Líneas | Observación |
| --- | ---: | ---: | --- |
| `core/` | 37 | 5.253 | stores 1/543 + IPC 8/1.467 + tipos 28/3.243. F24.24 suma `store.ts`. |
| `domain/` | 93 | 18.424 | núcleo: show, values, converters, audio, classes, media. **Agregar** los 173 `.ts`/45.625 líneas de `components/` que sean lógica pura, y parte de `utils/` (§4, F25.3). |
| `ui/` | 928 | ~152.900 | hoy React 372/39.015 + Svelte 506/106.993 + kit 46/6.515 + raíz 4/394. Al terminar F24 el *mismo* código estará en `.tsx`; la cifra de `react/` de hoy es un **piso**, no un techo. |
| `engine/` | 41 | 11.648 | + `src-tauri/tests/` (17 archivos de fixtures/goldens). |
| `platform/` | 30 | 6.616 | commands 18/4.569 + server 1/374 + domain 6/1.023 + types 2/214 + state/app_close/menu 3/436. |
| compartido Rust | 8 | 975 | `lib.rs`, `main.rs`, `error.rs` (100) y `utils/` (5/678). No entra en `engine/` ni en `platform/`. |

> **Re-medir antes de ejecutar.** F24.15f–F24.25 van a borrar cientos de `.svelte` y a crear más
> `.tsx`. Los números de esta tabla son la línea base verificable del commit indicado; el informe de
> cada fase `F25.x` debe incluir el conteo nuevo.

---

## 3. Regla de dependencias

Sentido permitido (una flecha = "puede importar de"):

```
ui  ──►  domain  ──►  core
 │           │          │
 └───────────┴──────────┘     (ui puede importar core directo: es un atajo permitido)
```

**Nunca al revés.** En particular:

| Desde `core/` | Prohibido importar |
| --- | --- |
| | `domain/`, `ui/`, `react/`, cualquier `.svelte`, `components/` |
| Desde `domain/` | Prohibido importar |
| | `ui/`, `react/`, cualquier `.svelte`, `components/` |
| Desde `engine/` (Rust) | Prohibido importar |
| | `crate::platform::*`, `crate::commands::*`, `crate::server::*` |

`ui → core` directo está permitido y es lo que ya hacen los componentes (`useStore`, `Main.*`).
En Rust, `platform → engine` es el equivalente (los comandos ya llaman a `crate::render`, 21 veces en
`commands/output.rs` y 3 en `commands/media.rs`). `engine` hoy **no** importa `commands`, `server`,
`types` ni `domain`: medido con `rg`, sus únicos `crate::*` son `render` (47), `error` (14) y `utils` (1).
Eso se preserva.

### 3.1 Estado real: la regla hoy está violada

Esto es lo que hay que arreglar **antes** de mover (fase de desacople, antes de F25.1), no después:

| Evidencia (medido) | Detalle |
| --- | --- |
| **121 imports inversos** desde core/domain candidatos a `components/` | `rg -n 'from …components/'` sobre `stores.ts`, `IPC/`, `converters/`, `audio/`, `values/`, `show/`, `types/` |
| `converters/`: 28 archivos con imports a `components/` | `songbeamer.ts`, `chordpro.ts`, `pdfToImages.ts`, `verseview.ts`, `importHelpers.ts`, 24 más |
| `audio/`: 10 archivos | `audioPlayer.ts`, `audioSender.ts`, `audioAnalyser.ts`, `audioFading.ts`, `effects/audioEffectsHelpers.ts`, `routing/*` |
| `IPC/responsesMain.ts` | 15 imports a `components/` (`actions/api`, `context/menuClick`, `drawer/bible/scripture`, `components/helpers/*`, `settings/tabs/defaultThemes`, `timeline/timecode`, …) |
| `stores.ts:35–36` | `import type { WebsiteAction } from "./components/helpers/websiteControls"` y `PlayingVideoState`/`VideoAudioData` de `./components/media/video/videoPlayer` |
| `src/types/Show.ts:1`, `src/types/Stage.ts:1` | `import type { AutosizeTypes } from "../frontend/components/edit/scripts/autosize"` |
| `src/frontend/utils/`: 19/41 archivos importan `components/` | `common.ts:5–7` importa `components/helpers/array`, `helpers/color`, `helpers/output` |
| Ciclo ya documentado | `ROADMAP.md:1867`: `language → common → save → apiHelper → historyHelpers` (títulos sin traducir si el diccionario no cargó) |

---

## 4. Lista ordenada de `git mv`

Ejecutar desde la raíz del repo, con el árbol limpio. Cada bloque es **un commit** (mensaje en
español, id `F25.x`) que incluye el `git mv` **y** sus rewrites de imports/config de §5, con el build
en verde al final del commit. **`mkdir -p` va antes porque `git mv` no crea el directorio destino.**

### F25.1 — `core/`

```bash
git status --porcelain                      # debe estar vacío
mkdir -p src/core
git mv src/frontend/stores.ts   src/core/stores.ts
git mv src/frontend/IPC         src/core/ipc
git mv src/types                src/core/types
git mv src/frontend/lib/store.ts src/core/store.ts    # sólo si F24.24 ya lo creó
```

Nota: `src/core/types/IPC/` se renombra a `src/core/types/ipc/` en el mismo commit si se quiere
uniformidad; hacerlo con `git mv src/core/types/IPC src/core/types/ipc` **antes** de reescribir imports.

### F25.2 — `domain/` (núcleo)

```bash
mkdir -p src/domain
git mv src/frontend/show        src/domain/show
git mv src/frontend/values      src/domain/values
git mv src/frontend/converters  src/domain/converters
git mv src/frontend/audio       src/domain/audio
git mv src/frontend/classes     src/domain/classes
git mv src/frontend/media       src/domain/media
```

### F25.3 — `domain/helpers/` y clasificación de `utils/`

Los 173 `.ts` de `components/` son mayormente hojas: **sólo 1** importa `components/`. Se extraen los
que son lógica pura. Lista mínima (los que hoy son destino de imports inversos, §3.1):

```bash
mkdir -p src/domain/helpers src/core/helpers
# helpers puros usados por converters/audio (dominio)
git mv src/frontend/components/helpers/array.ts        src/domain/helpers/array.ts
git mv src/frontend/components/helpers/color.ts        src/domain/helpers/color.ts
git mv src/frontend/components/helpers/show.ts         src/domain/helpers/show.ts
git mv src/frontend/components/helpers/media.ts        src/domain/helpers/media.ts
git mv src/frontend/components/helpers/time.ts         src/domain/helpers/time.ts
git mv src/frontend/components/helpers/history.ts      src/domain/helpers/history.ts
git mv src/frontend/components/helpers/setShow.ts      src/domain/helpers/setShow.ts
git mv src/frontend/components/helpers/dropActions.ts  src/domain/helpers/dropActions.ts
git mv src/frontend/components/edit/scripts/itemHelpers.ts src/domain/helpers/itemHelpers.ts
git mv src/frontend/components/edit/scripts/autosize.ts    src/domain/helpers/autosize.ts
# API de app usada por IPC → core
git mv src/frontend/components/helpers/output.ts       src/core/helpers/output.ts
git mv src/frontend/components/settings/tabs/defaultThemes.ts src/core/helpers/defaultThemes.ts
```

`utils/` **no se mueve en bloque**: 19 de 41 archivos importan `components/`. Regla de clasificación
por archivo (decidir en el commit, anotando la razón):

- importa `components/`/React y toca DOM → `ui/` (ej. `shortcuts.ts` 652 líneas, `cursor.ts`, `clickable.ts`);
- sólo stores/IPC/tipos → `core/` (ej. `common.ts` 271 líneas, `request.ts` 40);
- lógica de shows/audio/conversión → `domain/` (ej. `createData.ts` 1.467 líneas, `chordTranspose.ts` 80, `templates.ts` 81).

Los tests que viajan con su módulo se mueven con él (`*.test.ts`, `*.test.tsx`).

### F25.4 — `ui/`

```bash
mkdir -p src/ui/app src/ui/styles
git mv src/frontend/react          src/ui
git mv src/frontend/main.ts        src/ui/app/main.ts
git mv src/frontend/App.tsx        src/ui/app/App.tsx
git mv src/frontend/App.svelte     src/ui/app/App.svelte          # si F24 no lo borró
git mv src/frontend/MainLayout.tsx src/ui/app/MainLayout.tsx
git mv src/frontend/MainLayout.svelte src/ui/app/MainLayout.svelte
git mv src/frontend/app.css        src/ui/styles/app.css
git mv src/frontend/global.d.ts    src/ui/app/global.d.ts
git mv src/frontend/tsconfig.json  src/ui/tsconfig.json
```

Después de F24.24 no debe quedar ningún `.svelte` en `src/` fuera de `src/server/`; si queda, **parar**.

### F25.5 — `engine/` y `platform/` (Rust)

```bash
mkdir -p src-tauri/src/platform
git mv src-tauri/src/render            src-tauri/src/engine

git mv src-tauri/src/commands          src-tauri/src/platform/commands
git mv src-tauri/src/server            src-tauri/src/platform/server
mkdir -p src-tauri/src/platform/domain
git mv src-tauri/src/domain/data       src-tauri/src/platform/domain/data
git mv src-tauri/src/domain/mod.rs     src-tauri/src/platform/domain/mod.rs
git mv src-tauri/src/types             src-tauri/src/platform/types
git mv src-tauri/src/state.rs          src-tauri/src/platform/state.rs
git mv src-tauri/src/app_close.rs      src-tauri/src/platform/app_close.rs
git mv src-tauri/src/menu.rs           src-tauri/src/platform/menu.rs
# src-tauri/src/{lib.rs,main.rs,error.rs,utils/} NO se mueven (§5.3)
# src/server/ NO se toca. tauri.conf.json NO se toca.
```

`lib.rs` pasa a declarar `pub mod engine; pub mod platform;` (y `platform/mod.rs` declara sus
submódulos). Los `invoke_handler` siguen registrados en `lib.rs`, como exige `AGENTS.md`.

---

## 5. Reescritura de imports

Esta sección es el catálogo de rewrites que se aplican **dentro del commit de cada fase de §4** (ver
regla de oro en §1): no es una fase posterior a los movimientos. La tabla de §5.2 mezcla rutas
**pre-movimiento** (p. ej. `src/frontend/IPC/tauri.ts`) y **post-movimiento** (p. ej.
`src/core/stores.ts`): la columna "Archivo" usa la ruta que tiene el archivo *en el momento del
commit* y "Cambio" describe el destino final. El desacople de los 121 imports inversos (§3.1) se hace
antes de F25.1, como commit separado.

### 5.1 Aliases

Agregar `@core/*`, `@domain/*`, `@ui/*` en los tres lugares que hoy definen paths:

- `src/ui/tsconfig.json` (era `src/frontend/tsconfig.json`), `paths` actuales `$lib`/`$lib/*` en líneas 26–27;
- `vite.config.mjs:41–44` (alias `$lib` → `./src/frontend/lib`);
- `config/testing/vitest.config.mts:21` (alias `$lib` → `../../src/frontend/lib`).

`$lib` se conserva como alias de compatibilidad apuntando a `src/ui/lib` hasta que no queden usos;
`store.ts` pasa a importarse como `@core/store`. Codemod: convertir imports relativos que cruzan capa
en aliases; dejar los relativos dentro de la misma capa.

### 5.2 Imports que cambian sí o sí (evidencia concreta)

| Archivo | Cambio |
| --- | --- |
| `src/frontend/IPC/tauri.ts:18–20` | `../../types/Channels`, `../../types/IPC/Main`, `../utils/common` → `@core/types/...`, `@core/...` |
| `src/frontend/IPC/main.ts:2–6` | 5 imports de `../../types/IPC/*` y `./responsesMain` |
| `src/core/stores.ts:12–36` | 22 imports de `../types/*` (ahora `./types/*`), 2 de `./components/*` (ya extraídos en F25.3) |
| `src/frontend/components/helpers/sceneGraphPayload.test.ts:19` | `new URL("../../../../src-tauri/tests/fixtures/scene/", import.meta.url)` — la profundidad cambia al mover el archivo; recalcular o usar un alias de test |
| `src-tauri/src/render/scene_contract.rs:22–29` | `include_str!("../../tests/fixtures/scene/…")` — **sigue funcionando** porque `render/` y `engine/` están a la misma profundidad |
| `src-tauri/src/render/golden.rs:18` | `CARGO_MANIFEST_DIR` sigue apuntando a `src-tauri/`; sin cambio |
| `src-tauri/src/lib.rs` | `pub mod render` → `pub mod engine`; `pub mod commands/domain/server/state/menu/app_close` → `pub mod platform` |
| Llamadas Rust | `crate::render` → `crate::engine` (24 usos medidos: 21 en `output.rs`, 3 en `media.rs`); `crate::commands` → `crate::platform::commands`; `crate::state` → `crate::platform::state`; `crate::domain` → `crate::platform::domain` |

### 5.3 Compartido en Rust: por qué `error.rs` y `utils/` no se mueven

`render/video/ffmpeg.rs:15` importa `crate::utils::ffmpeg`, y `commands/{streaming,media}.rs` también.
Si `utils/` entrara en `platform/`, aparecería `engine → platform` y se rompería la regla. `error.rs`
es usado por 13 archivos de `engine` (14 usos) y por casi todos los comandos. Se dejan en la raíz del
crate como "infra compartida" y se documenta como deuda menor (separar el resolutor de ffmpeg en una
fase posterior).

### 5.4 Archivos de configuración a revisar (no son `git mv`)

| Archivo | Qué cambia |
| --- | --- |
| `index.html:20` | `<script src="/src/frontend/main.ts">` → `/src/ui/app/main.ts` (o `main.tsx` según F24.23) |
| `components.json:6` | `"css": "src/frontend/app.css"` → `src/ui/styles/app.css` |
| `src/ui/react/tsconfig.json` (F24.1) | `"extends": "../tsconfig.json"` → ruta nueva según dónde quede |
| `config/typescript/tsconfig.svelte.json:2` | `extends: ../../src/frontend/tsconfig.json` → `../../src/ui/tsconfig.json` (o borrar si F24.24 lo saca) |
| `config/typescript/tsconfig.server.json:2` | `extends: ../../src/server/tsconfig.json` — **sin cambio**, `src/server/` intacto |
| `scripts/check-react-types.ts:4,6,15` | filtro `src/frontend/react/` → `src/ui/`; ruta del `tsconfig` |
| `scripts/qualityBudget.ts:28` | `file.path.startsWith("src/frontend/react/")` → `src/ui/` |
| `scripts/check-windows-video.sh:10` | `SRC="$ROOT/src-tauri/src"` sigue válido; revisar `mod.rs` si cambia `render` → `engine` |
| `package.json:38–40` | globs `src/frontend` → `src/` o `src/ui` según cada lint |
| `src/frontend/IPC/ipcContract.test.ts:15,35–39` | rutas hardcodeadas: `src/types/IPC/Main.ts`, `src-tauri/src/lib.rs`, `src/frontend/IPC/tauri.ts` y `walk(src/frontend)` |
| `AGENTS.md`, `PLAN.md` | actualizar referencias a rutas (en un commit aparte, no mezclado con el código) |

---

## 6. Riesgos concretos y mitigación

| # | Riesgo | Evidencia | Mitigación |
| --- | --- | --- | --- |
| 1 | **Ciclos de imports.** Los módulos de core/domain hoy importan UI; al moverlos, un `import` relativo mal reescrito crea un ciclo ESM nuevo (o un `undefined` en el transform SSR de Vitest, ya visto en F4.2). | 121 imports inversos (§3.1); ciclo documentado en `ROADMAP.md:1867`. | Fase 1 obligatoria antes de cualquier `git mv`. Codemod a aliases `@core/@domain/@ui`. Test de capas con `rg` (§7). Si un helper es usado por ambos lados, va a `core/`, nunca se duplica. |
| 2 | **Stores mutados en el lugar.** Si `stores.ts` se copia en vez de moverse (o un barrel re-exporta dos copias), hay dos instancias del store: la UI se queda mirando la vieja y el engine recibe la nueva. | 624 archivos importan `stores`; 3.421 usos de `get(`; `useStore` F24.2 existe justamente porque `update(s => { s.x = 1; return s })` emite la **misma referencia**. | Un solo `git mv` de `stores.ts`; prohibido `cp`, re-export circular o crear un `index.ts` que vuelva a exportar el store. Verificar con `rg -l 'writable\(' src/` que no aparezca un segundo `stores`. |
| 3 | **Espejo de tipos IPC.** `Main.ts` (TS) y `main.rs` (Rust) deben coincidir 1:1; hoy el test que lo vigila lee rutas exactas y no compara los dos enums directamente. | `src/types/IPC/Main.ts` 428 líneas ↔ `src-tauri/src/types/main.rs` 208 líneas; `ipcContract.test.ts:35–39` lee 4 rutas fijas; `types/main.rs:1,14,199` y `commands/output.rs:31,147,156,174,202,245,298,347` tienen comentarios con rutas viejas. | Actualizar las 4 rutas del test en el **mismo commit** del movimiento; agregar un test que compare el conjunto de variantes de `enum Main` (Rust) contra `parseMainEnum()` (TS) leyendo ambos archivos por ruta nueva. Mantener `src/types/SceneGraph.ts` ↔ `render/scene.rs` y los 6 fixtures/goldens intactos. |
| 4 | **Fixtures y goldens con rutas relativas.** Cambiar la profundidad de un test rompe la comparación TS↔Rust en silencio (o peor: regenera fixtures con datos vacíos). | `sceneGraphPayload.test.ts:19` (`../../../../src-tauri/tests/...`); `scene_contract.rs:22–29` (`include_str!`); `golden.rs:18` (`CARGO_MANIFEST_DIR`). | No mover `src-tauri/tests/`. Recalcular la URL del test TS y correr `test:unit` **sin** `UPDATE_SCENE_FIXTURES`; correr `cargo test --lib` sin `UPDATE_GOLDEN`. Si los tests pasan sin regenerar, la ruta está bien. |
| 5 | **Alias `$lib` duplicado.** Vite, Vitest y TS lo definen por separado; si uno queda apuntando al directorio viejo, el build pasa y los tests fallan (o al revés). | `vite.config.mjs:43`, `vitest.config.mts:21`, `tsconfig.json:26–27`. | Cambiar los tres en el mismo commit; `rg -n '\$lib' config vite.config.mjs src/ui` debe devolver una sola ruta destino. |
| 6 | **Confusión `server/`.** `src/server/` (clientes web JS, 138 archivos, "No tocar") y `src-tauri/src/server/` (Rust, 1 archivo) tienen el mismo nombre. | Medido en §2.1. | `git mv` de Rust **siempre** con prefijo completo `src-tauri/src/server`. Ningún comando del plan escribe debajo de `src/server/`. Verificar al final con `git diff --name-status` que no aparezca esa ruta. |
| 7 | **Registro de comandos Tauri.** El regex del test de IPC y el `invoke_handler` de `lib.rs` dependen del texto `commands::<modulo>::NOMBRE`. | `ipcContract.test.ts:11` usa `/commands::[a-z_0-9]+::([A-Z][A-Z0-9_]*)/`; `lib.rs` (191 líneas) registra el handler. | Escribir los handlers como `platform::commands::<modulo>::NOMBRE` (el regex sigue matcheando el sufijo). Si se usa un `pub use platform::commands;`, verificar que el regex siga viendo los 80+ comandos. No tocar el `identifier`. |
| 8 | **Deuda de lógica en `commands/`.** Mover no arregla `files.rs` (1.081 líneas de negocio dentro de comandos, deuda ya registrada en `ROADMAP.md:1864`). | ROADMAP, sección de deuda. | Explícitamente fuera de alcance: este plan es de carpetas, no de responsabilidades. Anotar como deuda `F25.x` para no mezclar. |
| 9 | **Ventana de compatibilidad F24.** Si la división se ejecuta antes de F24.24, los puentes `ReactIsland.svelte`/`SvelteIsland.tsx` y los 332 `.svelte` de `components/` se moverían a `ui/` y habría que borrarlos después. | `src/frontend/react/` tiene hoy 2 `.svelte`; `components/`, 332. | Precondición F24.25. Chequeo de entrada: `rg --files src -g '*.svelte'` no debe devolver nada fuera de `src/server/`. |

---

## 7. Criterios de verificación

### 7.1 Línea base (no empeorar)

| Chequeo | Línea base declarada |
| --- | --- |
| `bun run test:unit` | 1.613 tests OK |
| `bun run test:react` | sin errores |
| `bun run test:svelte` | 37 errores / 289 warnings en 127 archivos (**no aumentar**). Después de F24.24 el comando desaparece y lo reemplaza `test:react` sobre todo el frontend, con trinquete de errores (F24.24 paso 5). |
| `bun run build` | OK |
| `cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test --lib` | 239 passed, 1 ignored. Si falla `render::media` por el test flaky en paralelo, repetir **sólo ese test** antes de reportar. |
| `bunx prettier --config config/formatting/.prettierrc.yaml --check <sólo archivos tocados en src/>` | limpio. **No** correr sobre `.md`, `docs/`, ni globalmente. |

### 7.2 Verificación estructural (nueva, una por fase)

```bash
# Capas TS: core y domain no deben importar UI
rg -n 'from ["'"'"'][^"'"'"']*(/ui/|@ui/|react/|components/|\.svelte)' src/core src/domain || true   # debe estar vacío
rg -n 'from ["'"'"'][^"'"'"']*@core/.*(react|components)' src/core src/domain || true                # debe estar vacío

# Un solo stores; sin copias
rg -l 'writable\(' src/ | sort

# Capas Rust: engine no depende de platform
rg -n 'crate::(platform|commands|server|state|domain)' src-tauri/src/engine || true                  # debe estar vacío
rg -n 'crate::engine' src-tauri/src/platform | wc -l                                                 # > 0 (platform → engine)

# Svelte retirado y servidor intacto
rg --files src -g '*.svelte' | grep -v '^src/server/' || true                                        # debe estar vacío
git diff --name-status main...HEAD -- src/server                                                     # debe estar vacío

# Espejo de tipos y contratos sin regeneración
bun run test:unit           # sin UPDATE_SCENE_FIXTURES
cd src-tauri && cargo test --lib   # sin UPDATE_GOLDEN

# Config consistente
rg -n '\$lib' vite.config.mjs config/testing/vitest.config.mts src/ui/tsconfig.json
rg -n 'src/frontend|src/types|src-tauri/src/render' --glob '!docs/**' --glob '!*.lock' . || true     # revisar cada coincidencia
```

### 7.3 Verificación funcional (al final de cada fase, y al final del plan)

1. `bun run dev:tauri` (un solo agente en el puerto 1420) y recorrido mínimo: abrir un show, pasar
   3 slides, poner en vivo y cerrar la salida, tocar un look, guardar y cerrar.
2. `RENDER_SNAPSHOT` con una escena de texto: el PNG debe ser idéntico al de la línea base (el engine
   no cambió de comportamiento, sólo de carpeta).
3. Los 6 fixtures del contrato Scene Graph y los goldens visuales pasan sin regenerarse.
4. El test de IPC `Main.* ↔ comandos Rust` pasa leyendo las rutas nuevas.
5. Si alguna fase no puede verificarse en la app (permisos de pantalla, segundo monitor), **decirlo
   en el reporte** y dejar el paso para el usuario, como prescribe `AGENTS.md`.

---

## 8. Deuda que queda registrada

- `docs/archivo/clientes-web-viejos/` (138 archivos / 22.687 líneas) sigue archivado: no se
  revivirá sin una tarea en el ROADMAP.
- Los 121 imports inversos se arreglan en la fase de desacople (§5, antes de F25.1), no en este documento.
- `utils/` queda repartido según criterio por archivo; conviene un `F25.x` de seguimiento para que
  no reaparezcan imports de `components/` en `core/` o `domain/`.
- `error.rs` + `utils/` compartidos en Rust: deuda menor, separar el resolutor de ffmpeg cuando el
  engine deje de necesitarlo.
- Los IDs `F25.x` usados acá son propuestos: hay que cargarlos en `docs/ROADMAP.md` antes de ejecutar.
