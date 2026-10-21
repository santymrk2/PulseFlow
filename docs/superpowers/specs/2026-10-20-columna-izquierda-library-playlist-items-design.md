# Columna izquierda: LIBRARIES · PLAYLISTS · ÍTEMS — Diseño

Fecha: 2026-10-20. Estado: borrador para aprobación del usuario.
Maquetas de referencia (no son el diseño final): `.superpowers/brainstorm/73277-1792540932/content/panel-izquierdo-v4.html` (estados y paneles) y `…-v2.html` (barras de título y pestañas con texto).

## Por qué

La pantalla principal mezcla dos modelos. ProPresenter organiza el trabajo en *Library → Playlist → ítems*; FreeShow en *Categorías de shows → Proyectos → Cajón con pestañas*. Hoy conviven y se pisan:

- Las categorías aparecen **dos veces**: arriba como `LIBRARY` y abajo como `CATEGORIES` del cajón (pestaña Shows).
- La lista de shows queda aplastada en el cajón, y la playlist (lo que se opera en vivo) tiene una sola fila visible porque comparte la columna con LIBRARY y MEDIA.
- `MEDIA` está arriba y también como pestaña abajo.
- El `+` de LIBRARY crea cosas de cuatro tipos distintos.

El usuario quiere **una estructura en la que cada cosa viva en un solo lugar y el límite entre secciones se vea**.

## Objetivos

1. La columna izquierda de la página **Show** tiene tres paneles apilados, cada uno con barra de título propia: **LIBRARIES**, **PLAYLISTS** e **ÍTEMS**.
2. **ÍTEMS es contextual**: muestra lo que está seleccionado arriba (ver "Comportamiento").
3. El cajón inferior **no muestra la lista de shows**; conserva Media, Audio, Overlays, Plantillas, Biblia, Calendario y Plugins, con **texto en las pestañas** en lugar de íconos.
4. La app arranca con **una sola library, "General"**.
5. Las secciones se distinguen a simple vista: barra de título más clara que el fondo, línea gruesa de separación, contador propio y un `+` que crea lo de **su** sección.

## No objetivos

- No cambia el formato de shows, libraries (categorías) ni proyectos guardados. **Sin migración**: lo que el usuario ya tiene se conserva tal cual.
- No se tocan las páginas Edit y Stage ni sus columnas izquierdas.
- No se rediseñan Media, Audio, Overlays, Plantillas, Biblia, Calendario ni Plugins; sólo cambian las pestañas que los abren.
- No se migran componentes a runes (regla de `AGENTS.md`).

## Anti-objetivos (fracaso aunque "funcione")

- Que una misma cosa aparezca en dos lugares (categorías, media, lista de shows).
- Que el `+` de un panel agregue algo de otro panel.
- Que el usuario no sepa de qué library o playlist es la lista que está viendo.

## Comportamiento

**Selección única.** Hay una sola fuente activa: una library **o** una playlist. Se marca con barra azul a la izquierda y fondo azulado (la misma marca en los dos paneles). Elegir una library desmarca la playlist y viceversa.

**ÍTEMS según la fuente:**

| Fuente | Contenido de ÍTEMS | Buscador | `+` de ÍTEMS |
| --- | --- | --- | --- |
| Library | shows de esa library | sí (filtra por nombre) | nuevo show en esa library |
| Playlist | ítems de la playlist, en su orden | no | abre el **modal "Agregar shows"** |

La barra de ÍTEMS lleva una pastilla con el nombre de la fuente y el contador (`ÍTEMS · Example · 5`).

**Modal "Agregar shows"** (lo pidió el usuario): se abre desde el `+` de ÍTEMS con una playlist elegida. Izquierda: lista de libraries. Derecha: shows de la library elegida con buscador y casillas de selección **múltiple**. Botón "Agregar N" los agrega al final de la playlist. Se puede cambiar de library sin perder lo ya marcado.

**Otras formas de armar un servicio** (suposición mía, ver abajo): arrastrar un show desde ÍTEMS (fuente library) hasta una fila de PLAYLISTS, y clic derecho → "Agregar a playlist".

**`+` de cada barra:** LIBRARIES crea una library; PLAYLISTS crea una playlist (y carpeta, como hoy); ÍTEMS según la tabla.

**Se mantiene como hoy** en ÍTEMS (fuente playlist): arrastrar y soltar, reordenar, menú contextual y doble clic.

**Clic en un show de ÍTEMS con fuente library:** lo abre en el centro para verlo y editarlo, **sin** agregarlo a ninguna playlist (suposición mía, ver abajo).

**Al iniciar:** queda seleccionada la última fuente usada; si no hay ninguna, la primera playlist, y si no existe, la library "General" (suposición mía). ÍTEMS nunca queda sin fuente: sin playlists ni libraries muestra un estado vacío con el `+` correspondiente.

**Perfiles con acceso restringido:** LIBRARIES sigue ocultando las libraries sin acceso (`getAccess(id)`), como hoy.

**Cajón inferior:** pestañas con texto (Media, Audio, Overlays, Plantillas, Biblia, Calendario, Plugins). Arranca en **Media**. Pestaña activa: texto blanco, subrayado azul, fondo igual al del contenido; las demás en gris. Con poco ancho, las que no entran van a un menú "⋯".

## Datos

- `default_synced_settings` (Rust, `src-tauri/src/domain/data/defaults.rs`) y su espejo `defaultSyncedSettings` (TS) pasan de `{song, presentation}` a **una sola library `General`** con `default: true` y nombre traducible (`category.general`).
- Los usuarios existentes conservan sus libraries; sólo cambia lo que reciben los perfiles nuevos.
- Las plantillas (`templateCategories`) y overlays (`overlayCategories`) **no cambian**.

## Restricciones del proyecto (de `AGENTS.md`)

- Sólo macOS y Windows. Sólo `bun`.
- Apariencia por variables CSS del tema (`--primary`, `--secondary`, `--text`…); sin colores fijos. El azul de las maquetas es `--secondary`/el acento actual, no un hex.
- Un componente que recibe `on:click` de sus padres se queda en modo legacy (`export let`) o reenvía el evento. Los componentes del kit (`lib/components/ui`: `SectionHeader`, `ListRow`, `Button`…) se reutilizan.
- Textos por traducciones (`translateText`), en todos los idiomas que el proyecto mantiene.
- `bun run test:unit`, `bun run test:svelte` **sin aumentar** los errores heredados, prettier sólo sobre los archivos de `src/` tocados. Un commit por tarea.

## Dónde toca (hallazgos del código)

- `src/frontend/MainLayout.svelte` (líneas ~58–110): hoy arma `librarySection`, `Projects`, `ProjectContentList` y `MEDIA` en la columna izquierda.
- `src/frontend/components/show/{Projects,ProjectContentList,LibraryAddMenu}.svelte`.
- `src/frontend/components/drawer/Drawer.svelte`: la tira de pestañas ya excluye `shows` (`tab.id !== "shows"`), pero `activeDrawerTab` arranca en `"shows"` (`stores.ts:71`) y el cajón se abre sobre esa vista. Las etiquetas están como sólo-ícono desde F11.2.
- `src/frontend/values/tabs.ts` (`drawerTabs`) y `drawer/navigation/ShowsTabs.svelte`, `drawer/pages/Shows.svelte` (la vista de shows que deja de usarse en el cajón).
- `src/frontend/utils/createData.ts:523`: crea una library `scripture` al agregar una Biblia; sigue creándose **bajo demanda**, no por defecto.

## Lo que queda para quien lo construya

- Ids y claves de traducción (`category.general`, etiquetas de pestañas).
- Cómo se reparte y persiste el alto de los tres paneles (propuesta: 4 · 2 · 4, divisores arrastrables, usando `Resizeable`).
- El destino de los atajos `Ctrl+1…` del cajón (hoy `Ctrl+1` abre Shows).
- Rendimiento de la lista de shows con cientos de canciones (virtualización si hace falta).
- Cómo se comporta el cajón colapsado (`drawer.height <= 40`) con pestañas de texto.

## Mis decisiones (no las dijo el usuario; revisarlas)

1. Nombre **"General"** para la library por defecto (la sección ya se llama LIBRARY).
2. Reparto de alto 4 · 2 · 4 con divisores arrastrables.
3. El buscador va dentro de ÍTEMS cuando la fuente es una library.
4. `+` de ÍTEMS con fuente library = "nuevo show".
5. Arrastrar de ÍTEMS a PLAYLISTS y "Agregar a playlist" por clic derecho, además del modal.
6. PLAYLISTS conserva carpetas y proyectos como hoy (en las maquetas se dibuja plana por simplicidad).
7. Cajón arranca en Media; las pestañas que no entran van a "⋯".
8. La library `scripture` se sigue creando sólo al agregar una Biblia.
9. Clic en un show de la library lo abre en el centro sin agregarlo a una playlist.
10. Selección inicial: última fuente usada → primera playlist → library "General".
