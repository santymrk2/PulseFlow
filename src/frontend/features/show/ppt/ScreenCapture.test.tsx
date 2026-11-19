// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeProject, outLocked, outputs, presentationData, projects, special } from "../../../shared/core/stores"
import { requestMain } from "../../../shared/core/ipc/main"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { ScreenCapture } from "./ScreenCapture"

const windows = [{ id: 1, name: "PowerPoint - Predicación" }]

vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn((_main, _data, callback) => callback(windows)) }))
vi.mock("../../../shared/utils/helpers/media", () => ({ getFileName: (path: string) => path, removeExtension: (name: string) => name.split(".")[0] }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getAllActiveOutputIds: vi.fn(() => ["out1"]) }))
vi.mock("../../../react/output/Window", async () => ({ Window: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Window") }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe("ScreenCapture", () => {
    it("selecciona automáticamente la única ventana coincidente", () => {
        vi.useFakeTimers()
        restore = setStoresForTest([looseEntry(presentationData, {}), looseEntry(projects, {}), looseEntry(activeProject, "project1"), looseEntry(special, { presentationApp: "PowerPoint" }), looseEntry(outLocked, false), looseEntry(outputs, { out1: { out: { slide: { type: "ppt" } } } })])
        const { container } = render(<ScreenCapture path="Predicación" />)
        act(() => vi.advanceTimersByTime(0))
        expect(container.querySelector('[data-isla="Window"]')?.getAttribute("data-props")).toContain('"id":1')
    })

    it("muestra la lista cuando hay varias ventanas", () => {
        vi.useFakeTimers()
        vi.mocked(requestMain).mockImplementation(((_main: unknown, _data: unknown, callback: (value: unknown) => void) =>
            callback([
                { id: 1, name: "Predicación PowerPoint uno" },
                { id: 2, name: "Predicación PowerPoint dos" }
            ])) as never)
        restore = setStoresForTest([looseEntry(presentationData, {}), looseEntry(projects, {}), looseEntry(activeProject, "project1"), looseEntry(special, { presentationApp: "PowerPoint" }), looseEntry(outLocked, false), looseEntry(outputs, {})])
        const { container } = render(<ScreenCapture path="Predicación" />)
        act(() => vi.advanceTimersByTime(0))
        expect(container.querySelectorAll('[data-isla="Window"]')).toHaveLength(2)
        fireEvent.click(container.querySelector("[role='button']")!)
    })
})
