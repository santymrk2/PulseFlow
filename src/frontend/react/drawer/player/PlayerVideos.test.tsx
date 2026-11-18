// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeFocus, activePlayerTagFilter, activeShow, dictionary, focusMode, outLocked, outputs, playerTags, playerVideos } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { clearIslands } from "../../test/islandMock"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { PlayerVideos } from "./PlayerVideos"

const { setOutputMock, findMatchingOutMock, clearBackgroundMock, clearSlideMock } = vi.hoisted(() => ({
    setOutputMock: vi.fn(),
    findMatchingOutMock: vi.fn((): string | null => null),
    clearBackgroundMock: vi.fn(),
    clearSlideMock: vi.fn()
}))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/helpers/output", () => ({ getResolution: () => ({ width: 16, height: 9 }), findMatchingOut: findMatchingOutMock, setOutput: setOutputMock }))
vi.mock("../../../components/output/clear", () => ({ clearBackground: clearBackgroundMock, clearSlide: clearSlideMock }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))

const dict = {
    empty: { player: "Sin videos", search: "Sin resultados" },
    actions: { remove: "Quitar" }
}

const video = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, type: "youtube", ...extra })
const cards = () => Array.from(document.querySelectorAll('[role="button"]')) as HTMLElement[]

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    findMatchingOutMock.mockReturnValue(null)
    clearIslands()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(playerVideos, { v1: video("v1", { name: "B" }), v2: video("v2", { name: "A" }), v3: video("v3", { name: "C", type: "vimeo" }) } as never), storeEntry(activePlayerTagFilter, []), storeEntry(playerTags, { t1: { name: "Música" } } as never), storeEntry(activeShow, null), storeEntry(activeFocus, {} as never), storeEntry(focusMode, false), storeEntry(outLocked, false), storeEntry(outputs, {} as never)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("PlayerVideos", () => {
    it("filtra por tipo y ordena por nombre", () => {
        render(<PlayerVideos active="youtube" />)
        const thumbnails = Array.from(document.querySelectorAll("img")) as HTMLImageElement[]
        expect(thumbnails).toHaveLength(2)
        expect(thumbnails[0].getAttribute("alt")).toContain("A")
        expect(thumbnails[0].src).toBe("https://i.ytimg.com/vi/v2/sddefault.jpg")
    })

    it("sin videos muestra el vacío", () => {
        act(() => playerVideos.set({} as never))
        render(<PlayerVideos active="youtube" />)
        expect(screen.getByText("Sin videos")).toBeTruthy()
    })

    it("sin resultados de búsqueda muestra el vacío de búsqueda", () => {
        act(() => playerVideos.set({ v1: video("v1", { tags: ["t1"] }) } as never))
        act(() => activePlayerTagFilter.set(["t2"]))
        render(<PlayerVideos active="youtube" />)
        expect(screen.getByText("Sin resultados")).toBeTruthy()
    })

    it("el click pone el video como fondo", () => {
        render(<PlayerVideos active="youtube" />)
        fireEvent.click(cards()[0])
        expect(clearSlideMock).toHaveBeenCalled()
        expect(setOutputMock).toHaveBeenCalledWith("background", { id: "v2", type: "player", muted: false, loop: false, startAt: 0, ignoreLayer: true })
    })

    it("el click en un video ya activo limpia el fondo", () => {
        findMatchingOutMock.mockReturnValue("red")
        render(<PlayerVideos active="youtube" />)
        fireEvent.click(cards()[0])
        expect(clearBackgroundMock).toHaveBeenCalled()
        expect(setOutputMock).not.toHaveBeenCalled()
    })

    it("con outLocked o con modificadores no hace nada", () => {
        act(() => outLocked.set(true))
        render(<PlayerVideos active="youtube" />)
        fireEvent.click(cards()[0])
        expect(setOutputMock).not.toHaveBeenCalled()

        cleanup()
        act(() => outLocked.set(false))
        render(<PlayerVideos active="youtube" />)
        fireEvent.click(cards()[0], { ctrlKey: true })
        expect(setOutputMock).not.toHaveBeenCalled()
    })

    it("el doble click activa el show o el foco según focusMode", () => {
        render(<PlayerVideos active="youtube" />)
        fireEvent.doubleClick(cards()[0])
        expect(get(activeShow)).toEqual({ id: "v2", type: "player" })

        cleanup()
        act(() => focusMode.set(true))
        render(<PlayerVideos active="youtube" />)
        fireEvent.doubleClick(cards()[0])
        expect(get(activeFocus)).toEqual({ id: "v2", type: "player" })
    })

    it("el botón de etiqueta quita las etiquetas del video", () => {
        act(() => playerVideos.set({ v1: video("v1", { tags: ["t1"] }) } as never))
        render(<PlayerVideos active="youtube" />)
        expect(screen.getByText("Música")).toBeTruthy()
        fireEvent.click(document.querySelector('[data-title="Quitar"]') as HTMLElement)
        expect(get(playerVideos).v1.tags).toEqual([])
    })

    it("la etiqueta múltiple muestra la cantidad", () => {
        act(() => playerVideos.set({ v1: video("v1", { tags: ["t1", "t2"] }) } as never))
        render(<PlayerVideos active="youtube" />)
        expect(screen.getByText("2")).toBeTruthy()
    })
})
