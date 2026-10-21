import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertTexts } = await import("./txt")

describe("convertTexts", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un .txt real en un show: el nombre sale del archivo y las secciones se separan por línea en blanco", () => {
        convertTexts([{ name: "Sublime Gracia", content: fixture("cancion.txt") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")

        const text = showText(show)
        expect(text).toContain("Sublime gracia del Señor")
        expect(text).toContain("Que a un infeliz salvó")
        expect(text).toContain("Fui ciego mas hoy veo yo")
    })
})
