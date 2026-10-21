import "./testEnv"
import { describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { fixture } from "./converterTestKit"

const { setActiveScripture } = vi.hoisted(() => ({ setActiveScripture: vi.fn() }))
vi.mock("./bible", () => ({ setActiveScripture }))

const { convertOSISBible } = await import("./osisBible")
const { scripturesCache } = await import("../stores")

describe("convertOSISBible", () => {
    it("convierte una Biblia OSIS real de un solo libro: libro, capítulo y versículos", async () => {
        await convertOSISBible([{ name: "biblia.osis.xml", content: fixture("biblia.osis.xml") }])

        const bibles: any[] = Object.values(get(scripturesCache))
        const bible = bibles.find((b) => b.books?.some((book: any) => book.name === "Juan"))
        expect(bible, "la Biblia importada está en la caché").toBeDefined()

        const [chapter] = bible.books[0].chapters
        expect(chapter.verses.map((v: any) => Number(v.number))).toEqual([16, 17])
        expect(chapter.verses[0].text).toContain("Porque de tal manera amó Dios al mundo")
        expect(setActiveScripture).toHaveBeenCalled()
    })
})
