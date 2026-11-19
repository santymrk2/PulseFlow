import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertSongbeamerFiles } = await import("./songbeamer")

describe("convertSongbeamerFiles", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un .sng real: título, autor, CCLI y la letra por secciones", () => {
        convertSongbeamerFiles([{ name: "cancion.sng", content: fixture("cancion.sng") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta).toMatchObject({ author: "John Newton", CCLI: "1234567" })

        const text = showText(show)
        expect(text).toContain("Sublime gracia del Señor")
        expect(text).toContain("Fui ciego mas hoy veo yo")
    })

    it("ignora el BOM de UTF-8 al principio del archivo", () => {
        convertSongbeamerFiles([{ name: "bom.sng", content: "ï»¿" + fixture("cancion.sng") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows[0].show.name).toBe("Sublime Gracia")
    })

    it("un archivo vacío no produce shows", () => {
        convertSongbeamerFiles([{ name: "vacio.sng", content: "" }])
        vi.runAllTimers()

        expect(setTempShows.mock.calls[0][0]).toEqual([])
    })
})
