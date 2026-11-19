// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { updateLimiterConfig } from "../../../../audio/effects/audioLimiter"
import { AudioLimiter } from "./AudioLimiter"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioLimiter", () => ({
    getLimiterReduction: () => -3,
    updateLimiterConfig: vi.fn()
}))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: { getChannelLiveVolume: () => -12 } }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/number-field/NumberField", () => ({
    NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(label === "audio.ceiling" ? -6 : 80)}>{label}</button>
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioLimiter", () => {
    it("se suscribe al efecto limiter", () => {
        render(<AudioLimiter channelId="ch1" effectId="l1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("limiter", expect.any(Function), "ch1", "l1")
    })

    it("muestra techo y release junto a la reducción", () => {
        render(<AudioLimiter />)
        expect(screen.getByText("audio.ceiling")).toBeTruthy()
        expect(screen.getByText("audio.release")).toBeTruthy()
        expect(screen.getByTitle("Gain Reduction").textContent).toContain("-3.0 dB")
    })

    it("escribe el techo cambiado", () => {
        render(<AudioLimiter channelId="ch1" effectId="l1" />)
        fireEvent.click(screen.getByText("audio.ceiling"))
        expect(updateLimiterConfig).toHaveBeenCalledWith({ ceiling: -6 }, "ch1", "l1")
    })

    it("convierte el release de ms a segundos", () => {
        render(<AudioLimiter channelId="ch1" effectId="l1" />)
        fireEvent.click(screen.getByText("audio.release"))
        expect(updateLimiterConfig).toHaveBeenCalledWith({ release: 0.08 }, "ch1", "l1")
    })
})
