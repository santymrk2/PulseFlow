// Recorrido mínimo (px) para que arrastrar desde el texto de un cuadro lo mueva en vez de seleccionar texto.
const DRAG_START_DISTANCE = 4

export function shouldStartDrag(startX: number, startY: number, x: number, y: number): boolean {
    return Math.hypot(x - startX, y - startY) >= DRAG_START_DISTANCE
}
