// Scene Graph que la UI de control envía al engine de render nativo (Rust) con `RENDER_SCENE`.
// Espejo exacto de `src-tauri/src/render/scene.rs` (serde camelCase). Si cambias un campo en un
// lado, cambia el otro: el test de contrato (`src-tauri/tests/scene_contract.rs`, F4.2) deserializa
// fixtures generadas desde aquí y falla si los nombres no coinciden.
//
// # Qué está implementado en el engine (F4.1)
//
// El contrato describe más de lo que el engine dibuja hoy. Implementado de verdad:
//
// - `outputId`: rutea la escena a la pantalla con ese id.
// - `stage`: elige el layout de Stage Display (`plainText`/`nextText`).
// - `width`: resolución lógica; escala `x`, `width` y `fontSize` de los items.
// - `background`: imagen o video (con `opacity` y `fit`).
// - `items` de tipo `text`: caja, alineación horizontal y vertical, línea, fuente por
//   tramo (`spans`), color, contorno (`stroke`) y sombra (`shadow`).
// - `plainText`/`nextText`: texto del Stage Display.
//
// Sólo tipo (llega al engine pero todavía no se dibuja):
//
// - `transition`: el engine guarda la config pero el bucle aún no la aplica (F4.4).
// - `height`.
// - Items que no son `text` (`media`, `image`, overlays…): Rust los ignora.
// - Los overlays de la UI salen del modelo previo de `ScreenScene`, no de este contrato.

/** Versión del contrato. El engine rechaza cualquier otra (F4.1). */
export const SCENE_GRAPH_VERSION = 1

/** Color RGBA normalizado: cada canal entre 0 y 1. */
export type SceneColor = [number, number, number, number]

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
    transition: SceneTransition | null
    /** Todo el texto de la slide en una cadena (stage display) */
    plainText: string
    /** Texto de la slide siguiente, si la hay (stage display) */
    nextText?: string
}

export interface SceneBackground {
    path: string
    type: "image" | "video"
    fit: "cover" | "contain" | "fill"
    opacity: number
    loop?: boolean
    muted?: boolean
}

export interface SceneTransition {
    /** Tipo de transición de FreeShow (none, fade, crossfade, slide...). Rust lo traduce al engine */
    type: string
    durationMs: number
    easing?: string
}

// por ahora el engine sólo soporta texto; el resto de tipos se ignora en Rust
export type SceneItem = SceneTextItem

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
    /** Texto completo con saltos de línea (\n) */
    text: string
    /** Tramos con estilo propio; los saltos de línea van dentro de los textos */
    spans: SceneTextSpan[]
}

export interface SceneTextSpan {
    text: string
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    color?: SceneColor
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
