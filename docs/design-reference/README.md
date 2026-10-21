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

## Mapeo a variables FreeShow (tema Svelte actual)

El frontend Svelte no renombra variables shadcn: mantiene nombres históricos FreeShow con otra semántica. Por ello el port se hace **por valores**, no por nombres. Comparando con `src/frontend/components/settings/tabs/defaultThemes.ts` y `public/global.css`:

| Token shadcn (referencia) | Variable FreeShow (Svelte) | Uso en FreeShow |
| --- | --- | --- |
| `--background` | `--primary` | fondo del panel / base |
| `--card` / `--sidebar` | `--primary-darker` | superficies secundarias / paneles |
| `--accent` | `--primary-lighter` | superficies resaltadas |
| `--foreground` | `--text` | texto principal |
| `--sidebar-primary` | `--secondary` | acento / color secundario |
| `--border` | `--border-color` (propuesto o existente según componente) | bordes |
| `--radius` | `--radius` (propuesto) | radios globales |

Notas: el tema se aplica inline desde `defaultThemes.ts` sobre `<html>`. Geist ya figura en la pila de fuentes (`--font-family` incluye `"Geist"`); si faltara cargar la font, instalar `@fontsource-variable/geist`.

## Idea a futuro

Hecho en F6.2–F6.5 (ver `docs/ROADMAP.md`): tema "PulseFlow" por defecto con los
valores `.dark` de la referencia (`defaultThemes.ts`), fuente Geist empaquetada
(`@fontsource-variable/geist`), radios/bordes globales `var(--radius)` /
`var(--border-color)` en los componentes base, topbar de 48px y componentes
shadcn-svelte generados en `src/frontend/lib/components/ui/` (su regla de uso
está en el README de esa carpeta: sólo pantallas nuevas).

Pendiente de verificación visual: `docs/archivo/VERIFICAR-F6.md`.
