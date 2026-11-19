// Resiliencia de `setLanguage` ante fallos de red (F25.9): los fetch se mockean
// para cubrir el idioma pedido, el fallback a inglés y el arranque sin red.

import { get, writable } from "../core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Dictionary } from "../../../types/Settings"

vi.mock("../core/stores", () => ({
    dictionary: writable<Dictionary>({}),
    language: writable("en"),
    localeDirection: writable<"ltr" | "rtl">("ltr")
}))
vi.mock("./common", () => ({ isMainWindow: vi.fn(() => true) }))
vi.mock("./helpers/array", () => ({ sortByName: (options: unknown) => options }))

const { setLanguage } = await import("./language")
const stores = await import("../core/stores")

const fetchMock = vi.fn<(input: string) => Promise<Response>>()
const jsonResponse = (data: unknown): Response => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })

let unhandled: unknown[] = []
const trackUnhandled = (reason: unknown) => {
    unhandled.push(reason)
}

beforeEach(() => {
    unhandled = []
    process.on("unhandledRejection", trackUnhandled)
    vi.stubGlobal("fetch", fetchMock)
    stores.dictionary.set({})
    stores.language.set("en")
    stores.localeDirection.set("ltr")
})

afterEach(() => {
    process.off("unhandledRejection", trackUnhandled)
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe("setLanguage con fetch fallido (F25.9)", () => {
    it("falla el idioma pedido: queda activo en, se carga en.json y no hay rejection", async () => {
        const english = { main: { yes: "Yes", no: "No" } }
        fetchMock.mockImplementation((url: string) => (url === "./lang/es.json" ? Promise.reject(new Error("sin red")) : Promise.resolve(jsonResponse(english))))

        setLanguage("es")

        await vi.waitFor(() => expect(get(stores.dictionary)).toEqual(english))
        expect(fetchMock).toHaveBeenCalledWith("./lang/es.json")
        expect(fetchMock).toHaveBeenCalledWith("./lang/en.json")
        expect(get(stores.language)).toBe("en")
        expect(get(stores.localeDirection)).toBe("ltr")
        expect(unhandled).toEqual([])
    })

    it("falla el en.json dentro de returnedFile: se conserva el diccionario previo", async () => {
        const previous = { main: { yes: "Previo" } }
        stores.dictionary.set(previous)
        fetchMock.mockImplementation((url: string) => (url === "./lang/es.json" ? Promise.resolve(jsonResponse({ main: { yes: "Sí" } })) : Promise.reject(new Error("sin red"))))

        setLanguage("es")

        await vi.waitFor(() => expect(get(stores.language)).toBe("en"))
        expect(get(stores.dictionary)).toEqual(previous)
        expect(get(stores.localeDirection)).toBe("ltr")
        expect(unhandled).toEqual([])
    })

    it("arranque sin red: fallan el principal y el fallback, sin rejection ni datos cambiados", async () => {
        fetchMock.mockRejectedValue(new Error("sin red"))

        setLanguage("en", true)

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(get(stores.language)).toBe("en")
        expect(get(stores.dictionary)).toEqual({})
        expect(get(stores.localeDirection)).toBe("ltr")
        expect(unhandled).toEqual([])
    })

    it("con red: carga es y rellena sus claves ausentes con en.json", async () => {
        fetchMock.mockImplementation((url: string) => Promise.resolve(jsonResponse(url === "./lang/es.json" ? { main: { yes: "Sí" } } : { main: { yes: "Yes", no: "No" } })))

        setLanguage("es")

        await vi.waitFor(() => expect(get(stores.dictionary)).toEqual({ main: { yes: "Sí", no: "No" } }))
        expect(get(stores.language)).toBe("es")
        expect(unhandled).toEqual([])
    })
})
