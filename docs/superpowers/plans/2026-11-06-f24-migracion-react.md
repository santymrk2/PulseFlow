# F24 — Migración de la UI de Svelte a React · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).
> Leer antes `docs/superpowers/plans/2026-11-06-guia-para-ejecutores.md`.

**Objetivo:** reemplazar los 451 componentes `.svelte` de `src/frontend/` por componentes React. La app tiene que
funcionar y verse igual **en cada commit**, y al final no tiene que quedar ninguna dependencia de Svelte.

**Arquitectura:** migración incremental ("estrangulador") **dentro de la misma app de Vite**:
1. **Base:** React 19 + React Compiler conviven con Svelte en el mismo build.
2. **Puentes:** `useStore` (React lee los stores de Svelte), `ReactIsland.svelte` (React dentro de Svelte) y
   `SvelteIsland.tsx` (Svelte dentro de React).
3. **Kit:** los componentes de `lib/components/ui/` en React, idénticos visualmente.
4. **Pantallas:** de las hojas hacia la raíz. Cada `.svelte` migrado se reemplaza en su padre por una isla y se borra.
5. **Vuelta:** `App` pasa a React; lo que falte va en `SvelteIsland`.
6. **Retiro:** sin `.svelte`, se reemplaza `svelte/store` por un módulo propio con la misma API y se saca Svelte.

La lógica en TypeScript (~72k líneas: helpers, conversores, IPC, stores) **no se reescribe**.

**Stack:** React 19, React DOM 19, `babel-plugin-react-compiler` 1, `@vitejs/plugin-react` 4 (Vite 5.4), Tailwind v4
(ya instalado), Vitest 2.1 + Testing Library + happy-dom, Svelte 5 (hasta F24.24).

**Spec:** no hay spec aparte (el usuario decidió el 2026-11-06 migrar a React de forma incremental y no ir a GPUI).
Las decisiones están en "Decisiones".

---

## Por qué así

- Ya hubo un intento en React, una reescritura **paralela** en `src-react/`, borrada en `82c8a4d0` (2026-10-16). Una
  reescritura aparte no sirve hasta que está completa. Acá cada paso queda andando en la app real.
- Los stores de Svelte (`svelte/store`) son JS puro, no dependen de componentes. Hay 132 archivos `.ts` que los
  importan y 2225 usos de `get(store)`: se conservan tal cual y React los lee con `useStore`.

## Decisiones

Del usuario (2026-11-06): React sí; GPUI no; seguir en Tauri; arreglar el engine aparte (plan F23).

Del planificador, a revisar por el usuario:
- **Estilos:** los `<style>` de los componentes Svelte (31 de los 40 del kit los tienen) se copian **tal cual** a
  `Nombre.module.css`, para garantizar que se vean idénticos. Las clases nuevas usan los tokens semánticos de Tailwind
  que ya existen en `src/frontend/app.css` (`bg-background`, `text-foreground`, `border-border`, …).
- **Estado:** no se introduce Zustand ni Redux. Los stores existentes siguen siendo la fuente de verdad. En F24.24
  `svelte/store` se reemplaza por `src/frontend/lib/store.ts`, con la misma API.
- **Tests de componentes:** Testing Library + happy-dom, sólo en los archivos `.test.tsx` (con
  `// @vitest-environment happy-dom`). Los tests actuales siguen en `node`.
- **Tipos React:** `bun run test:react` falla sólo por errores **dentro de `src/frontend/react/`** (el resto del
  frontend tiene errores heredados que mide svelte-check).
- **Orden:** kit → sistema → configuración → pantallas y looks → popups → columna izquierda → cajón → slides → stage →
  show y salida → editor → resto → shell → retiro. De lo más aislado a lo más acoplado.
- **Capturas** antes y después de cada pantalla en `docs/capturas/react/<área>/`.

## Estructura

```
src/frontend/react/
├── bridge/
│   ├── ReactIsland.svelte        React dentro de Svelte (F24.3)
│   ├── SvelteIsland.tsx          Svelte dentro de React (F24.4)
│   └── svelteProps.svelte.ts     props reactivas para SvelteIsland
├── hooks/useStore.ts             lee un store de Svelte (F24.2)
├── test/storeTestKit.ts          setear stores en tests (F24.2)
├── helpers/T.tsx, Icon.tsx       traducción e íconos (F24.5)
├── popups/registry.ts            popups ya migrados (F24.10)
├── ui/<carpeta>/<Nombre>.tsx     el kit (+ .module.css + .test.tsx) (F24.6–F24.10)
└── <área>/…                      pantallas migradas: settings/, screens/, looks/, popups/, show/, drawer/,
                                  slide/, stage/, timeline/, output/, edit/, system/, main/, …
```

## Global Constraints

- Las reglas de `AGENTS.md` (con la sección "Reglas de React" que agrega F24.1) y de la guía para ejecutores.
- **La app funciona y se ve igual en cada commit.** Nada de ramas largas: cada tarea termina integrada.
- No se cambia el comportamiento: mismos textos, mismas traducciones, mismos atajos, mismo menú contextual, mismos
  stores. Las mejoras van en tareas aparte, después de F24.
- `bun run test:svelte` **nunca sube**. Cuando baja, se actualiza el presupuesto en el mismo commit
  (`bun run test:budget --update`).
- No se crean `.svelte` nuevos (salvo el puente de F24.3 y el fixture de test de F24.4).
- Los archivos de `src/frontend/` que no son UI (`helpers/*.ts`, `converters/`, `IPC/`, `utils/`, `stores.ts`, `audio/`)
  **no se tocan**, salvo un import que el compilador exija.
- Un commit por sub-tarea (`F24.15c: …`), en español.

## Review Focus

1. **Clics que el padre Svelte escuchaba con `on:click`:** después de migrar el hijo, el clic hace exactamente lo
   mismo (es el bug histórico de `Button.svelte`). Lo cubren el test de eventos de cada componente (receta, paso 4)
   y la lista de verificación en la app (paso 8).
2. **Menú contextual sobre un elemento migrado:** el clic derecho muestra el mismo menú, porque `ContextMenu.svelte`
   busca en el DOM la clase `context` y una clase `#id` (`ContextMenu.svelte:56-57`). Lo cubre el test
   `conserva_la_clase_de_menu_contextual` de la receta (paso 4) cuando el original tenía `class="context #…"`.
3. **Stores mutados en el lugar** (`update(a => { a.x = 1; return a })`, muy común en el código heredado): la vista
   React se actualiza igual. Lo cubre `se_actualiza_con_mutacion_en_el_lugar` (F24.2).
4. **Atajos de teclado mientras se escribe en un campo React:** no se disparan atajos globales, igual que en Svelte.
   Lo cubre la verificación de F24.8 y de F24.12.
5. **Listas largas** (biblioteca de 5000 shows, grilla de 300 slides): el scroll es fluido y el filtro responde en
   menos de 100 ms. Lo cubren F24.16 (paso 8) y F24.18 (paso 8).

---

## Receta: migrar un componente `.svelte` a React

Toda tarea de pantallas (F24.11 en adelante) aplica esta receta a **cada** componente de su lista, empezando por los
que no tienen hijos sin migrar.

**1. Inventario.** Antes de escribir, anotar en el cuerpo del commit:
- Props: `export let x` (legado) o `let { … } = $props()` (runes), con su tipo y su default.
- Eventos: cada `dispatch("nombre", detail)` y cada `on:evento` que reenvía, con el tipo del `detail`.
- Stores que lee (`$store`, `get(store)`) y que escribe (`.set` / `.update`).
- Hijos `.svelte` que importa (ya migrados o no).
- Clases o atributos que usan sistemas globales: `context #id` (menú contextual), `DropArea`/`id` de arrastre,
  `selected`, `data-title` (tooltips), `nocontext`.
- Si tiene `<style>`, `{@html}`, `use:acción`, `bind:`, `<svelte:window>` o `<svelte:body>`.

**2. Hijos.** Si un hijo ya tiene versión React, se usa esa. Si no, `<SvelteIsland component={Hijo} props={…} events={…} />`
(temporal; se va cuando el hijo se migre).

**3. Escribir `src/frontend/react/<área>/<Nombre>.tsx`**, con esta tabla de equivalencias:

| Svelte | React |
| --- | --- |
| `export let x = d` / `$props()` | prop `x` con el mismo nombre y default, en una `interface NombreProps` plana |
| `dispatch("cambio", v)` | prop `onCambio?: (v: Tipo) => void`, con el **mismo** `detail` como argumento |
| `$store` / `get(store)` en el template | `const valor = useStore(store)` |
| `store.set(…)` / `store.update(…)` | igual, importando el store de `stores.ts` |
| `$: y = f(x)` | `const y = f(x)` en el cuerpo del componente (el Compiler memoiza) |
| `$: { efecto }` (IPC, timers, DOM) | `useEffect(() => { efecto }, [deps])` |
| `onMount` / `onDestroy` | `useEffect(() => { …; return () => limpieza }, [])` |
| `bind:value={v}` | input controlado: `value={v}` + `onChange` que hace lo mismo que el bind |
| `bind:this={el}` | `const el = useRef<HTMLElement>(null)` + `ref={el}` |
| `{#if}` / `{:else}` | `cond ? … : …` / `cond && …` |
| `{#each lista as item (item.id)}` | `lista.map((item) => <… key={item.id} />)`; si no había key, la posición, y anotarlo |
| `<slot />` / `{@render children()}` | `children` |
| `<slot name="x" />` | prop `x?: ReactNode` |
| `class:activo={c}` | `className={cn("…", c && "activo")}` |
| `style="…{x}…"` | `style={{ … }}` sólo para valores dinámicos |
| `<style>` | `Nombre.module.css` copiado **tal cual** (`:global(…)` se conserva); `className={styles.clase}` |
| `{@html x}` | `dangerouslySetInnerHTML={{ __html: x }}` **sólo** si el original lo tenía, con la misma fuente |
| `use:accion={p}` | `useEffect` sobre un `ref` que llama a la misma función de la acción y a su `destroy` |
| `<svelte:window on:keydown={f}>` | `useEffect(() => { window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f) }, [])` |
| `<T id="a.b" />` | `<T id="a.b" />` de `react/helpers/T.tsx` |
| `<Icon id="x" />` | `<Icon id="x" />` de `react/helpers/Icon.tsx` |
| componente del kit (`lib/components/ui/…`) | su versión de `react/ui/…` |

**4. Test `<Nombre>.test.tsx`** (primera línea `// @vitest-environment happy-dom`), con `storeTestKit` para los
stores y `vi.mock` de `../../IPC/main` (o el módulo que use) si manda mensajes:
- `renderiza_lo_principal`: con stores de ejemplo, aparecen los textos o controles principales.
- un test por **cada evento** del inventario: la interacción llama al callback con el mismo `detail`, o cambia el
  store como lo hacía el Svelte.
- `conserva_la_clase_de_menu_contextual`, si el original tenía `class="context #…"`: el elemento tiene esas clases.

**5. Reemplazar en el padre.**
- Padre Svelte: `<ReactIsland component={Nombre} props={{ …props, onCambio: (detail) => handler({ detail }) }} />`.
  El `({ detail })` deja el cuerpo del handler viejo sin tocar.
- Padre React: importar directo.
- Popup: registrarlo en `react/popups/registry.ts` (F24.10) y sacarlo del mapa `popups` de `utils/popup.ts`.

**6. Borrar el `.svelte`** si `rg -n "<Nombre>.svelte" src/frontend` no da resultados. Lo mismo para un componente
del kit Svelte que quedó sin importadores.

**7. Chequeos:** `bun run test:unit`, `test:react`, `test:svelte` (≤ presupuesto; si baja, `test:budget --update`),
`test:budget` y prettier sobre lo tocado.

**8. En la app:** cada evento del inventario hace lo mismo que antes; el menú contextual, el arrastre y los atajos de
esa pantalla funcionan; los textos están traducidos. Captura antes y después en
`docs/capturas/react/<área>/<Nombre>-svelte.png` y `-react.png`. Si no podés sacar capturas, decilo en el reporte y
las saca el usuario.

**9. Commit:** `F24.n: <área> en React (<componentes>)`.

---

### Task F24.1: Base de React en el proyecto

**Files:**
- Modify: `package.json`, `bun.lock`, `vite.config.mjs`, `config/testing/vitest.config.mts`,
  `src/frontend/tsconfig.json`, `scripts/quality-budget.ts` (+ su test), `.github/workflows/ci.yml` (job Frontend),
  `AGENTS.md`
- Create: `src/frontend/react/tsconfig.json`, `scripts/check-react-types.ts` (+ `scripts/checkReactTypes.ts` y su
  test), `src/frontend/react/setup.test.tsx`

**Interfaces:**
- Produce: `bun run test:react`, que sale con 0 sólo si no hay errores de TypeScript en `src/frontend/react/**`.
- Produce: `export function parseTscErrors(output: string): TscError[]` en `scripts/checkReactTypes.ts`, con
  `export interface TscError { file: string; line: number; message: string }`. Formato que lee:
  `ruta(línea,col): error TSxxxx: mensaje`.

- [x] **Step 1: Dependencias.**
  Run: `bun add react@^19 react-dom@^19`.
  Run: `bun add -d @vitejs/plugin-react@^4 babel-plugin-react-compiler@^1 @types/react@^19 @types/react-dom@^19 @testing-library/react@^16 @testing-library/dom@^10 happy-dom@^15`.
  Si `bun` avisa conflictos de peer dependencies, **parar y reportar**.
- [x] **Step 2: Vite.** En `vite.config.mjs`, `import react from "@vitejs/plugin-react"` y
  `plugins: [svelte({…igual…}), react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }), tailwindcss()]`;
  `resolve.dedupe: ["svelte", "react", "react-dom"]`.
- [x] **Step 3: Vitest.** El mismo `react({…})` en `plugins` e
  `include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"]`. El `environment` sigue en `"node"`.
- [x] **Step 4: TypeScript.** En `src/frontend/tsconfig.json`, `"jsx": "react-jsx"` dentro de `compilerOptions`.
  Crear `src/frontend/react/tsconfig.json`:
  `{ "extends": "../tsconfig.json", "compilerOptions": { "noEmit": true }, "include": ["."] }`.
- [x] **Step 5: Test de `parseTscErrors`** (`scripts/checkReactTypes.test.ts`), que tiene que fallar primero: con la
  salida
  `src/frontend/react/ui/button/Button.tsx(3,7): error TS2322: Type 'string' is not assignable to type 'number'.`
  `src/frontend/stores.ts(10,1): error TS2304: Cannot find name 'x'.`
  devuelve dos errores con `file`, `line` y `message` correctos.
- [x] **Step 6: Implementar.** `scripts/check-react-types.ts` corre `bunx tsc -p src/frontend/react/tsconfig.json --pretty false`
  (con `Bun.spawnSync`), pasa la salida por `parseTscErrors`, se queda con los `file` que empiezan con
  `src/frontend/react/`, los imprime y sale con 1 si hay alguno. En `package.json`:
  `"test:react": "bun scripts/check-react-types.ts"`.
- [x] **Step 7: Presupuesto de calidad.** En `scripts/quality-budget.ts`, el glob pasa a `src/**/*.{ts,tsx,svelte}` y el
  conteo de hex y `rgb()` también mira `.tsx` y `src/frontend/react/**/*.module.css`. Agregar al test de
  `qualityBudget.ts` un caso con un `.tsx` que tiene `className="bg-[#ff0000]"`: cuenta 1 hex.
- [x] **Step 8: Smoke test** `src/frontend/react/setup.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

function Hola({ nombre }: { nombre: string }) {
    return <p>Hola {nombre}</p>
}

describe("base de React", () => {
    it("renderiza un componente", () => {
        render(<Hola nombre="PulseFlow" />)
        expect(screen.getByText("Hola PulseFlow")).toBeTruthy()
    })
})
```

- [x] **Step 9: CI.** En el job Frontend de `ci.yml`, después de `test:unit`:

  ```yaml
              - name: Tipos de React
                run: bun run test:react
  ```

- [x] **Step 10: `AGENTS.md`.** Agregar en la tabla de comandos la fila `| Tipos React | bun run test:react |` y, después
  de "Reglas de Svelte", esta sección **textual**:

  ```markdown
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
  ```

  Y al final de "Reglas de Svelte": `- **Svelte en retirada (2026-11-06):** no se crean componentes .svelte nuevos; un .svelte sólo se toca para arreglar un bug o para reemplazarlo por su versión React (F24).`
- [x] **Step 11: Verificar.** Run: `bun run test:unit && bun run test:react && bun run test:svelte && bun run test:budget && bun run build`. (build y dev:tauri omitidos por regla del usuario: pendiente del usuario)
  Expected: todo verde; svelte-check con los mismos 40 errores (si `"jsx"` sumó errores, parar). `bun run dev:tauri`
  abre igual que antes.
- [x] **Step 12:** commit `F24.1: React 19 con React Compiler convive con Svelte en el build`.

---

### Task F24.2: `useStore` y el kit de stores para tests

**Files:** Create `src/frontend/react/hooks/useStore.ts`, `useStore.test.tsx`, `src/frontend/react/test/storeTestKit.ts`

**Interfaces:**
- Produce: `export function useStore<T>(store: Readable<T>): T`
- Produce: `export interface StoreEntry { apply: () => () => void }`;
  `export function storeEntry<T>(store: Writable<T>, value: T): StoreEntry`, cuyo `apply` lee el valor anterior con
  `get`, setea `value` y devuelve la función que restaura el anterior (así no hace falta ningún cast); y
  `export function setStoresForTest(entries: StoreEntry[]): () => void`, que aplica todas las entradas y devuelve una
  función que las restaura en orden inverso.

Implementación (va tal cual: el objeto envoltorio hace que React re-renderice aunque el store emita **la misma
referencia** mutada en el lugar):

```ts
import { useEffect, useState } from "react"
import { get, type Readable } from "svelte/store"

export function useStore<T>(store: Readable<T>): T {
    const [box, setBox] = useState(() => ({ value: get(store) }))
    useEffect(() => store.subscribe((value) => setBox({ value })), [store])
    return box.value
}
```

- [x] **Step 1: Tests que fallan** (`useStore.test.tsx`, con `renderHook` y `act` de Testing Library):
  - `devuelve_el_valor_inicial`: `writable(1)` → `1`.
  - `se_actualiza_con_set`: `set(2)` → `2`.
  - `se_actualiza_con_mutacion_en_el_lugar`: `writable({ n: 1 })`; `update((s) => { s.n = 5; return s })` → `n` es `5`.
  - `se_desuscribe_al_desmontar`: `readable(0, () => () => { detenido = true })`; `unmount()` → `detenido === true`.
  - `setStoresForTest_restaura`: setea dos stores, llama a la función devuelta y quedan los valores originales.
- [x] **Step 2:** Run: `bunx vitest run --config config/testing/vitest.config.mts src/frontend/react/hooks`.
  Expected: FAIL.
- [x] **Step 3: Implementar** los dos archivos. Si importar `stores.ts` en un test con happy-dom rompe por globales del
  navegador o por el orden de imports, seguir el patrón de `src/frontend/converters/testEnv.ts`.
- [x] **Step 4:** chequeos verdes. Commit `F24.2: React lee los stores de Svelte con useStore`.

---

### Task F24.3: `ReactIsland`, React dentro de Svelte

**Files:** Create `src/frontend/react/bridge/ReactIsland.svelte`, `ReactIsland.test.ts`

**Interfaces:**
- Produce: `<ReactIsland component={Componente} props={{ … }} />`. Las props son reactivas (cambiar el objeto
  re-renderiza). El contenedor es un `div` con `display: contents`, así no altera el layout.

Implementación (legado `export let` a propósito, para padres en modo legado):

```svelte
<script lang="ts">
    // Isla React dentro de Svelte (F24.3).
    import { onDestroy, onMount } from "svelte"
    import { createElement, type ElementType } from "react"
    import { createRoot, type Root } from "react-dom/client"

    export let component: ElementType
    export let props: Record<string, unknown> = {}

    let host: HTMLDivElement
    let root: Root | null = null

    onMount(() => {
        root = createRoot(host)
        root.render(createElement(component, props))
    })

    $: if (root) root.render(createElement(component, props))

    onDestroy(() => {
        const current = root
        root = null
        // desmontar fuera del ciclo de Svelte evita el aviso de React por desmontar durante un render
        queueMicrotask(() => current?.unmount())
    })
</script>

<div bind:this={host} style="display: contents"></div>
```

- [x] **Step 1: Test que falla** (`// @vitest-environment happy-dom`; `globalThis.IS_REACT_ACT_ENVIRONMENT = true`):
  montar con `mount` de `svelte` sobre un `div`, dentro de `act` de `react`, un componente React
  `Saludo({ nombre })` que además marca una variable al desmontarse (`useEffect` con limpieza). Verificar
  `"Hola Ana"`. `unmount` de Svelte y esperar un microtask (`await act(async () => {})`) → la limpieza corrió.
- [x] **Step 2:** correr. Expected: FAIL.
- [x] **Step 3: Implementar.**
- [x] **Step 4:** chequeos verdes (svelte-check no sube). Commit `F24.3: islas React dentro de Svelte`.

---

### Task F24.4: `SvelteIsland`, Svelte dentro de React

**Files:** Create `src/frontend/react/bridge/SvelteIsland.tsx`, `svelteProps.svelte.ts`, `SvelteIsland.test.tsx`,
`src/frontend/react/bridge/__fixtures__/Saludo.svelte` (sólo para el test)

**Interfaces:**
- Produce: `export function SvelteIsland({ component, props, events }: SvelteIslandProps)`, con
  `export interface SvelteIslandProps { component: SvelteMountable; props?: Record<string, unknown>; events?: Record<string, (event: CustomEvent) => void> }`
  y `type SvelteMountable = Parameters<typeof mount>[0]`.
- Produce: `export function createSvelteProps<T extends Record<string, unknown>>(initial: T): T` en
  `svelteProps.svelte.ts` (`const props = $state(initial); return props`).

Implementación:

```tsx
import { useEffect, useRef } from "react"
import { mount, unmount } from "svelte"
import { createSvelteProps } from "./svelteProps.svelte"

type SvelteMountable = Parameters<typeof mount>[0]

export interface SvelteIslandProps {
    component: SvelteMountable
    props?: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
}

interface MountedIsland {
    instance: ReturnType<typeof mount>
    props: Record<string, unknown>
}

export function SvelteIsland({ component, props = {}, events }: SvelteIslandProps) {
    const host = useRef<HTMLDivElement>(null)
    const mounted = useRef<MountedIsland | null>(null)

    useEffect(() => {
        if (!host.current) return
        const reactiveProps = createSvelteProps({ ...props })
        const instance = mount(component, { target: host.current, props: reactiveProps, events })
        mounted.current = { instance, props: reactiveProps }
        return () => {
            unmount(instance)
            mounted.current = null
        }
    }, [component])

    useEffect(() => {
        if (mounted.current) Object.assign(mounted.current.props, props)
    })

    return <div ref={host} style={{ display: "contents" }} />
}
```

`events` se toma al montar (alcanza para los padres de hoy: los handlers no cambian).

- [x] **Step 1: Fixture** `Saludo.svelte` (legado): `export let nombre = ""`, muestra `Hola {nombre}` y un botón que hace
  `dispatch("saludo", nombre)`.
- [x] **Step 2: Tests que fallan:** renderiza "Hola Ana"; al re-renderizar con `nombre: "Beto"` (y `await tick()` de
  `svelte`) muestra "Hola Beto"; el clic llama a `events.saludo` con `detail === "Beto"`; `unmount` de Testing Library
  vacía el contenedor.
- [x] **Step 3:** correr. Expected: FAIL.
- [x] **Step 4: Implementar.**
- [x] **Step 5:** chequeos verdes. Commit `F24.4: islas Svelte dentro de React`.

---

### Task F24.5: Traducción e íconos en React

**Files:** Create `src/frontend/react/helpers/T.tsx`, `T.test.tsx`, `Icon.tsx`, `Icon.test.tsx` (portando
`src/frontend/components/helpers/T.svelte` e `Icon.svelte`)

**Interfaces:**
- Produce: `export function T({ id, index, lowercase, replace }: TProps)`, con la misma lógica que `T.svelte`
  (categoría y clave separadas por el primer `.`, `$:` y `:$` se ignoran, `$1…$n` se reemplazan con `replace`) y el
  diccionario leído con `useStore(dictionary)`.
- Produce: `export function Icon(props: IconProps)`, con las mismas props que `Icon.svelte` (leer su script) y el
  mismo SVG.

- [x] **Step 1: Tests que fallan:**
  - `T`: con `dictionary = { toast: { save_error: "No se pudo" } }`, `<T id="toast.save_error" />` → "No se pudo";
    `replace` con `"Hola $1"` y `["Ana"]` → "Hola Ana"; `lowercase` → en minúsculas; clave inexistente → el mismo
    resultado que da `T.svelte` (leerlo y copiar ese comportamiento).
  - `Icon`: con un id conocido de `values/customIcons` (o de donde `Icon.svelte` saque los íconos), renderiza un `svg`
    con el mismo `viewBox` y `path` que el Svelte.
- [x] **Step 2:** correr. Expected: FAIL.
- [x] **Step 3: Implementar.**
- [x] **Step 4:** chequeos verdes. Commit `F24.5: traducción e íconos en React`.

---

### Tasks F24.6–F24.10: El kit en React

Componentes de `src/frontend/lib/components/ui/<carpeta>/` → `src/frontend/react/ui/<carpeta>/<Nombre>.tsx`. Regla
de nombres: la carpeta en kebab-case y el componente en PascalCase (`text-field` → `TextField.tsx`). Todos aplican la
receta, con dos diferencias:
- **No se reemplazan los usos todavía.** Los usos se cambian cuando se migra cada pantalla. Es la única excepción a
  "sin código sin usar", hasta F24.24.
- Además de los tests de la receta, cada componente tiene `variantes_y_tamanos` (si tiene `variant`/`size`): cada
  combinación aplica las clases que aplica el Svelte.

El contrato de eventos del kit está en `docs/design/kit.md` ("Contrato de eventos"). Por ejemplo, `Button` despacha
`click` y `dblclick` con `ButtonClickDetail { ctrl, shift, alt, doubleClick, target }`: en React,
`onClick?: (detail: ButtonClickDetail, event: MouseEvent<HTMLButtonElement>) => void`.

| Tarea | Carpetas | Commit |
| --- | --- | --- |
| **F24.6** Base | `button`, `input`, `link`, `h-rule`, `title`, `section-header`, `capsule`, `list-row` | `F24.6: kit base en React` |
| **F24.7** Controles | `dropdown`, `stepper`, `slider`, `tabs`, `menu`, `zoom-control`, `choice-grid` | `F24.7: controles del kit en React` |
| **F24.8** Campos I | `text-field`, `number-field`, `textarea-field`, `select-field`, `toggle-field`, `checkbox-field`, `segmented-field`, `toggle-group-field` | `F24.8: campos del kit en React (I)` |
| **F24.9** Campos II | `color-field`, `colors-field`, `font-field`, `file-field`, `folder-field`, `time-field`, `date-field`, `radial-field`, `popup-field` | `F24.9: campos del kit en React (II)` |
| **F24.10** Distribución y demo | `input-row`, `floating-bar`, `list`, `dynamic-list`, `combined-input`, `hidden-input` + popup `kit_demo_react` | `F24.10: kit completo en React y demo comparativa` |

- [x] **F24.6**
- [x] **F24.7** (en `number-field` y `stepper` se usa `evaluateArithmetic` de F23.11 si ya existe; si no, lo mismo
  que haga el Svelte en ese momento)
- [x] **F24.8**. Verificación extra (Review Focus 4): con un `TextField` React con foco, las teclas de atajo
  globales (`src/frontend/utils/shortcuts.ts`) no se disparan, igual que con el Svelte.
- [x] **F24.9**
- [x] **F24.10**. Además de las carpetas:
  - **Registro de popups React.** Create `src/frontend/react/popups/registry.ts` con
    `export const reactPopups: Partial<Record<Popups, ElementType>> = {}`. En `src/frontend/components/main/Popup.svelte`,
    en los dos lugares donde hace `<svelte:component this={popups[popupId]} />` (l.55 y l.85): si
    `reactPopups[popupId]` existe, `<ReactIsland component={reactPopups[popupId]} />`; si no, lo de siempre. El tipo de
    `popups` en `src/frontend/utils/popup.ts:99` pasa a `Partial<{ [key in Popups]: ComponentType }>`: al migrar un
    popup, sale de ahí y entra en `reactPopups`. Test `registry.test.ts`: ninguna clave está a la vez en los dos mapas.
  - **Demo comparativa.** `src/frontend/react/popups/KitDemoReact.tsx`: el mismo contenido que
    `components/main/popups/KitDemo.svelte`, con los componentes React. Se suma `kit_demo_react` al tipo `Popups` y se
    registra en `reactPopups`.
  - **Verificación:** abrir los dos popups y sacar una captura de cada uno en `docs/capturas/react/kit/`: tienen que
    verse **idénticos**. Las diferencias se corrigen antes del commit.

---

### Task F24.11: Componentes de sistema

Receta sobre `components/system/{DropArea,Resizeable,SelectElem,Center,Autoscroll}.svelte` y
`components/helpers/{LazyLoad,HoverPlay}.svelte`, hacia `src/frontend/react/system/`.

- [x] **Step 1:** los 7 componentes con la receta. **Cuidado con `DropArea`:** el arrastre de toda la app lee sus ids
  y el store `selected`. Su test verifica que al soltar se llama a la misma función de
  `components/helpers/dropActions.ts`, con los mismos argumentos que en el Svelte.
- [x] **Step 2:** commit `F24.11: componentes de sistema en React`.

---

### Task F24.12: Configuración (I)

Receta sobre `components/settings/`: `Settings`, `SettingsModal`, `SettingsTabs`, `SettingsTools`, `General`,
`Files`, `FilesButtons`, `Other`, `OtherButtons`. Primero las hojas (`*Buttons`, `General`, `Files`, `Other`), después
`SettingsTabs`/`SettingsTools` y al final `SettingsModal`/`Settings`.
Verificación extra: cada opción de esas pestañas cambia el mismo setting (comparar `config.json` en la carpeta de
configuración antes y después de tocarla, con la versión Svelte y con la React). Con foco en un campo, los atajos
globales no se disparan.
- [x] commit `F24.12: configuración en React (general, archivos, otros)`

### Task F24.13: Configuración (II)

Receta sobre `components/settings/`: `Profiles`, `ProfilesButtons`, `ProfilesTabs`, `Connection`, `AudioRouting`,
`AudioRoutingNode`. `AudioRouting.svelte` tiene 1040 líneas: va **en su propio commit**.
- [x] commit `F24.13a: perfiles y conexión en React`
- [x] commit `F24.13b: ruteo de audio en React`

### Task F24.14: Pantallas y Looks

Receta sobre `components/screens/` (`DisplayLayout`, `ScreenConfig`, `ScreenDetail`, `ScreenList`,
`ScreenOutputOptions`, `SystemDisplays`) y `components/looks/` (`LookAdvanced`, `LookGrid`, `LooksWindow`).
Verificación extra: abrir, cerrar, duplicar y eliminar pantallas; elegir monitor; identificar pantallas; cambiar de
look en vivo. Todo con el engine real.
- [x] commit `F24.14: pantallas y looks en React`

### Task F24.15: Popups (89, en 8 tandas)

Receta sobre `components/main/popups/`. Cada popup migrado sale de `popups` (`utils/popup.ts`) y entra en
`reactPopups`. Tandas en orden alfabético (`KitDemo` se reemplaza por `KitDemoReact` en 15e y se borra el popup
`kit_demo_react`):

| Sub-tarea | Popups |
| --- | --- |
| **15a** | About, Action, ActionHistory, AddAudioEffect, Alert, AspectRatio, AudioEffect, AudioStream, CategoryAction, ChangeIcon, ChooseChord |
| **15b** | ChooseMediaInput, ChooseOutput, ChooseStyle, ChurchAppsSyncCategories, CleaningUtility, CloudMethod, CloudSync, CloudUpdate, Color, ColorGradient, Conditions |
| **15c** | ConditionsBox, Confirm, Connect, CreateCollection, CreatePlayer, CreateShow, CustomAction, CustomText, DeleteDuplicatedShows, DeleteShow, DisplayDuration |
| **15d** | DynamicValues, EditChart, EditEvent, EffectItems, Emitters, Export, FindReplace, History, Import, ImportCalendar, ImportScripture |
| **15e** | Initialize, InteractionInput, KitDemo, ManageColors, ManageDynamicValues, ManageFonts, ManageGroups, ManageIcons, ManageMetadata, ManageTags, MaxLines |
| **15f** | MediaFit, MetadataDisplay, NewUpdate, NextTimer, NodeOptions, NowPlaying, OutputSelector, OutputSetup, PdfExport, RegexManager, Rename |
| **15g** | ResetAll, Restore, SelectLook, SelectOverlay, SelectShow, SelectStageLayout, SelectStyle, SelectTemplate, SetTime, Shortcuts, SlideMidi |
| **15h** | SlideShortcut, TemplateInfo, TemplateStyleOverrides, Timecode, TimelineSettings, Timer, Transition, Translate, Unsaved, UpdateManager, Variable, WebSearch |

Verificación extra por popup: abrir desde su lugar habitual (`rg -n "activePopup.set\(\"<id>\"\)" src/frontend`),
confirmar, cancelar y cerrar con `Esc`. `Unsaved` (15h) se prueba con el cierre de F23.8.
- [ ] 15a · - [ ] 15b · - [ ] 15c · - [ ] 15d · - [ ] 15e · - [ ] 15f · - [ ] 15g · - [ ] 15h
  (commit `F24.15<letra>: popups en React (<primero>–<último>)`)

### Task F24.16: Columna izquierda

Receta sobre `components/show/left/`: `LibraryShowList`, `PlaylistAddMenu`, `PlaylistOptionsMenu`,
`PlaylistOptionsModal`, `AddShowsModal`, `LibrariesPanel`, `PlaylistsPanel`, `ItemsPanel`, `LeftPanel`, `LeftColumn`
(en ese orden). Los divisores usan `panelSizes.ts` (no se toca).
Verificación extra (Review Focus 5): con una biblioteca de 5000 shows (generar copias de un `.show` en una carpeta de
datos de prueba, **nunca** en la del usuario), el scroll es fluido y el filtro responde en menos de 100 ms (medir con
el Performance de DevTools). Todo lo de F20.8: elegir biblioteca y playlist, buscar, agregar shows, arrastrar a una
playlist, renombrar, menú contextual.
- [ ] commit `F24.16: columna izquierda en React`

### Task F24.17: Cajón (drawer, 9 tandas)

Receta sobre `components/drawer/`:

| Sub-tarea | Componentes |
| --- | --- |
| **17a** | `Label`, `Card`, `VirtualList`, `DrawerTab`, `Navigation`, `Content`, `Drawer` (raíz de `drawer/`) y `navigation/*` (AudioTabs, CalendarTabs, FunctionsTabs, MediaTabs, NavigationSections, ScriptureTabs, ShowsTabs) |
| **17b** | `media/*` (CLogo, Canva, ContentLibraryBrowser, Folder, Image, IntersectionObserver, Media, MediaCard, MediaGrid, MediaLoader) |
| **17c** | `audio/`: Audio, AudioFile, AudioMeter, AudioMixers, AudioMixersGroup, AudioChannelMixer, AudioSidechain, Metronome, MetronomeInputs, MetronomeVisualizer |
| **17d** | `audio/` (efectos): AudioCompressor, AudioDelay, AudioEffect, AudioEffectPresets, AudioEffects, AudioEqualizer, AudioFilter, AudioLimiter, AudioNoiseGate, AudioReverb, AudioStereoShaper |
| **17e** | `info/*` (AudioInfo, CalendarInfo, CanvaInfo, EffectsInfo, FunctionsInfo, Info, InfoMetadata, MediaInfo, OBSInfo, OverlayInfo, PlayerInfo, ScenesInfo, ScriptureInfo, ShowInfo, TemplateInfo) |
| **17f** | `live/*` (AudioStreams, BMDStream, BMDStreams, Cam, Cameras, Capture, LiveInfo, Mic, Microphones, NDIStream, NDIStreams, OMTStream, OMTStreams, Screens, Windows) |
| **17g** | `pages/*` (Actions, Interactions, InteractionsInfo, OBS, OverlayActions, Overlays, SceneActions, ScenePreview, Scenes, Shows, TemplateSlide, Templates, Variables) |
| **17h** | `player/*` (PlayerVideos, Vimeo, YouTube, YouTubePlayer, YouTubePlayerLite), `calendar/*` (Calendar, CalendarsManagement, CreateCalendarShow, Day), `effects/*` (EffectIcons, Effects), `timers/*` (TimerInfo, Timers) y `components/system/Player` |
| **17i** | `bible/Scripture` (1321 líneas): en su propio commit. Conserva los `{@html formatBibleText(…)}` como `dangerouslySetInnerHTML` (con F23.10 ya saneados) |

Verificación extra: el audio sigue sonando y midiendo (WebAudio no cambia); medios con miniaturas; arrastrar un medio
a la salida.
- [ ] 17a · - [ ] 17b · - [ ] 17c · - [ ] 17d · - [ ] 17e · - [ ] 17f · - [ ] 17g · - [ ] 17h · - [ ] 17i

### Task F24.18: Slides

**Entrada:** F23.17 terminada (cambia `SlideProgress`, `DynamicEvents` y `Variable`).
Receta sobre `components/slide/` y tres de `components/system/`:
- **18a:** `views/*` (Captions, Chart, DynamicEvents, IconItem, MediaItem, QrCode, SlideProgress, Table, Timer,
  Variable, Visualizer, Weather, Website) y `system/{Clock,Date,AnalogClock}`.
- **18b:** `Textbox`, `TextboxLines`, `SlideItems`, `Slide`, `SkeletonSlide`, `Zoomed`, `Layouts`, `Icons`, `Actions`,
  `BreakCountdown`, `Reference`.

`Textbox.svelte` (917 líneas) calcula el autoajuste de texto midiendo el DOM (`autosize`): conservar la **misma**
medición, porque `sceneGraph.ts` usa `item.autoFontSize` (`sceneGraph.ts:124-127`) para el proyector.
Verificación extra (Review Focus 5): un show de 300 slides abre y scrollea fluido. Lo que se ve en la vista previa
coincide con el proyector (texto, tamaño autoajustado, cajas de F23.16).
- [ ] 18a · - [ ] 18b

### Task F24.19: Stage y línea de tiempo

**Entrada:** F23.19 terminada.
Receta sobre `components/stage/` (BoxStyle, ItemStyle, SkeletonStageSlide, SlideNotes, SlideStyle, SlideText,
StageItemsList, StageLayout, StageLayouts, StageSlide, StageTools, Stagebox) y `components/timeline/` (Timeline,
TimelineEasing; `Timeline.svelte` tiene 1322 líneas: en su propio commit).
- [ ] 19a stage · - [ ] 19b línea de tiempo

### Task F24.20: Show y salida

Receta sobre:
- **20a**, `components/show/` (sin `left/`): AudioPreview, EffectPreview, FocusItem, FocusMode, FolderShow,
  HighlightedNotes, LibraryAddMenu, Media, MediaPicker, MediaPreview, Metadata, Notes, OverlayPreview, PdfPreview,
  PowerPointPreview, ProjectContentList, ProjectList, ProjectShowPlaceholder, ScreenCapture, Section, Show,
  ShowButton, ShowHeader, ShowNotes, ShowTools, SlideGroups, Slides, Tag, Tags, TextEditor, VideoShow.
- **20b**, controles de `components/output/`: ClearButtons, MediaControls, ShowActions, TimerControls, VideoSlider,
  NextTimer, MultiOutputs, SpotifyController, Window.
- **20c**, vista previa de `components/output/`: Audio, Background, BackgroundMedia, Camera, Effect, EffectOutput,
  Media, Output, OutputTransition, Overlay, Overlays, PdfOutput, Preview, PreviewCanvas, PreviewOutput, SceneMedia,
  Show, SlideContent, SlideItemTransition.

Verificación extra: poner en vivo, avanzar y limpiar (los cuatro botones de limpiar y "Limpiar todo"); la barra de
transporte del video (con F23.14, la pausa y la posición llegan al proyector).
- [ ] 20a · - [ ] 20b · - [ ] 20c

### Task F24.21: Editor

Receta sobre `components/edit/` y `components/system/{Movebox,Snaplines}`:
- **21a**, paneles: EditTools, EditValues, ItemStyle, BoxStyle, SlideStyle, SlideFilters, ItemsList, ItemAddMenu,
  Navigation, EditHeader, CategoryPicker, ThemeNavigation, OverlayNavigation, OverlayStyle, TemplateStyle.
- **21b**, editores de medios y otros: AudioEditor, AudioTools, CameraEditor, EffectEditor, EffectTools, MediaEditor,
  MediaTools, OverlayEditor, SceneEditor, SceneTools, TemplateEditor.
- **21c**, edición de texto: `system/Movebox`, `system/Snaplines`, EditboxPlain, EditboxLines, EditboxChords,
  EditboxCropping, Editbox, SlideEditor, Slides, Editor.

**21c es lo más delicado de toda la migración:** `EditboxLines` usa `contenteditable` con la selección del navegador.
Reglas: el `contenteditable` **no** se controla con estado de React (React no re-renderiza su contenido mientras se
escribe); se maneja con un `ref` y los mismos eventos y funciones de `components/edit/scripts/` que usa el Svelte. El
cursor no salta al escribir, pegar ni deshacer.
Verificación extra: escribir `canción ñandú` con acentos y `ñ` (teclado español y US-Internacional); pegar texto con
formato; deshacer y rehacer; mover y redimensionar cuadros (F22.12: arrastrar desde el texto mueve el cuadro);
acordes.
- [ ] 21a · - [ ] 21b · - [ ] 21c

### Task F24.22: Lo que queda

Receta sobre `components/context/` (ContextChild, ContextItem, ContextMenu, SpellCheckMenu), `quicksearch/QuickSearch`,
`export/Pdf`, `actions/*` (ChooseEmitter, ChooseStyle, CreateAction, CustomInput, MidiValues, RestValues,
VariableInputs), `guide/Guide`, `media/{Image,Video}`, `form/{FormInput,FormInputs}`.
**`ContextMenu`** sigue leyendo el DOM (`closest(".context")` y la clase `#id`): las dos versiones tienen que
encontrar los mismos menús. Verificar clic derecho en cada área ya migrada.
- [ ] commit `F24.22: menú contextual, búsqueda rápida, acciones y restos en React`

### Task F24.23: La raíz pasa a React

**Files:** `index.html` (agregar `<div id="root"></div>` en el `body`), `src/frontend/main.ts` →
`src/frontend/main.tsx`, `App.svelte` → `react/App.tsx`, `MainLayout.svelte` → `react/MainLayout.tsx`, y
`components/main/` sin popups (Loader, MenuBar, Modal, Popup, ProfileChangerMenu, ProfileSelector, ProgressPanel,
Recorder, Splash, StatusIndicator, Tabs, Tip, Tipbar, Toast, Tooltip, TooltipManager, Top, TopButton) +
`components/system/Main`

- [ ] **Step 1:** receta sobre los componentes de `main/` (hojas primero) y `system/Main`.
- [ ] **Step 2:** `MainLayout` y `App` en React. Lo que todavía sea `.svelte` adentro, con `SvelteIsland`.
- [ ] **Step 3:** `main.tsx`: el mismo orden que hoy (`setupTauriApi()`, `initMenuActions()`, estilos y fuentes).
  Después `const rootElement = document.getElementById("root")`; si es `null`,
  `throw new Error("Falta <div id=\"root\"> en index.html")` (sin aserciones `!`). Luego
  `createRoot(rootElement).render(<App />)`. En `index.html`, el script apunta a `main.tsx`.
- [ ] **Step 4:** `Popup.svelte` → `react/main/Popup.tsx`: dibuja `reactPopups` directo y los que queden en `popups`
  con `SvelteIsland`.
- [ ] **Step 5: En la app:** el arranque completo (splash, perfil, carga de shows, autostart de salidas), todas las
  áreas, atajos, menú nativo de macOS, cierre con guardado (F23.8).
- [ ] **Step 6:** commit `F24.23: la raíz de la app es React`

### Task F24.24: Sacar Svelte

**Entrada:** `fd -e svelte . src/frontend` sólo muestra `react/bridge/ReactIsland.svelte` y el fixture de F24.4 (o
nada). `src/server/` (clientes web viejos, no se compilan) queda afuera y se anota en "Deuda registrada".

**Files:** Create `src/frontend/lib/store.ts` y `store.test.ts`; Modify todos los
`import … from "svelte/store"` de `src/frontend/`; Delete `react/bridge/` (y su fixture),
`src/frontend/components/helpers/*.svelte` y `lib/components/ui/` que queden; Modify `package.json`,
`vite.config.mjs`, `config/testing/vitest.config.mts`, `src/frontend/tsconfig.json`, `config/quality-budget.json`,
`scripts/quality-budget.ts`, `config/formatting/.prettierrc.yaml`, `.github/workflows/ci.yml`, `AGENTS.md`

**Interfaces (la misma API que `svelte/store`):**
- `export interface Readable<T> { subscribe(run: Subscriber<T>, invalidate?: () => void): Unsubscriber }`
- `export interface Writable<T> extends Readable<T> { set(value: T): void; update(updater: Updater<T>): void }`
- `export type Subscriber<T> = (value: T) => void`, `Unsubscriber = () => void`, `Updater<T> = (value: T) => T`,
  `StartStopNotifier<T> = (set: (value: T) => void, update: (fn: Updater<T>) => void) => void | (() => void)`
- `export function writable<T>(value?: T, start?: StartStopNotifier<T>): Writable<T>`
- `export function readable<T>(value: T | undefined, start: StartStopNotifier<T>): Readable<T>`
- `export function derived<S, T>(stores: S, fn: (values: StoresValues<S>, set?: (value: T) => void) => T | void, initial?: T): Readable<T>`
  (un store o un array; forma síncrona y forma con `set`)
- `export function get<T>(store: Readable<T>): T`

Semántica que hay que copiar: `subscribe` llama enseguida con el valor actual; `set` con el mismo **primitivo** no
notifica, pero con un **objeto o función** notifica siempre (`safe_not_equal` de Svelte); `start` corre con el primer
suscriptor y su limpieza con la salida del último.

- [ ] **Step 1: Tests que fallan** (`store.test.ts`), uno por regla de la semántica, más `derived` simple, con array y con
  `set` asíncrono, y `get`.
- [ ] **Step 2: Implementar** `store.ts`.
- [ ] **Step 3: Cambiar los imports:**
  `sd 'from "svelte/store"' 'from "$lib/store"' $(rg -l 'from "svelte/store"' src/frontend)`.
  `useStore` también pasa a `$lib/store`. Run: `rg -n '"svelte' src/frontend`. Expected: nada fuera de `src/server`.
- [ ] **Step 4: Sacar Svelte:** `bun remove svelte @sveltejs/vite-plugin-svelte prettier-plugin-svelte svelte-check @tsconfig/svelte`
  (sólo los que estén en `package.json`), el plugin de Vite y de Vitest, el `extends` de `@tsconfig/svelte` (copiar a
  `src/frontend/tsconfig.json` las opciones que heredaba y que el código necesita) y el plugin de prettier.
  `test:svelte` desaparece; `test:react` pasa a mirar **todo** `src/frontend` (sacar el filtro por carpeta de
  `check-react-types.ts` y mover su `tsconfig` a `src/frontend/tsconfig.json`).
- [ ] **Step 5: Presupuesto:** `svelteCheckErrors` se reemplaza por `tsErrors` con el número que dé `test:react` sobre
  todo el frontend ese día (trinquete: no sube). Hex y `rgb()` siguen contándose en `.tsx` y `.module.css`.
- [ ] **Step 6: `AGENTS.md`:** se borra "Reglas de Svelte" y la regla de la tabla de svelte-check; "Reglas de React" deja de
  hablar de islas.
- [ ] **Step 7:** todos los chequeos y `bun run build` en verde; la app completa en Mac y en Windows.
- [ ] **Step 8:** commit `F24.24: la UI ya no depende de Svelte`.

### Task F24.25: Aceptación (usuario)

- [ ] Un ensayo completo de un servicio real con la app React, en Mac y Windows y con 2 monitores: armar la playlist,
  proyectar canciones con fondos, una lectura bíblica, un video con pausa, overlays, stage, timers, editar una slide
  y cerrar guardando. Cada falla se convierte en una tarea `F24.n Corregir: …` en el roadmap.
