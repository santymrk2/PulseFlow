// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { updateFilterConfig } from "../../../../audio/effects/audioFilter"
import { AudioFilter } from "./AudioFilter"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioFilter", () => ({
    GAIN_FILTER_TYPES: ["peaking", "lowshelf", "highshelf"],
    updateFilterConfig: vi.fn()
}))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../ui/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(1000)}>{label}</button> }))
vi.mock("../../../ui/select-field/SelectField", () => ({ SelectField: ({ label, onChange }: { label: string; onChange?: (value: string | null) => void }) => <button onClick={() => onChange?.("highpass")}>{label}</button> }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioFilter", () => {
    it("se suscribe al efecto filter", () => {
        render(<AudioFilter channelId="ch1" effectId="f1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("filter", expect.any(Function), "ch1", "f1")
    })

    it("muestra tipo, frecuencia y factor Q", () => {
        render(<AudioFilter />)
        expect(screen.getByText("audio.filter_type")).toBeTruthy()
        expect(screen.getByText("audio.frequency")).toBeTruthy()
        expect(screen.getByText("audio.q_factor")).toBeTruthy()
    })

    it("escribe el tipo seleccionado", () => {
        render(<AudioFilter channelId="ch1" effectId="f1" />)
        fireEvent.click(screen.getByText("audio.filter_type"))
        expect(updateFilterConfig).toHaveBeenCalledWith({ type: "highpass" }, "ch1", "f1")
    })

    it("escribe la frecuencia cambiada", () => {
        render(<AudioFilter channelId="ch1" effectId="f1" />)
        fireEvent.click(screen.getByText("audio.frequency"))
        expect(updateFilterConfig).toHaveBeenCalledWith({ frequency: 1000 }, "ch1", "f1")
    })
})
