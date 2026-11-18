// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, labelsDisabled, outputs, showsCache, slideTimers } from "../../stores"
import { getActiveOutputs } from "../../components/helpers/output"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowTools } from "./ShowTools"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/helpers/output", () => ({ getActiveOutputs: vi.fn(() => []) }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../../components/output/tools/Audio.svelte", () => ({ default: { isla: "Audio" } }))
vi.mock("../../components/output/tools/Overlay.svelte", () => ({ default: { isla: "Overlay" } }))
vi.mock("../../components/output/tools/TimerControls.svelte", () => ({ default: { isla: "TimerControls" } }))
vi.mock("../output/NextTimer", () => ({
    NextTimer: (props: Record<string, unknown>) => <div data-isla="NextTimer" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}))
vi.mock("./tools/Media", () => ({ Media: () => <div data-testid="media-tools" /> }))
vi.mock("./tools/Metadata", () => ({ Metadata: () => <div data-testid="metadata-tools" /> }))
vi.mock("./tools/SlideGroups", () => ({ SlideGroups: () => <div data-testid="slide-groups" /> }))

const tabs = { audio: { name: "tools.audio", icon: "audio" }, media: { name: "tools.media", icon: "media" }, groups: { name: "tools.groups", icon: "groups" }, metadata: { name: "tools.metadata", icon: "info" } }

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    clearIslands()
    vi.clearAllMocks()
})

function setStores(reference?: string) {
    restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(labelsDisabled, false), looseEntry(outputs, {}), looseEntry(showsCache, { s1: reference ? { reference: { type: reference } } : {} }), looseEntry(slideTimers, {})])
    vi.mocked(getActiveOutputs).mockReturnValue([])
}

describe("ShowTools", () => {
    it("muestra el título de la pestaña activa y la isla de audio", () => {
        setStores()
        render(<ShowTools tabs={tabs} active="audio" />)
        expect(screen.getByText("tools.audio")).toBeTruthy()
        expect(islands.Audio).toBeTruthy()
    })

    it("muestra el port React de Media cuando la pestaña es media", () => {
        setStores()
        render(<ShowTools tabs={tabs} active="media" />)
        expect(screen.getByTestId("media-tools")).toBeTruthy()
    })

    it("muestra SlideGroups para la pestaña groups", () => {
        setStores()
        render(<ShowTools tabs={tabs} active="groups" />)
        expect(screen.getByTestId("slide-groups")).toBeTruthy()
    })

    it("no muestra el panel cuando la referencia es lessons", () => {
        setStores("lessons")
        render(<ShowTools tabs={tabs} active="audio" />)
        expect(screen.queryByText("tools.audio")).toBeNull()
        expect(islands.Audio).toBeUndefined()
    })
})
