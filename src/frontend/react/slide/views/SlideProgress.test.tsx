// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeProject, activeShow, allOutputs, groups, outputs, projects, showsCache } from "../../../stores"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { SlideProgress } from "./SlideProgress"

vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/helpers/dynamicItemText", () => ({ slideTrackerParts: vi.fn(() => ({ current: "2" })) }))
vi.mock("../../../components/helpers/output", () => ({ getFirstActiveOutput: vi.fn(() => ({ id: "out1" })) }))
vi.mock("../../../components/helpers/projectProgress", () => ({
    getProjectItems: vi.fn(() => [{ index: 0, showId: "s1" }]),
    getCurrentProjectIndexes: vi.fn(() => [0]),
    getProjectItemLabel: vi.fn(() => "Show 1")
}))
vi.mock("../../../components/helpers/show", () => ({
    getGroupName: vi.fn((_, __, name) => name),
    getLayoutRef: vi.fn(() => [])
}))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(outputs, { out1: { out: { slide: { id: "s1", index: 1 } } } }), looseEntry(allOutputs, {}), looseEntry(showsCache, {}), looseEntry(groups, {}), looseEntry(projects, {}), storeEntry(activeProject, ""), looseEntry(activeShow, null)])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("SlideProgress", () => {
    it("number_muestra_el_numero_y_el_total", () => {
        const { container } = render(<SlideProgress tracker={{ type: "number" }} />)
        expect(container.textContent).toContain("2")
        expect(container.querySelector(".autoFontSize")).toBeTruthy()
    })

    it("bar_calcula_el_ancho_del_progreso", () => {
        const { container } = render(<SlideProgress tracker={{ type: "bar" }} />)
        // sin slides en caché, slidesLength es 0 → ancho 0%
        expect((container.firstElementChild?.firstElementChild as HTMLElement).style.width).toBe("0%")
    })

    it("project_muestra_los_items_del_proyecto", () => {
        const { container } = render(<SlideProgress tracker={{ type: "project" }} />)
        expect(container.textContent).toContain("Show 1")
    })

    it("aplica_el_accent_como_variable_css", () => {
        const { container } = render(<SlideProgress tracker={{ type: "number", accent: "#f00" }} />)
        expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--accent")).toBe("#f00")
    })
})
