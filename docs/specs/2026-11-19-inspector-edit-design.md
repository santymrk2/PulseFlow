# Inspector de Edit al estilo ProPresenter: diseño

Fecha: 2026-11-19. Estado: para aprobar.

## Por qué

El panel de edición es poco intuitivo y, además, miente.

- **Desplegar activa.**
  - Abrir "Scrolling", "Shadow" o "List" ya le escribe valores al objeto (`toggleSection` en `features/edit/tools/EditValues.tsx:276`, por `expandAutoValue`).
  - Para apagarlo no alcanza con plegar: el encabezado queda deshabilitado (`disabled={hasChanged}`) y la única salida es "reset", que pierde lo ajustado.
- **Todo está repartido en seis lugares:**
  - las pestañas Texto, Ítem, Slide y Filtros;
  - el menú contextual;
  - los botones de copiar, pegar y reset.
- **Muestra opciones que no salen en pantalla.**
  - La salida real la dibuja el motor nativo (Rust/WGPU), con la escena que arma `shared/utils/helpers/sceneGraph.ts` según el contrato de `src-tauri/src/render/scene.rs`.
  - Rotación, sombra de caja, filtros, recorte, lista, acordes, scrolling, transición por objeto, timers, condiciones, varios tipos de objeto y más se ven en el editor y en el preview de la webview, pero **no en la proyección**.
  - Para una app en vivo es una trampa: configurás algo, se ve bien, y el domingo no sale.

La meta es el editor de ProPresenter:
- inspector en pestañas, con propiedades agrupadas que se prenden y apagan con un checkbox;
- columna derecha dedicada al inspector;
- todo lo que se ve se puede usar.

Copiamos cómo funciona, no el arte, los íconos ni los textos.

## Objetivos

1. **Inspector con dos pestañas** para el objeto seleccionado: **Forma** y **Contenido**.
   - Contenido se llama "Texto" en objetos de texto y el nombre del tipo en los demás ("Media", "Reloj"…).
2. **Mostrar sólo lo que el motor dibuja** (tabla de abajo). Lo demás se oculta del inspector, sin borrar datos.
3. **Checkbox y flecha separados:** el checkbox activa o desactiva, la flecha despliega o pliega. Desplegar nunca modifica el objeto.
4. **Apagar guarda los valores** (opción A) y prenderlo los restaura.
5. **Sin objeto seleccionado,** el inspector muestra el slide.
6. **En Edit no se muestra el preview de salida.** La columna derecha queda entera para el inspector.
7. **Con el drawer abierto, el editor se achica** y el slide no queda tapado.
8. **La barra de "agregar objeto" sólo ofrece tipos que el motor dibuja.**

## No objetivos

- Mover el inspector a otra columna, reescribir el canvas, los gestos, alinear/distribuir o los atajos. Eso es la reescritura grande (`docs/research/editor-slides.md`). El inspector nuevo se hace de forma que esa reescritura lo reuse.
- Agregar al motor lo que hoy no dibuja (animación por objeto, rotación, sombras de caja…). Va al roadmap. Cuando el motor lo soporte, la sección vuelve al inspector.
- Las pestañas de arriba del editor (Slide / Chords / Text edit).

## Anti-objetivos

- Que un show viejo no cargue, cambie cómo se ve en la salida o pierda datos.
- Que desplegar una sección vuelva a cambiar el objeto.
- Que, por ocultar el preview, deje de andar un atajo de salida (F1–F6, flechas).

## Enfoques considerados

1. **Inspector nuevo encima de la lógica existente (elegido).**
   - Componente nuevo en `features/edit/inspector/`.
   - Reusa los descriptores de campos (`logic/values/boxes.ts`, `item.ts`), los componentes de campo y las funciones de lectura y escritura de estilos (`getBoxStyle`/`setBoxStyle`, `getItemStyle`/`setItemStyle`, `getSlideStyle`/`setSlideStyle`, que `EditTools.tsx` importa de `logic/scripts/itemClipboard`).
   - Reemplaza `EditTools` y `EditValues`.
2. **Reacomodar el panel actual.** Emparcharía `EditValues`, el componente que mezcla desplegar con activar y que ya trajo bugs (F01, F04). Descartado.

## El inspector

"☐" = sección con checkbox (opción A). Sin "☐" = siempre activa.

### Forma

| Sección | Campos | Hoy está en |
|---|---|---|
| Posición y tamaño | X, Y, ancho, alto | Ítem › position |
| Apariencia | fondo, opacidad, esquinas, margen interno | Ítem › default + transform (sólo opacidad) |
| ☐ Borde | grosor, color | Ítem › border (sin estilo de línea) |

### Contenido: objeto de texto ("Texto")

| Sección | Campos | Hoy está en |
|---|---|---|
| Fuente | familia, tamaño, color, negrita/cursiva/subrayado/tachado, ajuste automático | Texto › default |
| Párrafo | alineación horizontal y vertical, interlineado, espaciado de letras, mayúsculas/minúsculas | Texto › align + text + lines (sólo esos campos) |
| ☐ Contorno | grosor, color | Texto › outline |
| ☐ Sombra | desplazamiento X, Y, color (sin blur) | Texto › shadow |
| Aparición | ☐ al hacer clic (`clickReveal`), ☐ línea por línea (`lineReveal`, sólo texto) | menú › Acciones del ítem |

En "Aparición" cada checkbox es el dato en sí: no guarda valores aparte.

### Contenido: otros tipos

| Tipo | Campos |
|---|---|
| Media (imagen/video) | archivo, ajuste (contain/cover/fill) |
| Reloj | las opciones de hoy, sin el tipo analógico |
| Timer, contador de slides, eventos, variable | las opciones de contenido de hoy (`boxes.ts`) |

Cada tipo muestra también "Aparición" (al hacer clic), porque `sceneGraph` la respeta en todos.

### Sin selección: Slide

Color de fondo, media de fondo y plantilla (lo que hoy muestra `SlideStyle`). En plantillas y overlays, lo que hoy muestran `TemplateStyle` y `OverlayStyle`, filtrado con el mismo criterio.

Los filtros del slide se ocultan si el plan confirma que la escena no los lleva: `SceneBackground` no tiene campo de filtro.

### Fijo arriba del inspector

Copiar, pegar y reset de estilo, con el comportamiento de hoy.

### Fuera del inspector

- **Lista de objetos** (`ItemsList`). Pasa a la columna izquierda de Edit, debajo de los slides.
- **Formato** (buscar y reemplazar, mayúsculas) **y Orden** (al frente, atrás). Se quedan en el menú contextual.

## Lo que se oculta (vuelve cuando el motor lo dibuje)

- **Forma:**
  - rotación, escala, rotación 3D y perspectiva;
  - sombra de caja;
  - texto alrededor;
  - desenfoque de fondo y filtros;
  - estilo de línea del borde;
  - CSS a mano.
- **Texto:**
  - espaciado entre palabras, "white-space" y fondo del texto;
  - separación, fondo, opacidad y redondeo por línea;
  - lista, acordes y desplazamiento;
  - CSS a mano.
- **Media dentro del slide:** recorte, espejar, blend, velocidad, loop y mute.
- **Animación e interacción:**
  - transición por objeto;
  - mostrar u ocultar a los X s, y duración en pantalla;
  - acción al presionar o soltar;
  - condiciones;
  - "vincular a" una salida.
- **Tipos de objeto** (también salen de la barra de "agregar objeto"): cámara, web, clima, visualizador, subtítulos, salida actual, ícono, gráfico, tabla, QR, reloj analógico, botón y metrónomo.

Reglas:
- **Ocultar no borra:** los valores siguen en el archivo del show.
- **Un objeto existente de un tipo oculto** se puede seleccionar, mover y borrar. Su pestaña de contenido dice "Este tipo de objeto todavía no se ve en la salida".
- **El menú contextual** pierde las entradas de lo oculto (Transición, Acciones del ítem salvo las de Aparición, Vincular a, Condiciones). El código que implementan no se borra en este trabajo.
- **Cada cosa oculta queda como ítem del roadmap del motor.**

## Checkbox: cómo funciona (opción A)

Aplica a Borde, Contorno y Sombra.

- **Tildado** = la sección tiene valores distintos de los de por defecto (mismo criterio que `hasChangedValues`).
- **Tildar:** si hay valores guardados en `item.inactive[sección]`, los aplica y borra la entrada. Si no, aplica un valor inicial visible:
  - Borde: 2 px blanco;
  - Contorno: 2 px negro;
  - Sombra: 2 px / 2 px negro.
- **Destildar:** guarda en `item.inactive[sección]` los valores actuales y aplica los de por defecto.
- **Un tildado o destildado = una sola entrada de `history`,** que escribe los valores y `inactive` juntos. No se encadenan `changed()` con `setTimeout` como hoy.
- **Varios objetos seleccionados:** cada uno guarda su propio `inactive`.

### Dato nuevo

```ts
// src/types/Show.ts, en Item
inactive?: { [sectionId: string]: { [property: string]: string } }
```

- **La clave es la propiedad CSS completa** (`border-width`, `-webkit-text-stroke`, `text-shadow`…) y el valor es la cadena CSS.
- **Opcional:** los shows viejos cargan sin migración. La salida no lo lee. Rust no lo toca, porque `commands/shows.rs` recorre los objetos como JSON genérico.
- **Copiar y pegar estilo no copia `inactive`,** y aplicar una plantilla no lo pasa al show.
- **Límite conocido:** si el texto tiene valores distintos por parte, se guarda lo que muestra el inspector, como pasa hoy al editar desde el inspector.

## Preview oculto en Edit

- **Hoy:** `MainLayout.tsx:93` monta `<Preview />` en todas las páginas, y `features/output/Preview.tsx:157-238` registra el `keydown` global de salida: F1–F6, flechas, número de slide, atajos de grupo y acciones por tecla.
- **Antes de ocultarlo,** ese manejo pasa a un hook montado siempre en `MainLayout`, junto con cualquier otro efecto del Preview que no sea dibujar.
- **Criterio:** en Edit no hay preview, y F1 (limpiar) y F6 (logo) siguen funcionando.

## Drawer y editor

- **Hoy:** con el drawer abierto, el canvas y su barra quedan debajo del drawer, y el inspector se aplasta.
- **Causa:** se investiga en el plan. `Editor.module.css:12` ya tiene `min-height: 0`, así que el problema está en otro contenedor.
- **Criterio:** con el drawer abierto a cualquier alto, el slide y la barra del canvas se ven enteros.

## Restricciones

- AGENTS.md:
  - React 19 con React Compiler, sin `useMemo`/`useCallback`/`memo`;
  - CSS Modules con variables del tema;
  - `features/<x>/` con `logic/`;
  - sin dependencias nuevas;
  - sólo bun.
- **Textos** por `translateText`, con claves nuevas en `public/lang/en.json` y `es.json`. **Íconos**, de los que ya usa la app.
- **Lo que decide qué se muestra** es una lista explícita en un solo archivo (`inspector/logic/supported.ts`). Así, cuando el motor sume algo, se habilita en un lugar.
- **El inspector viejo se borra al final,** cuando el nuevo cubre todo y `rg` demuestra que nadie más lo usa.

## Verificación

- **Tests:**
  - cada pestaña muestra exactamente las secciones de las tablas según el tipo de objeto;
  - lo oculto no aparece;
  - desplegar no escribe;
  - destildar guarda y resetea, retildar restaura;
  - un deshacer revierte el par completo;
  - un objeto sin `inactive` funciona;
  - los atajos F1/F6 funcionan con la página en Edit.
- **En la app, con capturas:**
  - texto con sombra apagada y reactivada;
  - media;
  - sin selección;
  - Edit sin preview y con el drawer abierto;
  - la barra de "agregar objeto".
- **Una vez al final:** `test:unit` (0 FAIL), `test:types` (≤36), arch tests, `test:budget` y prettier sobre lo tocado.

## Queda a criterio de quien lo construya

Cómo se parte el componente, el orden de las tandas y el estilo visual exacto, con los componentes de UI que ya existen.
