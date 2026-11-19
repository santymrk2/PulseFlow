import { describe, expect, test } from "vitest"
import { computeDisplayLayout, type LayoutDisplay } from "./displayLayout"

const fullHD = { width: 1920, height: 1080 }

const laptop: LayoutDisplay = { id: "Built-in#0", label: "Built-in", bounds: { x: 0, y: 0, ...fullHD }, primary: true }
const externalRight: LayoutDisplay = { id: "SB220Q#1", label: "SB220Q", bounds: { x: 1920, y: 0, ...fullHD } }

describe("computeDisplayLayout", () => {
    test("lado a lado: normaliza al origen y mantiene la proporción", () => {
        // 2 monitores de 1920×1080 lado a lado → conjunto 3840×1080.
        const layout = computeDisplayLayout([laptop, externalRight], { width: 1000, height: 400, padding: 0 })

        // Escala = min(1000/3840, 400/1080) = 0.2604…
        expect(layout.scale).toBeCloseTo(1000 / 3840, 6)
        expect(layout.contentWidth).toBeCloseTo(1000, 4)
        expect(layout.contentHeight).toBeCloseTo(1080 * (1000 / 3840), 4)

        // El primero arranca en el origen; el segundo a la derecha del primero.
        expect(layout.displays[0].x).toBeCloseTo(0, 6)
        expect(layout.displays[1].x).toBeCloseTo(layout.displays[0].width, 6)
        expect(layout.displays[0].number).toBe(1)
        expect(layout.displays[1].number).toBe(2)
        // Ambos a la misma altura.
        expect(layout.displays[0].y).toBeCloseTo(layout.displays[1].y, 6)
    })

    test("apilados: uno encima del otro, sin solaparse", () => {
        const top: LayoutDisplay = { id: "Top#0", bounds: { x: 0, y: 0, ...fullHD }, primary: true }
        const bottom: LayoutDisplay = { id: "Bottom#1", bounds: { x: 0, y: 1080, ...fullHD } }

        const layout = computeDisplayLayout([top, bottom], { width: 800, height: 800, padding: 0 })

        // Escala = min(800/1920, 800/2160).
        expect(layout.scale).toBeCloseTo(Math.min(800 / 1920, 800 / 2160), 6)
        expect(layout.displays[0].y).toBeCloseTo(0, 6)
        expect(layout.displays[1].y).toBeCloseTo(layout.displays[0].height, 6)
        expect(layout.displays[0].x).toBeCloseTo(layout.displays[1].x, 6)
    })

    test("coordenadas negativas: el monitor a la izquierda/arriba se normaliza al origen", () => {
        // Monitor a la izquierda del principal (x negativo) y otro arriba (y negativo).
        const left: LayoutDisplay = { id: "Left#0", bounds: { x: -1920, y: 0, ...fullHD } }
        const above: LayoutDisplay = { id: "Above#1", bounds: { x: 0, y: -1080, ...fullHD }, primary: true }

        const layout = computeDisplayLayout([left, above], { width: 1000, height: 1000, padding: 0 })

        // Ningún monitor puede quedar en coordenadas negativas tras normalizar.
        for (const d of layout.displays) {
            expect(d.x).toBeGreaterThanOrEqual(-1e-6)
            expect(d.y).toBeGreaterThanOrEqual(-1e-6)
        }
        // left está a la izquierda de above; above está por encima de left.
        const [layoutLeft, layoutAbove] = layout.displays
        expect(layoutLeft.x).toBeLessThan(layoutAbove.x)
        expect(layoutAbove.y).toBeLessThan(layoutLeft.y)
        expect(layoutLeft.x).toBeCloseTo(0, 6)
        expect(layoutAbove.y).toBeCloseTo(0, 6)
    })

    test("respeta el padding del contenedor", () => {
        const layout = computeDisplayLayout([laptop], { width: 500, height: 500, padding: 20 })
        // El monitor de 1920×1080 en 460×460 → escala 460/1920 (ancho manda).
        expect(layout.scale).toBeCloseTo(460 / 1920, 6)
        // Con un solo monitor que entra, nunca amplía por encima de 1.
        const tiny = computeDisplayLayout([{ id: "x", bounds: { x: 0, y: 0, width: 100, height: 100 } }], { width: 1000, height: 1000 })
        expect(tiny.scale).toBe(1)
    })

    test("sin monitores devuelve un layout vacío", () => {
        const layout = computeDisplayLayout([], { width: 800, height: 600 })
        expect(layout.displays).toEqual([])
        expect(layout.contentWidth).toBe(0)
        expect(layout.contentHeight).toBe(0)
    })
})
