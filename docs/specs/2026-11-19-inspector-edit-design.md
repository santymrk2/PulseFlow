# Inspector de Edit al estilo ProPresenter: diseño

Fecha: 2026-11-19. Estado: borrador para aprobar.

## Por qué

El panel de edición (abajo a la derecha en Edit) es poco intuitivo:

- **Desplegar activa.** Abrir una sección como "Scrolling", "Shadow" o "List" ya le escribe valores al objeto. Lo hace `toggleSection` en `features/edit/tools/EditValues.tsx:276`, por `expandAutoValue`.
- **No hay forma clara de apagar.** Cuando la sección tiene cambios, su encabezado queda deshabilitado (`disabled={hasChanged}`) y la única salida es "reset", que pierde lo que habías ajustado.
- **Todo está repartido en seis lugares:**
  - las pestañas Texto, Ítem, Slide y Filtros;
  - el menú contextual de la caja (acciones del ítem, transición, vincular a, condiciones);
  - los botones de copiar, pegar y reset.

La meta es ProPresenter: un inspector con **tres pestañas generales**, y dentro de cada una **propiedades agrupadas que se prenden y apagan con un checkbox**.

- Desplegar y activar quedan separados.
- Apagar no borra los valores.
- Copiamos cómo funciona, no el arte, los íconos ni los textos de ProPresenter.

## Objetivos

1. Un inspector nuevo con tres pestañas para el objeto seleccionado: **Forma**, **Contenido** y **Animación**.
   - La pestaña del medio se llama "Texto" en objetos de texto y el nombre del tipo en los demás ("Media", "Reloj", "Tabla"…).
2. Cada sección opcional tiene un **checkbox** (activar/desactivar) separado de la **flecha** (desplegar/plegar).
   - Desplegar nunca modifica el objeto.
3. Desactivar una sección **guarda sus valores** y los vuelve a aplicar al reactivarla: opción A, elegida por el usuario.
4. **Sin objeto seleccionado**, el inspector muestra las propiedades del slide: fondo, media de fondo, plantilla y filtros del slide.
   - En plantillas y overlays muestra lo que hoy muestran `TemplateStyle` y `OverlayStyle`.
5. **Todo lo que hoy se puede tocar sigue disponible.** Nada se pierde en el reordenamiento: el mapeo completo está más abajo.
6. **Con el drawer abierto, el editor se achica** al espacio que queda: el slide no queda tapado. Hoy el canvas y su barra quedan debajo del drawer, y el inspector se aplasta con "Copy" encima de "Text color".

## No objetivos

- Mover el inspector a la derecha, reescribir el canvas, los gestos, alinear/distribuir o los atajos. Eso es la reescritura grande (`docs/research/editor-slides.md`, fases F0–F7). El inspector nuevo se hace de forma que esa reescritura lo reuse tal cual.
- Cambiar qué hace cada campo. Los campos, sus valores y cómo se guardan son los de hoy.
- Las pestañas de arriba del editor (Slide / Chords / Text edit), que no se tocan.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que algún ajuste que hoy existe quede inaccesible.
- Que un show viejo no cargue, o que cambie cómo se ve en la salida.
- Que desplegar una sección vuelva a cambiar el objeto.

## Enfoques considerados

1. **Inspector nuevo encima de la lógica existente (elegido).** Componente nuevo con pestañas y secciones con checkbox. Reusa:
   - los descriptores de campos (`logic/values/boxes.ts`, `item.ts`, `filters.ts`);
   - los componentes de campo;
   - las funciones que hoy leen y guardan estilos (`getBoxStyle`/`setBoxStyle`, `getItemStyle`/`setItemStyle`, `getSlideStyle`/`setSlideStyle`, `getFilterStyle`), que `EditTools.tsx` importa de `logic/scripts/itemClipboard`.

   Reemplaza `EditTools` y `EditValues`. Ataca la causa (el `EditValues` que mezcla desplegar con activar) y sirve para la reescritura grande.
2. **Reacomodar el panel actual.** Mover secciones entre pestañas y agregar checkboxes al `EditValues` de hoy. Es más rápido, pero emparcha justo el componente con efectos encadenados que ya trajo bugs (F01, F04). Descartado.

## Mapeo completo

"☐" = sección con checkbox. Sin "☐" = siempre activa: se despliega, pero no se apaga.

### Forma (`item.ts` y secciones de caja)

| Sección | Hoy está en | Campos |
|---|---|---|
| Posición y tamaño | Ítem › position | left, top, width, height |
| Transformación | Ítem › transform | opacity, rotate, scaleX, rotateX, perspective |
| Relleno y esquinas | Ítem › default | background-color, padding, border-radius |
| ☐ Borde | Ítem › border | border-width, -color, -style |
| ☐ Sombra | Ítem › shadow | box-shadow |
| ☐ Texto alrededor | Ítem › shape_outside | shape-outside |
| ☐ Desenfoque de fondo | Ítem › backdrop_filters | backdrop-filter |
| ☐ Filtros | `mediaSections`/`cameraSections` › filters | filter |
| ☐ Recorte | `mediaSections`/`cameraSections` › cropping | cropping.* |
| Avanzado (plegado) | Ítem › CSS | CSS de la caja |

"Filtros" y "Recorte" sólo aparecen en los tipos de objeto que hoy los tienen.

### Contenido

**Si el objeto es texto, la pestaña se llama "Texto":**

| Sección | Hoy está en | Campos |
|---|---|---|
| Fuente | Texto › default | familia, color, tamaño, ajuste automático, negrita, cursiva, subrayado, tachado |
| Alineación | Texto › align | horizontal y vertical |
| Espaciado | Texto › text | letter-spacing, word-spacing, text-transform, background-color, white-space |
| Líneas | Texto › lines | line-height, lineGap, lineBg, opacity, lineRadius |
| ☐ Contorno | Texto › outline | -webkit-text-stroke |
| ☐ Sombra | Texto › shadow | text-shadow |
| ☐ Lista | Texto › list | list.* |
| ☐ Acordes | Texto › chords | chords.* |
| ☐ Desplazamiento | Texto › scrolling | scrolling.* |
| Avanzado (plegado) | Texto › CSS | CSS del texto |

**Si el objeto no es texto,** la pestaña toma el nombre y el ícono del tipo (hoy `itemBoxes[type]` ya los da). Muestra las secciones de contenido de ese tipo de `boxes.ts`, igual que hoy: media, cámara, web, timer, reloj, slide_tracker, events, weather, visualizer, captions, current_output, icon, chart, table, qr_code. Lo que en esos tipos sea de forma (filtros, recorte) va a Forma, como dice la tabla anterior.

### Animación

Todos estos campos ya existen en el objeto. Hoy se cambian desde el menú contextual o desde popups.

| Sección | Hoy está en | Dato en el objeto |
|---|---|---|
| ☐ Transición | menú › Transición (popup `transition`) | `actions.transition` |
| ☐ Aparecer al hacer clic | menú › Acciones del ítem | `clickReveal` |
| ☐ Revelar línea por línea (sólo texto) | menú › Acciones del ítem | `lineReveal` |
| ☐ Duración en pantalla | menú › Acciones del ítem (popup `set_time`) | `actions.displayDuration` |
| ☐ Mostrar a los X s | ídem | `actions.showTimer` |
| ☐ Ocultar a los X s | ídem | `actions.hideTimer` |

Al final de la pestaña va el bloque **Interacción**: no es animación, pero es "qué hace el objeto en vivo", que es la idea del Build de ProPresenter.

| Sección | Hoy está en | Dato |
|---|---|---|
| ☐ Acción al presionar / soltar | Texto › special | `button.press`, `button.release` |
| Condiciones | menú › Condiciones | `conditions` |
| Vincular a | menú › Vincular a | `bindings` |

- **Transición, Condiciones y Vincular a** muestran un resumen y un botón que abre el mismo popup o menú de hoy. No se reescriben.
- **Los timers** se editan en línea, con un campo numérico de segundos, escribiendo el mismo dato que el popup `set_time`.
- **El menú contextual se queda como está:** son atajos, y no se borra código.

### Sin selección: el slide

Muestra lo que hoy muestran las pestañas Slide y Filtros: color de fondo, media de fondo, plantilla y filtros del slide. En plantillas muestra `TemplateStyle` y en overlays `OverlayStyle`.

### Lo que sale del inspector

- **Lista de objetos** (`ItemsList`, "ordenar ítems"). Va a la columna izquierda de Edit, debajo de la lista de slides, como la lista de objetos de ProPresenter. Mantiene subir y bajar.
- **Copiar, pegar y reset de estilo.** Barrita fija arriba del inspector, siempre visible, con el mismo comportamiento de hoy.
- **Formato** (buscar/reemplazar, mayúsculas) **y Orden** (al frente/atrás). Se quedan en el menú contextual: son acciones, no propiedades.

## Checkbox: cómo funciona (opción A)

- **Tildado** = la sección tiene valores distintos de los de por defecto. Es el mismo criterio que hoy usa `hasChangedValues`.
- **Tildar una sección apagada:**
  - si hay valores guardados en `item.inactive[sección]`, los aplica y borra esa entrada;
  - si no hay, aplica los valores iniciales de `expandAutoValue` (lo que hoy pasa al desplegar).
- **Destildar:** guarda en `item.inactive[sección]` los valores actuales de sus campos, tal como los lee el inspector. Después aplica los valores por defecto, que es lo mismo que hace hoy `resetSection`.
- **La flecha** sólo despliega o pliega. Nunca escribe.
- **Una sección siempre activa** (sin checkbox) mantiene el botón de reset de hoy.
- **Todo pasa por `history`**, como hoy. Deshacer un tildado o un destildado vuelve al estado anterior, incluido `inactive`.

### Formato del dato nuevo

```ts
// src/types/Show.ts, en Item
inactive?: { [sectionId: string]: { [inputKey: string]: unknown } }
```

- **Opcional.** Los shows viejos cargan igual y no hace falta migración: AGENTS.md lo permite para un campo opcional nuevo.
- **La salida no lo lee:** `sceneGraph` y el render siguen leyendo `style`, `lines`, etc., así que un valor apagado no se ve.
- **Rust no lo toca:** `commands/shows.rs` recorre los objetos como JSON genérico.
- **Las claves son las de la decisión 3** (más abajo): la propiedad CSS completa o la ruta del dato, no el campo del inspector.
- **Copiar y pegar estilo no copia `inactive`.** Aplicar una plantilla tampoco lo pasa al show.
- **Límite conocido.** Si el texto tiene estilos distintos en distintas partes (por ejemplo dos sombras en dos líneas), se guarda lo que muestra el inspector, que es lo de la selección o la primera línea. Al reactivar se aplica ese valor a todo. Es igual que hoy al editar desde el inspector.

## Decisiones del controlador (revisables)

Salieron de la revisión del diseño. Son decisiones técnicas, no de producto; el usuario las puede revertir.

1. **Un solo interruptor.** En Lista y Acordes, el checkbox de sección reemplaza al campo `list.enabled` / `chords.enabled`, que se oculta en el inspector nuevo. Tildar pone `enabled: true` y destildar `false`, con el resto de sus valores guardados en `inactive`.
2. **Un tildado o destildado = una sola entrada de `history`.** Escribe en una operación los valores de la sección y `inactive`. Hace falta una ruta de escritura en lote: no se encadenan `changed()` con `setTimeout` como hoy en `resetSection`. Deshacer revierte todo junto.
3. **Qué se guarda en `inactive`.** Se guarda por propiedad real y no por campo del inspector. Para estilos CSS, la clave es la propiedad (`box-shadow`, `text-shadow`, `filter`…) y el valor es la cadena CSS completa. Para datos del objeto, la ruta (`chords.size`, `scrolling.speed`, `actions.showTimer`…). Así los campos que comparten propiedad con `valueIndex` (las sombras) no colisionan.
4. **Valor inicial al tildar sin nada guardado.** Toda sección con ☐ tiene uno que produce un cambio visible. Así, "tildado = distinto del default" se cumple apenas tildás:
   - las que ya tienen `expandAutoValue` usan ese valor;
   - Filtros: blur 2px;
   - Desenfoque de fondo: blur 6px;
   - Recorte: 10 % en cada lado;
   - Transición: fundido de 500 ms;
   - Aparecer al hacer clic y Revelar línea por línea: `true`;
   - Duración en pantalla y los timers: 5 s;
   - Acción al presionar: abre el selector de acción, y si se cancela queda destildado.
5. **"Duración en pantalla" depende de "Aparecer al hacer clic".** Hoy sólo se usa con `clickReveal` (`Textbox.tsx:615-621`), así que queda deshabilitada, con una explicación, mientras "Aparecer al hacer clic" está apagado.
6. **Tipos sin contenido propio.** `button`, `variable` y `metronome` existen en `ItemType` pero no en `itemBoxes`. La pestaña del medio muestra el nombre del tipo y el texto "Este objeto no tiene opciones de contenido". "Acción al presionar / soltar" aparece en los tipos que hoy tienen la sección `special`: texto e ícono.
7. **Varios objetos seleccionados.** Tildar y destildar se aplican a cada objeto, y cada uno guarda su propio `inactive` con sus propios valores.
8. **Tipado.** Se tipa `Item.actions`, hoy `any`, con `showTimer`, `hideTimer`, `displayDuration` y `transition`. Así el inspector no usa `any`.

## Drawer y editor

- Con el drawer abierto, el área central de Edit tiene que ocupar sólo el alto que queda. El canvas se escala para entrar entero, como ya lo hace cuando la ventana se achica.
- La causa exacta se investiga en el plan. `Editor.module.css:12` ya tiene `min-height: 0`, así que el problema está en otro contenedor.
- Criterio: con el drawer abierto a cualquier alto, el slide y la barra de herramientas del canvas se ven enteros.

## Restricciones

- Reglas de AGENTS.md:
  - React 19 con React Compiler, sin `useMemo`/`useCallback`/`memo`;
  - CSS Modules con las variables del tema;
  - `features/<x>/` con lógica en `logic/`;
  - sin dependencias nuevas;
  - sólo bun.
- **Textos** por `translateText`, con claves nuevas en `public/lang/en.json` y `es.json`. **Íconos**, de los que ya usa la app.
- **Ubicación:** el inspector nuevo vive en `src/frontend/features/edit/inspector/`. Lo que la reescritura grande vaya a reusar no depende de `EditTools`.
- **El inspector viejo se borra** al final, una vez que el nuevo cubre todo el mapeo y está demostrado que nadie más lo usa (`rg`). Antes no.

## Verificación

- **Tests:**
  - cada pestaña muestra las secciones del mapeo según el tipo de objeto;
  - desplegar no llama a guardar;
  - destildar guarda en `inactive` y resetea;
  - retildar restaura y borra la entrada;
  - deshacer funciona;
  - un objeto sin `inactive` funciona.
- **En la app, con capturas:**
  - un objeto de texto con sombra apagada y reactivada;
  - un media con Forma y Contenido;
  - Animación con un timer;
  - el panel sin selección;
  - el editor con el drawer abierto.
- **Una sola vez al final:** `test:unit` completo (0 FAIL), `test:types` (≤36), arch tests, `test:budget` y prettier sobre lo tocado.

## Queda a criterio de quien lo construya

- Cómo se parte el componente (por pestaña, por sección).
- El orden de las tandas.
- El estilo visual exacto de las secciones y el checkbox, con los componentes de UI que ya existen.
