// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { updateNoiseGateConfig } from "../../../../audio/effects/audioNoiseGate"
import { AudioNoiseGate } from "./AudioNoiseGate"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioNoiseGate", () => ({ updateNoiseGateConfig: vi.fn() }))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: { getChannelLiveVolume: () => -20 } }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/number-field/NumberField", () => ({
    NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(label === "audio.threshold" ? -50 : 10)}>{label}</button>
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioNoiseGate", () => {
    it("se suscribe al efecto noiseGate", () => {
        render(<AudioNoiseGate channelId="ch1" effectId="g1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("noiseGate", expect.any(Function), "ch1", "g1")
    })

    it("muestra el estado abierto cuando la señal supera el umbral", () => {
        render(<AudioNoiseGate />)
        for (const label of ["audio.threshold", "audio.hysteresis", "audio.attack", "audio.release"]) {
            expect(screen.getByText(label)).toBeTruthy()
        }
        expect(screen.getByText("OPEN")).toBeTruthy()
    })

    it("escribe el umbral cambiado", () => {
        render(<AudioNoiseGate channelId="ch1" effectId="g1" />)
        fireEvent.click(screen.getByText("audio.threshold"))
        expect(updateNoiseGateConfig).toHaveBeenCalledWith({ threshold: -50 }, "ch1", "g1")
    })

    it("convierte el ataque de ms a segundos", () => {
        render(<AudioNoiseGate channelId="ch1" effectId="g1" />)
        fireEvent.click(screen.getByText("audio.attack"))
        expect(updateNoiseGateConfig).toHaveBeenCalledWith({ attack: 0.01 }, "ch1", "g1")
    })
})
