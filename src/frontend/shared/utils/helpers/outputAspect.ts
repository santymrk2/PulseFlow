// Relación de aspecto efectiva de una salida: con qué proporción se dibujan sus diapositivas
// (en la vista del show, la vista previa y la escena que recibe el engine). Sin stores, testeable.

type Size = { width: number; height: number }
type Cropping = { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string }
type StyleRatio = Size & { outputResolutionAsRatio?: boolean; cropping?: Cropping }

export type AspectOutput = {
    bounds?: Size
    cropping?: Cropping
    /** Relación elegida en la Pantalla (F10); sin valor es "Original": el tamaño real de la salida. */
    aspectRatio?: Size
    stageOutput?: unknown
    kind?: string
}

const valid = (size: Size | null | undefined): size is Size => !!size && size.width > 0 && size.height > 0

/**
 * Orden de prioridad:
 * 1. Salida stage: sus propios límites.
 * 2. La relación elegida en la **Pantalla** (`output.aspectRatio`).
 * 3. El estilo con `outputResolutionAsRatio`: límites de la salida menos el recorte.
 * 4. Una relación del estilo (datos viejos, antes de que pasara a la Pantalla).
 * 5. "Original": el tamaño real de la salida (sus límites), o los por defecto si no los tiene.
 *
 * Antes sólo se miraba el estilo, y el puente de Looks genera estilos sin relación: la vista de
 * diapositivas caía siempre en 16:9 sin importar la pantalla.
 */
export function resolveOutputAspect(input: { output?: AspectOutput | null; styleRatio?: StyleRatio | null; defaultBounds: Size }): Size {
    const { output, styleRatio, defaultBounds } = input
    const bounds = valid(output?.bounds) ? output.bounds : defaultBounds

    if (output && (output.stageOutput || output.kind === "stage")) return bounds
    if (valid(output?.aspectRatio)) return { width: output.aspectRatio.width, height: output.aspectRatio.height }

    if (styleRatio?.outputResolutionAsRatio) {
        const cropping = output?.cropping || styleRatio.cropping
        const cropWidth = (Number(cropping?.left) || 0) + (Number(cropping?.right) || 0)
        const cropHeight = (Number(cropping?.top) || 0) + (Number(cropping?.bottom) || 0)
        return { width: Math.max(1, bounds.width - cropWidth), height: Math.max(1, bounds.height - cropHeight) }
    }

    if (valid(styleRatio)) return { width: styleRatio.width, height: styleRatio.height }
    return { ...bounds }
}

/**
 * Salida que las vistas de diapositivas toman como referencia de tamaño: la elegida en el selector
 * de la vista previa, si existe y es una audiencia. Vacío = no forzar ninguna (se usa la primera activa).
 */
export function referenceOutputId(outputs: { [id: string]: AspectOutput }, previewId: string): string {
    const picked = previewId ? outputs[previewId] : undefined
    return picked && !picked.stageOutput && picked.kind !== "stage" ? previewId : ""
}

/** Alineación del contenido que se envía al engine (F21.2): sólo "start" o "end"; el centro es el valor por defecto y no se manda. */
export function contentAlign(...candidates: (string | null | undefined)[]): "start" | "end" | undefined {
    for (const value of candidates) {
        if (value === "start" || value === "end") return value
    }
    return undefined
}
