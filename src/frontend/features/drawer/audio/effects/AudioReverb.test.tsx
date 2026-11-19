// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { updateReverbConfig } from "../../../../shared/audio/effects/audioReverb"
import { AudioReverb } from "./AudioReverb"

vi.mock("../../../../shared/audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../shared/audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../shared/audio/effects/audioReverb", () => ({ updateReverbConfig: vi.fn() }))
vi.mock("../../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(40)}>{label}</button> }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioReverb", () => {
    it("se suscribe al efecto reverb", () => {
        render(<AudioReverb channelId="ch1" effectId="r1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("reverb", expect.any(Function), "ch1", "r1")
    })

    it("muestra room size, dampening y wet", () => {
        render(<AudioReverb />)
        expect(screen.getByText("audio.room_size")).toBeTruthy()
        expect(screen.getByText("audio.dampening")).toBeTruthy()
        expect(screen.getByText("audio.wet")).toBeTruthy()
    })

    it("escribe el valor normalizado al cambiar room size", () => {
        render(<AudioReverb channelId="ch1" effectId="r1" />)
        fireEvent.click(screen.getByText("audio.room_size"))
        expect(updateReverbConfig).toHaveBeenCalledWith({ roomSize: 0.4 }, "ch1", "r1")
    })
})
