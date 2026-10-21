import "./testEnv"
import { describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { fixture } from "./converterTestKit"

const { setActiveScripture } = vi.hoisted(() => ({ setActiveScripture: vi.fn() }))
vi.mock("./bible", () => ({ setActiveScripture }))

const { convertZefaniaBible } = await import("./zefaniaBible")
const { scriptures, scripturesCache } = await import("../stores")

describe("convertZefaniaBible", () => {
    it("convierte una Biblia Zefania real: libros, capítulos y versículos quedan en la caché y en la lista", () => {
        convertZefaniaBible([{ name: "biblia.zefania.xml", content: fixture("biblia.zefania.xml") }])

        const [id] = Object.keys(get(scripturesCache))
        const bible: any = get(scripturesCache)[id]

        expect(bible.name).toBe("Reina Valera de prueba")
        expect(bible.metadata.copyright).toBe("Dominio público")

        expect(bible.books).toHaveLength(1)
        expect(bible.books[0].name).toBe("Juan")
        const [chapter] = bible.books[0].chapters
        expect(chapter.verses.map((v: any) => v.number)).toEqual([16, 17])
        expect(chapter.verses[0].text).toBe("Porque de tal manera amó Dios al mundo")

        expect(get(scriptures)[id]).toEqual({ name: "Reina Valera de prueba", id })
        expect(setActiveScripture).toHaveBeenCalledWith(id)
    })

    it("un archivo sin libros produce una Biblia vacía sin romper", () => {
        convertZefaniaBible([{ name: "vacia", content: "<XMLBIBLE></XMLBIBLE>" }])

        const bibles: any[] = Object.values(get(scripturesCache))
        expect(bibles.some((bible) => bible.books.length === 0)).toBe(true)
    })
})
