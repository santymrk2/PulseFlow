// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => null }))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), receiveToMain: () => "id", destroyMain: vi.fn() }))
vi.mock("../../shared/core/stores", () => ({ popupData: { subscribe: (fn: (v: unknown) => void) => { fn(null); return () => {} } } }))
vi.mock("./logic/midi", () => ({ defaultMidiActionChannels: {}, midiToNote: () => "C0" }))
vi.mock("../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: ({ label }: { label?: string }) => <div>{label}</div> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div>{label}</div> }))
vi.mock("../../shared/ui/kit/toggle-field/ToggleField", () => ({ ToggleField: ({ label }: { label?: string }) => <div>{label}</div> }))

import { MidiValues } from "./MidiValues"

describe("MidiValues", () => {
    afterEach(() => cleanup())

    it("renderiza controles MIDI básicos", () => {
        const { container } = render(<MidiValues value={{ type: "noteon", values: { note: 0, velocity: 0, channel: 1 } } as unknown as never} type="output" />)
        expect(container.textContent).toContain("midi.output")
        expect(container.textContent).toContain("midi.type")
    })
})
