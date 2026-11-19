import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertOpenSong } = await import("./opensong")

describe("convertOpenSong", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un archivo de OpenSong real en un show con nombre, metadatos y la letra completa", () => {
        convertOpenSong([{ name: "cancion.opensong.xml", content: fixture("cancion.opensong.xml") }])
        vi.runAllTimers()

        expect(setTempShows).toHaveBeenCalledTimes(1)
        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta.author).toBe("John Newton")

        const text = showText(show)
        expect(text).toContain("Sublime gracia del Señor")
        expect(text).toContain("Que a un infeliz salvó")
        expect(text).toContain("Fui ciego mas hoy veo yo")
    })
})
