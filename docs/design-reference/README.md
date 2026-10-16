# Referencia de diseño (React / shadcn)

Esta carpeta conserva, **solo como referencia visual**, la estética del intento
abandonado de migrar la UI de FreeShow a React (`src-react/`, ya eliminado).

> No se compila, no se importa y no forma parte de ningún build. `tsc`,
> `svelte-check`, `prettier` y `eslint` del proyecto no la tocan (solo miran
> `src/`; `svelte-check` además ignora `docs/` explícitamente).

## Qué hay

| Ruta | Contenido |
| --- | --- |
| `index.css` | Tokens de diseño (variables CSS en `:root` y `.dark`), `@theme inline` de Tailwind v4, fuente Geist |
| `components.json` | Configuración de shadcn (estilo **new-york**, Tailwind v4, variables CSS) |
| `utils.ts` | Helper `cn()` (clsx + tailwind-merge) |
| `components/ui/` | Componentes shadcn: button, input, select, tabs, slider, switch, resizable, scroll-area, context-menu, dropdown-menu... |
| `components/*.tsx` | Layout y pantallas principales (Topbar, LibraryPanel, Editor, SlideEditor, SlideGrid, RightPanel, MediaPlaybackBar, paneles de timers, overlays, etc.) |

Se eliminaron los componentes que dependían de forma directa de la lógica de
salida/IPC (selector de motor de render, vistas de salida y stage, ajustes de
hardware/importación).

## Cómo se veía

- **Estilo:** shadcn `new-york`, Tailwind v4, tokens CSS (`--background`, `--primary`,
  `--muted`, `--border`, `--radius`...), tema oscuro por defecto, tipografía **Geist**.
- **Layout:**
  - **Topbar** arriba (proyecto, controles de proyección, ajustes).
  - **Library** (biblioteca/drawer) a la izquierda.
  - **Editor** en el centro (rejilla de slides + editor de slide).
  - **Properties** a la derecha (estilo de slide/item, notas, overlays).
  - **MediaBar** abajo (reproducción de medios, timers, controles de limpieza).
- Paneles redimensionables con `react-resizable-panels`; iconos `lucide`.

## Idea a futuro

Portar estos tokens y estilos al frontend Svelte actual (`src/frontend/`), que ya
tiene Tailwind v4 + `bits-ui` + shadcn-svelte en `src/frontend/lib`: copiar las
variables de `index.css` a la hoja global, instalar la fuente Geist y reescribir
los componentes de `components/ui/` con sus equivalentes de shadcn-svelte. Esto
**no** se aplica todavía.
