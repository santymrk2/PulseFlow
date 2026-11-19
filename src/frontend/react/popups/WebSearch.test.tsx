// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import type { LyricSearchResult } from "../../../types/Main"
import { destroyMain, receiveMain, sendMain } from "../../shared/core/ipc/main"
import { dictionary, special } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { WebSearch, type LyricData } from "./WebSearch"

vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), receiveMain: vi.fn((id: string) => `id-${id}`), destroyMain: vi.fn() }))
vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../shared/utils/language", () => ({ translateText: (value: string) => value }))
vi.mock("../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Loader") }))

const SONG = (title: string, artist: string, source: LyricSearchResult["source"] = "Genius"): LyricSearchResult => ({ key: title, title, artist, source })
const searchListener = () => vi.mocked(receiveMain).mock.calls[0][1] as (data: LyricSearchResult[]) => void
const lyricsListener = () => vi.mocked(receiveMain).mock.calls[1][1] as (data: LyricData) => void
const LYRICS = (lyrics: string, source = "Genius"): LyricData => ({ lyrics, source, title: "Título", artist: "Artista" })

let restaurar: () => void = () => {}
function montar(query = "Buscar", onUpdate = vi.fn()) {
    restaurar = setStoresForTest([looseEntry(special, {}), looseEntry(dictionary, { create_show: { search_results: "Resultados", block: "Bloquear" }, show: { song: "Canción", artist: "Artista", source: "Fuente" }, actions: { undo: "Deshacer" } })] as never)
    const result = render(<WebSearch query={query} onUpdate={onUpdate} />)
    return { ...result, onUpdate }
}
function answerSearch(data: LyricSearchResult[]) {
    act(() => searchListener()(data))
}
function answerLyrics(data: LyricData) {
    act(() => lyricsListener()(data))
}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("WebSearch", () => {
    it("al montar pide la búsqueda y muestra el Loader isla", () => {
        const { container } = montar()
        expect(sendMain).toHaveBeenCalledWith(Main.SEARCH_LYRICS, { artist: "", title: "Buscar" })
        expect(islands.Loader).toBeDefined()
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })

    it("sin nombre avisa y no pide nada", () => {
        const { container } = montar("")
        expect(newToast).toHaveBeenCalledWith("toast.no_name")
        expect(sendMain).not.toHaveBeenCalled()
        expect(container.innerHTML).toBe("")
    })

    it("muestra la tabla con los encabezados y una fila por canción", () => {
        montar()
        answerSearch([SONG("Una", "Artista A"), SONG("Dos", "Artista B", "Hymnary")])
        expect(screen.getByText("Resultados")).toBeTruthy()
        expect(screen.getByText("Canción")).toBeTruthy()
        expect(screen.getByText("Artista")).toBeTruthy()
        expect(screen.getByText("Fuente")).toBeTruthy()
        expect(screen.getByText("Una")).toBeTruthy()
        expect(screen.getByText("Dos")).toBeTruthy()
        expect(screen.getByText("Genius")).toBeTruthy()
        expect(document.querySelectorAll("tbody tr")).toHaveLength(2)
    })

    it("filtra los artistas bloqueados por defecto y los del store", () => {
        montar()
        special.update((a) => ({ ...a, blockedArtists: ["Prohibido"] }))
        answerSearch([SONG("Uno", "Ghost"), SONG("Dos", "Genesis"), SONG("Tres", "AC/DC"), SONG("Cuatro", "Disturbed"), SONG("Cinco", "Bob Rivers"), SONG("Seis", "Cary Ann Hearst"), SONG("Siete", "Prohibido"), SONG("Bien", "Artista")])
        expect(screen.queryByText("Uno")).toBeNull()
        expect(screen.queryByText("Siete")).toBeNull()
        expect(screen.getByText("Bien")).toBeTruthy()
    })

    it("sin resultados avisa, entrega update vacío y muestra la tabla sin filas", () => {
        const { onUpdate } = montar()
        answerSearch([])
        expect(newToast).toHaveBeenCalledWith("empty.search")
        expect(onUpdate).toHaveBeenCalledWith("")
        expect(document.querySelectorAll("tbody tr")).toHaveLength(0)
    })

    it("clickear una fila pide la letra y vuelve a mostrar el Loader", () => {
        const { container } = montar()
        answerSearch([SONG("Una", "Artista A")])
        fireEvent.click(screen.getByText("Una"))
        expect(sendMain).toHaveBeenCalledWith(Main.GET_LYRICS, { song: SONG("Una", "Artista A") })
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })

    it("con letra entrega el resultado y avisa el origen copiado", () => {
        const { onUpdate, container } = montar()
        answerLyrics(LYRICS("la letra"))
        expect(onUpdate).toHaveBeenCalledWith(LYRICS("la letra"))
        expect(newToast).toHaveBeenCalledWith("toast.lyrics_copied Genius!")
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })

    it("filtra las palabras bloqueadas y entrega update vacío", () => {
        const { onUpdate } = montar()
        answerLyrics(LYRICS("letra con fuck"))
        expect(newToast).toHaveBeenCalledWith("toast.lyrics_undefined")
        expect(onUpdate).toHaveBeenCalledWith("")
    })

    it("bloquear un artista lo agrega al store, tacha la fila y se puede deshacer", () => {
        const { container } = montar()
        answerSearch([SONG("Una", "Artista A")])
        const blockButton = () => document.querySelector("button[data-title='create_show.block']") as HTMLElement
        fireEvent.click(blockButton())
        expect(get(special).blockedArtists).toEqual(["Artista A"])
        expect((screen.getByText("Artista A").closest("td") as HTMLElement).style.textDecoration).toBe("line-through")
        expect(document.querySelector("button[data-title='actions.undo']")).toBeTruthy()
        fireEvent.click(document.querySelector("button[data-title='actions.undo']") as HTMLElement)
        expect(get(special).blockedArtists).toEqual([])
        expect(container.querySelector("tbody td[style]")).toBeNull()
    })

    it("bloquear desde el botón no pide la letra y Hymnary no tiene botón de bloqueo", () => {
        montar()
        answerSearch([SONG("Una", "Artista A"), SONG("Himno", "Artista H", "Hymnary")])
        fireEvent.click(document.querySelector("button[data-title='create_show.block']") as HTMLElement)
        expect(sendMain).not.toHaveBeenCalledWith(Main.GET_LYRICS, expect.anything())
        expect(document.querySelector("button[data-title='create_show.block']")).toBeNull()
    })

    it("quita los dos receptores al desmontar", () => {
        const { unmount } = montar()
        unmount()
        expect(destroyMain).toHaveBeenCalledWith("id-SEARCH_LYRICS")
        expect(destroyMain).toHaveBeenCalledWith("id-GET_LYRICS")
    })
})
