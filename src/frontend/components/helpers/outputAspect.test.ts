import { describe, expect, test } from "vitest"
import { referenceOutputId, resolveOutputAspect } from "./outputAspect"

const DEFAULT_BOUNDS = { width: 1920, height: 1080 }
const macbook = { width: 1512, height: 982 }

describe("resolveOutputAspect", () => {
    test('sin relación propia ni de estilo usa el tamaño real de la salida ("Original")', () => {
        expect(resolveOutputAspect({ output: { bounds: macbook }, styleRatio: null, defaultBounds: DEFAULT_BOUNDS })).toEqual(macbook)
    })

    test("un estilo del puente de Looks (sin relación) tampoco pisa el tamaño de la salida", () => {
        expect(resolveOutputAspect({ output: { bounds: macbook }, styleRatio: undefined, defaultBounds: DEFAULT_BOUNDS })).toEqual(macbook)
    })

    test("la relación elegida en la Pantalla manda sobre el estilo y sobre el tamaño", () => {
        const result = resolveOutputAspect({ output: { bounds: macbook, aspectRatio: { width: 4, height: 3 } }, styleRatio: { width: 16, height: 9 }, defaultBounds: DEFAULT_BOUNDS })
        expect(result).toEqual({ width: 4, height: 3 })
    })

    test("una relación vieja del estilo se respeta si la Pantalla no tiene propia", () => {
        expect(resolveOutputAspect({ output: { bounds: macbook }, styleRatio: { width: 21, height: 9 }, defaultBounds: DEFAULT_BOUNDS })).toEqual({ width: 21, height: 9 })
    })

    test("outputResolutionAsRatio del estilo: tamaño de la salida menos el recorte", () => {
        const result = resolveOutputAspect({
            output: { bounds: { width: 1920, height: 1080 }, cropping: { top: 0, right: 100, bottom: 80, left: 20 } },
            styleRatio: { width: 16, height: 9, outputResolutionAsRatio: true },
            defaultBounds: DEFAULT_BOUNDS
        })
        expect(result).toEqual({ width: 1800, height: 1000 })
    })

    test("una relación inválida (0 o vacía) se ignora", () => {
        expect(resolveOutputAspect({ output: { bounds: macbook, aspectRatio: { width: 0, height: 9 } }, styleRatio: null, defaultBounds: DEFAULT_BOUNDS })).toEqual(macbook)
    })

    test("una salida stage usa sus propios límites", () => {
        expect(resolveOutputAspect({ output: { stageOutput: "layout", bounds: { width: 1280, height: 1024 } }, styleRatio: { width: 16, height: 9 }, defaultBounds: DEFAULT_BOUNDS })).toEqual({ width: 1280, height: 1024 })
    })

    test("sin salida ni estilo cae a 16:9 por defecto", () => {
        expect(resolveOutputAspect({ output: null, styleRatio: null, defaultBounds: DEFAULT_BOUNDS })).toEqual(DEFAULT_BOUNDS)
    })

    test("una salida sin límites usa los por defecto", () => {
        expect(resolveOutputAspect({ output: {}, styleRatio: null, defaultBounds: DEFAULT_BOUNDS })).toEqual(DEFAULT_BOUNDS)
    })
})

describe("referenceOutputId", () => {
    const outputs = { main: {}, second: {}, stage: { stageOutput: "layout" }, kindStage: { kind: "stage" } }

    test("la salida elegida en la vista previa, si existe y es una audiencia", () => {
        expect(referenceOutputId(outputs, "second")).toBe("second")
    })

    test("sin elegir, o si la elegida ya no existe o es stage, no fuerza ninguna (se usa la primera activa)", () => {
        expect(referenceOutputId(outputs, "")).toBe("")
        expect(referenceOutputId(outputs, "borrada")).toBe("")
        expect(referenceOutputId(outputs, "stage")).toBe("")
        expect(referenceOutputId(outputs, "kindStage")).toBe("")
    })
})
