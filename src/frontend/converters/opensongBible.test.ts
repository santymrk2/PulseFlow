import "./testEnv"
import { describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { fixture } from "./converterTestKit"

const { setActiveScripture } = vi.hoisted(() => ({ setActiveScripture: vi.fn() }))
vi.mock("./bible", () => ({ setActiveScripture }))
vi.mock("./importHelpers", () => ({ setTempShows: vi.fn(), createCategory: vi.fn(() => "cat") }))

const { convertOpenSongBible } = await import("./opensong")
const { scripturesCache } = await import("../stores")

describe("convertOpenSongBible", () => {
    it("convierte una Biblia de OpenSong real: libro, capítulo y versículos", () => {
        convertOpenSongBible([{ name: "biblia.opensong.xml", content: fixture("biblia.opensong.xml") }])

        const bibles: any[] = Object.values(get(scripturesCache))
        const bible = bibles.find((b) => b.books?.some((book: any) => book.name === "Juan"))
        expect(bible, "la Biblia importada está en la caché").toBeDefined()

        const [chapter] = bible.books[0].chapters
        expect(chapter.verses.map((v: any) => Number(v.number))).toEqual([16, 17])
        expect(chapter.verses[1].text).toBe("Porque no envió Dios a su Hijo al mundo")
    })
})
