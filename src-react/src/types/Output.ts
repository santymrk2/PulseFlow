// ----- FreeShow -----
// Estado de proyección compartido entre la ventana de Control, la de Audiencia
// (Output) y la de Stage.
//
// Es la "carga útil" que las ventanas de salida necesitan para dibujar lo que ve
// el público (o los músicos). Se mantiene deliberadamente simple para poder
// crecer hacia el modelo completo de `out`/layouts en bloques posteriores.

export type ProjectionAlign = "center" | "left"

export type ProjectionMediaKind = "image" | "video"

/** Medio (imagen o vídeo) enviado a la pantalla de Audiencia. */
export interface ProjectionMedia {
    /** Id único por envío: fuerza el remontaje y el crossfade aunque se repita el archivo. */
    id: string
    kind: ProjectionMediaKind
    /** URL servible por el webview (generada con `convertFileSrc`). */
    src: string
    /** Ruta original en disco (referencia). */
    path: string
    name: string
    /** Reproducción en bucle (vídeo). */
    loop: boolean
    /** Silenciado (vídeo usado como fondo). */
    muted: boolean
}

/** Estado de reproducción de un medio enviado a la pantalla de Audiencia. */
export interface ProjectionMediaPlayback {
    playing: boolean
    /** Posición actual en segundos. */
    currentTime: number
    /** Duración total en segundos (0 si aún se desconoce). */
    duration: number
    /** Volumen 0..1. */
    volume: number
    muted: boolean
}

export const DEFAULT_MEDIA_PLAYBACK: ProjectionMediaPlayback = {
    playing: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
}

export type ProjectionTimerMode = "countdown" | "elapsed" | "clock" | "event"

/** Mensaje/alerta mostrado a la audiencia (texto grande sobre la salida). */
export interface ProjectionAlert {
    text: string
    background: string
    color: string
}

/** Temporizador/cuenta atrás activo, sincronizado por marcas de tiempo. */
export interface ProjectionTimer {
    id: string
    label: string
    mode: ProjectionTimerMode
    /** Duración total en segundos (cuenta atrás). */
    total: number
    /** Epoch ms en que termina (countdown) o en que empezó (elapsed). */
    anchor: number
    /** Congelado: se muestra `remaining`. */
    paused: boolean
    /** Segundos restantes/transcurridos cuando está en pausa. */
    frozen: number
    /** Visible para la audiencia (si no, sólo interno). */
    visible: boolean
}

/** Estilo parcial aplicable a una línea de texto proyectada. */export interface ProjectionTextStyle {
    fontSize?: number
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    color?: string
    textShadow?: string
    textAlign?: ProjectionAlign
}

/** Línea de texto enriquecido (con estilo propio). */
export interface ProjectionTextLine {
    text: string
    style?: ProjectionTextStyle
}

/**
 * Caja de contenido posicionada de forma absoluta (px sobre el lienzo
 * 1920×1080). Port reducido del sistema de "items" del editor: se usa cuando la
 * diapositiva define posiciones propias (plantillas, cajas movidas…).
 */
export interface ProjectionBox {
    /** Estilo CSS del item (`top:..;left:..;width:..;height:..;`). */
    style?: string
    /** Alineación del texto dentro de la caja. */
    align?: ProjectionAlign
    /** Ajuste automático del texto al alto de la caja (por defecto `true`). */
    auto?: boolean
    /** Contenido de la caja (una entrada por línea). */
    lines: ProjectionTextLine[]
}

/** Bloque de texto enriquecido (diapositiva o versículo). */
export interface ProjectionRichText {
    lines: ProjectionTextLine[]
    align?: ProjectionAlign
    /**
     * Si existe, la salida dibuja cada caja en su posición absoluta en lugar de
     * centrar `lines`. Requiere que la diapositiva tenga posiciones definidas.
     */
    boxes?: ProjectionBox[]
}

export type ProjectionOverlayKind = "text" | "lower-third" | "image"

export type ProjectionOverlayPosition = "top" | "bottom-left" | "bottom" | "center"

/** Gráfico superpuesto (alerta, tercio inferior o logo) sobre la salida. */
export interface ProjectionOverlay {
    id: string
    kind: ProjectionOverlayKind
    text?: string
    subtext?: string
    /** URL de imagen para `kind: "image"` (logos). */
    src?: string
    position: ProjectionOverlayPosition
    color?: string
    background?: string
}

export interface ProjectionState {
    /** Si `false`, la audiencia queda en negro (pantalla limpia). */
    visible: boolean
    /** Texto principal proyectado (modo plano). */
    text: string
    /** Línea secundaria opcional (p. ej. referencia). */
    subtext: string
    /** Color de fondo CSS. */
    background: string
    /** Color del texto CSS. */
    color: string
    /** Alineación horizontal del contenido. */
    align: ProjectionAlign
    /** Texto enriquecido; si existe tiene prioridad sobre `text`/`subtext`. */
    richText: ProjectionRichText | null
    /** Medio activo; si está presente se dibuja a pantalla completa. */
    media: ProjectionMedia | null
    /** Gráficos superpuestos sobre la salida (logos, alertas, tercios). */
    overlays: ProjectionOverlay[]
    /** Texto de la siguiente diapositiva (para el Stage Display). */
    nextText: string
    /** Notas de la diapositiva actual (para el Stage Display). */
    notes: string
    /** Estado de reproducción del medio activo (play/pausa/seek/volumen). */
    mediaPlayback: ProjectionMediaPlayback
    /** Temporizador/cuenta atrás activo (o `null`). */
    timer: ProjectionTimer | null
    /** Mensaje de alerta mostrado a la audiencia (o `null`). */
    alert: ProjectionAlert | null
    /** Marca de tiempo del último cambio (para depuración/sincronización). */
    updatedAt: number
}

export const DEFAULT_PROJECTION: ProjectionState = {
    visible: false,
    text: "",
    subtext: "",
    background: "#000000",
    color: "#ffffff",
    align: "center",
    richText: null,
    media: null,
    overlays: [],
    nextText: "",
    notes: "",
    mediaPlayback: DEFAULT_MEDIA_PLAYBACK,
    timer: null,
    alert: null,
    updatedAt: 0,
}

/** Mensajes de la audiencia hacia la ventana de control. */
export interface ProjectionMessage {
    type: "REQUEST"
}
