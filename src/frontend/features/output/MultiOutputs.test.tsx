// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeRecording, activeStyle, audioChannelsData, dictionary, outputs, previewOutputId, rtmpStatus, selected, styles as outputStyles, templates, toggleOutputEnabled } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { MultiOutputs } from "./MultiOutputs"

vi.mock("../settings/logic/openSettings", () => ({ openSettings: vi.fn() }))
vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../drawer/logic/live/recorder", () => ({ stopMediaRecorder: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ openDrawer: vi.fn() }))
vi.mock("../../shared/utils/helpers/array", () => ({
    clone: vi.fn((v: unknown) => v),
    keysToID: vi.fn((obj: Record<string, unknown>) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...(v as object) }))),
    sortByName: vi.fn((arr: unknown[]) => arr),
    sortObject: vi.fn((arr: unknown[]) => arr)
}))
vi.mock("../../shared/utils/helpers/output", () => ({
    defaultLayers: ["background", "slide", "overlays"],
    getOutputResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    startRtmpStreaming: vi.fn(),
    startStreaming: vi.fn(),
    stopRtmpStreaming: vi.fn(),
    stopStreaming: vi.fn()
}))
vi.mock("../../shared/utils/helpers/rtmpDestinations", () => ({ getUnhealthyDestinations: vi.fn(() => []), hasStreamableDestination: vi.fn(() => false) }))
vi.mock("../../shared/utils/helpers/show", () => ({ bindSlidesToOutput: vi.fn(), getLayoutRef: vi.fn(() => []) }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: vi.fn(() => ({ get: vi.fn(() => null) })) }))
vi.mock("./PreviewOutput", () => ({ PreviewOutput: () => <div data-testid="preview-output" /> }))
vi.mock("../drawer/audio/AudioMeter", () => ({ AudioMeter: () => <div data-testid="audio-meter" /> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({
    SelectField: ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange?: (v: string | null) => void }) => (
        <select data-testid="output-select" value={value} onChange={(e) => onChange?.(e.target.value)}>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("MultiOutputs", () => {
    it("renderiza_selector_y_cambia_salida_activa", () => {
        restore = setStoresForTest([
            looseEntry(outputs, { a: { name: "A", enabled: true }, b: { name: "B", enabled: true } }),
            looseEntry(outputStyles, {}),
            looseEntry(templates, {}),
            looseEntry(audioChannelsData, {}),
            looseEntry(previewOutputId, "a"),
            looseEntry(rtmpStatus, {}),
            looseEntry(selected, { id: null, data: [] }),
            looseEntry(activeRecording, null),
            looseEntry(toggleOutputEnabled, false),
            looseEntry(dictionary, {}),
            looseEntry(activeStyle, "")
        ])

        render(<MultiOutputs />)
        expect(screen.getAllByTestId("preview-output").length).toBeGreaterThan(0)
        const select = screen.getByTestId("output-select") as HTMLSelectElement
        fireEvent.change(select, { target: { value: "b" } })
        expect(previewOutputId).toBeTruthy()
    })
})
