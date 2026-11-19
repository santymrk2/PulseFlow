# Investigación: Looks y Pantallas (ProPresenter 7 vs PulseFlow)

Fecha: 2026-11-19. Solo lectura. Copiamos el funcionamiento, no arte ni textos.

## Parte 1. Cómo lo hace ProPresenter 7

### 1. Configuración de pantallas
Fuente: https://support.renewedvision.com/hc/en-us/articles/360041879173-Screen-Configuration-in-ProPresenter-7
- Se abre con Screens > Configure Screens (Opción-Cmd-1 en Mac).
- La ventana tiene dos secciones: **Audience** (pantallas de cara al público) y **Stage** (monitores de escenario / confidence / foldback). Cada una con un botón **+**.
- El **+** ofrece las salidas disponibles: salidas del sistema, NDI virtual, SDI (con hardware), Syphon (Mac), **Placeholder** (armar shows fuera del sitio a una resolución fija). El mismo menú ofrece Grouped, Mirrored y Edge Blended.
- Tipos: **Single** (una pantalla, una salida), **Mirror** (una pantalla a varias salidas; la de más a la izquierda es la primaria), **Grouped** (una imagen repartida en una grilla de salidas), **Edge Blend** (varios proyectores fundidos en los bordes; artículo aparte).
- Pestaña Hardware: desplegable **Output** elige dispositivo y resolución; debajo Name y Size. Los campos editables dependen del tipo de salida.
- Borrar: clic derecho > delete. "Disable" (v22+) oculta la pantalla solo en el preview de esa computadora.
- Hay sección de bit depth / HDR y, en Settings > Screens, estadísticas de rendimiento en pantalla.
- Fuente adicional (hardware): https://renewedvision.com/blog/?p=214355 (no hay tope de pantallas, solo el que impone el hardware).
- Lo que el artículo no cubre: controles de aspecto, color y arreglo de pantallas más allá de los tipos.

### 2. Looks
Fuente: https://renewedvision.com/blog/using-looks-with-multiple-screens-in-propresenter-7
- Un Look define **qué capas y qué versión de las slides muestra cada pantalla de audiencia**, y se cambia todo a la vez con un preset.
- Ventana Screens > Edit Looks: lista las pantallas de audiencia, y bajo cada una sus capas (slide, announcements, video input, etc.) con interruptor por capa. La capa Slide puede llevar un **tema (theme)** propio por pantalla y por look (ejemplo: pantalla de switcher con tema de tercio inferior con key).
- Cada preset (ej. "Teaching") tiene sus propios interruptores de capa y tema por pantalla. Se agregan con un botón y se nombran.
- **Identify** muestra en cada pantalla física sus capas en orden de apilado.
- Cambio en vivo: **Make Live** en la ventana, el desplegable Screens > Looks, y la acción **Audience Look** en una slide (Action Palette o clic derecho > Add Action > Audience Look). El look queda activo hasta que otra slide dispare otro Audience Look; "Default" vuelve al estado base.
- Máscaras: la fuente no las menciona; no las tratamos como parte del alcance.
- Stage: una pantalla de stage recibe su propio layout (se arma en Stage Editor); desde 7.x cada pantalla de stage puede tener un layout distinto (https://renewedvision.com/blog/?p=213763).

### 3. Capas de salida y limpieza
Fuentes: https://support.renewedvision.com/hc/en-us/articles/4408681880211-Using-Clear-Groups-in-ProPresenter ; https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface
- Pila (de arriba abajo): **Audio, Messages, Props, Announcements, Slide, Media, Video Input**. Los botones de clear se muestran en el mismo orden que las capas.
- Hay clear por capa (Props F4, Message F6, Announcements F7 según la tabla de atajos; verificar teclas exactas en la versión) y **Clear to Logo** (F12).
- **Clear Groups** (7.7+): botones configurables (clic derecho en un clear > Configure Clear Groups) con nombre, icono y color, que limpian cualquier combinación de: Music, Audio Effects, Messages, Props, Announcements, Presentation, Presentation Media, Video Input. Por defecto existe "Clear All"; el icono y el color aparecen como botón en el panel de preview. Ejemplo oficial: "All But Video Input".
- El artículo de Clear Groups no cubre atajos ni Clear to Logo.

### 4. Stage solo en relación con pantallas y Looks
- Stage es una sección separada de la configuración de pantallas; cada pantalla de stage elige un layout propio. Los Looks (capas por pantalla) solo gobiernan las pantallas de **audiencia**; el stage no entra en un Look. Fuente: https://support.renewedvision.com/hc/en-us/articles/360041879173-Screen-Configuration-in-ProPresenter-7 y el blog de looks citado arriba.

### 5. Detalles de UX útiles para el operador
- Cambiar de look sin abrir ventanas: desplegable en la barra (Screens > Looks) y acción atada a la slide, así el look cambia solo al llegar a esa parte del servicio.
- Identify en pantallas físicas para no confundir salidas.
- Botones de clear con el mismo orden que las capas, y grupos de clear personalizados con color/icono para no equivocarse en vivo.
- Placeholder de pantalla para preparar el show sin proyector.
- Un look "queda pegado" hasta que otro lo reemplaza (modelo predecible).

## Parte 2. Qué tiene PulseFlow hoy (worktree PulseFlow-orden)

**Modelo de datos** (`src/types/Settings.ts`, `src/types/Output.ts`)
- `Look { name, transitionMs, screens: { [outputId]: LookScreen } }`; `LookScreen` = `layers {media, slide, overlays}` + theme, background, fit, blur, volume, lines, etc.
- `Output` con `kind: "audience" | "stage"`, `stageLayout`, `screenType: "single" | "mirror" | "edge_blend"`, `mirrorOf`, `blending`, `aspectRatio`, `cropping`, `forcedResolution`, ndi/omt/blackmagic/webrtc/rtmp.
- Stores: `looks`, `activeLook` (`shared/core/stores.ts:392-393`).

**Looks (frontend)**
- Ventana: `features/popups/LooksWindow.tsx`: presets a la izquierda (lista con punto de "en vivo"), grilla pantallas x capas a la derecha, borrador con "Guardar", Rename / Duplicate / Delete / Make Live, deslizador de transición.
- `features/looks/LookGrid.tsx`: una columna por pantalla de audiencia; filas Presentación (tema), Slide, Media, Overlays. `LookAdvanced.tsx`: "Más opciones" plegable (fondo, volumen, blur, líneas).
- Barra superior `app/main/Top.tsx:158-170`: botón de Looks con menú que lista los looks (marca el activo) y "Edit looks".
- Menú nativo: `app/wiring/shortcuts.ts:544-554` (submenú "En vivo" con los looks).
- Selector `features/popups/SelectLook.tsx` (usa `popupData.trigger`, o sea sirve para elegir un look desde una acción).
- Lógica `shared/utils/helpers/looks.ts`: `applyLook`, `createLook`, `deleteLook`, migración y un **puente** que traduce el look activo a entradas `__look__<id>` de `styles` y apunta `output.style` a ellas.
- Las salidas de stage no entran en un Look (`isStageOutput`).

**Pantallas (frontend)**
- `features/screens/ScreenConfig.tsx` (popup `screen_config`, 960x620): izquierda `ScreenList` (Audience/Stage con alta), debajo `SystemDisplays` (monitores detectados, Refresh, Identify) y botón de NDI nuevo; derecha `ScreenDetail` (381 líneas) y `ScreenOutputOptions` (547).
- `ScreenDetail`: selección de monitor, tipo single/mirror/edge_blend (con campos de blending), aspect ratio, layout de stage por pantalla, etc.
- Identify: `send(OUTPUT, ["IDENTIFY_SCREENS"], displays)` -> `src-tauri/src/render/screens/identify.rs` (número 3 s en cada monitor).
- `DisplayLayout.tsx`: arreglo de pantallas.

**Capas y clear**
- `features/output/ClearButtons.tsx`: Clear all / Restore output, y botones por capa: background (F1), slide (F2), overlays (F3), audio (F4), timer (F5), scene. Con botón de "preview" de cada capa. Acciones en `features/output/logic/clear.ts`.
- No hay capas Messages / Props / Announcements / Video Input separadas, ni grupos de clear configurables. No se encontró "Clear to Logo" en `features/output` ni en `shared/utils/helpers/output.ts` (el `rg` de "logo" solo devuelve cosas ajenas: splash, About, drawer media).

**Rust** (`src-tauri/src/render/`)
- `scene.rs`: `ScenePayload { stage, width, height, background, items, overlays, transition, plain_text, next_text, align }`. Es decir, el engine conoce 3 capas fijas: fondo, items de slide y overlays; más stage como "layout" dentro del mismo loop (`stage.rs`, `screens/render_loop.rs`). No existe concepto de Look ni de capas nombradas en Rust: **el look se resuelve entero en el frontend** (apila/oculta capas al armar la escena de cada salida).
- `screens/`: `monitors.rs`, `identify.rs`, `lifecycle.rs`, `scene_state.rs`, `render_loop.rs`, `video_hub.rs`, `close_button.rs`.

**Problemas conocidos** (`docs/diagnostico.md`)
- F09: popup `select_look` sin traducción (`[popup.select_look]`).
- F11: el preview del panel de salida queda negro aunque haya contenido en salida; no se ve qué está en vivo.
- F14: `choose_output_type` recortado.
- UX: `Clear all` y `Restore output` comparten lugar y cambian de sentido sin confirmación visual; ProPresenter mantiene botones fijos con estado.
- No se verificó la ventana física del engine WGPU ni una segunda pantalla (el diagnóstico lo declara como no cubierto).
- Referencia diagnóstico: la lista de humo describe el flujo actual de Looks (icono paleta > menú > ventana con Rename/Duplicate/Delete/Make Live).

## Parte 3. Análisis de brechas

| Concepto PP | Estado | Detalle y archivos |
|---|---|---|
| Ventana de configuración con Audience / Stage separados | Existe, funciona como PP | `ScreenList.tsx`, `ScreenConfig.tsx` |
| Alta de pantalla desde un "+" con tipos de salida | Existe, difiere | `onAddAudience`/`onAddStage` + botón NDI aparte; `choose_output_type` (F14 recortado). PP unifica todo en un menú "+". |
| Mapeo a monitor físico y resolución | Existe, funciona similar | `SystemDisplays.tsx`, `ScreenDetail.tsx`, `forcedResolution` |
| Identify | Existe, funciona como PP (sobre el monitor); no muestra capas | `identify.rs` |
| Single / Mirror / Edge blend | Existe. Mirror y edge blend presentes, Grouped no existe | `Output.screenType`; `ScreenDetail.tsx:353` |
| Placeholder (pantalla sin hardware) | Falta | no hay tipo equivalente |
| Disable por computadora | Falta | `hideFromPreview` existe pero es otra cosa (verificar) |
| Look = capas por pantalla de audiencia | Existe, funciona como PP, con 3 capas | `LookGrid.tsx`, `Settings.ts:19`. PP tiene más (announcements, video input) |
| Tema por pantalla y look | Existe, funciona como PP | `LookScreen.theme` |
| Editor de looks (presets + grilla) | Existe, difiere: edición con borrador y "Guardar" explícito, ventana modal; en PP se edita directo | `LooksWindow.tsx` |
| Presets "Default" | Existe (migración crea "Default") | `looks.ts` migración |
| Presets tipo "Lyrics only" / "Speaker" | Falta como plantillas de arranque | solo se crean vacíos o copiando el activo (`createLook`) |
| Cambio en vivo desde la barra | Existe, funciona como PP | `Top.tsx:158` |
| Look atado a una slide (Audience Look action) | Parcial: existe `SelectLook` con `trigger` y actions en `features/actions`, pero no verifiqué que haya acción "audience look" por slide | verificar `features/actions/logic/actionData.ts` |
| Transición al cambiar de look | Existe (`transitionMs`) y PP no lo expone igual | mejora a favor de PulseFlow |
| Stage fuera de los Looks | Existe, funciona como PP | `isStageOutput` |
| Capas Audio / Messages / Props / Announcements / Slide / Media / Video Input | Parcial: hay media, slide, overlays (~props), audio, timer, scene. Faltan Messages y Announcements como capa | `ClearButtons.tsx`, `scene.rs` (overlays) |
| Clear por capa | Existe, funciona como PP | `ClearButtons.tsx`, `logic/clear.ts` |
| Orden de botones igual al apilado de capas | Difiere | orden actual: Scene, Clear all, background, slide, overlays, audio, timer |
| Clear groups configurables | Falta | no hay |
| Clear to Logo | Falta | no hay logo de salida |
| Estado/preview vivo en el panel de salida | Falla conocida (F11) | `features/output/Output.tsx` |
| Look aplicado en el engine | Existe vía puente frontend; Rust no sabe de looks | `looks.ts` (puente), `scene.rs` |

## Cambios mínimos priorizados

**1. Clear to Logo + logo de salida (M)**
- Operador: un botón/atajo "Logo" en la franja de clear. Al pulsarlo la salida muestra el logo configurado (imagen elegida en Settings o por pantalla) sobre fondo del look; pulsar otra cosa lo quita.
- Toca: frontend `ClearButtons.tsx`, `logic/clear.ts`, un campo `logo` en `Output` o en `LookScreen` (`Settings.ts`/`Output.ts`), escena en `shared/utils/helpers/output.ts`; Rust: nada si el logo se manda como fondo/item de la escena existente (S extra si se prefiere capa propia en `scene.rs`).
- Dependencias/riesgos: decidir si el logo es por look o global. Hay que migrar el JSON de escena si se agrega capa nueva (contrato versionado en `SCENE_GRAPH_VERSION`).

**2. Presets iniciales de Looks y acción "Audience Look" por slide (S + M)**
- Operador: al crear un look elige plantilla (Default, Solo letras, Orador) y en una slide agrega una acción "Cambiar look" que queda pegada hasta otra acción. "Default" vuelve al estado base.
- Toca: `LooksWindow.tsx`/`createLook` (plantillas con capas predefinidas, 15-30 líneas); `features/actions` (verificar si ya existe `APPLY_LOOK` como acción; `SelectLook.tsx` ya acepta `trigger`).
- Riesgo: confirmar si la acción ya existe antes de construirla; evitar duplicar el flujo.

**3. Reordenar y renombrar la franja de clear según la pila de capas, y mantener Restore visible (S)**
- Operador: botones fijos en el orden de apilado (Audio, Props/Overlays, Slide, Media, ...) y "Clear all" / "Restore" como dos botones con estado, no uno que cambia (cierra la fila de UX de `diagnostico.md`).
- Toca: `ClearButtons.tsx` y su `.module.css`. Solo frontend.
- Riesgo: tests existentes en `ClearButtons.test.tsx`; atajos F1-F5 no deben cambiar de tecla.

**4. Clear Groups configurables (M)**
- Operador: clic derecho en un clear > configurar; crea botones propios (ej. "Todo menos video") con nombre/color/icono que limpian una combinación de capas.
- Toca: nuevo store/ajuste de grupos (settings; formato de usuario: requiere migración o valor por defecto "Clear all"), `ClearButtons.tsx`, `logic/clear.ts`, un popup nuevo en `features/popups/registry.ts`.
- Dependencias: #3 (para que los botones de grupo tengan lugar claro). Riesgo: cambia formato de settings, hay que dar default sin migrar archivos existentes.

**5. Capas Messages y Announcements en salida y en la grilla de Looks (L)**
- Operador: dos filas más en la grilla de Looks (Messages, Announcements) y dos botones de clear; los anuncios se envían a su capa sin tocar la slide.
- Toca: `LookScreen.layers` (`Settings.ts`), `LookGrid.tsx`, puente en `looks.ts`, `OutData` en `Output.ts`, `output/logic`, y en Rust `ScenePayload` (nueva lista de items por capa) + `render_loop`/`scene_state`. Contrato IPC con test de (de)serialización y espejo TS.
- Riesgo: es el cambio más grande; cambia contrato de escena y formato de Looks guardados (migración idempotente como la de F10). Hacerlo después de 1-4.

**6. Identify con capas y unificar el alta de pantallas en un menú "+" (S)**
- Operador: Identify muestra además el nombre del look/capas por pantalla; el "+" ofrece pantalla de sistema, NDI, Placeholder.
- Toca: `ScreenList.tsx`, `ScreenConfig.tsx` (`newNdi`), `identify.rs` (solo si se muestra más que el número).
- Riesgo: Placeholder implica una salida sin ventana (`lifecycle.rs`); validar que no abra ventana física.

**7. Arreglos ya diagnosticados que rozan estos flujos (S cada uno)**
- F09 traducción `popup.select_look` en `public/lang/en.json`; F11 preview vivo en `features/output/Output.tsx`; F14 recorte de `choose_output_type`.

### Qué no se verificó
- Si existe una acción de "look" por slide en `features/actions` (solo vi `SelectLook` con `trigger`).
- Comportamiento real del engine WGPU con una segunda pantalla (el diagnóstico tampoco lo cubre).
- Teclas exactas de clear en PP (la fuente las muestra con columnas ilegibles).
