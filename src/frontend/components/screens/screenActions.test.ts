import { describe, expect, test } from "vitest"
import { canRemoveScreen, nextScreenAfterRemove } from "./screenActions"

const audience = (name: string) => ({ name })
const stage = (name: string) => ({ name, stageOutput: "layout-1" })

describe("canRemoveScreen", () => {
    test("una audiencia se puede quitar si queda otra audiencia", () => {
        const outputs = { a: audience("A"), b: audience("B") }
        expect(canRemoveScreen(outputs, "a")).toBe(true)
    })

    test("la última audiencia no se quita (el store crearía una 'default' sola)", () => {
        const outputs = { a: audience("A"), s: stage("S") }
        expect(canRemoveScreen(outputs, "a")).toBe(false)
    })

    test("un stage siempre se puede quitar", () => {
        const outputs = { a: audience("A"), s: stage("S") }
        expect(canRemoveScreen(outputs, "s")).toBe(true)
    })

    test("un id inexistente no se puede quitar", () => {
        expect(canRemoveScreen({ a: audience("A") }, "nope")).toBe(false)
    })

    test("kind: 'stage' también cuenta como stage", () => {
        const outputs = { a: audience("A"), s: { name: "S", kind: "stage" } }
        expect(canRemoveScreen(outputs, "a")).toBe(false)
    })
})

describe("nextScreenAfterRemove", () => {
    test("prefiere otra pantalla del mismo grupo", () => {
        const outputs = { a: audience("A"), s: stage("S"), b: audience("B") }
        expect(nextScreenAfterRemove(outputs, "a")).toBe("b")
    })

    test("si el grupo queda vacío, cae al otro grupo", () => {
        const outputs = { a: audience("A"), s: stage("S") }
        expect(nextScreenAfterRemove(outputs, "s")).toBe("a")
    })

    test("sin más pantallas devuelve null", () => {
        expect(nextScreenAfterRemove({ a: audience("A") }, "a")).toBeNull()
    })
})
