import { describe, expect, test } from "vitest"
import { toDisplayUrl } from "./assetUrl"

const fake = (p: string) => `asset://localhost/${encodeURIComponent(p)}`

describe("toDisplayUrl", () => {
    test("un archivo local sale por el protocolo asset (file:// lo bloquea el webview)", () => {
        expect(toDisplayUrl("/Users/a/Pictures/foto 1.png", fake)).toBe("asset://localhost/%2FUsers%2Fa%2FPictures%2Ffoto%201.png")
    })
    test("acepta rutas ya con file:// o con %XX y las normaliza", () => {
        expect(toDisplayUrl("file:///Users/a/foto%201.png", fake)).toBe("asset://localhost/%2FUsers%2Fa%2Ffoto%201.png")
    })
    test("una ruta de Windows se pasa tal cual, con barras originales", () => {
        expect(toDisplayUrl("C:\\Users\\a\\foto.png", fake)).toBe("asset://localhost/C%3A%5CUsers%5Ca%5Cfoto.png")
    })
    test("sin Tauri (tests, navegador) devuelve null para que el llamador use su fallback", () => {
        expect(toDisplayUrl("/Users/a/foto.png", null)).toBeNull()
    })
})
