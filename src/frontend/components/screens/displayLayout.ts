/**
 * Cálculo puro de la disposición de monitores (F10.0e).
 *
 * Toma los monitores tal como los devuelve `GET_DISPLAYS` (bounds en píxeles
 * lógicos, con `primary`) y los normaliza para dibujarlos en un contenedor de
 * tamaño conocido: mueve el conjunto al origen (respetando coordenadas negativas
 * de monitores a la izquierda/arriba) y lo escala para que entre completo con
 * `min(anchoDisponible/anchoTotal, altoDisponible/altoTotal)`.
 *
 * Es puro y testeable: no toca el DOM.
 */

export interface LayoutDisplay {
    /** Id estable del monitor (`GET_DISPLAYS` de F10.0c). */
    id: string
    /** Nombre legible. */
    label?: string
    /** Bounds del monitor en píxeles lógicos del sistema. */
    bounds: { x: number; y: number; width: number; height: number }
    /** Es el monitor principal del sistema. */
    primary?: boolean
}

export interface LaidOutDisplay<T extends LayoutDisplay = LayoutDisplay> {
    display: T
    /** Posición y tamaño ya escalados, relativos al contenedor. */
    x: number
    y: number
    width: number
    height: number
    /** Etiqueta corta para mostrar dentro del monitor (nombre o "1", "2"…). */
    number: number
}

export interface DisplayLayout<T extends LayoutDisplay = LayoutDisplay> {
    /** Factor aplicado a las coordenadas originales. */
    scale: number
    /** Tamaño ocupado por el conjunto ya escalado (incluye el margen). */
    contentWidth: number
    contentHeight: number
    displays: LaidOutDisplay<T>[]
}

export interface LayoutOptions {
    /** Ancho del contenedor en px. */
    width: number
    /** Alto del contenedor en px. */
    height: number
    /** Margen interior alrededor del conjunto (px). */
    padding?: number
}

const DEFAULT_PADDING = 12

/**
 * Normaliza y escala los monitores para que entren en el contenedor.
 * Sin monitores devuelve un layout vacío con escala 1.
 */
export function computeDisplayLayout<T extends LayoutDisplay>(displays: T[], options: LayoutOptions): DisplayLayout<T> {
    const padding = options.padding ?? DEFAULT_PADDING
    const availableWidth = Math.max(0, options.width - padding * 2)
    const availableHeight = Math.max(0, options.height - padding * 2)

    if (!displays.length) {
        return { scale: 1, contentWidth: 0, contentHeight: 0, displays: [] }
    }

    // Bounding box del conjunto original (puede tener x/y negativos).
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const display of displays) {
        const { x, y, width, height } = display.bounds
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x + width > maxX) maxX = x + width
        if (y + height > maxY) maxY = y + height
    }

    const totalWidth = Math.max(1, maxX - minX)
    const totalHeight = Math.max(1, maxY - minY)

    // Escala para que entre completo; nunca amplía por encima de 1 (evita monitores
    // gigantes en un contenedor chico al revés).
    const scale = Math.min(1, availableWidth / totalWidth, availableHeight / totalHeight)

    const laidOut: LaidOutDisplay<T>[] = displays.map((display, index) => {
        const { x, y, width, height } = display.bounds
        return {
            display,
            number: index + 1,
            x: (x - minX) * scale,
            y: (y - minY) * scale,
            width: width * scale,
            height: height * scale
        }
    })

    return {
        scale,
        contentWidth: totalWidth * scale,
        contentHeight: totalHeight * scale,
        displays: laidOut
    }
}
