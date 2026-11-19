import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText, slideGroups } from "./converterTestKit"

const { setTempShows, createCategory } = vi.hoisted(() => ({ setTempShows: vi.fn(), createCategory: vi.fn(() => "cat") }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory }))

const { convertVerseVIEW } = await import("./verseview")

describe("convertVerseVIEW", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        createCategory.mockClear()
        vi.useFakeTimers()
    })

    it("convierte una base de VerseVIEW real: nombre, autor, categoría y una diapositiva por bloque", () => {
        convertVerseVIEW([{ content: fixture("cancion.verseview.xml") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)
        expect(createCategory).toHaveBeenCalledWith("VerseVIEW/Himnos")

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta.author).toBe("John Newton")

        expect(slideGroups(show)).toHaveLength(2)
        expect(showText(show)).toContain("Fui ciego mas hoy veo yo")
    })
})
