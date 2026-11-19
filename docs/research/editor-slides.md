# Investigación: editor de slides de PulseFlow vs ProPresenter 7

Fecha: 2026-11-19. Sólo lectura. Se copia el flujo, layout y comportamiento de ProPresenter (PP); no su arte, íconos, marca ni textos.

Nota de honestidad: varias páginas oficiales de `learn.renewedvision.com` redirigen (302) y el PDF de la guía de PP7 devolvió 522, así que algunos puntos vienen de resúmenes de búsqueda o de la guía de PP6. Cada punto marca su fuente y los que no pude confirmar están rotulados **(no confirmado)**.

---

## Parte 1: cómo funciona el editor de ProPresenter 7

### 1. Layout
- Se entra con **Edit** en la barra principal y se vuelve con **Show**. Izquierda: lista de todas las slides y, debajo, la **lista de objetos** de la slide elegida. Centro: canvas. Derecha: **panel de propiedades** contextual. Sin selección muestra los ajustes de la presentación (tamaño, transición, copyright). Con una slide muestra enabled, hotkey, etiquetas, fondos y acordes. Con un objeto muestra sus propiedades. Las notas de slide están al pie de ese panel. Fuente: https://www.renewedvision.com/blog/using-the-presentation-editor-in-propresenter-7
- Pestañas del inspector de un objeto: Arrangement (alineación, posición, tamaño, transformación, opacidad), Fill (color, gradiente, media, web, entrada de video u otros objetos), Stroke, Shadow, Feathering, Visibility; más una pestaña Text. Misma fuente. Confirmación de la pestaña Text y de Align/Distribute encima de posición y tamaño: https://learn.renewedvision.com/propresenter/working-with-slides (vía resultado de búsqueda; la URL redirige).
- La grilla de slides en modo Show tiene vistas **Grid / Table / Easy** y un slider de tamaño. Fuente: https://support.renewedvision.com/hc/en-us/articles/360041344174-Slide-View-Options-in-ProPresenter y https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface

### 2. Edición de texto
- El texto vive dentro de un objeto de texto y no se sale de sus límites. Tiene stroke y sombra propios, distintos de los de la forma. Fuente: working-with-slides (arriba) y blog del editor.
- Opciones de texto: fuente, negrita, subrayado, engranaje con mayúsculas, espaciado de caracteres, interlineado, márgenes de la caja; color; alineación; "Lines only"; listas con viñetas; texto enlazado (timers, reloj, ticker). Fuente: blog del editor.
- **Auto-fit** (escalado de texto): "fit container to text", "scale text up/down to fit container" o ambos sentidos. Fuente: blog del editor. En un tema, el escalado automático se activa en la pestaña Text. Fuente: https://support.renewedvision.com/hc/en-us/articles/34551484745875-Guide-to-Using-Themes-in-ProPresenter
- Edición inline en el canvas y estilo caja-completa vs selección: no encontré una fuente oficial que lo describa en detalle **(no confirmado)**. Lo que sí está documentado son atajos de formato (punto 6).

### 3. Manejo de objetos
- Snapping y guías de alineación contra bordes y centros de la slide u otros objetos; grilla y regla; guías de slide/template. Fuente: blog del editor.
- Alinear: seleccionar varios, menú Editor > Arrangement > Align Objects. Distribuir: horizontal, vertical o parejo. Fuente: https://learn.renewedvision.com/propresenter/working-with-slides (búsqueda).
- Orden: se arrastra el objeto en la lista de objetos; además Bring Forward / to Front / Send Backward / to Back (atajos en punto 6). Fuentes: blog del editor y https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter
- Bloquear: ícono de candado al pasar el mouse; un objeto bloqueado no se edita hasta desbloquearlo. Ocultar objeto: toggle en la lista. Fuente: working-with-slides y blog del editor.
- Agrupar objetos: no encontré fuente oficial que lo confirme **(no confirmado)**; no lo tomo como requisito.

### 4. Temas y templates
- Un **Theme** se edita en su propio Theme Editor (menú More o botón Theme; "+" crea, lápiz edita). El editor se centra en estilo, no en texto concreto. Tiene Slide Navigator con theme slides, pestañas Text (fuente/tamaño por defecto, mayúsculas, escalado automático) y Shape, y media en capa de media. Fuente: https://support.renewedvision.com/hc/en-us/articles/34551484745875-Guide-to-Using-Themes-in-ProPresenter
- Se aplica seleccionando slides, clic derecho > Theme > elegir; rellena estilos de texto, media y formas en las slides elegidas, y hay vista previa antes de aplicar. Misma fuente.
- Qué pasa con slides ya hechas al editar el tema: la fuente no lo dice **(no confirmado)**.

### 5. De la letra a las slides
- **Reflow editor**: editor de texto de toda la canción; los cambios se aplican a las slides en tiempo real. Cortar slide: cursor al final y botón Insert Slide Break u Opt+Return. Unir: Delete al inicio de la segunda. Salto de línea: Return. Slider de tamaño de preview; flechas en cada slide para transición y tema. Fuente: https://support.renewedvision.com/hc/en-us/articles/34513457866899-How-to-Use-Reflow-Editor-in-ProPresenter y https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface
- Limitación (guía PP6): Reflow sólo sirve con una caja de texto por slide. Fuente: https://learn.renewedvision.com/propresenter6/working-with-slides/slide-reflow-editor
- **Grupos**: clic derecho en la slide > Group > etiqueta existente u "Other". Cada slide debe pertenecer a un grupo. Fuente: https://support.renewedvision.com/hc/en-us/articles/360041809973-Using-Groups-and-Arrangements-for-Presentation-Organization
- **Arrangements**: botón en el encabezado de la presentación; el "Master" lista todos los grupos; se crean otros arrastrando grupos en el orden de disparo; se elige por presentación desde el menú contextual o el dropdown. Evita duplicar la canción. Misma fuente.
- Importar texto plano / SongSelect arma grupos automáticamente: https://support.renewedvision.com/hc/en-us/articles/360011789713-Import-options-for-text-files-and-SongSelect (sólo título; no leí el cuerpo).

### 6. Atajos y velocidad (editor)
Mac / Windows, fuente https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter:
- Fuente Cmd/Ctrl+T; Negrita B; Cursiva I; Subrayado U; Agrandar/Achicar Cmd/Ctrl +/-.
- Espaciado de caracteres: Opt+Cmd+[ y ] / Ctrl+Shift+[ y ].
- Alinear texto izq/centro/der/justificado (sólo Mac listado).
- Bring Forward Opt+Shift+Cmd+F / Ctrl+Alt+F; to Front Shift+Cmd+F / Ctrl+Shift+F; Send Backward ...B; to Back Shift+Cmd+B / Ctrl+Shift+B.
- Fit Slide into Edit Window Cmd/Ctrl+0; Duplicate Cmd/Ctrl+D; New Slide Shift+Cmd+N / Ctrl+Shift+N.
- Sin atajos listados para group, lock o nudge.
- Teclas personalizables desde 7.7: https://support.renewedvision.com/hc/en-us/articles/4412282390547-Custom-Key-Mapping
- Copiar estilo (pegar estilo en otras slides) está en el panel de texto. Fuente: blog del editor.

---

## Parte 2: el editor de PulseFlow hoy

Ruta: `src/frontend/features/edit/` (~14.5k líneas, 100+ archivos, cada componente con su test).

### Estructura
- **`Editor.tsx` (229)**: raíz. Decide por `activeEdit.type` qué editor montar: show/slide (`SlideEditor`), overlay, template, scene, effect, media, camera, audio. Tabs "Slide / Chords / Text edit" (`text_edit` monta `features/show/TextEditor`, un textarea que reformatea el show entero). Efectos con efectos de borde: abre/cierra el drawer al montar, `refreshEditSlide` por pulso con timeout.
- **`editors/SlideEditor.tsx` (467)**: canvas. Resuelve la slide por layout ref, el fondo (con "ghost background" heredado de slides previas), zoom, y monta `Zoomed` > `DropArea` > `Snaplines` + un `Editbox` por item. Guarda en estado local `newStyles` (estilos en vuelo durante el drag) y los vuelca a `history({id:"setStyle"})` en `updateStyles`, con un `setTimeout` extra que borra `autoFontSize`. Tiene 20+ `useStore`, 13 `useState` y refs `latest` para evitar closures viejos.
- **`editbox/`**: `Editbox.tsx` (367, caja y mouse: selección, shift, click derecho, resize handles, crop), `EditboxLines.tsx` (812, texto `contentEditable` con su propio manejo de teclado, caret y autosize), `EditboxPlain`, `EditboxChords`, `EditboxCropping`.
- **`EditTools.tsx` (468) + `tools/`**: inspector inferior con pestañas Text (BoxStyle, 782 líneas), Item (ItemStyle), Slide (SlideStyle), Filters. `EditValues.tsx` (459) renderiza campos genéricos desde descriptores en `logic/values/boxes.ts` (738). Flechas = nudge 1px (10px con Ctrl/Cmd) en un listener `window.keydown`.
- **`Slides.tsx` (191) / `Navigation.tsx` (233)**: lista de slides a la izquierda (reusa `features/slide/Slide`); `tools/ItemsList.tsx` (113) lista de objetos con botones subir/bajar.
- **`ItemAddMenu.tsx`**: barra flotante para agregar texto/media/timer/etc. vía `addItem`.
- **Snapping y transformación**: viven en `shared/ui/system/Snaplines.tsx` (191): move, resize, rotate, radius, guías, centro.
- **`logic/`**: `scripts/itemHelpers.ts` (510: `addItem`, `rearrangeItems`, condiciones, dynamic values), `textStyle.ts` (447: `addStyle` sobre rangos, `getSelectionRange`, caret), `autosize.ts` (170: shrinkToFit/growToFit), `itemClipboard.ts` (copiar/pegar estilos), `autoPosition.ts`, `values/boxes.ts`, `editbox/EditboxHelper.ts` y `EditboxPaste.ts`.

### Dónde vive el estado
- Estado global en stores (`shared/core/stores`): `activeEdit` ({slide, items[], showId, id, type}), `showsCache`, `editMode`, `refreshEditSlide`, `special`, `focusMode`, `drawer`, etc. El texto y el estilo del item **viven dentro del show** (`Slide.items[]` con `lines[].text[]` y `style` como **string CSS**).
- Escrituras: casi todas por `history({id, newData, location})` (undo/redo central, con `override` para fundir cambios).
- Estado local: `newStyles`, `mouse`, `lines` (snaplines), `zoom`, en `SlideEditor`. El caret y la selección se leen del DOM (`getSelectionRange`).
- Sincronización por pulsos: `refreshEditSlide.set(true)` obliga a re-render tras reordenar; `activeEdit.items` se limpia a mano en `rearrangeItems`.

### Acoplamiento (hallazgo de la revisión)
Fuera de `edit` hay 26 archivos que importan de `features/edit/` (1 en `app/`, 4 en `app/wiring`, 5 en `shared/ui`, 10 en `shared/utils`, el resto en stage/import/popups/slide). La API de facto es `itemHelpers`, `textStyle`, `values/boxes` y `autosize`. Inclusive `shared/` depende de `features/edit`, lo que invierte la dirección de dependencias (`shared/ui/system/Snaplines` además importa lógica de edit/stage). Además `app/wiring/shortcuts.ts` importa `addItem`.

### Problemas vistos en el código (candidatos a explicar el "funciona mal")
- Un `console.warn("SNAPDBG down", ...)` quedó en `Editbox.mousedown` (línea ~102): se dispara en cada clic.
- `openToolsTab.set("text")` en cada mousedown de una caja: el clic en el canvas cambia la pestaña del inspector por efecto lateral.
- Estilos como string CSS parseado/serializado en cada cambio (`getStyles` / concatenar `key:value;`), con valores px absolutos sobre 1920x1080 y conversiones a % para outputs distintos.
- Dos mecanismos de teclado (listener `window` en `EditTools` para nudge y en `shortcuts.ts` global) con guardas por `closest(".edit")`.
- Los diagnósticos F01 y F04 (arreglados) salieron justo de este acoplamiento estado/efecto (`style` string a un `div`; bucle `setState` con `activeEdit.slide = 0`).
- `SlideEditor` y `Editbox` replican props con `latest.current` y 20+ stores: difícil de razonar, de testear y de rehacer a pedazos.
- `docs/diagnostico.md` (sección UX) pide justamente un estado vacío único y "lista de slides a la izquierda, canvas al centro, herramientas abajo".

---

## Parte 3: análisis de brechas y propuesta

### 3.1 Tabla de brechas

Leyenda: **Igual** = funciona como PP; **Difiere** = existe pero distinto; **Falta**.

| Capacidad de PP | Estado | Detalle y archivos |
|---|---|---|
| Lista de slides a la izquierda | Igual (básico) | `Slides.tsx`, `Navigation.tsx`; sin objetos de la slide bajo la lista en esa columna |
| Lista de objetos de la slide | Difiere | `tools/ItemsList.tsx`: botones subir/bajar, no drag; está dentro del inspector |
| Inspector contextual a la derecha | Difiere | Está **abajo** (`EditTools.tsx`), con pestañas fijas Text/Item/Slide/Filters; no cambia solo según la selección (nada seleccionado = ajustes de la slide) |
| Inspector: Arrangement (pos/tamaño/opacidad) | Difiere | Campos top/left/width/height en `values/boxes.ts`/`EditValues.tsx`; sin bloque "arrangement" con align/distribute |
| Fill/Stroke/Shadow/Feather | Difiere | Hay color, sombra, borde, etc. en `boxes.ts`; sin feather ni "visibility" propio (hay condiciones: `itemHelpers.shouldItemBeShown`) |
| Edición inline de texto | Igual | `EditboxLines.tsx` (contentEditable) |
| Estilo caja vs selección | Difiere | `textStyle.addStyle(selection,...)` aplica a rangos; con auto-fit y selección parcial hay una excepción (`BoxStyle.tsx:548`); funciona pero opaco |
| Auto-fit de texto | Difiere | `autosize.ts` (shrinkToFit/growToFit), opción `textFit` en `BoxStyle.tsx`; falta "fit container to text"; el tamaño automático se guarda en `autoFontSize` y se borra con un timeout (`SlideEditor.tsx:~200`) |
| Atajos de formato (B/I/U, fuente, +/-) | Difiere | `EditTools` / `shortcuts.ts` manejan B/I/U; sin más/menos tamaño, espaciado, alinear, orden de capas |
| Seleccionar y mover | Igual | `Editbox.tsx` + `Snaplines.tsx`; multiselección con Shift |
| Redimensionar / rotar / radio | Igual | `Snaplines.tsx` (más que PP en radius) |
| Snapping y guías | Igual | `Snaplines.tsx` (guías, centro) |
| Alinear / distribuir objetos | Falta | Sólo alineación de texto (`boxes.ts:115`); no hay align/distribute entre objetos |
| Nudge con flechas | Igual | `EditTools.tsx:326` |
| Orden de capas | Difiere | `rearrangeItems` y botones en `ItemsList`; sin drag ni atajos |
| Bloquear objeto | Falta | Sólo lock de show/grupo (`Editbox.tsx:297`) |
| Ocultar objeto en editor | Falta | No encontrado |
| Agrupar objetos | Falta (PP: no confirmado) | |
| Grilla / regla / guías de slide | Falta | no encontrado en `edit/` |
| Zoom / fit a ventana | Difiere | `ZoomControl` (0.2 a 4x) y `centerZoom.ts`; sin atajo "fit" |
| Copiar/pegar estilo | Igual | `itemClipboard.ts`, `EditTools` copyStyle/pasteStyle |
| Duplicar objeto/slide | No verificado | no lo leí; revisar en `clipboard.ts` |
| Tema/template atado a la slide | Difiere | Hay templates (`TemplateEditor`, `updateLayoutsFromTemplate` en `shared/utils/helpers/output.ts:1703`, modos global/group/slide en `historyActions.ts:710`) pero editor de template con un `mode` global/item y overrides por regex; no hay "aplicar tema a slides seleccionadas con vista previa" tan directo |
| Editor de texto de la canción (Reflow) | Difiere | Pestaña `text_edit` (`features/show/TextEditor.tsx`): textarea con formato propio (`formatText`); sin "Insert Slide Break", sin preview en vivo de slides al lado, sin colores de grupo |
| Grupos (Verse/Chorus) | Existe | Layout/group en `features/show` y `shared/utils/helpers/show.ts`; asignación y color a verificar |
| Arrangements | Existe (layouts) | Layouts en el modelo de show; UX por validar contra PP |
| Atajos de velocidad (duplicar, nueva slide, fit) | Difiere | Dispersos en `app/wiring/shortcuts.ts` y listeners locales; sin tabla única ni remapeo |
| Estado vacío único | Difiere | `diagnostico.md`: Edit sin show mezcla splash con "No show selected" |
| Slide notes | Igual | `SlideEditor` + `show/tools/Notes` |

### 3.2 Enfoques

**A. Evolucionar paso a paso.**
Mantener `Editor/SlideEditor/Editbox`; añadir align/distribute, lock, atajos, mover el inspector a la derecha y pulir. Tamaño: M, 3 a 5 semanas de uno. Riesgo bajo por pieza, pero hereda el estado enredado (`newStyles`, `latest.current`, pulsos de `refreshEditSlide`, estilo-string) que es la causa raíz del "funciona mal". Cada arreglo nuevo vuelve a chocar con los mismos efectos laterales. Útil para ganar rápido, pero no resuelve lo intuitivo.

**B. Reescribir canvas e inspector, reusando la lógica de dominio (recomendado).**
Nuevo `features/slide-editor/` (canvas, panel de objetos, inspector a la derecha contextual) sobre un estado de edición explícito: una selección y un controlador de gestos (`useCanvasGestures`) con una API clara, escritura sólo por `history`. Se reusa sin tocar `autosize`, `textStyle.addStyle`, `itemClipboard`, `Snaplines` y los descriptores de `values/boxes` (ya probados), tras moverlos a `shared/`. Se reemplaza UI y orquestación (Editor, SlideEditor, EditTools, ItemsList, Editbox shell). Convive con el viejo detrás de un flag hasta paridad. Tamaño: L, 6 a 9 semanas. Riesgo medio: paridad (cropping, acordes, tablas, scripture, timeline), y que hay 26 importadores externos. Se mitiga con el paso previo en `shared/` y con fases que se entregan solas.

**C. Reescritura total (modelo de datos incluido).**
Pasar de estilo-string a objetos tipados, nuevo modelo de item y migración de shows. Tamaño: XL, 3+ meses. Riesgo alto: toca formato de archivos de usuario (AGENTS.md exige migración), stage, import PowerPoint, output nativo. Beneficio real pero no necesario para el objetivo de UX. No recomendado ahora.

**Recomendación: B.** Resuelve la causa (estado y orquestación) sin tocar el formato de datos, y cada fase deja algo usable. Se puede empezar con las partes de A que son baratas (quitar el `console.warn`, atajos) dentro de la fase 0 y 1.

### 3.3 Roadmap por fases (enfoque B)

**Fase 0: Mover la API compartida a `shared/` (preparatoria, sin cambio visible).**
- Mover a `shared/` (p. ej. `shared/items/`): `itemHelpers` (separar lo de stage y las condiciones), `textStyle`, `values/boxes`, `autosize`, `itemClipboard`, `Snaplines` (ya está en `shared/ui/system`; sacarle imports de edit).
- Actualizar los ~26 importadores; dejar un test de dependencia (`shared` no importa `features`).
- Quitar el `console.warn("SNAPDBG")`.
- Operador ve: nada cambia; se verifica con los tests existentes. Criterio: `rg "features/edit/logic"` fuera de `edit` = 0.

**Fase 1: Estado de edición explícito y estado vacío único.**
- `useEditSelection` + un único lugar de escritura; sacar `openToolsTab.set("text")` del mousedown, el `newStyles` local al controlador del canvas, `refreshEditSlide` a una suscripción.
- Un estado vacío por página (lo pide `diagnostico.md`).
- Operador ve: clic en el canvas ya no cambia de pestaña inesperadamente; Edit sin show muestra un solo mensaje claro.

**Fase 2: Layout estilo PP: slides + objetos a la izquierda, inspector contextual a la derecha.**
- Panel izquierdo: slides y, debajo, objetos de la slide con drag para ordenar, ojo (ocultar en editor) y candado (nuevo campo opcional `locked` por item, retrocompatible).
- Inspector derecho contextual: sin selección = slide (fondo, notas, tema); con objeto = Texto / Fill / Sombra / Posición. Reusa `EditValues` y `boxes`.
- Operador ve: el layout conocido de PP; los controles aparecen según lo seleccionado.

**Fase 3: Herramientas de objeto.**
- Align/distribute (menú y botones sobre posición), atajos de capas, duplicar, fit a ventana, nudge con Shift, grilla y regla opcionales.
- Operador ve: alinear varias cajas con un clic; orden de capas con teclado.

**Fase 4: Texto y atajos.**
- Tabla única de atajos de edición (B/I/U, tamaño +/-, alinear, capas, Cmd/Ctrl+D, nueva slide), con auto-fit visible ("ajustar caja / reducir / agrandar") y estilo caja vs selección explícito en el inspector.
- Operador ve: formato rápido con teclado y auto-fit predecible.

**Fase 5: Flujo letra -> slides.**
- Reflow tipo PP: texto de la canción a la izquierda y preview de slides en vivo, "romper slide" con Opt/Alt+Enter, unir con Delete, color/etiqueta de grupo por slide, UI de arrangements. Reutiliza `formatText`/`convertText`.
- Operador ve: pegar letra, cortar en slides con un atajo, etiquetar Verse/Chorus y armar el orden.

**Fase 6: Temas.**
- "Aplicar tema a slides seleccionadas" con vista previa, indicador de qué slides siguen al tema y cuáles lo sobrescriben.
- Operador ve: cambiar el look de toda la canción en un paso.

**Fase 7: Retiro del editor viejo.**
- Paridad de cropping, acordes, tablas, scripture, timeline; borrar `EditTools`, `Editbox` viejo y flag; sólo con uso demostrado nulo (regla de AGENTS.md).

Cada fase termina con tests (`*.test.tsx` al lado), `bun run test:unit`, `test:react` y `test:budget` sin empeorar, y se prueba de verdad en la app.

### Preguntas abiertas para el dueño
1. ¿La paridad de acordes/tablas/scripture entra en la primera versión o se queda en el editor viejo hasta la fase 7?
2. ¿Aceptás un campo nuevo `locked`/`hidden` por item (retrocompatible) o preferís no tocar el formato?
3. ¿El "tema" de PulseFlow es el template actual (global/grupo/slide) o se redefine?
