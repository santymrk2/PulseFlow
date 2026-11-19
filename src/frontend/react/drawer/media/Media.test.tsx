// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { activeDrawerTab, activeEdit, activeFocus, activeMediaTagFilter, activePopup, activeShow, audioFolders, cloudSyncData, drawerTabsData, focusMode, labelsDisabled, media, mediaFolders, mediaOptions, openedMediaFolders, outLocked, outputs, popupData, providerConnections, selectAllMedia, selected, sorted, special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { clearIslands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Media } from "./Media"

vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./pixabay", () => ({ loadFromPixabay: vi.fn(() => Promise.resolve([])) }))
vi.mock("./unsplash", () => ({ loadFromUnsplash: vi.fn(() => Promise.resolve([])) }))
vi.mock("../../../components/drawer/media/pixabay", () => ({ loadFromPixabay: vi.fn(() => Promise.resolve([])) }))
vi.mock("../../../components/drawer/media/unsplash", () => ({ loadFromUnsplash: vi.fn(() => Promise.resolve([])) }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    restaurar = setStoresForTest([
        looseEntry(media, {}),
        looseEntry(mediaFolders, {}),
        looseEntry(mediaOptions, { columns: 4, mode: "grid", view: "all" }),
        looseEntry(openedMediaFolders, {}),
        looseEntry(audioFolders, {}),
        looseEntry(cloudSyncData, { enabled: false }),
        looseEntry(special, { optimizedMode: false }),
        looseEntry(drawerTabsData, { media: { activeSubTab: "all", enabled: true } }),
        looseEntry(outputs, {}),
        looseEntry(providerConnections, {}),
        looseEntry(activeShow, null),
        looseEntry(activeEdit, { id: "", type: "", items: [] }),
        looseEntry(activeMediaTagFilter, []),
        looseEntry(sorted, {}),
        looseEntry(outLocked, false),
        looseEntry(focusMode, false),
        looseEntry(labelsDisabled, false),
        looseEntry(selectAllMedia, false),
        looseEntry(selected, null),
        looseEntry(activeDrawerTab, "media"),
        looseEntry(activeFocus, null),
        looseEntry(activePopup, null),
        looseEntry(popupData, {})
    ])
    vi.mocked(requestMain).mockImplementation(((id: Main) => {
        if (id === Main.GET_CONTENT_PROVIDERS) return Promise.resolve([])
        if (id === Main.READ_FOLDER) return Promise.resolve({})
        if (id === Main.GET_MEDIA_FOLDER_PATH) return Promise.resolve("")
        return Promise.resolve(undefined)
    }) as never)
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Media", () => {
    it("renderiza_el_contenedor_de_scroll", () => {
        const { container } = render(<Media active="all" streams={[]} />)
        expect(container.querySelector("[class*='scroll']")).not.toBeNull()
    })

    it("muestra_las_pestanas_de_inputs", () => {
        render(<Media active="inputs" streams={[]} />)
        expect(screen.getByText("NDI")).toBeTruthy()
        expect(screen.getByText("OMT")).toBeTruthy()
        expect(screen.getByText("Blackmagic")).toBeTruthy()
    })

    it("muestra_las_pestanas_de_online", () => {
        render(<Media active="online" streams={[]} />)
        expect(screen.getByText("YouTube")).toBeTruthy()
        expect(screen.getByText("Vimeo")).toBeTruthy()
        expect(screen.getByText("Canva")).toBeTruthy()
    })

    it("pide_el_contenido_de_la_carpeta_al_montar", () => {
        render(<Media active="all" streams={[]} />)
        expect(requestMain).toHaveBeenCalledWith(Main.GET_CONTENT_PROVIDERS)
    })
})
