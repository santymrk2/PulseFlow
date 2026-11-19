// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, autoOpenedTimeline, outLocked, projects, resized, showsCache, special, templateApplied } from "../../shared/core/stores"
import { clearIslands } from "../../shared/test/islandMock"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Show } from "./Show"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/common", () => ({ DEFAULT_WIDTH: 250 }))
vi.mock("../../components/drawer/timers/timers", () => ({ createGlobalTimerFromLocalTimer: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({ setOutput: vi.fn() }))
vi.mock("../main/Splash", () => ({ Splash: () => <div data-isla="Splash" /> }))
vi.mock("../output/Camera", async () => ({ Camera: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Camera") }))
vi.mock("../drawer/live/NDIStream", async () => ({ NDIStream: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("NDIStream") }))
vi.mock("../slide/Layouts", () => ({ Layouts: () => <div data-testid="layouts" /> }))
vi.mock("../../features/timeline/Timeline", () => ({ Timeline: () => <div data-testid="timeline" /> }))
vi.mock("../../shared/ui/system/Resizeable", () => ({ Resizeable: ({ children }: { children?: ReactNode }) => <div data-testid="resizeable">{children}</div> }))
vi.mock("../../shared/ui/system/HoverPlay", () => ({ HoverPlay: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("./AudioPreview", () => ({ AudioPreview: () => <div data-testid="audio-preview" /> }))
vi.mock("./Slides", () => ({ Slides: () => <div data-testid="slides" /> }))
vi.mock("./ShowNotes", () => ({ ShowNotes: () => <div data-testid="show-notes" /> }))
vi.mock("./MediaPreview", () => ({ MediaPreview: () => <div data-testid="media-preview" /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    clearIslands()
    vi.clearAllMocks()
})

function setStores(show: unknown = null, showCache: unknown = {}) {
    restore = setStoresForTest([looseEntry(activeShow, show), looseEntry(projects, {}), looseEntry(showsCache, showCache), looseEntry(autoOpenedTimeline, false), looseEntry(outLocked, false), looseEntry(resized, { timeline: 0 }), looseEntry(special, {}), looseEntry(templateApplied, false)])
}

describe("Show", () => {
    it("muestra el splash cuando no hay show activo", () => {
        setStores()
        render(<Show />)
        expect(document.querySelector('[data-isla="Splash"]')).toBeTruthy()
        expect(screen.queryByTestId("slides")).toBeNull()
    })

    it("muestra AudioPreview para un show de audio", () => {
        setStores({ id: "a1", type: "audio" })
        render(<Show />)
        expect(screen.getByTestId("audio-preview")).toBeTruthy()
    })

    it("muestra Slides y Layouts para un show normal", () => {
        setStores({ id: "s1", type: "show" }, { s1: { settings: { activeLayout: "l1" }, layouts: { l1: {} } } })
        render(<Show />)
        expect(screen.getByTestId("slides")).toBeTruthy()
        expect(screen.getByTestId("layouts")).toBeTruthy()
    })

    it("usa el port Camera para un show de cámara", () => {
        setStores({ id: "c1", type: "camera", data: { groupId: "g1" } })
        render(<Show />)
        expect(document.querySelector('[data-isla="Camera"]')).toBeTruthy()
    })

    it("usa el port NDIStream para un show ndi", () => {
        setStores({ id: "n1", type: "ndi", name: "Cámara NDI" })
        render(<Show />)
        expect(document.querySelector('[data-isla="NDIStream"]')).toBeTruthy()
    })
})
