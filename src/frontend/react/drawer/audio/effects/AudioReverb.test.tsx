// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { updateReverbConfig } from "../../../../audio/effects/audioReverb"
import { AudioReverb } from "./AudioReverb"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioReverb", () => ({ updateReverbConfig: vi.fn() }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../ui/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(40)}>{label}</button> }))

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
