// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { updateDelayConfig } from "../../../../audio/effects/audioDelay"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { AudioDelay } from "./AudioDelay"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioDelay", () => ({ updateDelayConfig: vi.fn() }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../ui/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(500)}>{label}</button> }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioDelay", () => {
    it("se suscribe al efecto delay con canal e id", () => {
        render(<AudioDelay channelId="ch1" effectId="d1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("delay", expect.any(Function), "ch1", "d1")
    })

    it("muestra los controles de delay, feedback y wet", () => {
        render(<AudioDelay />)
        expect(screen.getByText("audio.delay")).toBeTruthy()
        expect(screen.getByText("audio.feedback")).toBeTruthy()
        expect(screen.getByText("audio.wet")).toBeTruthy()
    })

    it("convierte milisegundos a segundos al cambiar el delay", () => {
        render(<AudioDelay channelId="ch1" effectId="d1" />)
        fireEvent.click(screen.getByText("audio.delay"))
        expect(updateDelayConfig).toHaveBeenCalledWith({ delayTime: 0.5 }, "ch1", "d1")
    })
})
