// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeScripture, activeTriggerFunction, customScriptureBooks, dictionary, drawerTabsData, notFound, openScripture, outLocked, resized, scriptureHistory, scriptureMode, scriptures, scriptureSettings, selected } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Scripture } from "./Scripture"

const { loadJsonBibleMock, playScriptureMock, swapPreviewBibleMock, outputFlag } = vi.hoisted(() => ({
    loadJsonBibleMock: vi.fn(),
    playScriptureMock: vi.fn(),
    swapPreviewBibleMock: vi.fn(),
    outputFlag: { current: false }
}))

vi.mock("../../../utils/common", () => ({ ...commonMock(), wait: () => Promise.resolve() }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../classes/Show", () => ({ ShowObj: class ShowObj {} }))
// El módulo real arrastra ciclos (actions → apiHelper → scripture) que rompen la carga en el
// entorno de test; acá se reemplaza por las funciones puras que usa el componente.
vi.mock("../../../components/drawer/bible/scripture", () => {
    function getVerseIdParts(verseId: string | number) {
        const match = verseId?.toString().match(/(\d+(?:\.\d+)?)(?:_(\d+))?(?:-(\d+))?/)
        if (!match) return { id: 0, subverse: 0, endNumber: 0 }
        const [, id, subverse, endNumber] = match
        return { id: Number(id), subverse: Number(subverse) || 0, endNumber: Number(endNumber) || 0 }
    }

    function sortScriptureSelection(selection: (string | number)[]) {
        return selection.sort((a, b) => {
            const pa = getVerseIdParts(a)
            const pb = getVerseIdParts(b)
            if (pa.id !== pb.id) return pa.id - pb.id
            return pa.subverse - pb.subverse
        })
    }

    function joinRange(array: (number | string)[]) {
        if (!Array.isArray(array) || !array.length) return ""
        const numbers = sortScriptureSelection(array.slice()).map((entry) => getVerseIdParts(entry).id)
        const segments: string[] = []
        numbers.forEach((number) => {
            const last = segments[segments.length - 1]
            const lastEnd = last?.split("-").map(Number).pop() ?? Number.NaN
            if (last && number === lastEnd + 1) segments[segments.length - 1] = `${last.split("-")[0]}-${number}`
            else segments.push(String(number))
        })
        return segments.join("+")
    }

    function formatBibleText(text: string | undefined, redJesus = false) {
        if (!text) return ""
        return redJesus ? text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>') : text
    }

    function getShortBibleName(name: string) {
        if (!name) return ""
        const words = name
            .replace(/[^a-zA-Z ]+/g, "")
            .trim()
            .split(/\s+/)
        return words.length < 2 ? words[0].slice(0, 3) : words.map((word) => word[0] || "").join("")
    }

    function scriptureRangeSelect(e: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }, currentlySelected: (number | string)[], newSelection: number | string) {
        const clicked = newSelection.toString()
        if (e.ctrlKey || e.metaKey) return currentlySelected.map(String).includes(clicked) ? currentlySelected.filter((id) => id.toString() !== clicked) : [...currentlySelected, clicked]
        return [clicked]
    }

    function moveSelection(_lengths: { verses: number }, current: { book: number; chapters: number[]; verses: (number | string)[] }, moveLeft = false) {
        const next = sortScriptureSelection(current.verses.slice())
        const last = getVerseIdParts(next[next.length - 1]).id
        const verses = moveLeft || last >= _lengths.verses ? next : [last + 1]
        return { book: current.book, chapters: [current.chapters[0]], verses }
    }

    return {
        loadJsonBible: loadJsonBibleMock,
        playScripture: playScriptureMock,
        swapPreviewBible: swapPreviewBibleMock,
        outputIsScripture: () => outputFlag.current,
        sanitizeVerseText: (text: unknown) => (text === null || text === undefined ? "" : String(text)),
        formatBibleText,
        getShortBibleName,
        getVerseIdParts,
        getVersePartLetter: (subverse: number) => (Number(subverse) + 9).toString(36),
        joinRange,
        moveSelection,
        scriptureRangeSelect,
        sortScriptureSelection,
        splitText: (value: string) => (value ? [value] : [])
    }
})

interface FakeVerse {
    number: number
    text: string
}
interface FakeChapter {
    number: number
    verses: FakeVerse[]
}
interface FakeBook {
    number: number
    name: string
    abbr: string
    chapters: FakeChapter[]
}

const genesis: FakeBook = {
    number: 1,
    name: "Genesis",
    abbr: "Gen",
    chapters: [
        {
            number: 1,
            verses: [
                { number: 1, text: "In the beginning God created" },
                { number: 2, text: "And the earth was without form" },
                { number: 3, text: "And God said let there be light" }
            ]
        },
        { number: 2, verses: [{ number: 1, text: "Thus the heavens and the earth" }] }
    ]
}

const genesisSpanish: FakeBook = {
    number: 1,
    name: "Genesis",
    abbr: "Gen",
    chapters: [
        { number: 1, verses: [{ number: 1, text: "En el principio creó Dios" }] },
        { number: 2, verses: [] }
    ]
}

const exodus: FakeBook = {
    number: 2,
    name: "Exodus",
    abbr: "Exo",
    chapters: [{ number: 1, verses: [{ number: 1, text: "Now these are the names" }] }]
}

function fakeBible(books: FakeBook[], verses: FakeVerse[] = []) {
    return {
        data: {
            metadata: { title: "Fake Bible" },
            books: books.map((book) => ({ number: book.number, name: book.name, chapters: book.chapters.map((chapter) => ({ number: chapter.number })) }))
        },
        getBooksData: () => books.map((book) => ({ abbreviation: book.abbr, category: { color: "" } })),
        getBook: (numberOrName: number | string) => {
            const book = books.find((entry) => entry.number === Number(numberOrName)) || books[0]
            return {
                name: book.name,
                number: book.number,
                data: { chapters: book.chapters.map((chapter) => ({ number: chapter.number })) },
                getAbbreviation: () => book.abbr,
                getChapter: (number: number) => {
                    const chapter = book.chapters.find((entry) => entry.number === number) || book.chapters[0]
                    return {
                        data: { verses: chapter.verses },
                        getVerse: (verseNumber: number) => ({ getHTML: () => chapter.verses.find((verse) => verse.number === verseNumber)?.text || "" }),
                        getVerses: (verseNumbers: number[]) => verseNumbers
                    }
                }
            }
        },
        textSearch: (query: string) => (query === "beginning" ? verses.map((verse) => ({ book: 1, chapter: 1, verse, reference: `Genesis 1:${verse.number}` })) : [])
    }
}

const bibles: Record<string, ReturnType<typeof fakeBible>> = {
    gen: fakeBible([genesis, exodus], [{ number: 1, text: "In the beginning God created" }]),
    gen2: fakeBible([genesisSpanish, exodus], [{ number: 1, text: "En el principio creó Dios" }])
}

const dict = {
    error: { bible: "Biblia no encontrada", bible_api: "La API falló" },
    empty: { search: "Sin resultados", general: "Vacío" },
    scripture: { show_all: "Mostrar todo", search: "Buscar" },
    edit: { offset: "Offset" },
    popup: { history: "Historial" }
}

const baseScripture = { id: "gen", reference: { book: 1, chapters: [1], verses: [[1]] } }

let restaurar: () => void = () => {}

function montar(active = "gen", extra: ReturnType<typeof storeEntry>[] = []) {
    restaurar()
    restaurar = setStoresForTest([
        storeEntry(dictionary, dict as never),
        storeEntry(scriptures, { gen: { name: "Genesis Bible" }, gen2: { name: "Segunda" }, col: { name: "Colección", collection: { versions: ["gen", "gen2"], previewIndex: 0 } } } as never),
        storeEntry(activeScripture, baseScripture as never),
        storeEntry(scriptureMode, "list"),
        storeEntry(scriptureHistory, []),
        storeEntry(scriptureSettings, { referenceDivider: ":", splitLongVerses: false, longVersesChars: 100, longVersesTolerance: 0, splitLongVersesSuffix: false, showAllVersions: false } as never),
        storeEntry(notFound, { show: [], bible: [] }),
        storeEntry(customScriptureBooks, {}),
        storeEntry(resized, { leftPanel: 290, rightPanel: 290, leftPanelDrawer: 290, rightPanelDrawer: 290 }),
        storeEntry(drawerTabsData, { scripture: { enabled: true, activeSubTab: active } } as never),
        storeEntry(activeEdit, { items: [] } as never),
        storeEntry(activeTriggerFunction, null as never),
        storeEntry(openScripture, null),
        storeEntry(outLocked, false),
        storeEntry(selected, { id: null, data: [] }),
        ...extra
    ])
    return render(<Scripture active={active} />)
}

const libros = () => document.querySelector(".books") as HTMLElement | null
const capitulos = () => document.querySelector(".chapters") as HTMLElement | null
const versiculos = () => document.querySelector(".verses") as HTMLElement | null
const textos = (elem: HTMLElement | null) => [...(elem?.querySelectorAll("span") || [])].map((span) => span.textContent)
// Cada versículo es un span con su número (.v) y el texto adentro del mismo span.
const numerosDeVersiculos = () => [...Array.from(versiculos()?.children || [])].filter((child) => child.tagName === "SPAN" && child.querySelector(".v")).map((span) => span.querySelector(".v")?.textContent)

async function montarListo(active = "gen", extra: ReturnType<typeof storeEntry>[] = []) {
    const utils = montar(active, extra)
    await waitFor(() => expect(versiculos()?.querySelector("span[id]")).toBeTruthy())
    return utils
}

beforeEach(() => {
    vi.clearAllMocks()
    outputFlag.current = false
    loadJsonBibleMock.mockImplementation(async (id: string) => bibles[id] || null)
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Scripture", () => {
    it("muestra el error cuando la biblia no existe", () => {
        montar("missing")
        expect(screen.getByText("Biblia no encontrada")).toBeTruthy()
    })

    it("muestra el error de la API cuando falla la carga", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        loadJsonBibleMock.mockRejectedValue(new Error("sin red"))
        montar("gen", [storeEntry(scriptures, { gen: { name: "Genesis Bible", api: true } } as never)])
        expect(await screen.findByText("La API falló")).toBeTruthy()
    })

    it("muestra el error cuando la biblia está en notFound", () => {
        montar("gen", [storeEntry(notFound, { show: [], bible: ["gen"] })])
        expect(screen.getByText("Biblia no encontrada")).toBeTruthy()
    })

    it("lista libros, capítulos y versículos y marca la selección activa", async () => {
        await montarListo()
        expect(textos(libros())).toEqual(["Genesis", "Exodus"])
        expect(textos(capitulos())).toEqual(["1", "2"])
        expect(numerosDeVersiculos()).toEqual(["1", "2", "3"])
        expect(versiculos()?.querySelector("span.isActive")?.getAttribute("id")).toBe("1")
        expect(document.body.textContent).toContain("Genesis 1:1")
    })

    it("al elegir un libro recarga su primer capítulo", async () => {
        await montarListo()
        fireEvent.click((libros() as HTMLElement).querySelectorAll("span")[1])
        await waitFor(() => expect(get(activeScripture).reference?.book).toBe("2"))
        expect(textos(capitulos())).toEqual(["1"])
        expect(versiculos()?.textContent).toContain("Now these are the names")
        expect(document.body.textContent).toContain("Exodus 1:1")
    })

    it("al elegir un capítulo muestra sus versículos", async () => {
        await montarListo()
        fireEvent.click((capitulos() as HTMLElement).querySelectorAll("span")[1])
        await waitFor(() => expect(versiculos()?.textContent).toContain("Thus the heavens"))
        expect(document.body.textContent).toContain("Genesis 2:1")
    })

    it("ctrl+click agrega un capítulo a la referencia", async () => {
        await montarListo()
        fireEvent.click((capitulos() as HTMLElement).querySelectorAll("span")[1], { ctrlKey: true })
        await waitFor(() => expect(get(activeScripture).reference?.chapters).toEqual([1, "2"]))
        expect(document.body.textContent).toContain("Genesis 1,2:1")
    })

    it("mousedown sobre un versículo actualiza la selección", async () => {
        await montarListo()
        const segundo = (versiculos() as HTMLElement).querySelector('span[id="2"]') as HTMLElement
        fireEvent.mouseDown(segundo)
        // Los ids de versículo se guardan como string, igual que en el Svelte original.
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["2"]]))
        expect(segundo.className).toContain("isActive")
    })

    it("doble click sobre un versículo lo reproduce", async () => {
        await montarListo()
        fireEvent.doubleClick((versiculos() as HTMLElement).querySelector('span[id="1"]') as HTMLElement)
        expect(playScriptureMock).toHaveBeenCalled()
    })

    it("el modo grilla usa abreviaturas y oculta el texto de los versículos", async () => {
        montar("gen", [storeEntry(scriptureMode, "grid")])
        await waitFor(() => expect(document.querySelector(".grid .books span")).toBeTruthy())
        expect(textos(libros())).toEqual(["Gen", "Exo"])
        expect(versiculos()?.textContent).not.toContain("In the beginning")
        expect(document.body.textContent).not.toContain("Genesis Bible:")
    })

    it("muestra el historial y lo cierra con Ctrl+H", async () => {
        const history = [
            { tabId: "gen", id: "gen", version: "Bible One", reference: "Juan 3:16", text: "Porque de tal manera", book: 43, chapter: 3, verse: [16] },
            { tabId: "gen", id: "gen", version: "Bible Two", reference: "Juan 3:17", text: "Porque no envió Dios", book: 43, chapter: 3, verse: [17] }
        ]
        await montarListo("gen", [storeEntry(scriptureHistory, history as never)])

        fireEvent.click(document.querySelector('[data-title="Historial [Ctrl+H]"]') as HTMLElement)
        expect(await screen.findByText("Juan 3:16")).toBeTruthy()
        expect(screen.getByText("Juan 3:17")).toBeTruthy()
        expect(document.querySelector(".history-version")?.textContent).toBe("BT")

        fireEvent.keyDown(window, { key: "h", ctrlKey: true })
        await waitFor(() => expect(document.querySelector(".verseList")).toBeNull())
    })

    it("busca contenido y reproduce el resultado", async () => {
        await montarListo()
        fireEvent.click(document.querySelector('[data-title="Buscar [Ctrl+B]"]') as HTMLElement)

        const input = (await screen.findByPlaceholderText("Buscar")) as HTMLInputElement
        fireEvent.input(input, { target: { value: "beginning" } })

        expect(await screen.findByText("Genesis 1:1")).toBeTruthy()
        fireEvent.doubleClick(document.querySelector('[data-chapter="1"]') as HTMLElement)
        await waitFor(() => expect(playScriptureMock).toHaveBeenCalled())
        expect(input.isConnected).toBe(true)
    })

    it("Ctrl+B abre la búsqueda y Escape la cierra", async () => {
        await montarListo()
        fireEvent.keyDown(window, { key: "b", ctrlKey: true })
        expect(await screen.findByPlaceholderText("Buscar")).toBeTruthy()

        fireEvent.keyDown(window, { key: "Escape" })
        await waitFor(() => expect(screen.queryByPlaceholderText("Buscar")).toBeNull())
    })

    it("en colecciones permite cambiar la versión de vista previa", async () => {
        await montarListo("col")
        const cambiar = document.querySelector('[data-title="Segunda"]') as HTMLElement
        expect(cambiar).toBeTruthy()
        fireEvent.click(cambiar)
        await waitFor(() => expect(swapPreviewBibleMock).toHaveBeenCalledWith("col"))
    })

    it("en colecciones con offsets muestra los campos y permite activarlos", async () => {
        montar("col", [storeEntry(scriptures, { gen: { name: "Genesis Bible" }, gen2: { name: "Segunda" }, col: { name: "Colección", collection: { versions: ["gen", "gen2"], previewIndex: 0, offsets: { "gen2-1-1": 1 } } } } as never)])
        await waitFor(() => expect(document.querySelectorAll(".numberfield")).toHaveLength(2))
        expect(document.body.textContent).toContain("Genesis Bible")
        expect(document.body.textContent).toContain("Segunda")

        fireEvent.click(document.querySelector('[data-title="Offset"]') as HTMLElement)
        await waitFor(() => expect(document.querySelectorAll(".numberfield")).toHaveLength(0))
    })

    it("mostrar todas las versiones lista el texto de cada traducción", async () => {
        await montarListo("col")
        fireEvent.click(document.querySelector('[data-title="Mostrar todo"]') as HTMLElement)
        await waitFor(() => expect(Array.from(document.querySelectorAll(".collection-versions")).some((el) => el.querySelectorAll(".version-item").length === 2)).toBe(true))
        expect(versiculos()?.textContent).toContain("In the beginning God created")
        expect(versiculos()?.textContent).toContain("En el principio creó Dios")
    })

    it("con la salida en escritura permite mover la selección", async () => {
        outputFlag.current = true
        await montarListo()

        fireEvent.click(document.querySelector('[data-title="preview._next_slide [Ctrl+Arrow Right]"]') as HTMLElement)
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["2"]]))
        expect(playScriptureMock).toHaveBeenCalled()
    })

    it("los atajos de seleccionar todo y mover vienen de activeTriggerFunction", async () => {
        await montarListo()

        const segundo = (versiculos() as HTMLElement).querySelector('span[id="2"]') as HTMLElement
        fireEvent.mouseDown(segundo)
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["2"]]))

        act(() => activeTriggerFunction.set("scripture_next" as never))
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["3"]]))

        act(() => activeTriggerFunction.set("scripture_previous" as never))
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["2"]]))

        act(() => activeTriggerFunction.set("scripture_selectAll" as never))
        await waitFor(() => expect(get(activeScripture).reference?.verses).toEqual([["1", "2", "3"]]))
    })
})
