// Scene Graph que la UI de control envía al engine de render nativo (Rust) con `RENDER_SCENE`.
// Espejo de `src-tauri/src/render/scene.rs` (serde camelCase). Si cambias uno, cambia el otro.

/** Color RGBA normalizado: cada canal entre 0 y 1. */
export type SceneColor = [number, number, number, number]

export interface SceneGraph {
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
 * Por ahora sólo lo invoca un agente/CI desde la consola del webview.
 */
export interface SnapshotRequest {
    scene: SceneGraph
    /** Ancho en píxeles del PNG (por defecto 1920) */
    width?: number
    /** Alto en píxeles del PNG (por defecto 1080) */
    height?: number
    /** Ruta absoluta donde guardar el PNG */
    path: string
}
