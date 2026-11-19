import { describe, expect, test } from "vitest"
import { shouldStartDrag } from "./dragThreshold"

describe("shouldStartDrag", () => {
    test("un clic sin movimiento no arrastra (queda el cursor de texto)", () => {
        expect(shouldStartDrag(100, 100, 100, 100)).toBe(false)
        expect(shouldStartDrag(100, 100, 102, 101)).toBe(false)
    })
    test("a partir de 4 px de recorrido empieza a mover el cuadro", () => {
        expect(shouldStartDrag(100, 100, 104, 100)).toBe(true)
        expect(shouldStartDrag(100, 100, 103, 103)).toBe(true)
    })
    test("cuenta la distancia en cualquier dirección", () => {
        expect(shouldStartDrag(100, 100, 96, 100)).toBe(true)
        expect(shouldStartDrag(100, 100, 100, 94)).toBe(true)
    })
})
