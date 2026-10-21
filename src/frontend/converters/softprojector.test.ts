import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture, showText, slideGroups } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertSoftProjector } = await import("./softprojector")

describe("convertSoftProjector", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte una base de SoftProjector real: nombre, autor, tonalidad y una diapositiva por sección", () => {
        convertSoftProjector([{ content: JSON.parse(fixture("cancion.softprojector.json")) }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta).toMatchObject({ author: "John Newton", composer: "Tradicional", key: "G" })

        expect(slideGroups(show)).toHaveLength(2)
        const text = showText(show)
        expect(text).toContain("Que a un infeliz salvó")
        expect(text).toContain("Fui ciego mas hoy veo yo")
        // el título de la sección ("Verse 1") no se cuela como letra
        expect(text).not.toContain("Verse 1")
    })
})
