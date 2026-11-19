import { describe, expect, test } from "vitest"
import { contextMenuMode } from "./nativeMenu"

describe("contextMenuMode", () => {
    test("fuera de un campo de texto siempre se usa el menú propio y se suprime el nativo", () => {
        expect(contextMenuMode(false, "darwin")).toBe("app")
        expect(contextMenuMode(false, "win32")).toBe("app")
    })
    test("en un campo de texto de macOS se deja sólo el menú nativo (cortar, copiar, pegar, ortografía)", () => {
        expect(contextMenuMode(true, "darwin")).toBe("native")
    })
    test("en un campo de texto de Windows se usa el menú propio de pegar", () => {
        expect(contextMenuMode(true, "win32")).toBe("app")
    })
})
