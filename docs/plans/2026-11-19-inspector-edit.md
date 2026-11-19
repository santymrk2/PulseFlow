# Inspector de Edit: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: superpowers:subagent-driven-development. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** reemplazar el panel de edición por un inspector de dos pestañas (Forma / Contenido) que sólo muestre lo que el motor nativo dibuja, con secciones que se prenden y apagan con un checkbox sin perder valores. Además, ocultar el preview de salida en Edit sin romper los atajos, y que el editor no quede tapado por el drawer.

**Arquitectura:**
- Una lista explícita (`inspector/logic/supported.ts`) arma las secciones del inspector a partir de los descriptores que ya existen (`logic/values/boxes.ts`, `item.ts`).
- Un componente nuevo de secciones (checkbox ≠ flecha) reemplaza a `EditValues`.
- Los adaptadores de datos actuales (`BoxStyle`, `ItemStyle`, `SlideStyle`) siguen leyendo y escribiendo. Sólo cambian a qué renderizador le pasan las secciones.
- Prender y apagar es una función pura sobre el `Item`, escrita con una sola entrada de `history`.

**Stack:** React 19 + React Compiler, TypeScript, CSS Modules, vitest + happy-dom, bun.

**Spec:** `docs/specs/2026-11-19-inspector-edit-design.md`.

## Restricciones globales

- Reglas de AGENTS.md:
  - sin `useMemo`/`useCallback`/`memo`;
  - imports nombrados de React;
  - un componente por archivo con su test al lado (primera línea `// @vitest-environment happy-dom`);
  - sin `any` nuevo;
  - CSS Modules: clases siempre con `styles.x`, nunca un selector que empiece por elemento, colores sólo con variables del tema.
- Sólo bun. Sin dependencias nuevas. Nada de `bun run build`.
- Textos con `translateText` y claves nuevas en `public/lang/en.json` y `public/lang/es.json`. Íconos de los que ya usa la app. Nada de arte, íconos ni textos de ProPresenter.
- Ocultar no borra datos: ningún valor existente de un show se elimina ni se migra.
- `Item.inactive?: { [sectionId: string]: { [property: string]: string } }`: clave = propiedad CSS completa, valor = cadena CSS.
- Valores iniciales al tildar sin nada guardado:
  - Borde: `border-width: 2px; border-color: #ffffff; border-style: solid`;
  - Contorno: `-webkit-text-stroke-width: 2px; -webkit-text-stroke-color: #000000`;
  - Sombra: `text-shadow: 2px 2px 0px #000000`.
- Un tildado o destildado = una sola entrada de `history`.
- Verificación por tarea: sus tests, `bun run test:types` (≤36; si baja, bajar `MAX_ERRORS`) y los arch tests (`bunx vitest run --config config/testing/vitest.config.mts src/frontend/arch`).
- Commits en español con conventional commits, sin atribución de IA. Prohibido `git checkout`/`switch`/`stash`/`reset --hard`.
- Trabajo en el worktree `../PulseFlow-inspector`, rama `feat/inspector`, creada desde `main`.

## Foco de revisión

1. **Un show viejo con sombra de caja, rotación o CSS a mano.** Al abrirlo en Edit, esos valores siguen en el archivo y en la salida, aunque el inspector no los muestre. Test: tarea 1.
2. **Destildar y retildar con texto de varias líneas y varios spans.** El contorno y la sombra vuelven en todas las líneas. Test: tarea 2.
3. **Deshacer después de destildar.** Vuelve el valor y desaparece la entrada de `inactive` en un solo paso. Test: tarea 3.
4. **Escribir en un campo de texto del inspector con la página en Edit.** No dispara atajos de salida, igual que hoy, y F1 sí funciona. Test: tarea 7.
5. **Dos objetos seleccionados y destildar Borde.** Cada uno guarda su propio `inactive`. Test: tarea 2.

---

### Tarea 1: lista de lo soportado y armado de secciones

**Archivos:**
- Crear: `src/frontend/features/edit/inspector/logic/supported.ts` y su `supported.test.ts`

**Interfaces:**
- Produce:
  - `type InspectorTab = "shape" | "content"`;
  - `type SectionId = "position" | "appearance" | "border" | "font" | "paragraph" | "outline" | "shadow" | "reveal"`, más los ids de contenido por tipo, que son los de `itemBoxes[type].sections` sin las secciones ocultas;
  - `const CHECKABLE_SECTIONS = ["border", "outline", "shadow"] as const`;
  - `const SUPPORTED_ITEM_TYPES = ["text", "media", "timer", "clock", "slide_tracker", "events", "variable"] as const`;
  - `function isSupportedItemType(type: ItemType | undefined): boolean` (undefined = texto);
  - `function getInspectorSections(tab: InspectorTab, itemType: ItemType | undefined): { [sectionId: string]: EditBoxSection & { checkable?: boolean; hiddenInputs?: string[] } }`.

- [ ] **Paso 1: test que falla.** `supported.test.ts` con estos casos:
  - `getInspectorSections("shape", "text")` devuelve exactamente las claves `position`, `appearance`, `border`, en ese orden.
  - `appearance` tiene los inputs de `itemSections.default` más el input de `opacity` de `itemSections.transform`, y ningún input con `key` `rotate`, `scaleX`, `rotateX` o `perspective`.
  - `border` es `checkable: true` y sólo trae `border-width` y `border-color` (sin `border-style`).
  - `getInspectorSections("content", "text")` devuelve `font`, `paragraph`, `outline`, `shadow`, `reveal`.
    - `paragraph` = todos los inputs de `textSections.align` + `letter-spacing` y `text-transform` de `textSections.text` + `line-height` de `textSections.lines`.
    - `shadow.hiddenInputs` contiene el input de blur: el de `valueIndex` 2 de `text-shadow`.
  - Ninguna sección devuelta contiene inputs con `id` `CSS_text`, `CSS_item`, `button.press`, `list.enabled`, `chords.enabled` o `scrolling.type`.
  - `getInspectorSections("content", "media")` sólo tiene inputs con `id` `src` y `fit`.
  - `getInspectorSections("content", "clock")` no ofrece la opción analógica en el dropdown de tipo de reloj.
  - `isSupportedItemType("web") === false` e `isSupportedItemType(undefined) === true`.
- [ ] **Paso 2:** correrlo y verlo fallar: `bunx vitest run --config config/testing/vitest.config.mts src/frontend/features/edit/inspector/logic/supported.test.ts`.
- [ ] **Paso 3: implementar.** Las secciones se arman filtrando y combinando los descriptores existentes por `id`/`key`. No se copian valores a mano: si el descriptor original cambia, el inspector lo hereda. Cada filtro lleva un comentario de una línea que cita la razón ("la escena no lo lleva").
- [ ] **Paso 4:** correr el test y los arch tests. Pasan.
- [ ] **Paso 5: commit** `feat(edit): lista de secciones soportadas del inspector`.

### Tarea 2: prender y apagar secciones (lógica pura)

**Archivos:**
- Modificar: `src/types/Show.ts`. En `Item`, agregar `inactive?` y tipar `actions` como `ItemActions { transition?: Transition; showTimer?: number; hideTimer?: number; displayDuration?: number }`.
- Crear: `src/frontend/features/edit/inspector/logic/sectionToggle.ts` y su `.test.ts`

**Interfaces:**
- Consume: `CHECKABLE_SECTIONS` (tarea 1).
- Produce:
  - `type CheckableSection = (typeof CHECKABLE_SECTIONS)[number]`;
  - `function isSectionOn(item: Item, section: CheckableSection): boolean`;
  - `function toggleSection(item: Item, section: CheckableSection, on: boolean): Item`. Pura: devuelve un clon y no muta.

Reglas que cubren los tests:
- **Borde** vive en `item.style`.
- **Contorno y Sombra** viven en el `style` de cada span (`lines[].text[].style`). Se aplican y se quitan en todos los spans de todas las líneas.
- **Apagar:**
  - guarda en `inactive[section]` las propiedades actuales: las del primer span para Contorno y Sombra, las de `item.style` para Borde;
  - quita esas propiedades del CSS.
- **Prender:**
  - si hay `inactive[section]`, aplica esos valores y borra la entrada (y `inactive` entero si queda vacío);
  - si no hay, aplica los valores iniciales de Restricciones globales.
- **`isSectionOn`** es true si las propiedades de la sección están presentes con un valor distinto de vacío, `0px` o `none`.

- [ ] **Paso 1: tests que fallan:**
  - apagar Sombra en un ítem con dos líneas y dos spans quita `text-shadow` de los cuatro y guarda `inactive.shadow["text-shadow"] = "<valor del primer span>"`;
  - prender después restaura el valor en los cuatro spans y no deja `inactive`;
  - prender Borde sin `inactive` pone los tres valores iniciales;
  - el resto de `item.style` (por ejemplo `left`, `top`) queda intacto;
  - el original no se muta;
  - `isSectionOn` con `text-shadow: none` da false;
  - un ítem sin `inactive` ni estilos no tira error en ninguna combinación.
- [ ] **Paso 2:** verlos fallar.
- [ ] **Paso 3: implementar** con los helpers de CSS que ya existen (rg `getStyles`, `addStyleString` en `shared/`). No se crea un parser nuevo.
- [ ] **Paso 4:** tests verdes, `test:types` y arch.
- [ ] **Paso 5: commit** `feat(edit): prender y apagar secciones guardando valores`.

### Tarea 3: escribir varios ítems en una sola entrada de history

**Archivos:**
- Modificar: `src/frontend/shared/utils/helpers/history.ts`. Agregar el caso `"replaceSlideItems"` siguiendo el patrón de `"slideStyle"`: `_show(showID).slides([slide]).set({ key: "items", value })`, devolviendo el viejo para deshacer.
- Crear: `src/frontend/features/edit/inspector/logic/writeItems.ts` y su `.test.ts`

**Interfaces:**
- Produce: `function writeItems(next: { index: number; item: Item }[]): void`.
  - Lee `activeEdit`.
  - Con `activeEdit.id` (overlay o plantilla) usa `history({ id: "UPDATE", newData: { key: "items", data, indexes }, … })`, igual que `BoxStyle.tsx:671`.
  - En un show arma el array completo de ítems del slide con los reemplazos y usa `history({ id: "replaceSlideItems", … })`.

- [ ] **Paso 1: test que falla.** Con un show en memoria (mirá cómo arman stores los tests de `historyActions`):
  - `writeItems` sobre el ítem 1 deja el resto igual;
  - un `undo()` devuelve el ítem original completo, incluido `inactive`.
- [ ] **Paso 2:** verlo fallar.
- [ ] **Paso 3: implementar.**
- [ ] **Paso 4:** verde, `test:types` y arch.
- [ ] **Paso 5: commit** `feat(edit): escritura de ítems en un solo paso de deshacer`.

### Tarea 4: componente de secciones (reemplazo de EditValues)

**Archivos:**
- Crear: `src/frontend/features/edit/inspector/InspectorSections.tsx`, su `.module.css` y su `.test.tsx`
- Crear: `src/frontend/features/edit/inspector/InspectorField.tsx` y su test. Contiene el render de un input extraído de `tools/EditValues.tsx`: el `switch` por `input.type` y la lógica de `changed()`, incluido `valueIndex`. `EditValues` pasa a usarlo, para no duplicar.

**Interfaces:**
- Consume: el tipo de secciones de la tarea 1.
- Produce: `InspectorSections` con props
  - `sections`, `styles`, `customValues`, `customLocalFonts`, `item`, `type` (iguales a `EditValuesProps`);
  - `onChange(input: EditInput): void`;
  - `isOn(sectionId): boolean`;
  - `onToggle(sectionId, on: boolean): void`.

Comportamiento:
- Cada sección tiene una flecha que sólo cambia el estado local de abierta o cerrada.
- Las `checkable` tienen además un checkbox con estado `isOn(id)`, que llama a `onToggle`.
- Las no checkables tienen el botón de reset de hoy.
- Los inputs de `hiddenInputs` no se dibujan, pero `changed()` los sigue viendo para armar valores compuestos (la sombra).
- No hay `expandAutoValue` ni efecto que abra secciones solo.

- [ ] **Paso 1: tests que fallan:**
  - click en la flecha de `shadow` no llama a `onChange` ni a `onToggle`;
  - click en el checkbox de `shadow` apagado llama `onToggle("shadow", true)`;
  - una sección no checkable no tiene checkbox;
  - el input oculto de blur no se renderiza;
  - cambiar X de la sombra llama a `onChange` con un `text-shadow` de cuatro partes que conserva el blur actual.
- [ ] **Paso 2:** verlos fallar.
- [ ] **Paso 3: implementar.** Primero extraer `InspectorField` y correr `tools/EditValues.test.tsx`, que tiene que seguir verde. Después armar `InspectorSections` con los componentes de UI del kit (Button, Checkbox) y las variables del tema.
- [ ] **Paso 4:** verde, `test:types` y arch (`cssModulesScope`, `cssModulesClasses`).
- [ ] **Paso 5: commit** `feat(edit): secciones del inspector con checkbox separado del despliegue`.

### Tarea 5: panel del inspector (pestañas, slide, copiar y pegar)

**Archivos:**
- Crear: `src/frontend/features/edit/inspector/Inspector.tsx`, su `.module.css` y su `.test.tsx`
- Modificar:
  - `tools/BoxStyle.tsx`, `tools/ItemStyle.tsx`, `tools/SlideStyle.tsx`: aceptan una prop `inspector?: boolean`. Con ella usan `getInspectorSections(...)` y renderizan `InspectorSections` en lugar de `EditValues`, con `onToggle` → `writeItems(items.map(i => ({ index, item: toggleSection(i, id, on) })))` para cada ítem seleccionado. `SlideStyle` pierde `ItemsList`.
  - `app/MainLayout.tsx:110`: `<EditTools />` → `<Inspector />`.

**Interfaces:**
- Consume: tareas 1–4. `getBoxStyle`/`setBoxStyle`/… de `logic/scripts/itemClipboard` para la barra de copiar y pegar.
- Produce: `Inspector` sin props.

Comportamiento:
- **Sin ítem seleccionado** (`activeEdit.items` vacío): muestra `SlideStyle` (o `TemplateStyle`/`OverlayStyle` según `activeEdit.type`) sin pestañas.
  - Los filtros del slide (`SlideFilters`) no se muestran. Antes, confirmar en `sceneGraph.ts:getBackground` y en `SceneBackground` (`src-tauri/src/render/scene.rs`) que la escena no lleva filtros. Si los lleva, se muestran como sección "Filtros" del panel del slide, y se anota en el reporte.
- **Con ítem:** pestañas "Forma" (`ItemStyle`) y la de contenido (`BoxStyle`). La de contenido se llama `translateText("items." + (type || "text"))`, con el ícono de `itemBoxes[type]`.
- **Tipo no soportado:** la pestaña de contenido muestra la clave nueva `edit.type_not_in_output`.
  - es: "Este tipo de objeto todavía no se ve en la salida";
  - en: "This object type is not shown in the output yet".
- **Sección "Aparición":** dos checkboxes que escriben `clickReveal` y `lineReveal` (este último sólo en texto). Usan el mismo `history` que `menuClick.ts:item_actions`.
- **Barra fija arriba:** copiar, pegar y reset. Se mueven tal cual las funciones de `EditTools.tsx` (`copyStyle`, `pasteStyle`, `reset`), adaptadas a la pestaña activa.

- [ ] **Paso 1: tests que fallan:**
  - sin selección se renderiza el panel del slide y no hay pestañas;
  - con un ítem de texto hay dos pestañas, "Forma" y "Texto";
  - con un ítem `web` la pestaña de contenido muestra `edit.type_not_in_output`;
  - tildar Borde llama a `writeItems` una vez con el ítem modificado (mockeá `writeItems`);
  - copiar y pegar sigue llamando a `setBoxStyle` en la pestaña de contenido.
- [ ] **Paso 2:** verlos fallar.
- [ ] **Paso 3: implementar.**
- [ ] **Paso 4:** verde, `test:types`, arch y `bun run test:unit` del directorio `features/edit`.
- [ ] **Paso 5: en la app** (método de la sección "Verificación en la app"). Capturas `inspector-texto.png`, `inspector-sin-seleccion.png`, y sombra apagada y prendida (`inspector-sombra-off.png`, `inspector-sombra-on.png`).
- [ ] **Paso 6: commit** `feat(edit): inspector de dos pestañas`.

### Tarea 6: lista de objetos, menú contextual y barra de agregar

**Archivos:**
- Modificar:
  - la columna izquierda de Edit (`app/MainLayout.tsx:80` usa `features/edit/Navigation.tsx`): debajo de los slides, `<ItemsList allSlideItems=… />`, sólo con la página en Edit y un slide abierto;
  - `shared/ui/context/logic/contextMenus.ts:412` (`edit_box`): sacar `transition`, `item_bind_to` y `GROUP_dynamic` si sólo agrupa condiciones o valores dinámicos (verificalo);
  - `loadItems.ts:item_actions`: dejar sólo `clickReveal` y `lineReveal`;
  - `features/edit/ItemAddMenu.tsx`: ofrecer sólo `SUPPORTED_ITEM_TYPES` (tarea 1).

- [ ] **Paso 1: tests que fallan:**
  - `ItemAddMenu` no lista `web`, `camera` ni `chart`, y sí `text`, `media`, `timer` y `clock`;
  - el menú `edit_box` no contiene `transition` ni `item_bind_to`;
  - `item_actions` devuelve sólo `clickReveal` y `lineReveal` para un texto.
- [ ] **Paso 2:** verlos fallar.
- [ ] **Paso 3: implementar.** No se borra el código de los handlers ocultos (`menuClick`).
- [ ] **Paso 4:** verde, `test:types` y arch. Captura `edit-lista-objetos.png`.
- [ ] **Paso 5: commit** `feat(edit): lista de objetos a la izquierda y sólo tipos soportados`.

### Tarea 7: atajos de salida fuera del Preview, y sin Preview en Edit

**Archivos:**
- Crear: `src/frontend/features/output/useOutputShortcuts.ts` y su `.test.ts`
- Modificar:
  - `features/output/Preview.tsx`: mover al hook el `keydown` de las líneas 157-238 y las funciones que usa (`playSlideAtIndex`, `actionKeyActivate`, `checkGroupShortcuts`, los atajos numéricos, `keydownContext`);
  - `app/MainLayout.tsx`: llamar `useOutputShortcuts()` una vez y renderizar `<Preview />` sólo si `page !== "edit"`.

Antes de mover, revisá cada `useEffect` de `Preview.tsx`. Cualquier efecto que no sea dibujar (timers, audio, suscripciones) también se muda al hook. Listalos en el reporte.

- [ ] **Paso 1: tests que fallan:**
  - con el hook montado en un componente de prueba sin `Preview`, un `keydown` F1 llama a la función de limpiar de `previewShortcuts`;
  - un `keydown` "a" con foco en un `input` no dispara acciones por tecla;
  - `MainLayout` con `activePage = "edit"` no renderiza `Preview`.
- [ ] **Paso 2:** verlos fallar.
- [ ] **Paso 3: implementar.** `Preview.test.tsx` tiene que seguir verde, ajustado sólo en lo que se mudó.
- [ ] **Paso 4:** verde, `test:types` y arch.
- [ ] **Paso 5: en la app.** Edit sin preview (`edit-sin-preview.png`). Con un slide en salida, apretar F1 estando en Edit y capturar que la salida se limpió (`edit-f1.png`).
- [ ] **Paso 6: commit** `feat(edit): atajos de salida siempre activos y sin preview en Edit`.

### Tarea 8: el editor se achica con el drawer abierto

**Archivos:**
- Modificar: el contenedor que corresponda en `features/edit/Editor*.module.css` o en `app/MainLayout.module.css`. Encontrar la causa con la app y la sonda de scroll y tamaños (método de "Verificación en la app"). `Editor.module.css:12` ya tiene `min-height: 0`.

- [ ] **Paso 1:** reproducir. Edit con el drawer abierto a la mitad. Anotar qué contenedor excede su padre (alto real contra alto disponible) y su archivo:línea.
- [ ] **Paso 2: test que falla**, si la causa es testeable en happy-dom (por ejemplo una clase o estilo esperado en el contenedor). Si no lo es, decirlo en el reporte y dejar la verificación por captura.
- [ ] **Paso 3:** arreglar en CSS, sin JS. Prohibido `overflow: hidden` para tapar el síntoma.
- [ ] **Paso 4:** capturas con el drawer cerrado, a la mitad y casi al máximo (`edit-drawer-*.png`). El slide y la barra del canvas se ven enteros.
- [ ] **Paso 5: commit** `fix(edit): el editor se ajusta al alto que deja el drawer`.

### Tarea 9: retirar el panel viejo y cierre

**Archivos:**
- Borrar `features/edit/EditTools.tsx`, `tools/EditValues.tsx` y sus tests y CSS **sólo si** `rg` demuestra que no quedan importadores fuera de ellos mismos. `InspectorField` sale de `EditValues`. Si algo más los usa (Stage, por ejemplo, con `isStage`), no se borran y se reporta qué los usa.
- `docs/diagnostico.md`: agregar al final una sección "Ocultos del inspector (pendiente del motor)" con la lista del spec, para el roadmap.

- [ ] **Paso 1:** `rg -n "EditTools|EditValues" src`, y decidir según el resultado.
- [ ] **Paso 2:** borrar lo que no se usa. Correr `bun run test:unit` completo (0 FAIL), `test:types`, arch, `bun run test:budget` y prettier sobre todos los archivos tocados en `src/`.
- [ ] **Paso 3: en la app, recorrido completo con capturas:**
  - texto: sombra off/on y deshacer;
  - media: Forma y Media;
  - sin selección;
  - menú contextual;
  - barra de agregar;
  - drawer abierto;
  - F1 en Edit.
- [ ] **Paso 4: commit** `refactor(edit): retirar el panel viejo de edición`.

## Verificación en la app (todas las tareas con UI)

- **Puerto 1420.** Si el usuario tiene la app levantada en `main`, no se toca esa instancia. Se levanta desde el worktree sólo si el puerto está libre; si está ocupado, se avisa en el reporte y la verificación en la app queda para el controlador.
- **Sonda temporal** al final de `src/frontend/app/main.tsx`: un `<pre>` fijo amarillo con lo que se mida. NUNCA se commitea.
- **Capturas:** con osascript, traer "pulseflow" al frente y leer `{position, size}` de `window 1`; después `screencapture -x -R`. Van a `<workspace del plan>/shots/`.
- **Datos:** todo lo que se cree se llama `[diag] …` y se borra al final. `rg -l -i '\[diag\]' ~/Documents/PulseFlow` tiene que dar vacío. No tocar `Shows/Show.show`.
