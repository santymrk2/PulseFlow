import { describe, expect, test } from "vitest"
import { compareToBudget, countAny, countHex, countRgb, measureSources } from "./qualityBudget"

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
    test("any en .ts; colores sólo en .tsx y fuera de lo excluido", () => {
        const files = [
            { path: "src/a.ts", text: "let a: any = 1; const c = '#ffffff'" },
            { path: "src/ejemplos/plantilla.tsx", text: "<div className=\"bg-[#aabbcc]\">{x as any}</div>" }
        ]
        expect(measureSources(files, ["src/ejemplos/"])).toEqual({ anyCount: 2, hexColors: 0, rgbColors: 0 })
    })

    test("un .tsx cuenta colores y any; un .module.css de react cuenta colores", () => {
        const files = [
            { path: "src/frontend/react/A.tsx", text: '<div className="bg-[#ff0000]">{x as any}</div>' },
            { path: "src/frontend/react/A.module.css", text: "a { color: rgb(0 0 0) }" },
            { path: "src/otro/B.module.css", text: "a { color: #fff }" }
        ]
        expect(measureSources(files)).toEqual({ anyCount: 1, hexColors: 1, rgbColors: 1 })
    })

    test("los tests (*.test.ts) no cuentan: el presupuesto de any mide código de producción", () => {
        const files = [
            { path: "src/a.ts", text: "let a: any" },
            { path: "src/a.test.ts", text: "const x: any = 1; const y = z as any" }
        ]
        expect(measureSources(files)).toEqual({ anyCount: 1, hexColors: 0, rgbColors: 0 })
    })
})

describe("compareToBudget", () => {
    const budget = { anyCount: 100, hexColors: 50, rgbColors: 20 }

    test("igual o menor pasa; los que bajaron se informan para actualizar el json", () => {
        const result = compareToBudget(budget, { anyCount: 90, hexColors: 50, rgbColors: 20 })
        expect(result.failures).toEqual([])
        expect(result.improvements).toEqual([{ key: "anyCount", from: 100, to: 90 }])
    })

    test("si algún número sube, falla nombrándolo", () => {
        const result = compareToBudget(budget, { anyCount: 101, hexColors: 51, rgbColors: 20 })
        expect(result.failures.map((f) => f.key)).toEqual(["anyCount", "hexColors"])
        expect(result.failures[1]).toEqual({ key: "hexColors", from: 50, to: 51 })
    })

    test("una medida que no se pudo tomar (null) falla en lugar de pasar en silencio", () => {
        const result = compareToBudget(budget, { anyCount: null, hexColors: 50, rgbColors: 20 })
        expect(result.failures.map((f) => f.key)).toEqual(["anyCount"])
    })
})
