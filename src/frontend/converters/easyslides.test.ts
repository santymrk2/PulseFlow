import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText, slideGroups } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertEasyslides } = await import("./easyslides")

describe("convertEasyslides", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un archivo de EasySlides real: nombre, número y una diapositiva por sección", () => {
        convertEasyslides([{ name: "cancion.easyslides.xml", content: fixture("cancion.easyslides.xml") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta.number).toBe("12")

        expect(slideGroups(show)).toHaveLength(2)
        const text = showText(show)
        expect(text).toContain("Sublime gracia del Señor")
        expect(text).toContain("Fui ciego mas hoy veo yo")
    })

    it("un archivo sin canciones no produce shows", () => {
        convertEasyslides([{ name: "vacio.xml", content: "<EasiSlides></EasiSlides>" }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toEqual([])
    })
})
