// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { updateCompressorConfig } from "../../../../shared/audio/effects/audioCompressor"
import { AudioCompressor } from "./AudioCompressor"

vi.mock("../../../../shared/audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../shared/audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../shared/audio/effects/audioCompressor", () => ({
    getCompressorReduction: () => -6,
    updateCompressorConfig: vi.fn()
}))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: { getChannelLiveVolume: () => -20 } }))
vi.mock("../../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/number-field/NumberField", () => ({
    NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(label === "audio.threshold" ? -30 : 5)}>{label}</button>
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioCompressor", () => {
    it("se suscribe al efecto compressor", () => {
        render(<AudioCompressor channelId="ch1" effectId="c1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("compressor", expect.any(Function), "ch1", "c1")
    })

    it("muestra los cinco controles y la reducción de ganancia", () => {
        render(<AudioCompressor />)
        for (const label of ["audio.threshold", "audio.ratio", "audio.knee", "audio.attack", "audio.release"]) {
            expect(screen.getByText(label)).toBeTruthy()
        }
        expect(screen.getByTitle("Gain Reduction").textContent).toContain("-6.0 dB")
    })

    it("escribe el umbral cambiado", () => {
        render(<AudioCompressor channelId="ch1" effectId="c1" />)
        fireEvent.click(screen.getByText("audio.threshold"))
        expect(updateCompressorConfig).toHaveBeenCalledWith({ threshold: -30 }, "ch1", "c1")
    })

    it("convierte el attack de ms a segundos", () => {
        render(<AudioCompressor channelId="ch1" effectId="c1" />)
        fireEvent.click(screen.getByText("audio.attack"))
        expect(updateCompressorConfig).toHaveBeenCalledWith({ attack: 0.005 }, "ch1", "c1")
    })
})
