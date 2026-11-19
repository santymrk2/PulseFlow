// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { updateDelayConfig } from "../../../../shared/audio/effects/audioDelay"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { AudioDelay } from "./AudioDelay"

vi.mock("../../../../shared/audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../shared/audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../shared/audio/effects/audioDelay", () => ({ updateDelayConfig: vi.fn() }))
vi.mock("../../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(500)}>{label}</button> }))

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
