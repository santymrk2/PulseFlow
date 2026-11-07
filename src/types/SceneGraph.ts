// Scene Graph que la UI de control envía al engine de render nativo (Rust) con `RENDER_SCENE`.
// Espejo exacto de `src-tauri/src/render/scene.rs` (serde camelCase). Si cambias un campo en un
// lado, cambia el otro: el payload lo arma `sceneGraphPayload.ts` (el único lugar que enumera las
// claves) y el test de contrato F4.2 lo verifica — `sceneGraphPayload.test.ts` genera los fixtures
// de `src-tauri/tests/fixtures/scene/*.json` y `src-tauri/src/render/scene_contract.rs` los
// deserializa con el engine y falla si los nombres o los valores no coinciden.
//
// # Qué está implementado en el engine (F4.1)
//
// El contrato describe más de lo que el engine dibuja hoy. Implementado de verdad:
//
// - `outputId`: rutea la escena a la pantalla con ese id.
// - `stage`: elige el layout de Stage Display (`plainText`/`nextText`); si trae `items` (el layout que diseñó el
//   usuario, F23.19), el engine los dibuja como los de una audiencia (cajas, texto, medios) en lugar de `plainText`.
// - `width`: resolución lógica; escala `x`, `width` y `fontSize` de los items.
// - `background`: imagen o video (con `opacity` y `fit`).
// - `items` de tipo `text`: caja, alineación horizontal y vertical, línea, fuente por
//   tramo (`spans`), color, contorno (`stroke`) y sombra (`shadow`).
// - `items` de tipo `media` (imágenes): caja, `src`, `fit` y `opacity` (F4.5). Los
//   videos se aceptan en el contrato pero el engine todavía no los dibuja.
// - `transition`: crossfade y corte en el bucle de render (F4.4).
// - `plainText`/`nextText`: texto del Stage Display.
// - `overlays`: capa propia con los items de las overlays activas (texto e imagen),
//   dibujada encima de la slide en este orden: fondo → medios de la slide → texto de
//   la slide → medios de los overlays → texto de los overlays (F4.6). Todo overlay
//   activo viaja en esta capa, incluso los con `placeUnderSlide`: el engine todavía
//   no los dibuja debajo de la slide.
//
// Sólo tipo (llega al engine pero todavía no se dibuja):
//
// - `height`.
// - Items que no son `text` ni `media` (cámaras, web, temporizadores…): Rust los ignora.

/** Versión del contrato. El engine rechaza cualquier otra (F4.1). */
export const SCENE_GRAPH_VERSION = 1

/** Color RGBA normalizado: cada canal entre 0 y 1. */
export type SceneColor = [number, number, number, number]

/** Margen interior de un cuadro, en unidades de la resolución lógica (orden CSS: arriba, derecha, abajo, izquierda) */
export interface ScenePadding {
    top: number
    right: number
    bottom: number
    left: number
}

/**
 * Caja de un ítem (F23.16): fondo, borde, esquinas redondeadas, opacidad y padding. Todo opcional; el engine
 * dibuja la caja en el rect completo del ítem, antes de su contenido. `opacity` multiplica caja, texto y medio.
 * `padding` achica el rect del texto (no el de la caja).
 */
export interface SceneBoxStyle {
    background?: SceneColor
    borderColor?: SceneColor
    borderWidth?: number
    radius?: number
    opacity?: number
    padding?: ScenePadding
}

export interface SceneGraph {
    /** Versión del contrato (`SCENE_GRAPH_VERSION`). El engine la valida. */
    version: number
    outputId: string
    /** La salida es un Stage Display */
    stage: boolean
    /** Resolución lógica de la escena: x/y/width/height/fontSize de los items están en estas unidades */
    width: number
    height: number
    background: SceneBackground | null
    items: SceneItem[]
    /** Items de las overlays activas: capa propia dibujada encima de la slide (F4.6) */
    overlays: SceneItem[]
    transition: SceneTransition | null
    /** Todo el texto de la slide en una cadena (stage display) */
    plainText: string
    /** Texto de la slide siguiente, si la hay (stage display) */
    nextText?: string
    /**
     * Dónde se ubica la escena dentro de la ventana cuando su proporción (`width × height`) no coincide
     * con la de la salida: "start" (arriba/izquierda) o "end" (abajo/derecha). Si falta, centrada.
     */
    align?: "start" | "end"
}

export interface SceneBackground {
    path: string
    type: "image" | "video"
    fit: "cover" | "contain" | "fill"
    opacity: number
    loop?: boolean
    muted?: boolean
    /** El transporte del webview está en pausa (el video del engine lo sigue; F23.14) */
    paused?: boolean
    /** Posición del transporte del webview en ms */
    positionMs?: number
}

export interface SceneTransition {
    /** Tipo de transición de FreeShow (none, fade, crossfade, slide...). Rust lo traduce al engine */
    type: string
    durationMs: number
    easing?: string
}

// Tipos de item que el engine dibuja; el resto (cámaras, web, timers…) se ignora en Rust.
export type SceneItem = SceneTextItem | SceneMediaItem

export interface SceneMediaItem {
    type: "media"
    id?: string
    x: number
    y: number
    width: number
    height: number
    /** Ruta del archivo en disco */
    src: string
    /** "image" o "video" (el engine sólo dibuja imágenes por ahora) */
    mediaType: "image" | "video"
    /** Cómo encaja la imagen en la caja (por defecto "contain") */
    fit?: "cover" | "contain" | "fill"
    opacity: number
    /** Fondo, borde, esquinas y opacidad del cuadro (F23.16) */
    box?: SceneBoxStyle
    /** Transporte del webview para un video (F23.20): igual que en el fondo */
    paused?: boolean
    positionMs?: number
}

export interface SceneTextItem {
    type: "text"
    id?: string
    x: number
    y: number
    width: number
    height: number
    align: "left" | "center" | "right" | "justify"
    verticalAlign: "top" | "center" | "bottom"
    /** Múltiplo del tamaño de fuente (line-height CSS sin unidad) */
    lineHeight: number
    fontFamily?: string
    fontSize: number
    fontWeight: number
    fontStyle?: "normal" | "italic"
    color: SceneColor
    stroke?: { color: SceneColor; width: number }
    shadow?: { color: SceneColor; offsetX: number; offsetY: number }
    /** Espaciado entre letras en px (por defecto 0) */
    letterSpacing?: number
    /** Texto completo con saltos de línea (\n) */
    text: string
    /** Tramos con estilo propio; los saltos de línea van dentro de los textos */
    spans: SceneTextSpan[]
    /** El texto cambia solo con el tiempo (reloj, timer): el engine lo actualiza sin pedir transición */
    live?: boolean
    /** Fondo, borde, esquinas, opacidad y padding del cuadro (F23.16) */
    box?: SceneBoxStyle
}

export interface SceneTextSpan {
    text: string
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    color?: SceneColor
    underline?: boolean
    strike?: boolean
}

/**
 * Payload del comando de debug `RENDER_SNAPSHOT` (Rust: `commands/output.rs`).
 * Renderiza una escena a un PNG offscreen, sin ventana ni monitor.
 * El comando existe sólo en builds de desarrollo y devuelve la ruta completa
 * del PNG escrito. Por ahora sólo lo invoca un agente/CI desde la consola del
 * webview.
 */
export interface SnapshotRequest {
    scene: SceneGraph
    /** Ancho en píxeles del PNG (por defecto 1920) */
    width?: number
    /** Alto en píxeles del PNG (por defecto 1080) */
    height?: number
    /** Nombre simple del archivo PNG (sin ruta); queda en `<cache>/snapshots/` */
    fileName: string
}
