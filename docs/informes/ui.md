# Informe — Carril D (Interfaz)

Agente nocturno, rama `feature/f11-ui`. Tareas en orden: F11.2, F11.3, F11.4, F11.5,
F11.6, F11.8, F11.10.

## Nota transversal de chequeos

La línea base documentada en el ROADMAP (F0) es `svelte-check 58 errores`, pero ese
número quedó obsoleta: un HEAD limpio de `feature/f11-ui` (527876ae) ya tiene
**60 errores** (verificado con un worktree temporal en HEAD puro). El set de errores
antes/después de mis cambios es **idéntico** (diff exacto de las 60 líneas), así que el
criterio aplicado es "no empeorar el set de HEAD limpio". `test:unit` subió de 58 a
68/68 con los tests nuevos que agrego por tarea.

## F11.2 — Cajón inferior como "media bin" (2026-10-20)

Commit `0a075dcd`.

### Qué se hizo

- **`drawer/breadcrumb.ts`** (nuevo): `getBreadcrumbs(tab, activeSubTab, data)` resuelve
  la tira de migas por pestaña (medios → carpeta, audio → playlist, scripture → libro,
  overlays/templates → categoría, etc.) con catálogos de datos pasados por parámetro
   (testeable sin stores). `breadcrumb.test.ts`: 5 tests de vitest.
- **`Drawer.svelte`**:
  - Manija de resize de 4 px (`.handle`, cursor `ns-resize`, `--secondary` mientras se
    arrastra) reemplaza al pseudo-elemento `::after` sobre `.top`.
  - Pestañas superiores solo-icono (36 px, `border-radius: var(--radius) var(--radius) 0 0`),
    se eliminan los `<span>` con etiqueta de texto.
  - Barra de migas (32 px, `›` separador, migas al 50 % salvo la actual).
  - Pie de 36 px en grilla `1fr auto 1fr`: `+` a la izquierda (acciones por pestaña:
    show nuevo, importar Biblia, abrir carpeta MEDIA/AUDIO, crear categoría
    overlays/templates), buscador centrado de 256 px (mismas clases
    `search edit drawer_search` para no romper el Ctrl+F ni el plugin de scripture), y
    a la derecha toggle grilla/lista (sólo Media) + slider de columnas
    (`Slider`, 2–10, invertido).
  - `.content` ahora es flex en vez de `calc()` fijo, porque las migas son condicionales.
- **`Media.svelte`**: los controles flotantes duplicados (zoom + grilla/lista abajo a la
  derecha, zoom en secciones de proveedores) se reemplazan por `<MaterialZoom hidden …/>`
  — se conserva el handler de rueda a nivel ventana que exige el id del elemento en la
  cadena del target. Se borra `slidesViews` (quedó muerto).
- **`MaterialDrawerTab.svelte` / `Navigation.svelte`**: filas de 32 px redondeadas
  (`var(--radius)`), hover `--hover`, activa `--primary-lighter` con barra de acento de
  3 px; aire de 4 px + gap 2 px alrededor de la lista de categorías.
- **Lang**: clave `ui.filter` ("Filter" / "Filtro") en la sección nueva `ui`, insertada
  textualmente sin reformatear el resto del archivo.

### Chequeos

- `bun run test:unit`: 68/68.
- `bun run test:svelte`: 60 errores — set idéntico al de HEAD limpio (verificado con
  diff contra worktree temporal), 0 aportados por esta tarea.
- `bun run build`: OK (warnings de tamaño de chunks heredados).
- Prettier limpio en los archivos tocados de `src/`.

### Verificación visual

Pendiente de realizar con la app (lock `/tmp/pulseflow-app.lock`); se anota en el
resumen final si no se llegó.

### Decisión pendiente

- El buscador del pie muestra el botón "Filtro" colapsado con etiqueta sólo si
  `$labelsDisabled` es falso (misma condición que antes); si el equipo preiere
  etiqueta siempre visible, es un cambio de una línea.

## F11.3 — Panel izquierdo: proyectos y navegación (2026-10-20)

Commit `75a0943d`.

### Qué se hizo

- **`ProjectList.svelte` / `Projects.svelte` / `ProjectContentList.svelte`**: filas de
  32 px (`min-height`, `padding-block: 0 !important` para ganarle al padding inline de
  los botones), redondeadas con `var(--radius)`, hover `--hover`, activa
  `--primary-lighter` + barra de acento de 3 px `--secondary`. En ProjectContentList no
  se fuerza altura fija (las filas de sección llevan notas/horarios) ni se toca el
  radio derecho inline de la primera/última fila de cada cápsula.
- **Títulos de sección** (`.title` en `NavigationSections`, `ProjectList`, `Projects`):
  mayúsculas, `0.62rem`, `letter-spacing: 0.08em`, opacidad 0.45, separador
  `--border-color`.
- Menús contextuales: sin cambios (sólo CSS propio de cada componente).

### Chequeos

- `test:unit` 83/83 (subió con los tests del merge de Looks), `test:svelte` 57 errores
  (igual que HEAD post-merge), `build` OK, Prettier limpio.

### Verificación visual

Pendiente (misma nota que F11.2).

## F11.4 — Cabecera del show (2026-10-20)

Commit `f6f9b7bb`.

### Qué se hizo

- `ShowHeader.svelte` a 44 px: icono de layout, nombre del show, "· layout", contador de
  diapositivas a la derecha, botón "Añadir" (ghost, `variant="text"`) que crea una
  diapositiva (`history({ id: "SLIDES" })` + `activeEdit`/`activePage`) y "Proyectar"
  (secundario, `variant="contained"` = `--secondary`) que proyecta la diapositiva
  activa (o la primera si no estamos en edición) vía `setOutput("slide", …)`.

### Chequeos

- `test:unit` 83/83, `test:svelte` 57 errores (línea base), `build` OK, Prettier limpio.
