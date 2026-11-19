// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { updateStereoShaperConfig } from "../../../../audio/effects/audioStereoShaper"
import { AudioStereoShaper } from "./AudioStereoShaper"

vi.mock("../../../../audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../audio/effects/audioStereoShaper", () => ({ updateStereoShaperConfig: vi.fn() }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../ui/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => <button onClick={() => onChange?.(150)}>{label}</button> }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioStereoShaper", () => {
    it("se suscribe al efecto stereoShaper", () => {
        render(<AudioStereoShaper channelId="ch1" effectId="s1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("stereoShaper", expect.any(Function), "ch1", "s1")
    })

    it("muestra el ancho por defecto como Stereo", () => {
        const { container } = render(<AudioStereoShaper />)
        expect(screen.getByText("audio.width")).toBeTruthy()
        expect(container.querySelector("svg")?.textContent).toContain("Stereo")
    })

    it("actualiza el ancho", () => {
        render(<AudioStereoShaper channelId="ch1" effectId="s1" />)
        fireEvent.click(screen.getByText("audio.width"))
        expect(updateStereoShaperConfig).toHaveBeenCalledWith({ width: 150 }, "ch1", "s1")
    })
})
