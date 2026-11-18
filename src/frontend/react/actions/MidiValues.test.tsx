// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../hooks/useStore", () => ({ useStore: () => null }))
vi.mock("../../IPC/main", () => ({ requestMain: vi.fn(), receiveToMain: () => "id", destroyMain: vi.fn() }))
vi.mock("../../stores", () => ({ popupData: { subscribe: (fn: (v: unknown) => void) => { fn(null); return () => {} } } }))
vi.mock("../../components/actions/midi", () => ({ defaultMidiActionChannels: {}, midiToNote: () => "C0" }))
vi.mock("../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/number-field/NumberField", () => ({ NumberField: ({ label }: { label?: string }) => <div>{label}</div> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div>{label}</div> }))
vi.mock("../ui/toggle-field/ToggleField", () => ({ ToggleField: ({ label }: { label?: string }) => <div>{label}</div> }))

import { MidiValues } from "./MidiValues"

describe("MidiValues", () => {
    afterEach(() => cleanup())

    it("renderiza controles MIDI básicos", () => {
        const { container } = render(<MidiValues value={{ type: "noteon", values: { note: 0, velocity: 0, channel: 1 } } as unknown as never} type="output" />)
        expect(container.textContent).toContain("midi.output")
        expect(container.textContent).toContain("midi.type")
    })
})
