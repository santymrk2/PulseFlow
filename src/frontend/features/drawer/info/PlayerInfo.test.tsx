// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OUTPUT } from "../../../../types/Channels"
import { Main } from "../../../../types/IPC/Main"
import { drawerTabsData, photoApiCredits, playerVideos, providerConnections } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { PlayerInfo } from "./PlayerInfo"

const mocks = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn(), outputs: [] as unknown[] }))
vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: mocks.request }))
vi.mock("../../../shared/utils/request", () => ({ send: mocks.send }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getAllNormalOutputs: () => mocks.outputs }))
vi.mock("./CanvaInfo", () => ({ CanvaInfo: () => <div data-testid="canva" /> }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.outputs = []
    restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { openedSubSubTab: { online: "youtube" } } }), looseEntry(photoApiCredits, {}), looseEntry(playerVideos, {}), looseEntry(providerConnections, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PlayerInfo", () => {
    it("avisa y permite cerrar el anuncio cuando YouTube está reproduciéndose", () => {
        mocks.outputs = [{ out: { background: { type: "player", id: "vid" } } }]
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { openedSubSubTab: { online: "youtube" } } }), looseEntry(playerVideos, { vid: { type: "youtube" } })])
        render(<PlayerInfo optionsOpen={false} />)
        expect(screen.getByText("[error.video_unavailable]")).toBeTruthy()
        fireEvent.click(screen.getByText("[inputs.close_ad]"))
        expect(mocks.send).toHaveBeenCalledWith(OUTPUT, ["CLOSE_AD"])
    })

    it("muestra CanvaInfo en la pestaña canva sin opciones", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { openedSubSubTab: { online: "canva" } } })])
        render(<PlayerInfo optionsOpen={false} />)
        expect(screen.getByTestId("canva")).toBeTruthy()
    })

    it("desconecta Canva y actualiza el store al confirmar el IPC", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { openedSubSubTab: { online: "canva" } } }), looseEntry(providerConnections, { canva: true })])
        mocks.request.mockImplementation((_channel: Main, _data: unknown, callback: (result: unknown) => void) => callback({ success: true }))
        render(<PlayerInfo optionsOpen={true} />)
        fireEvent.click(screen.getByText("[settings.disconnect_from]"))
        expect(mocks.request).toHaveBeenCalledWith(Main.PROVIDER_DISCONNECT, { providerId: "canva" }, expect.any(Function))
        expect(get(providerConnections).canva).toBe(false)
    })

    it("muestra los créditos de la foto cuando coincide el proveedor", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { media: { openedSubSubTab: { online: "unsplash" } } }), looseEntry(photoApiCredits, { type: "unsplash", photo: "Foto 1", artist: "Ana", artistUrl: "https://ana.test", photoUrl: "https://foto.test" })])
        render(<PlayerInfo optionsOpen={false} />)
        expect(screen.getByText("Foto 1")).toBeTruthy()
        expect(screen.getAllByText("Ana").length).toBeGreaterThan(0)
        expect(screen.getByText("unsplash")).toBeTruthy()
    })
})
