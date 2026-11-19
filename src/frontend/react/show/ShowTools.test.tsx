// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, labelsDisabled, outputs, showsCache, slideTimers } from "../../shared/core/stores"
import { getActiveOutputs } from "../../components/helpers/output"
import { _show } from "../../components/helpers/shows"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowTools } from "./ShowTools"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/helpers/output", () => ({ getActiveOutputs: vi.fn(() => []) }))
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../output/Audio", () => ({ Audio: () => <div data-isla="Audio" /> }))
vi.mock("../output/ToolsOverlay", () => ({ ToolsOverlay: () => <div data-isla="Overlay" /> }))
vi.mock("../output/TimerControls", () => ({ TimerControls: () => <div data-isla="TimerControls" /> }))
vi.mock("../output/NextTimer", () => ({
    NextTimer: (props: Record<string, unknown>) => <div data-isla="NextTimer" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}))
vi.mock("./tools/Media", () => ({ Media: () => <div data-testid="media-tools" /> }))
vi.mock("./tools/Metadata", () => ({ Metadata: () => <div data-testid="metadata-tools" /> }))
vi.mock("./tools/SlideGroups", () => ({ SlideGroups: () => <div data-testid="slide-groups" /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(reference?: string, refs: unknown[][] = []) {
    restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(labelsDisabled, false), looseEntry(outputs, {}), looseEntry(showsCache, { s1: reference ? { reference: { type: reference } } : {} }), looseEntry(slideTimers, {})])
    vi.mocked(getActiveOutputs).mockReturnValue([])
    vi.mocked(_show).mockImplementation(() => ({ layouts: () => ({ ref: () => refs }) }) as never)
}

describe("ShowTools", () => {
    it("muestra el título de la pestaña activa y la isla de audio", () => {
        setStores()
        render(<ShowTools />)
        expect(screen.getByText("tabs.audio")).toBeTruthy()
        expect(document.querySelector('[data-isla="Audio"]')).toBeTruthy()
    })

    it("oculta la pestaña media cuando el show no tiene multimedia", () => {
        setStores()
        render(<ShowTools />)
        expect(screen.queryByTitle("tools.media")).toBeNull()
    })

    it("muestra el port React de Media al elegir la pestaña cuando el show tiene multimedia", () => {
        setStores(undefined, [[{ data: { background: "bg.png" } }]])
        render(<ShowTools />)
        fireEvent.click(screen.getByTitle("tools.media"))
        expect(screen.getByTestId("media-tools")).toBeTruthy()
    })

    it("muestra SlideGroups al elegir la pestaña groups", () => {
        setStores()
        render(<ShowTools />)
        fireEvent.click(screen.getByTitle("tools.groups"))
        expect(screen.getByTestId("slide-groups")).toBeTruthy()
    })

    it("no muestra el panel cuando la referencia es lessons", () => {
        setStores("lessons")
        render(<ShowTools />)
        expect(screen.queryByText("tabs.audio")).toBeNull()
        expect(document.querySelector('[data-isla="Audio"]')).toBeNull()
    })
})
