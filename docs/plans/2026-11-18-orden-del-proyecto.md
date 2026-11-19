# Ordenar el proyecto — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** hacer el inventario de lo roto, dejar un solo sistema de estilos y dividir el frontend en
`app/`, `features/` y `shared/`, sin cambiar comportamiento.

**Arquitectura:** las tareas 3 y 4 ponen las herramientas y los guards antes de mover nada. Un script mueve archivos y
reescribe todas las rutas relativas, y los tests de arquitectura detectan rutas rotas y dependencias prohibidas.
Después se muda primero lo compartido, luego una funcionalidad por tarea y al final el armazón de la app.

**Stack:** React 19, Vite 5, TypeScript, vitest, bun, Tauri v2.

**Spec:** `docs/specs/2026-11-18-orden-del-proyecto-design.md` (leerla antes de empezar).

## Restricciones globales

- Sólo `bun` / `bunx`. Sin dependencias nuevas. Sólo macOS y Windows.
- **No correr `bun run build`** (preferencia del usuario). La verificación de arranque se hace con `bun run dev:tauri`.
- Todo el trabajo va en **una sola rama** `refactor/orden`, en el worktree `../PulseFlow-orden`. Las tareas son
  secuenciales; nunca dos agentes a la vez. Sólo un proceso usa el puerto 1420.
- Commits: conventional commits en español (`refactor(features/show): …`), sin Co-Authored-By ni atribución de IA.
- **La mudanza es mecánica.** El commit de una mudanza sólo mueve archivos y reescribe rutas. Los arreglos de tipos van
  en un commit aparte. Un bug encontrado no se arregla: se anota en `docs/diagnostico.md`.
- Prettier sólo sobre los archivos tocados en `src/`, nunca global.
- Línea base: `test:unit` en 2837/2838 (el error es un worker sin memoria, `heap out of memory`, que ya estaba);
  `tsc` sobre todo el frontend con **168** errores.

## Puntos a revisar con cuidado

1. **Un `vi.mock("./x")` que apunta a un archivo que ya no existe.** El test puede pasar en silencio usando el módulo
   real. Lo cubre `arch/relativeSpecifiers.test.ts` (tarea 4): toda ruta relativa en `from`, `import()`, `vi.mock`,
   `vi.doMock` y `vi.importActual` tiene que resolver a un archivo existente.
2. **Imports de archivos que no son TS**: `.module.css`, `.json`, imágenes. El script de la tarea 3 los reescribe por
   coincidencia exacta y tiene un caso de test para eso.
3. **`import()` dinámicos de vistas cargadas a demanda**: `tsc` no siempre los ve. Los cubre el mismo test de rutas.
4. **El diagnóstico modifica datos reales del usuario** (`Documents/PulseFlow`). Todo lo que se cree se nombra con
   el prefijo `[diag]` y se lista en el documento. No se borra ni edita nada que no tenga ese prefijo.
5. **`index.html` apunta a `/src/frontend/main.tsx`.** Si `main.tsx` se mueve sin actualizarlo, la app no arranca y
   ningún test lo detecta. La tarea 13 lo verifica levantando la app.

---

## Procedimiento de mudanza (MUD)

Lo usan las tareas 5 a 13. Cada una indica sus pares `origen=destino` y su lista de humo.

- [ ] **MUD-1: Mover.** Correr `bun scripts/move-modules.ts <origen>=<destino> ...` y esperar el resumen
  `movidos: N, reescritos: M, sin resolver: 0`. Si quedan rutas sin resolver, eran imports rotos de antes: anotarlos en
  `docs/diagnostico.md` y no arreglarlos.
- [ ] **MUD-2: Verificar.** Correr:
  - `bunx vitest run --config config/testing/vitest.config.mts src/frontend/arch` → PASS;
  - `bun run test:types` → el número de errores es ≤ al máximo anotado en `scripts/check-types.ts`;
  - `bun run test:unit` → igual que la línea base.
- [ ] **MUD-3: Commit de la mudanza.** `git add -A src/frontend`, más los configs que la tarea diga, y
  `git commit -m "refactor(<destino>): mudar <origen>"`.
- [ ] **MUD-4: Errores de tipos.** Arreglar los errores de `test:types` en los archivos recién movidos, sin cambiar
  comportamiento: tipos, guardas y `import type`. Bajar `MAX_ERRORS` en `scripts/check-types.ts` al número nuevo.
  Commit `fix(<destino>): errores de tipos`. Si no había errores en esos archivos, este paso no hace commit.
- [ ] **MUD-5: Humo.** Levantar `bun run dev:tauri` y recorrer la lista de humo de la tarea con capturas de la ventana.
  El resultado tiene que coincidir con lo que dice `docs/diagnostico.md`. Si aparece una falla nueva, la causó la
  mudanza: arreglarla antes de seguir.

---

### Task 1: Diagnóstico

**Archivos:** crear `docs/diagnostico.md`. Sonda temporal en `src/frontend/main.tsx` (**no se commitea**).

- [ ] **1.1** Crear el worktree: `git worktree add ../PulseFlow-orden -b refactor/orden main`. Después
  `cd ../PulseFlow-orden && bun install && bun run setup:sidecars --only-host`.
- [ ] **1.2** Levantar `bun run dev:tauri > /tmp/pf.log 2>&1` en segundo plano y esperar en el log la línea
  `Running \`target/debug/pulseflow\``.
- [ ] **1.3** Capturas: tomar `{posición, tamaño}` de la ventana con
  `osascript -e 'tell application "System Events" to tell (first process whose name is "pulseflow") to get {position, size} of window 1'`
  y después `screencapture -x -R<x>,<y>,<w>,<h> <archivo>`. Traer la ventana al frente antes de cada captura.
- [ ] **1.4** Para navegar sin clics, agregar al final de `main.tsx` una sonda temporal. La sonda recorre una secuencia
  de estados con los stores de `src/frontend/stores.ts`:
  - `activePage.set("show" | "edit" | "stage")`
  - `settingsOpen.set(true)` y la pestaña activa de settings
  - `activeDrawerTab.set(...)`
  - `activePopup.set(<id>)`

  En cada paso espera 3 s, escribe en el log `console.warn("DIAG <paso>")` e imprime los `console.error` que hayan
  aparecido. Entre paso y paso, sacar la captura (1.3). La lista de ids de popups sale de los `case` o del mapa de
  popups en `src/frontend/react/main/Popup.tsx`.
- [ ] **1.5** Cobertura obligatoria:
  - las páginas Show, Edit y Stage;
  - Settings, con cada pestaña;
  - cada pestaña del drawer;
  - cada popup;
  - los flujos de crear show `[diag] prueba`, agregar 3 slides, editar texto de un slide, mandar a salida, siguiente
    slide y limpiar salida. Los flujos se hacen desde la sonda llamando a las mismas funciones que llaman los botones
    (buscarlas con `rg` en `src/frontend/react/show` y `src/frontend/react/output`).
- [ ] **1.6** Escribir `docs/diagnostico.md` con estas secciones:
  - **Línea base:** fecha, commit y resultados de `test:unit` y de `tsc`.
  - **Fallas**, con columnas `id | dónde | qué pasa | cómo reproducir | gravedad (bloquea / molesta / cosmético) | captura`.
  - **UX**: lo que funciona pero es poco intuitivo, comparado con cómo lo resuelve ProPresenter.
  - **Lista de humo** por funcionalidad. La usa MUD-5.
  - **Datos creados**: todo lo que tenga el prefijo `[diag]`.

  Las capturas que valgan la pena van a `docs/diagnostico/` como `.png`.
- [ ] **1.7** Sacar la sonda de `main.tsx` (`git diff src/` debe quedar vacío) y commitear:
  `git add docs/diagnostico.md docs/diagnostico && git commit -m "docs: diagnóstico de la app"`.

---

### Task 2: Sacar Tailwind

**Archivos:**
- Modificar: `src/frontend/react/edit/CategoryPicker.tsx`, `src/frontend/react/ui/menu/MenuItem.tsx`,
  `src/frontend/react/ui/menu/MenuSeparator.tsx`, `src/frontend/react/show/left/LeftPanel.tsx`,
  `src/frontend/react/ui/section-header/SectionHeader.tsx`, `src/frontend/react/show/left/ItemsPanel.tsx`,
  `src/frontend/react/ui/list-row/ListRow.tsx`, y su `.module.css` (crearlo si no existe).
- Modificar: `src/frontend/lib/utils.ts`, `src/frontend/main.tsx`, `public/global.css`, `vite.config.mjs`,
  `package.json`, `bun.lock`, `AGENTS.md`.
- Borrar: `src/frontend/app.css`.
- Test: `src/frontend/lib/utils.test.ts`.

- [ ] **2.1** Test de `cn` en `src/frontend/lib/utils.test.ts`:
  - `cn("a", false && "b", "c")` devuelve `"a c"`;
  - `cn("p-1", "p-2")` devuelve `"p-1 p-2"`, porque ya no hay `tailwind-merge` que deduplique.

  Correrlo: el segundo caso falla.
- [ ] **2.2** `export function cn(...inputs: ClassValue[]): string` pasa a ser `clsx(inputs)`. Correr el test: PASS.
- [ ] **2.3** Antes de tocar los 7 componentes, sacar una captura de Show con el panel izquierdo y de Edit con el selector
  de categoría abierto. Después pasar cada clase de Tailwind a una clase del `.module.css`, con los mismos valores:
  - `bg-background` → `var(--primary)`;
  - `text-foreground` → `var(--text)`;
  - `border-border` → `var(--border-color, var(--primary-lighter))`;
  - `text-muted-foreground` → `color-mix(in srgb, var(--text) 60%, transparent)`;
  - `rounded-md` → `var(--radius, 6px)`;
  - `rounded-sm` → `var(--radius-chip, 4px)`;
  - `text-sm` → `var(--text-sm)`, y así con el resto de la escala;
  - espaciados en px (`p-2` = 8px).

  La tabla completa sale de los bloques `:root` y `@theme inline` de `app.css`. Confirmar que no quedan otros usos con
  `rg 'className="[^"]*\b(flex|grid|gap-|[pm][xytrbl]?-\d|bg-|text-|border-|rounded|items-|justify-|w-|h-)' src/frontend -g '*.tsx'`
  y con el mismo patrón dentro de `cn(`. Revisar cada resultado: los nombres de clase propios no cuentan.
- [ ] **2.4** Mover a `public/global.css`, dentro de su `@layer base`, la regla
  `*, ::before, ::after { border-color: var(--border-color, var(--primary-lighter)); }` de `app.css`. Borrar
  `src/frontend/app.css` y su import en `main.tsx`.
- [ ] **2.5** `bun remove tailwindcss @tailwindcss/vite tailwind-merge`. Sacar el plugin `tailwindcss()` y su import de
  `vite.config.mjs`. Dejar `clsx`.
- [ ] **2.6** En AGENTS.md, "Reglas de estilos", la viñeta de Tailwind pasa a decir: "No se usa Tailwind: los estilos van
  en CSS Modules con las variables del tema. `cn()` (clsx) sólo para clases condicionales o para mezclar con un
  `className` recibido."
- [ ] **2.7** Verificar:
  - `bun run test:unit`, `bun run test:react` y `bun run test:budget` → como la línea base;
  - `bunx prettier … --check` sobre los archivos tocados;
  - levantar `bun run dev:tauri` y comparar contra las capturas de 2.3: tienen que verse iguales.
- [ ] **2.8** Commit `refactor(estilos): sacar Tailwind y quedarse con CSS Modules`.

---

### Task 3: Script de mudanza

**Archivos:** crear `scripts/moveModules.ts` (lógica), `scripts/move-modules.ts` (CLI) y `scripts/moveModules.test.ts`.

**Interfaces producidas:**
- `interface Move { from: string; to: string }`: rutas relativas a la raíz del repo; pueden ser carpetas o archivos.
- `buildFileMap(moves: Move[], allFiles: string[]): Map<string, string>`: ruta vieja → ruta nueva de cada archivo
  afectado. Un archivo dentro de `from` conserva su subruta bajo `to`.
- `resolveSpecifier(fromPath: string, spec: string, exists: (p: string) => boolean): string | null`: ruta del archivo
  al que apunta `spec` desde `fromPath`, o `null` si no resuelve. Exportada: la usa la tarea 4.
- `rewriteSpecifiers(code: string, oldPath: string, newPath: string, fileMap: Map<string, string>, exists: (p: string) => boolean): { code: string; unresolved: string[] }`
- CLI: `bun scripts/move-modules.ts <from>=<to> [<from>=<to> ...]`.
  1. Lista los archivos de `src/` con `git ls-files`.
  2. Reescribe **todos** los `.ts`/`.tsx` de `src/`, se muevan o no.
  3. Hace `git mv` de cada archivo del mapa y borra las carpetas vacías.
  4. Imprime `movidos: N, reescritos: M, sin resolver: K` y la lista de sin resolver.

**Reglas de `rewriteSpecifiers`:**
- Sólo toca rutas que empiezan con `./` o `../`, dentro de estas formas:
  - `from "…"`
  - `import "…"`
  - `import("…")`
  - `vi.mock("…"`
  - `vi.doMock("…"`
  - `vi.unmock("…"`
  - `vi.importActual("…")`
  - `vi.importMock("…")`

  Funciona con comillas simples o dobles.
- **Resolución contra la ubicación vieja**, en este orden: la ruta exacta, después `+.ts`, `.tsx`, `.js`, `.mjs`, y
  después `/index.ts`, `/index.tsx`. El destino se busca en `fileMap`; si no está, queda donde estaba.
- La ruta nueva se calcula desde `newPath`, con el mismo estilo que la original: sin extensión si no tenía, `./`
  delante si queda en la misma carpeta, y separadores `/` también en Windows.

- [ ] **3.1** Escribir los tests en `scripts/moveModules.test.ts`. Cada caso es un `it` con su `expect` sobre `code`:
  - **archivo que no se mueve, importa uno movido:**
    `src/a/X.tsx` con `from "../b/Y"`, y `b` pasa a `src/z/b` → `from "../z/b/Y"`;
  - **archivo movido, importa uno que no se mueve:** el caso inverso;
  - **los dos se mueven juntos:** la ruta queda igual;
  - **`vi.mock`:** `vi.mock("../b/Y", () => ({}))` se reescribe;
  - **`import()` dinámico:** `import("./Lazy")` se reescribe;
  - **`.module.css`:** `import styles from "./A.module.css"` sigue a su archivo movido;
  - **`index`:** `from "../b"` que resuelve a `b/index.ts` queda sin `/index`;
  - **sin tocar:** `"react"` y `"@tauri-apps/api/core"` no cambian;
  - **sin resolver:** `from "./NoExiste"` queda igual y aparece en `unresolved`.
- [ ] **3.2** Correr `bunx vitest run --config config/testing/vitest.config.mts scripts/moveModules.test.ts` → FAIL
  (no existe el módulo).
- [ ] **3.3** Implementar `buildFileMap` y `rewriteSpecifiers` con `node:path` (`posix`) y el CLI. El CLI no hace
  `git mv` si no se le pasa ningún par.
- [ ] **3.4** Correr los tests → PASS.
- [ ] **3.5** Probar en seco: `bun scripts/move-modules.ts src/frontend/react/quicksearch=src/frontend/features/quicksearch`.
  Revisar con `git status` y `git diff --stat` que se haya movido y reescrito lo esperado, y después revertir con
  `git checkout -- src && git clean -fd src`. Sólo se permite acá, en el worktree propio y sobre cambios propios sin
  commitear.
- [ ] **3.6** Commit `feat(scripts): script para mover módulos y reescribir rutas relativas`.

---

### Task 4: Chequeo de tipos de todo el frontend y tests de arquitectura

**Archivos:**
- Renombrar: `scripts/check-react-types.ts` → `scripts/check-types.ts`; `scripts/checkReactTypes.ts` →
  `scripts/checkTypes.ts`; `scripts/checkReactTypes.test.ts` → `scripts/checkTypes.test.ts`.
- Modificar: `package.json` (`test:react` → `test:types`, también en el script `test`), `scripts/qualityBudget.ts`,
  `AGENTS.md`, `README.md`.
- Mover a `src/frontend/arch/`: `src/frontend/react/cssModulesScope.test.ts` y
  `src/frontend/react/cssModulesClasses.test.ts`.
- Crear: `src/frontend/arch/relativeSpecifiers.test.ts`.
- Borrar: `src/frontend/react/tsconfig.json`.

**Interfaces producidas:** `scripts/check-types.ts` exporta la constante `MAX_ERRORS = 168`, que bajan las tareas
siguientes. `bun run test:types` falla si hay más errores que `MAX_ERRORS`. Si hay menos, imprime
`bajar MAX_ERRORS a <n>`.

- [ ] **4.1** `check-types.ts`:
  - corre `bunx tsc -p src/frontend/tsconfig.json --noEmit --pretty false`;
  - cuenta los errores de `src/frontend/`;
  - imprime `errores: <n> (máximo <MAX_ERRORS>)`;
  - sale con 1 si `n > MAX_ERRORS`;
  - conserva el chequeo de "tsc murió sin errores parseables".

  Ajustar el nombre del import en el test. Correr `bun run test:types` → `errores: 168 (máximo 168)`.
- [ ] **4.2** `qualityBudget.ts`: la condición `startsWith("src/frontend/react/")` pasa a `startsWith("src/frontend/")`.
  Correr `bun run test:budget` → OK. Si el presupuesto sube por los `.module.css` que ahora entran, ajustarlo al valor
  medido y explicarlo en el commit.
- [ ] **4.3** Mover los dos guards de CSS a `src/frontend/arch/` y hacer que recorran `src/frontend/**`, no sólo
  `react/`. Correrlos → PASS.
- [ ] **4.4** Escribir `relativeSpecifiers.test.ts`: para cada `.ts`/`.tsx` de `src/frontend`, toda ruta relativa en las
  formas de la tarea 3 tiene que resolver a un archivo existente (mismas reglas de resolución). Usar
  `resolveSpecifier` de `scripts/moveModules.ts` (tarea 3). Correrlo: si
  falla hoy, los fallos son imports rotos de antes. Anotarlos en `docs/diagnostico.md` y meterlos en una lista
  `KNOWN_BROKEN` del test, que sólo puede achicarse (falla si una entrada ya resuelve).
- [ ] **4.5** Reemplazar `test:react` por `test:types` en AGENTS.md y README.md. En AGENTS.md, los guards ahora están en
  `src/frontend/arch/`.
- [ ] **4.6** Correr `bun run test:unit` (como la línea base), `test:types` y `test:budget`. Commit
  `test(arch): chequeo de tipos de todo el frontend y guards de rutas`.

---

### Task 5: `shared/core`

Pares para MUD:
- `src/frontend/stores.ts=src/frontend/shared/core/stores.ts`
- `src/frontend/lib=src/frontend/shared/core/lib`
- `src/frontend/values=src/frontend/shared/core/values`
- `src/frontend/classes=src/frontend/shared/core/classes`
- `src/frontend/IPC=src/frontend/shared/core/ipc`, **salvo** `IPC/responsesMain.ts`, que se muda en la tarea 7

Antes de MUD-1:
- reemplazar los 2 imports `$lib/...` por rutas relativas y sacar el alias `$lib` de `vite.config.mjs` y de
  `config/testing/vitest.config.mts`;
- borrar las carpetas vacías de `src/frontend/lib/components/`.

Mismo commit que MUD-3. Humo: la app arranca y abre Show.

### Task 6: `shared/utils`

Pares:
- `src/frontend/components/helpers=src/frontend/shared/utils/helpers`
- cada archivo de `src/frontend/utils/` que **no** esté en la lista de la tarea 7: `=src/frontend/shared/utils/<nombre>`

Humo: Show, Edit y drawer Media.

### Task 7: `app/wiring`

Pares: `src/frontend/IPC/responsesMain.ts` y estos archivos de `src/frontend/utils/` → `src/frontend/app/wiring/`:
- `startup`, `save`, `receivers`
- `listeners`, `shortcuts`, `sendData`
- `cloudSync`, `updateSettings`, `createData`
- `remoteController`, `controllerTalk`, `remoteTalk`, `stageTalk`

Cada uno va con su `.test.ts`, si existe. En MUD-4, `utils/receivers.ts` trae 40 errores de tipos. Humo: la app
arranca, guarda (cambiar el nombre de `[diag] prueba` y reiniciar) y responde a los atajos.

### Task 8: `shared/ui` y `shared/test`

Pares:
- `react/ui=shared/ui/kit`
- `react/system=shared/ui/system`
- `components/system=shared/ui/system/logic`
- `react/helpers=shared/ui/helpers`
- `react/hooks=shared/ui/hooks`
- `react/form=shared/ui/form`
- `components/form=shared/ui/form/logic`
- `react/context=shared/ui/context`
- `components/context=shared/ui/context/logic`
- `react/test=shared/test`

Todo bajo `src/frontend/`. Humo: menú contextual en un show, un popup con campos de formulario y el drawer.

### Task 9: Funcionalidades chicas

Un ciclo MUD completo (un commit de mudanza) por cada una, en este orden:
`popups`, `quicksearch`, `screens`, `looks`, `export`, `stage`, `timeline`. Para cada `<x>`, los pares son
`src/frontend/react/<x>=src/frontend/features/<x>` y, si existe, `src/frontend/components/<x>=src/frontend/features/<x>/logic`.
Humo: lo que diga `docs/diagnostico.md` para cada una.

### Task 10: `show` y `slide`

Primero `show`, con los pares de la regla general más `src/frontend/show/slides.ts=src/frontend/features/show/logic/slides.ts`.
Después `slide`, con la regla general. Humo: abrir un show y navegar slides con el teclado.

### Task 11: `settings`, `media` y `output`

`media` lleva además `src/frontend/media/cameraManager.ts=src/frontend/features/media/logic/cameraManager.ts`.
Humo: cada pestaña de settings, preview y salida, y limpiar salida.

### Task 12: `drawer`, `import`, `actions` y `edit`

Un ciclo MUD por cada uno, en este orden:
1. **`drawer`**: regla general más `src/frontend/audio=src/frontend/features/drawer/audio/logic`. Si
   `rg -l 'audio/' src/frontend/features/output` muestra imports a esa lógica de audio, mudarla a
   `src/frontend/shared/audio` en vez de al drawer.
2. **`import`**: `src/frontend/converters=src/frontend/features/import`.
3. **`actions`**: regla general.
4. **`edit`**: regla general.

Humo: cada pestaña del drawer, importar un `.txt` como `[diag] import`, y el editor de slides (editar texto, mover
una caja).

### Task 13: `app/` y cierre

- [ ] **13.1** MUD con estos pares:
  - `src/frontend/main.tsx=src/frontend/app/main.tsx`
  - `src/frontend/react/App.tsx=src/frontend/app/App.tsx`, y lo mismo para `App.module.css`, `MainLayout.tsx` y
    `MainLayout.module.css`
  - `src/frontend/react/main=src/frontend/app/main`
  - `src/frontend/components/main=src/frontend/app/main/logic`
  - `src/frontend/react/guide=src/frontend/app/guide`
  - `src/frontend/components/guide=src/frontend/app/guide/logic`
  - lo que quede en `react/` y `components/`, según la tabla de la spec

  Actualizar `index.html` a `/src/frontend/app/main.tsx` en el mismo commit.
- [ ] **13.2** Verificar que `src/frontend/react` y `src/frontend/components` no existan (`fd` no devuelve nada).
- [ ] **13.3** Crear `src/frontend/arch/sharedBoundary.test.ts`. Ningún archivo de `src/frontend/shared/` importa
  (con las formas de la tarea 3) un archivo de `src/frontend/features/` ni de `src/frontend/app/`, salvo los que
  figuran en `export const SHARED_EXCEPTIONS: string[]`. Esa lista arranca con las violaciones medidas hoy, ordenada.
  El test falla si aparece una violación nueva o si una excepción ya no viola nada (hay que borrarla). Correrlo → PASS.
- [ ] **13.4** Arreglar los errores de tipos que queden hasta `test:types` = 0. Después sacar `MAX_ERRORS` de
  `check-types.ts`: cualquier error hace fallar.
- [ ] **13.5** En AGENTS.md, "Reglas de React": el código vive en `src/frontend/app/`, `features/<x>/` (UI en la raíz,
  lógica en `logic/`) y `shared/` (`core`, `utils`, `ui`, `test`). `shared/` no importa de `features/` ni de `app/`
  (ver `arch/sharedBoundary.test.ts`).
- [ ] **13.6** Verificar `test:unit`, `test:types`, `test:budget`, los guards de `arch/` y la lista de humo completa de
  `docs/diagnostico.md` con la app levantada. Commit `refactor(app): mudar el armazón y cerrar la división en módulos`.
- [ ] **13.7** Avisar al usuario: la rama `refactor/orden` está lista para revisar e integrar. No mergear sin su OK.
