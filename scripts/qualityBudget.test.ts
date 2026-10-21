import { describe, expect, test } from "vitest"
import { compareToBudget, countAny, countHex, countRgb, measureSources, parseSvelteCheckErrors } from "./qualityBudget"

describe("conteos", () => {
    test("any: cuenta `: any` y `as any` sin confundirlos con otras palabras", () => {
        const text = "let a: any = b as any\nconst many: company = 1\nfunction f(x: any[]) {}\nlet c: anything"
        expect(countAny(text)).toBe(3)
    })

    test("hex: colores de 3 a 8 dígitos, no ids con guion bajo ni palabras", () => {
        expect(countHex("color: #fff; background: #1447E6; x: #ff00aa80")).toBe(3)
        expect(countHex('class="context #add_button" id="#header"')).toBe(0)
    })

    test("rgb: rgb( y rgba(", () => {
        expect(countRgb("a: rgb(0 0 0 / 0.5); b: rgba(1,2,3,.4); c: argb(1)")).toBe(2)
    })
})

describe("measureSources", () => {
    test("any en .ts y .svelte; colores sólo en .svelte y fuera de lo excluido", () => {
        const files = [
            { path: "src/a.ts", text: "let a: any = 1; const c = '#ffffff'" },
            { path: "src/b.svelte", text: "<div style='color: #fff; background: rgb(0 0 0)'>{x as any}</div>" },
            { path: "src/ejemplos/plantilla.svelte", text: "#aabbcc rgb(1 1 1)" }
        ]
        expect(measureSources(files, ["src/ejemplos/"])).toEqual({ anyCount: 2, hexColors: 1, rgbColors: 1 })
    })
})

describe("parseSvelteCheckErrors", () => {
    test("lee la línea COMPLETED de svelte-check", () => {
        expect(parseSvelteCheckErrors("1792 COMPLETED 535 FILES 41 ERRORS 312 WARNINGS 140 FILES_WITH_PROBLEMS")).toBe(41)
    })
    test("sin línea COMPLETED devuelve null (no se puede medir)", () => {
        expect(parseSvelteCheckErrors("algo roto")).toBeNull()
    })
})

describe("compareToBudget", () => {
    const budget = { svelteCheckErrors: 41, anyCount: 100, hexColors: 50, rgbColors: 20 }

    test("igual o menor pasa; los que bajaron se informan para actualizar el json", () => {
        const result = compareToBudget(budget, { svelteCheckErrors: 41, anyCount: 90, hexColors: 50, rgbColors: 20 })
        expect(result.failures).toEqual([])
        expect(result.improvements).toEqual([{ key: "anyCount", from: 100, to: 90 }])
    })

    test("si algún número sube, falla nombrándolo", () => {
        const result = compareToBudget(budget, { svelteCheckErrors: 42, anyCount: 101, hexColors: 50, rgbColors: 20 })
        expect(result.failures.map((f) => f.key)).toEqual(["svelteCheckErrors", "anyCount"])
        expect(result.failures[1]).toEqual({ key: "anyCount", from: 100, to: 101 })
    })

    test("una medida que no se pudo tomar (null) falla en lugar de pasar en silencio", () => {
        const result = compareToBudget(budget, { svelteCheckErrors: null, anyCount: 100, hexColors: 50, rgbColors: 20 })
        expect(result.failures.map((f) => f.key)).toEqual(["svelteCheckErrors"])
    })
})
