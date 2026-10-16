# PLAN — Verificar Svelte 5 + Tailwind en FreeShow

## Objetivo
Reconectar el frontend Svelte (`src/frontend`) al backend Rust/Tauri y dejarlo
sobre **Svelte 5** con **TailwindCSS 4** (+ base shadcn-svelte) funcionando.
Esta iteración se limita a **verificar que Svelte 5 y Tailwind funcionan**; el
resto (componentes shadcn, migración de `on:` a `onclick`, repintado) viene después.

## Estado actual (ya hecho)
- `svelte@5.57.2`, `vite@5.4.21`, `@sveltejs/vite-plugin-svelte@4.0.4`, `svelte-check@4`.
- `main.ts` usa `mount(App, { target })`; `svelte.config.mjs` usa `vitePreprocess()`.
- Build de compilación: **0 / 546 componentes con error**.
- `tailwindcss@4.3.3` + `@tailwindcss/vite`, importado en `src/frontend/app.css`.
- Tokens shadcn aislados como `--shui-*` (evita colisión con `--primary/--secondary/--accent` de `public/global.css`).
- `tauri.conf.json` apuntando a `devUrl :1420` y `frontendDist ../../dist`.
- Build SPA de producción → `dist/` (index.html + assets + global.css + fonts).

## Criterios de aceptación
1. `bun run build` termina sin errores y produce `dist/index.html` + assets con hash.
2. Dev server (`vite`, :1420) responde 200 en `/` y en `/src/frontend/main.ts`.
3. Tailwind: el CSS generado contiene utilidades shadcn usadas por `button.svelte`
   (`bg-primary`, `ring-offset-background`, …) y las variables `--shui-*`.
4. Svelte 5 runtime: un componente `.svelte` se **renderiza** (SSR con `svelte/server`)
   sin errores y produce el markup esperado (`data-slot="button"`).
5. `tauri.conf.json` parsea correctamente (`tauri info`).

## Pasos
1. **Svelte 5 runtime smoke test**: añadir el plugin `svelte` + alias `$lib` al
   `config/testing/vitest.config.ts` y un test `src/svelte5-smoke.test.ts` que
   haga SSR-render del `Button` y valide el HTML.
2. **Ejecutar**: `bun run test:unit -- svelte5-smoke` (o config dedicada).
3. **Tailwind**: `bun run build` + grep de utilidades/tokens en `dist/assets/*.css`.
4. **Dev server**: levantar `vite` en :1420 y comprobar `/` y `main.ts` = 200.
5. **Tauri config**: `bun --cwd=tauri-app run tauri info` (frontendDist/devUrl OK).
6. Reportar resultados.

## Riesgos / notas
- **Sin verificación visual** (no GUI): se valida compilación, build, render SSR y CSS,
  no apariencia pixel-perfect.
- **Preflight de Tailwind NO se importa** a propósito (para no resetear los estilos
  existentes de `global.css`). Se activará cuando se adopten componentes shadcn de forma masiva.
- Advertencias de `on:`/a11y son no bloqueantes en Svelte 5 (se migrarán después).

## Siguiente iteración (fuera de este plan)
- Generar componentes shadcn-svelte (`npx shadcn-svelte@latest add …`) y ajustar `$lib`.
- Migrar `createEventDispatcher`/`on:` → `onX`/`$props` de Svelte 5.
- Repintar UI con Tailwind respetando la REGLA ESTRICTA de UI (look shadcn por defecto,
  sin copiar el paint de Svelte).

## Resultado (ejecutado) — Svelte 5 OK, Tailwind OK
1. `bun run build` → OK. Sliders libres. `dist/index.html` + assets con hash (index 3.62 MB, gzip 1.12 MB).
2. Tests: `bun run test:unit` → **54/54 pass** (4 archivos), incluye el nuevo `src/svelte5-smoke.test.ts`
   que hace SSR-render del `Button` con `svelte/server` (Svelte 5 runtime) y valida `data-slot="button"`.
3. Tailwind en CSS generado (`dist/assets/*.css`): `bg-primary`, `text-primary-foreground`,
   `border-input`, `ring-offset-background` (clases usadas en `button.svelte`) + tokens `--shui-*`.
   Los tokens originales de FreeShow (`--primary`, `--secondary`) siguen intactos en `public/global.css`.
4. Dev server (`vite`, :1420): `/` = 200, `/src/frontend/main.ts` = 200.
5. `tauri info` → `frontendDist: ../../dist`, `devUrl: http://127.0.0.1:1420/`.

### Cambios de esta ejecución
- `config/testing/vitest.config.ts` → **`.mts`** (ESM) + plugin `svelte` + alias `$lib`; script `test:unit` actualizado.
- Nuevo `src/svelte5-smoke.test.ts` (smoke test SSR).
- Corregido export duplicado en `src/frontend/lib/components/ui/button/button.svelte`.

### Pendiente (no bloqueante)
- Verificación visual con `tauri dev` (requiere GUI): no ejecutable/verificable en este entorno.
- Migración de `on:`/`createEventDispatcher` y adopción masiva de shadcn (siguiente iteración).

## Revisión de consistencia (auditoría posterior) — corregido
Detalles encontrados y arreglados al revisar:
- `vite.config.mjs`: `fileURLToPath` importado sin usar → alias `$lib` ahora usa `fileURLToPath(new URL(...))` (también Windows-safe).
- `svelte-preprocess` quedó como dependencia muerta (reemplazado por `vitePreprocess`) → **eliminado**.
- `public/build/` (bundle IIFE de Svelte 3 del build de baseline) se copiaba a `dist/build/` (4.3 MB basura) → **borrado**; `dist` pasó de 16M a 12M.
- `eslint-plugin-svelte3` (era Svelte 3) rompía `lint:svelte` con Svelte 5 (`Preprocessing error`) → reemplazado por **`eslint-plugin-svelte@3` + `svelte-eslint-parser@1`** y `config/linting/eslint.svelte.js` reescrito. El linter ya parsea todos los `.svelte` (0 errores de parsing).

### Estado final verificado
- `bun run build` → OK (1525 módulos, `dist` limpio 12M).
- `bun run test:unit` → 54/54.
- `lint:svelte` (eslint) → parsea Svelte 5 sin errores de parser (157 errores/warnings son calidad de código pre-existente).
- dev server :1420 → `/`, `/global.css`, `/src/frontend/app.css`, `/src/frontend/main.ts` = 200.

### Notas menores (no bloqueantes)
- `@tsconfig/svelte@2.0.1` es antiguo (funciona); `svelte-inspector` (git) no se usa en la config actual.
- `test:svelte` (svelte-check) arrastra ~190 errores heredados → `bun run test` fallará en ese paso (pre-existente).
