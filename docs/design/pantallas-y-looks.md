# Pantallas y Looks — especificación (modelo ProPresenter)

Especificación de la fase **F10** de [`docs/ROADMAP.md`](../ROADMAP.md). Referencias:
la ventana *Screen Configuration* y la ventana *Looks* de ProPresenter 7.

## Problema actual

- **Looks y Estilos conviven.** Un Look de PulseFlow hoy es "a cada pantalla, un id de
  Estilo". El usuario tiene que entender dos conceptos para lo que en ProPresenter es
  uno solo, y editar un Estilo afecta a todos los Looks que lo usan.
- **La configuración de pantallas está repartida** en Settings → Outputs (620 líneas
  mezclando ventana, NDI, Blackmagic, RTMP, WebRTC, stage…), el popup "Elegir pantalla"
  (`Screens.svelte`), Settings → Styles y Settings → Looks. No hay un lugar donde ver
  "qué pantallas tengo, en qué monitor está cada una y qué muestra".

## Decisiones

1. **El Look reemplaza al Estilo.** Desaparece el concepto "Estilo" de la UI (la pestaña
   Settings → Styles se elimina). Todo lo que hoy configura un Estilo se reparte entre:
   - **la Pantalla**, para lo que depende del hardware (relación de aspecto, recorte,
     edge blending);
   - **la celda Look × Pantalla**, para lo que decide qué se ve y cómo (capas, tema,
     fondo, transiciones, líneas, metadata).
2. **Siempre hay un Look en vivo** (`activeLook`). Lo que muestra cada pantalla de
   audiencia sale de `looks[activeLook].screens[outputId]`. No hay "estilo de la salida".
3. **Dos ventanas propias**, no pestañas de Settings: **Configuración de pantallas** y
   **Looks**. Se abren desde el menú **Pantallas** y desde el botón de salida.
4. **Puente interno para no reescribir 44 archivos de golpe** (ver "Migración").

## Modelo de datos

```ts
// src/types/Output.ts — la Pantalla (sigue siendo `Output`)
interface Output {
    id, name, enabled, color,
    kind: "audience" | "stage"          // reemplaza el truthy de `stageOutput`
    stageLayout?: string                // sólo stage: id del layout (antes `stageOutput`)
    screenType: "single" | "mirror" | "edge_blend"   // "grouped" fuera de alcance
    mirrorOf?: string                   // sólo mirror: id de la pantalla que replica
    display: { screen: string | null, bounds, boundsLocked?, alwaysOnTop? }
    target: "full" | "custom"           // Output Target: monitor entero o bounds propios
    aspectRatio?: AspectRatio           // movido desde Styles
    cropping?: Cropping                 // "Corner pin" simplificado (movido desde Styles)
    blending?: …                        // ya existe; sólo se usa con screenType edge_blend
    ndi?, ndiData?, blackmagic?, blackmagicData?, rtmp?, rtmpData?, webrtc?, … // sin cambios
}

// src/types/Settings.ts — el Look
interface Look {
    name: string
    transitionMs: number                // transición al hacerlo live (slider "1.0s")
    screens: { [outputId: string]: LookScreen }   // sólo pantallas de audiencia
}

interface LookScreen {
    layers: { media: boolean, slide: boolean, overlays: boolean }
    theme?: string                      // "Presentation" ⊘ = sin override; si no, id de template
    themeScripture?: string             // overrides de scripture (antes templateScripture*)
    background?: string; backgroundImage?: string; clearStyleBackgroundOnText?: boolean
    fit?, blurAmount?, blurOpacity?, volume?
    transition?: { [key: string]: Transition }
    lines?, showAsFaded?, lineOpacity?, skipVirtualBreaks?
    metadata?: Metadata
}
```

Equivalencias con ProPresenter (filas de la grilla de Looks):

| ProPresenter | PulseFlow |
| --- | --- |
| Presentation (⊘ / tema alternativo) | `theme` (+ `themeScripture` en "más opciones") |
| Slide | `layers.slide` |
| Media | `layers.media` (la capa `background` de FreeShow) |
| Props / Messages / Announcements | `layers.overlays` (FreeShow tiene una sola capa de overlays) |
| Video Input | `layers.media` (las cámaras son medios en FreeShow) — no fila propia |
| Mask | fuera de alcance |

## Migración (una sola vez, al cargar settings)

1. Por cada Look existente y por cada pantalla de audiencia: `LookScreen` = copia de los
   campos de `styles[look.screens[id]]` (o del estilo actual de la salida si el look no
   la menciona), mapeando `layers: ["background","slide","overlays"]` → booleanos y
   `template` → `theme`.
2. Si no hay Looks, crear **"Default"** con el estilo actual de cada salida y hacerlo live.
3. `aspectRatio` y `cropping` del estilo → a la Pantalla (si la salida no tenía propios).
4. `stageOutput` → `kind: "stage"` + `stageLayout`.
5. Guardar el objeto `styles` original en `stylesLegacyBackup` (no se borra nada).
6. Test de vitest con un settings real de FreeShow como fixture.

### Puente (para no tocar 44 archivos en la misma tarea)

Hoy 44 archivos leen `$styles[output.style]` o `getCurrentStyle(styles, output.style)`.
En la primera etapa:

- Una función `lookScreenToStyle(lookScreen): Styles` convierte la celda al formato viejo.
- Un `derived` (o un `subscribe` en `looks.ts`) regenera `styles` con entradas internas
  `__look__<outputId>` a partir del **Look en vivo**, y cada salida apunta
  `output.style = "__look__<outputId>"`. El resto del código sigue funcionando igual.
- Después, en tareas separadas, se reemplazan los usos por un helper
  `getOutputLook(outputId): LookScreen` y se elimina el puente.

## Modales (cómo se ven y se comportan)

"Configuración de pantallas" y "Looks" son **modales**, como las ventanas de
ProPresenter, no páginas ni pestañas de Settings:

- Centrados sobre la app con el fondo oscurecido; tamaño fijo cómodo (≈ 960×620 para
  pantallas, ≈ 720×480 para looks), que se reduce si la ventana es más chica.
- Barra de título propia de 36 px con el nombre centrado en texto chico y botón de
  cerrar; `Esc` cierra. **No** se cierran con un clic afuera (evita perder cambios).
- Dos columnas: lista a la izquierda (fondo `--primary-darker`), detalle a la derecha.
- Los cambios de pantallas se aplican al momento; los de looks, al tocar "Guardar".
- Se implementan con un componente base nuevo `components/main/Modal.svelte` (no con
  el `Popup.svelte` actual, que es para diálogos chicos) para que ambos modales se vean
  igual.

## Ventana "Configuración de pantallas"

Modal (ver arriba) con el lenguaje visual del tema PulseFlow (F6). Se abre desde **Pantallas → Configurar pantallas…** (`⌘⇧1` / `Ctrl+Shift+1`)
y desde el menú contextual del botón de salida.

```
┌ Configuración de pantallas ─────────────────────────────────────────────────────┐
│ ┌──────────────────────┐ ┌────────────────────────────────────────────────────┐ │
│ │ (●) Audiencia      + │ │ Principal                           ☐ Siempre arriba│ │
│ │ ▌Principal           │ │ 1920 × 1080                                         │ │
│ │ ▌1920 × 1080   ● live│ │ [ Única ▾ ]   (Única · Espejo · Edge blend)         │ │
│ │  Lower thirds        │ │ ┌────────────────────────────────────────────────┐ │ │
│ │  1920 × 1080         │ │ │      ┌──────────────┐                          │ │ │
│ │                      │ │ │      │   SB220Q     │  ← rectángulo del monitor │ │ │
│ │ (●) Stage          + │ │ │      └──────────────┘    asignado (clic = otro)│ │ │
│ │  Monitor banda       │ │ └────────────────────────────────────────────────┘ │ │
│ │  1920 × 1080         │ │ SB220Q                                              │ │
│ │                      │ │ [ Hardware ] [ Recorte ] [ Envío (NDI/RTMP…) ]      │ │
│ │──────────────────────│ │ Salida   [▣ SB220Q              ▾]  Destino [Completo▾]│
│ │ SISTEMA              │ │ ┌───────────────────────────┐                       │ │
│ │ ▭▬ Pantalla integrada│ │ │ Nombre: SB220Q            │                       │ │
│ │    1512 × 982        │ │ │ Tamaño: 1920 × 1080       │                       │ │
│ │ ▬▭ Monitor externo   │ │ │ Relación: 1.78 (16:9)     │                       │ │
│ │    1920 × 1080       │ │ └───────────────────────────┘                       │ │
│ │ NDI                  │ │                                                     │ │
│ │  Nueva salida NDI  > │ │                     [ Identificar pantallas ]       │ │
│ └──────────────────────┘ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Columna izquierda**
- **Audiencia** y **Stage**: interruptor (activa/desactiva todas las de ese grupo, es el
  mismo efecto que el botón de salida para ese grupo), botón `+` (nueva pantalla de ese
  tipo) y la lista con nombre + resolución. La seleccionada se resalta; las que están en
  vivo muestran un punto verde. Clic derecho: renombrar, duplicar, eliminar.
- **Sistema** (abajo): monitores detectados (`GET_DISPLAYS`) con miniatura que muestra la
  disposición (la pantalla integrada marcada), y la sección **NDI** con "Nueva salida
  NDI" (crea una pantalla de audiencia sin monitor con `ndi: true`). Se refresca al
  abrir la ventana y al conectar/desconectar monitores.

**Panel derecho (pantalla de audiencia)**
- Nombre editable inline, resolución debajo, "Siempre arriba".
- **Tipo**: Única / Espejo (elegir de qué pantalla) / Edge blend (muestra los controles
  de blending que hoy están en `Screens.svelte`). "Agrupada" no se ofrece todavía.
- **Lienzo**: rectángulo del monitor asignado, en escala; clic en otro monitor del
  lienzo = asignar ese monitor (reemplaza el popup "Elegir pantalla").
- Pestañas:
  - **Hardware**: *Salida* (dropdown con los monitores detectados + "Ninguna"), *Destino*
    (Completo / Personalizado → x, y, ancho, alto), ficha con nombre, tamaño y relación.
  - **Recorte**: recorte por lado (hoy `cropping`), relación de aspecto.
  - **Envío**: NDI, OMT, Blackmagic, RTMP, WebRTC (lo que hoy está en Settings → Outputs,
    sin cambios funcionales; sólo se mueve).

**Panel derecho (pantalla de stage)**: igual, pero en lugar de "Tipo" muestra **Layout**
(dropdown de layouts de stage + botón "Editar layout") y no muestra la pestaña Recorte.

## Ventana "Looks"

```
┌ Looks ──────────────────────────────────────────────────────────────┐
│ ┌────────────────┐ ┌───────────────────────────────────────────────┐│
│ │ En vivo Default│ │ Default                        [ Guardar ]    ││
│ │ Presets      + │ │                     Principal   Lower thirds  ││
│ │ ▌Default       │ │ Presentación (tema)   [ ⊘ ▾ ]     [ LT ▾ ]    ││
│ │  Sólo letras   │ │   Slide                 ☑            ☑        ││
│ │  Lobby         │ │   Media                 ☑            ☐        ││
│ │                │ │ Overlays                ☑            ☑        ││
│ │                │ │ ▸ Más opciones (fondo, líneas, metadata, …)   ││
│ │                │ │                                               ││
│ └────────────────┘ │ ▣ 1.0 s ━━●───────          [ Poner en vivo ] ││
│                    └───────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

- **Izquierda**: "En vivo: <nombre>" arriba; lista de presets con `+`; clic derecho:
  renombrar, duplicar, eliminar (no se puede eliminar el último).
- **Grilla**: una columna por pantalla de audiencia (las de stage no aparecen), filas
  como la tabla de equivalencias. El dropdown de tema muestra ⊘ cuando no hay override.
- **"Más opciones"** (colapsado): el resto de campos de `LookScreen` por columna
  (fondo, ajuste de medios, desenfoque, volumen, transiciones, líneas, metadata). Es
  donde terminan las opciones avanzadas del viejo Estilo.
- **Guardar** guarda el preset; si el preset editado es el que está en vivo, los cambios
  se ven en las pantallas al guardar (no en cada clic).
- **Slider de transición** (`transitionMs`) y **Poner en vivo**.
- Los cambios de Look se registran en el historial (deshacer).

## Distribución general (como ProPresenter 7)

Objetivo: que quien viene de ProPresenter encuentre las cosas donde las espera. No se
mueven features de lugar si no figuran acá.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [ Show | Edit | Stage ]        Look: Default ▾  [▣ Audiencia] [▣ Stage] ⚙ │
├──────────────┬─────────────────────────────────────────────┬──────────────────┤
│ Proyectos /  │ Nombre del show · layout          12 slides │ ┌──────────────┐ │
│ playlists    │                    [+ Añadir] [▶ Proyectar] │ │  Audiencia   │ │
│              │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │ │  (preview)   │ │
│              │ │ 1  │ │ 2  │ │ 3  │ │ 4  │  grilla de      │ └──────────────┘ │
│              │ └────┘ └────┘ └────┘ └────┘  slides         │ [ Limpiar todo ] │
│              │                                             │ ▭  🖼  ◧  ♪      │
│              │                                             │ Timers│Overlays│…│
│              │                                             │ (controles)      │
├──────────────┴─────────────────────────────────────────────┴──────────────────┤
│ Shows │ Media │ Audio │ Scripture │ Overlays │ Templates │ …      🔍 Buscar     │
│ (cajón de bibliotecas, como el Media Bin de ProPresenter)                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

| Elemento | Dónde | Qué hace |
| --- | --- | --- |
| Botón **Audiencia** | barra, derecha | enciende/apaga todas las pantallas de audiencia (⌘1); resaltado cuando están en vivo; clic derecho → Configurar pantallas… |
| Botón **Stage** | barra, derecha | igual para las de stage (⌘2) |
| **Look: X ▾** | barra, a la izquierda de los botones de pantallas | cambia el look en vivo; última opción "Editar looks…" abre el modal |
| Vista previa | panel derecho, arriba | muestra la pantalla de audiencia principal; encima, "Look: X" |
| **Limpiar todo** + limpiar por capa | debajo de la vista previa | lo que hoy hacen los botones de limpiar, con el mismo orden de capas que la grilla de looks |
| Controles (Timers, Overlays/Mensajes, Stage, Acciones) | panel derecho, debajo de limpiar | las herramientas que hoy muestra `ShowTools` |
| Configurar pantallas… / Looks… | menú **Pantallas**, clic derecho en los botones de pantallas, selector de look | abren los modales |

Pendiente de decidir por el usuario (no hacerlo sin preguntar): mover la biblioteca de
shows del cajón inferior a la columna izquierda, como en ProPresenter.

## Dónde se accede (y qué desaparece)

| Lugar | Qué |
| --- | --- |
| Menú **Pantallas** (menú nativo en macOS vía Tauri; en Windows, el `MenuBar.svelte` existente) | Mostrar pantallas de audiencia `⌘1` · Mostrar pantallas de stage `⌘2` · Configurar pantallas… `⌘⇧1` · Looks… `⌘⇧L` · submenú **En vivo** con los looks (check en el activo) |
| Barra superior, junto al botón de salida | Selector compacto "Look: Default ▾" |
| Panel de salida (derecha) | El selector de look que ya existe (F5.4), con el mismo componente |
| Acción de slide | `set_look` (ya existe) |
| **Se eliminan** | Settings → Outputs, Settings → Styles, Settings → Looks, popup "Elegir pantalla", popup "Cambiar valores de salida" (todo vive en la ventana nueva). En Settings queda sólo un botón "Configurar pantallas…" para encontrarlo. |
