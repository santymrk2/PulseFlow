# Diagnóstico de la app (línea base antes de ordenar)

Inventario de lo roto, lo poco intuitivo y lo que hay que revisar a mano después de cada mudanza.
Se hizo levantando la app real (`bun run dev:tauri`, Tauri en macOS Apple Silicon, modo dev) y recorriendo
cada pantalla con una sonda temporal. Las capturas están en `docs/diagnostico/`.

## Línea base

| Qué | Valor |
| --- | --- |
| Fecha | 2026-11-19 |
| Commit | `25102cbc` (rama `refactor/orden`) |
| `bun run test:unit` | 482/483 archivos, **2837/2838 tests**. El único error es `Worker exited unexpectedly` (worker sin memoria), ya conocido. |
| `tsc -p src/frontend/tsconfig.json` (todo el frontend) | **168** errores |
| `tsc -p src/frontend/react/tsconfig.json` | 136 errores (casi todos en archivos heredados fuera de `react/`: `utils/receivers.ts` 44, `components/helpers/dropActions.ts` 9, `IPC/main.ts` 9, `utils/startup.ts` 8, …) |
| Arranque | `dev:tauri` levanta, la ventana abre y la UI renderiza. En el log sólo salen los avisos de F06 y F18. |

No se corrió `test:react`, `test:budget`, prettier ni Rust: esta tarea no toca código.

## Cómo se obtuvo (para repetirlo)

1. `bun run setup:sidecars --only-host` una vez, después `bun run dev:tauri > /tmp/pf.log 2>&1`.
2. Sonda temporal al final de `src/frontend/main.tsx` (no se commitea): importa los stores de
   `src/frontend/stores.ts` y recorre una lista de pasos. Cada paso espera ~1,8 s, hace
   `console.warn("DIAG <paso>")` y a los 2,5 s `console.warn("DIAGERRS <paso> :: [errores]")`.
   `console.warn` y `console.error` de la webview salen en el log de Tauri como `[webview][WARN]` / `[ERROR]`.
   Un `console.error` interceptado junta los errores del paso; si `#root` queda vacío, el paso se marca
   `DIAGCRASH` y la sonda hace `location.reload()` y sigue en el paso siguiente (el índice vive en `sessionStorage`).
3. Un script `tail -F /tmp/pf.log` captura al ver `DIAG <paso>` con
   `screencapture -x -o -l <idVentana>`; el id sale de `CGWindowListCopyWindowInfo` (JXA) filtrando por dueño `pulseflow`.
   Con `-l` **no hace falta traer la ventana al frente**.
4. Pasos usados: `activePage.set("show"|"edit"|"stage"|"reflow"|"calendar")`, `activeDrawerTab.set(<id>)`,
   `quickSearchActive.set(true)`, `settingsTab.set(<id>)` + `settingsOpen.set(true)`, `activePopup.set(<id>)` para los 90 ids
   de `Popups` (`src/types/Main.ts`), y los flujos llamando a las mismas funciones que los botones:
   `convertText(...)` (`converters/txt.ts`, la usa el popup `show`), `formatText(...)` (editor de texto),
   `setOutput("slide", …)`, `OutputHelper.advanceOutputs("next")` y `clearAll(true)` (`ClearButtons.tsx`).
5. Los popups se abrieron **sin `popupData`** (como los abre la sonda, no el menú contextual). Los que dependen de esos
   datos salen vacíos o rompen: está anotado caso por caso.

## Fallas

Gravedad: **bloquea** (no se puede seguir usando esa parte o se pierde la ventana), **molesta** (funciona mal pero hay
rodeo), **cosmético**.

| id | dónde | qué pasa | cómo reproducir | gravedad | captura |
| --- | --- | --- | --- | --- | --- |
| F01 | Página **Edit** con un show cargado | **Arreglado** (ca8c81cb y 142d2a1f). La ventana entera queda **en blanco** y no se recupera sin reiniciar. En el log: `The \`style\` prop expects a mapping from style properties to values, not a string` (React, `setValueForStyles`), con `An error occurred in the <div> component`. **Origen confirmado:** `react/edit/tools/EditValues.tsx:411` pasa `style={values.style}` a `<FontField>`, y `values.style` es un string CSS (`"flex: 4;max-width: 80%;"`, definido en `components/edit/values/boxes.ts:131`). `ui/font-field/FontField.tsx:63` lo reenvía a `<InputRow style={style}>` y `ui/input-row/InputRow.tsx:29` lo pone en `<div className="row" style={style}>`: React exige un objeto y revienta. Se confirmó con la sonda: se interceptó `document.createElement`, y el elemento que falla es `div.row` (InputRow) con un `SelectField` "Font family" adentro. Arreglo probable: convertir con `cssTextToStyle(values.style)` en `EditValues.tsx:411` (o en `FontField`). Los otros campos de `EditValues` no pasan `values.style` crudo a un DOM (revisado por `rg`). | Pestaña Show → crear un show (`Nuevo show`, con dos grupos de texto) → que quede seleccionado → clic en el lápiz (Edit). Reproducido 3 veces (con la sonda: `convertText` + `activeShow.set` en la página Show, y después `activePage.set("edit")`). Si el show no está cargado en `showsCache` (p. ej. se pasa a Edit sin haber pasado por la página Show) no rompe: ver F04. | bloquea | `f01-edit-pantalla-blanca.png` |
| F02 | Popup `metadata_display` (`react/popups/MetadataDisplay.tsx:55`) | **Arreglado** (b0d1d6a6). `TypeError: null is not an object (evaluating 'data.type')`: lee `popupData` sin comprobar que exista. Rompe toda la ventana (ver F15). | `activePopup.set("metadata_display")` sin `popupData` (o abrir el popup sin datos). Desde la UI se abre desde categorías/estilos con datos: **no verificado por UI**, puede ser sólo un artefacto de la sonda. | molesta | `f02-popup-metadata-display-blanco.png` |
| F03 | Popup `edit_event` (`react/popups/EditEvent.tsx:71` `getISO`, llamado desde `resetEdit:150`) | **Arreglado** (507f42b3). `RangeError: Invalid Date` por `toISOString()` de una fecha inválida. Ventana en blanco. | `activePopup.set("edit_event")` sin `popupData`. En la UI: drawer Calendario → `New event` (**verificar**: ese camino sí pasa datos). | molesta | `f03-popup-edit-event-blanco.png` |
| F04 | Página **Edit** con `activeEdit.slide = 0` y show no cargado | **Arreglado** (66bddd29). `Maximum update depth exceeded` repetido sin parar (miles de líneas en el log, CPU alta). La UI se ve ("No slides"), pero hay un bucle `setState` en un efecto. | `activeShow.set({ id, type: "show" })` de un show que no está en `showsCache`, `activeEdit.set({ slide: 0, items: [] })`, `activePage.set("edit")`. Camino por UI **no confirmado**; se anota porque un bucle así suele aparecer con datos reales. | molesta | `f04-edit-bucle-actualizacion.png` |
| F05 | `activePage` = `"reflow"` o `"calendar"` (`TopViews`, `src/types/Tabs.ts`) | `MainLayout` no tiene vista para esos valores: queda todo vacío (sin barra lateral ni centro). Ningún botón de la UI lleva a ellos (el botón del libro del `Top` abre Escritura). Valores del tipo sin uso. | `activePage.set("reflow")` o `activePage.set("calendar")`. | cosmético | `f05-pagina-reflow-vacia.png`, `f06-pagina-calendar-vacia.png` |
| F06 | Arranque | `[tauri] invoke("INIT_PORT") failed: Command INIT_PORT not found`: el frontend invoca un comando de Rust que no existe. | Arrancar la app y mirar el log. | cosmético | — |
| F07 | Drawer: pestañas `shows`, `overlays`, `templates`, `timers` | `activeDrawerTab` acepta esos ids (`DrawerTabIds`) pero la barra del drawer sólo muestra Media, Audio, Scripture, Calendar y Functions (`values/tabs.ts`). Al fijar uno de los ocultos, el drawer sigue mostrando Media. Overlays y Templates se editan desde el menú `⋮` (Overlay editor / Theme editor), no desde el drawer. | `activeDrawerTab.set("overlays")` (o `templates`, `timers`, `shows`). Confirmar si Overlays/Templates/Timers están en otra parte de la UI (Functions → Timers sí existe). | molesta | `f07-drawer-overlays-cae-en-media.png`<br>**Arreglado** (a0c136e1): la guarda de Drawer ya redirigía a Media; se sacaron del tipo los ids sin pestaña. Overlays/Templates siguen en el menú ⋮. |
| F08 | Popup `connect` | El enlace dice `http://undefined:undefined` y el QR apunta a eso. En el log de arranque: `[server] remote/stage/controller/output_stream: sin cliente web empaquetado, no se abre el puerto 551x`, o sea que en dev no hay servidor. | Drawer Functions o Settings → Connection → activar RemoteShow → `Connect`; o `activePopup.set("connect")`. | molesta | `f08-popup-connect-undefined.png`<br>**Arreglado** (9d3d4ba5) sólo el caso sin id/ip (muestra "no disponible"). **Pendiente:** con id+ip y sin cliente web el link sigue roto; opción recomendada, un comando Rust que informe qué servidores están abiertos. |
| F09 | Popup `select_look` | El título muestra la clave cruda `[popup.select_look]`: falta `popup.select_look` en `public/lang/en.json`. | `activePopup.set("select_look")`. | cosmético | `f09-popup-select-look-sin-traduccion.png` |
| F10 | Settings → Files | El icono de carpeta/enlace rojo de `Data location` se pisa con el texto `Documents/PulseFlow`. | Abrir Settings → Files. | cosmético | `f10-settings-files-icono-superpuesto.png` |
| F11 | Panel de salida (columna derecha) | Con una slide enviada a salida, el recuadro de preview queda **negro**: no se ve el contenido que sale. Lo que sí cambia: la slide se marca en el grid, aparece el botón de refresco, el botón "Clear all" y, tras limpiar, "Restore output". No se verificó la ventana de salida física del engine WGPU (no hay segunda pantalla en esta prueba). | Show con 3 slides → clic en la slide 1 (o `setOutput("slide", …)`) y mirar el recuadro Output. | molesta | `f11-salida-preview-vacio.png`<br>**Arreglado** (25f34ab1): PreviewOutput no montaba `<Output>`. |
| F12 | Columna izquierda (Libraries) | Un show creado sin categoría crea la categoría `Unlabeled`, y esa fila queda recortada y pisada por el encabezado `PLAYLISTS` (el panel Libraries no crece). | Crear un show sin elegir categoría, mirar la columna izquierda. | cosmético | `f12-libraries-unlabeled-recortado.png` |
| F13 | Popup `cleaning_utility` | Cuerpo completamente vacío (sólo el título). Posible falta de `popupData`. | `activePopup.set("cleaning_utility")`. | cosmético | `f13-popup-cleaning-utility-vacio.png` |
| F14 | Popup `choose_output_type` | La grilla de tipos de salida (Window, Blackmagic, NDI, OMT, WebRTC, …) se corta abajo: el último botón queda a medias y hay que hacer scroll dentro del popup. | `activePopup.set("choose_output_type")` o Configure screens → agregar salida. | cosmético | `f14-popup-choose-output-type-recortado.png` |
| F15 | `react/App.tsx` / raíz | **Arreglado** (058de0ff). **No hay error boundary.** Cualquier excepción de render (F01, F02, F03) desmonta todo el árbol: ventana blanca, sin mensaje, sin botón para recuperar. Agrava todas las otras fallas. | Ver F01/F02/F03. | bloquea | `f02-popup-metadata-display-blanco.png` |
| F16 | Popup `select_style` | Warning de React: `Each child in a list should have a unique "key" prop` en `SlideContent` (hijo `SlideItemTransition`). | `activePopup.set("select_style")`. | cosmético | — |
| F17 | Popup `choose_media_input` | Warning: `Unsupported style property object-fit. Did you mean objectFit?` (estilo en kebab-case en un objeto). | `activePopup.set("choose_media_input")`. | cosmético | — |
| F18 | Drawer → Scripture | Al abrirlo salen `Error loading API Bible` y `The tag <%s> is unrecognized in this browser` en el log. La lista de Biblias y el texto se ven bien. | `activeDrawerTab.set("scripture")`. | cosmético | — |
| F19 | Popup `manage_fonts` | La fila `System` muestra **0** fuentes: `getSystemFontsList` devuelve vacío en macOS, entonces no se pueden elegir fuentes del sistema. | Settings → General → `Manage fonts`. | molesta | —<br>**Arreglado** (1a1cc43b): comando Rust LIST_SYSTEM_FONTS (fontdb) en vez de queryLocalFonts. |

Lo que **funcionó** y está verificado: arranque, las 3 páginas (Show/Edit sin show/Stage sin layouts), las 6 pestañas
de Settings, las pestañas Media/Audio/Scripture/Calendar/Functions del drawer, el buscador rápido, y los flujos
crear show `[diag] prueba` con 3 slides, editar el texto (pasa a 4 slides, el contador del encabezado se actualiza),
enviar a salida, siguiente slide (pasa a la 2) y limpiar salida (aparece "Restore output"). Los otros 88 popups abren y
renderizan (varios vacíos por no tener `popupData`).

## UX: funciona pero es poco intuitivo (vs ProPresenter)

| Qué se ve | Cómo lo resuelve ProPresenter | Propuesta |
| --- | --- | --- |
| Página Edit sin show: izquierda "No show selected" pero el centro muestra el splash de bienvenida con "Quick search / New project / New show". Mezcla dos estados. | Edit (Reflow/Edit) sin slide muestra el canvas vacío con el mensaje de qué falta elegir. | Un único estado vacío por página; esconder el splash fuera de Show. |
| Stage sin layouts: "No layouts" / "No layout selected" y un único botón `New layout` abajo a la izquierda, lejos de la mirada. | Los layouts de Stage se arman desde una lista con acción de alta visible arriba. | Botón de alta arriba de la lista y plantilla de ejemplo. |
| Buscador rápido: el cuadro aparece en el centro-inferior de la columna central, debajo del contenido y sin resultados ni sugerencias hasta escribir. | La búsqueda va en un campo fijo de la lista de shows, con resultados en vivo. | Mostrarlo arriba, centrado, y listar recientes. |
| Crear un show sin categoría lo manda a `Unlabeled`, que aparece como una categoría más, y el show queda activo pero la lista `ITEMS` sigue mostrando otra categoría (no se ve el show creado). | Al crear, el show aparece resaltado en la biblioteca activa. | Crear en la categoría seleccionada y seleccionarlo en la lista. |
| Drawer: sólo 5 pestañas (Media, Audio, Scripture, Calendar, Functions); Overlays, Templates y Timers no tienen pestaña propia (F07). | La barra de biblioteca tiene Shows, Media, Audio, Props, Messages, etc. a la vista. | Decidir cuáles se exponen y si Overlays/Templates vuelven. |
| Settings → General: los botones `Manage metadata / dynamic values / emitters / fonts / icons / colors` están abajo a la izquierda, separados de lo que configuran. | ProPresenter agrupa preferencias por categoría y lleva cada gestor dentro de su sección. | Mover cada `Manage …` a la sección que corresponde. |
| Salida: el preview del panel derecho queda negro aunque haya algo en salida (F11) y no hay indicación de qué se está enviando. | El panel de salida muestra la miniatura del slide vivo y el nombre de la presentación/slide. | Pintar el preview de la salida o mostrar un texto con lo que está en vivo. |
| Los popups muestran su título crudo (`[popup.x]`) o quedan vacíos cuando falta un dato (F09, F13) y nunca explican qué falta. | Los diálogos vacíos dicen qué acción falta ("No hay …, creá uno"). | Un estado vacío estándar para popups sin datos. |
| `Clear all` y `Restore output` ocupan el mismo lugar y cambian de sentido tras limpiar; no hay confirmación visual de que se restauró. | Los grupos Clear tienen botones fijos con estado (activo/inactivo). | Mantener ambos visibles, con el estado resaltado. |

## Lista de humo (la usa MUD-5)

Después de cada mudanza hay que poder hacer, **sin errores `[webview][ERROR]` nuevos** en el log de `dev:tauri` y sin
ventana en blanco. Cada entrada dice qué abrir y qué debe pasar. Los números `F` son fallas ya conocidas: no cuentan
como regresión si siguen igual.

| Funcionalidad | Cómo abrirla | Debe pasar |
| --- | --- | --- |
| Arranque | `bun run dev:tauri` | Abre la ventana, se ve la barra superior, Libraries/Playlists/Items, panel de salida y el drawer abajo; en el log sólo F06 y los avisos de puertos (F08). |
| Libraries / Playlists | Columna izquierda de la página Show: clic en `+` de `LIBRARIES` y de `PLAYLISTS`; clic en una biblioteca (p. ej. `General`) | Cada `+` abre su menú/alta (`react/show/LibraryAddMenu.tsx`); al elegir una biblioteca, `ITEMS` lista sus shows; los contadores se actualizan. `Playlists` dice "Nothing here" si está vacía. |
| Show (página) | Clic en el icono "Show" (barra superior) | Columna izquierda con Libraries, Playlists e Items; centro con la lista de slides del show activo o el splash; derecha con el panel de salida. |
| Crear show | Clic en `New show` del splash, o `+` de `ITEMS` | Abre el popup `show` (New show): nombre, categoría y 3 opciones (Quick lyrics / Web search / Empty show). Con texto en 3 bloques separados por línea vacía y Ctrl/Cmd+Enter se crea y aparece con 3 slides y etiquetas de grupo. |
| Edit (página) | Con un show seleccionado, clic en el lápiz | **Hoy rompe (F01).** Debe: lista de slides a la izquierda, canvas en el centro, herramientas abajo (texto, imagen, video, timer, …). |
| Edit: texto | Pestaña `Text edit` de Edit | Editar texto actualiza las slides y el contador del encabezado ("N slides"). |
| Slide | Clic en una slide del grid | Se marca la slide (borde) y se manda a la salida; flecha derecha/izquierda o `>`/`<` del panel avanzan y retroceden. |
| Escritura (libro) | Icono del libro de la barra superior | Abre el drawer en la pestaña Scripture (lo hace `Top.tsx: openScriptureDrawer`; no es una página): Biblias, libros, capítulos, versículos. |
| Stage | Menú `⋮` de la barra superior → `Stage editor` (o icono Stage) | Lista de layouts a la izquierda ("No layouts" si no hay) y centro vacío; no rompe con show activo. |
| Overlays | Panel de salida: icono de capas (`layers`) de la fila de herramientas; edición: `⋮` → `Overlay editor` | La lista/selector de overlays abre; el editor abre la página Edit en modo overlay (hoy puede romper por F01 si hay campos de fuente). |
| Templates | `⋮` → `Theme editor` | Abre Edit en modo template (misma salvedad de F01). Popups `select_template` y `template_info` por sonda (ver Popups). |
| Timers | Drawer → `Functions` → `Timers`; icono de reloj del panel de salida | Lista de timers; `New timer`/popup `timer` ofrece "From start to end", "Towards a time", "Time until event". |
| Variables | Drawer → `Functions` → `Variables` | Lista de variables; el alta abre el popup `variable` con Number / Random number / Text / Text set. |
| Salida (output) | Clic en una slide; `>` siguiente; `Clear all` | Avanza y retrocede, `Clear all` limpia y aparece `Restore output`; `Restore output` vuelve a la slide. |
| Pantallas (screens) | Settings → General → `Configure screens…` | Popup `screen_config`: lista Audience/Stage, monitores detectados, tipo, cropping y sending. |
| Looks | Icono paleta (barra superior, a la derecha) → menú de looks / ventana de looks | Ventana con la lista de looks, "Default" y presets, botones Rename/Duplicate/Delete/Make Live. |
| Drawer: Media | Pestaña `Media` (o icono de media de la barra) | Carpetas Pictures/Videos, All/Inputs/Online, grilla de media. |
| Drawer: Audio | Pestaña `Audio` | Lista de audio, carpeta Music, Metronome, mezclador a la derecha. |
| Drawer: Scripture | Pestaña `Scripture` | Lista de Biblias, libros, capítulos y versículos; `New scripture`, `New collection`. |
| Drawer: Calendar | Pestaña `Calendar` | Calendario del mes, `Events` y `Schedule action`, botones `New event` e `Import calendar`. |
| Drawer: Functions | Pestaña `Functions` | Actions, Timers, Variables, Scenes, Interactions; botón `New interaction`. |
| Timeline | **Sin camino por clics confirmado** (el timeline de proyecto depende de `special.projectTimelineActive`). Snippet: `DS.activePopup.set("timeline"); /* y luego */ DS.activePopup.set("timecode")` | Ambos popups abren con campos de tiempo (Start time; Type/Frame rate/Mode); sin errores. |
| Settings | Atajo `Cmd+,` (abre `openSettings`) o el botón de ajustes del drawer | Modal con 6 pestañas: General, Audio, Connection, Files, Profiles, Other; cada una renderiza su contenido (Audio con el grafo, Files con Backup/Restore, Other con Reset). |
| Popups (los 90) | Sólo por sonda: `for (const id of POPUPS) { DS.activePopup.set(id as never); await new Promise(r => setTimeout(r, 2000)); DS.activePopup.set(null) }`, con `POPUPS` = los 90 ids de la unión `Popups` en `src/types/Main.ts`. Sin `popupData` es normal que algunos salgan vacíos (F13) | Ninguno deja la ventana en blanco salvo `metadata_display` (F02) y `edit_event` (F03). Para ver el error: `[webview][ERROR]` en el log. Caminos por clic de los comunes: `export` (`Cmd+E`), `import` (`Cmd+I` o el `+` de LIBRARIES → Import), `about` (menú de la app), `manage_*` (Settings → General). |
| Quicksearch | Icono lupa (barra superior) o `Cmd+F` | Aparece el cuadro `Quick search…`; Esc lo cierra. |
| Export | `Cmd+E`, o por sonda: `DS.activePopup.set("export")` | Tres opciones: Current project, Selected shows, All shows. |
| Actions | Drawer Functions → Actions → `New action`; por sonda: `DS.activePopup.set("action")`, `"custom_action"`, `"category_action"`, `"action_history"` | Abren con "Choose action" / "Nothing here" sin error. |
| Media (popups) | Drawer Media → `Inputs`/`Add folder`; por sonda: `DS.activePopup.set("media_fit")`, `"choose_media_input"` | `media_fit` muestra Contain/Cover/Fill/Blur fill; `choose_media_input` pestañas Cameras/Screens/NDI/OMT/Blackmagic (F17 sigue). |
| Import | `Cmd+I` o `+` de LIBRARIES → Import; por sonda: `DS.activePopup.set("import")`, `"import_scripture"`, `"import_calendar"` | `import` lista orígenes (Show, Project, Lessons, PDF, PowerPoint, texto, …); los otros dos ofrecen URL/API y Local. |

Para los pasos "por sonda" agregá al final de `main.tsx`: `import * as DS from "./stores"` y la línea que dice la tabla,
dentro de `setTimeout(() => { … }, 12000)` (esperar a que cargue la UI). Quitar todo antes de commitear (`git diff src/` vacío).

## Datos creados

- Show **`[diag] prueba`** (y, en pruebas de F01, `[diag] edit b`): se crearon con `convertText` desde la sonda. Quedan
  **sólo en memoria**; no se guardó ningún archivo `[diag]` en `~/Documents/PulseFlow` (se verificó la carpeta `Shows/`
  y `Config/` antes de terminar). Si la app autoguarda (cada 15 min) y alguno aparece, borrarlo a mano desde la lista.
- La categoría `Unlabeled` apareció como efecto de crear esos shows sin categoría; se reinicia con la app.
- No se editó ni borró nada que no empezara con `[diag]`.

## Qué no se pudo cubrir

- Menús contextuales, arrastrar y soltar, diálogos nativos de archivo (importar/exportar/backup) y atajos de teclado.
- Ventana de salida física del engine WGPU y segunda pantalla (sólo se vio el preview del panel, F11).
- Reproducción real de media/audio, timeline en uso, ejecución de acciones, cloud (ChurchApps) y MIDI/NDI.
- Los popups se abrieron sin datos de contexto (F02, F03, F13 pueden ser artefactos de la sonda).
- Sólo macOS Apple Silicon. Windows no se probó.

## Imports rotos preexistentes

Los encontró `src/frontend/arch/relativeSpecifiers.test.ts` (rutas relativas que no resuelven a ningún archivo). No se
arreglaron para no cambiar el comportamiento de los tests; están en `KNOWN_BROKEN` de ese test, que sólo puede achicarse.

- `src/frontend/components/drawer/audio/metronome.ts` → `../../../types/Audio`
- `src/frontend/react/drawer/media/Media.test.tsx` → `vi.mock("./pixabay")` y `vi.mock("./unsplash")`
- `src/frontend/react/show/Show.test.tsx` → `vi.mock("./MediaPreview")`

Además: la línea base de 168 errores de `tsc` incluía 8 de `node_modules/json-bible`; dentro de `src/frontend/` son 160, y
ese es el `MAX_ERRORS` de `scripts/check-types.ts`.
