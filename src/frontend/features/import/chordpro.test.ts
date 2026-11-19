import "./testEnv"
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertChordPro } = await import("./chordpro")

const sample = readFileSync(new URL("./fixtures/cancion.chordpro", import.meta.url), "utf8")

describe("convertChordPro", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un .chordpro real en un show con título, metadatos y diapositivas con texto", () => {
        convertChordPro([{ name: "Sublime Gracia", content: sample }])
        vi.runAllTimers()

        expect(setTempShows).toHaveBeenCalledTimes(1)
        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)

        const { show } = shows[0]
        expect(show.name).toBe("Sublime Gracia")
        expect(show.meta.artist).toBe("John Newton")

        const text = Object.values<any>(show.slides)
            .flatMap((slide) => slide.items)
            .flatMap((item: any) => item.lines || [])
            .flatMap((line: any) => line.text || [])
            .map((t: any) => t.value)
            .join(" ")
        expect(text).toContain("Sublime gracia del")
        expect(text).toContain("Fui ciego mas")
        // los acordes ([G]) no quedan en la letra
        expect(text).not.toContain("[G]")
    })
})
