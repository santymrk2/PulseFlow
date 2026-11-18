// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { activeRecording, activeShow, cloudSyncData, drawerTabsData, special } from "../../../stores"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { MediaInfo } from "./MediaInfo"

const ipc = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn() }))
vi.mock("../../../IPC/main", () => ({ requestMain: ipc.request, sendMain: ipc.send }))
vi.mock("../../../components/helpers/media", async () => {
    const actual = await vi.importActual<typeof import("../../../components/helpers/media")>("../../../components/helpers/media")
    return { ...actual, getMediaInfo: vi.fn(() => Promise.resolve(null)) }
})
vi.mock("../../../components/drawer/live/LiveInfo.svelte", () => ({ default: { isla: "LiveInfo" } }))
vi.mock("../../../components/system/Clock.svelte", () => ({ default: { isla: "Clock" } }))
vi.mock("../../../components/system/Date.svelte", () => ({ default: { isla: "Date" } }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("./PlayerInfo", () => ({ PlayerInfo: ({ optionsOpen }: { optionsOpen: boolean }) => <div data-testid="player" data-open={optionsOpen} /> }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(activeRecording, null), looseEntry(activeShow, null), looseEntry(cloudSyncData, { enabled: false }), looseEntry(drawerTabsData, { media: { activeSubTab: "files" } }), looseEntry(special, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearIslands()
})

describe("MediaInfo", () => {
    it("muestra reloj y fecha cuando no hay ningún archivo activo", () => {
        render(<MediaInfo optionsOpen={false} />)
        expect(islands["Clock"]).toBeTruthy()
        expect(islands["Date"]).toBeTruthy()
    })

    it("muestra los metadatos del archivo activo con la información de FILE_INFO", async () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeRecording, null), looseEntry(activeShow, { id: "/videos/cast.mp4", name: "Cast", type: "video" }), looseEntry(cloudSyncData, { enabled: false }), looseEntry(drawerTabsData, { media: { activeSubTab: "files" } }), looseEntry(special, {})])
        ipc.request.mockImplementation((_channel: Main, _id: string, callback: (data: unknown) => void) => {
            callback({ extension: "mp4", path: "/videos/cast.mp4", stat: { size: 2048 } })
        })
        await act(async () => {
            render(<MediaInfo optionsOpen={false} />)
        })
        expect(ipc.request).toHaveBeenCalledWith(Main.FILE_INFO, "/videos/cast.mp4", expect.any(Function))
        expect(screen.getByText("Cast")).toBeTruthy()
        expect(screen.getByText("MP4")).toBeTruthy()
        expect(screen.getByText("2 KB")).toBeTruthy()
    })

    it("monta LiveInfo con grabación activa", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeRecording, {}), looseEntry(drawerTabsData, { media: { activeSubTab: "files" } })])
        render(<MediaInfo optionsOpen={false} />)
        expect(islands["LiveInfo"]?.props).toEqual({ optionsOpen: false })
    })

    it("delega en PlayerInfo en la pestaña online", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { activeSubTab: "online" } })])
        render(<MediaInfo optionsOpen={true} />)
        expect(screen.getByTestId("player").getAttribute("data-open")).toBe("true")
    })

    it("permite abrir la caché desde las opciones", () => {
        render(<MediaInfo optionsOpen={true} />)
        fireEvent.click(screen.getByText("[actions.open_cache_folder]"))
        expect(ipc.send).toHaveBeenCalledWith(Main.OPEN_CACHE)
    })

    it("escribe la preferencia de limpiar multimedia al terminar", () => {
        render(<MediaInfo optionsOpen={true} />)
        fireEvent.click(document.querySelector('[data-title="settings.clear_media_when_finished"]') as HTMLElement)
        expect(get(special).clearMediaOnFinish).toBe(false)
    })
})
