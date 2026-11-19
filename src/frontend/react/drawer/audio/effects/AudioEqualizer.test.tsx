// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioEqualizer as AudioEqualizerEngine, updateEqualizerBands } from "../../../../shared/audio/effects/audioEqualizer"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { AudioEqualizer } from "./AudioEqualizer"

vi.mock("../../../../shared/audio/effects/audioEffectsHelpers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../shared/audio/effects/audioEffectsHelpers")>()),
    subscribeEffect: vi.fn(() => () => {})
}))
vi.mock("../../../../shared/audio/effects/audioEqualizer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../../shared/audio/effects/audioEqualizer")>()),
    updateEqualizerBands: vi.fn()
}))
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../shared/audio/spectrumAnalyzer", () => ({
    SpectrumAnalyzer: class {
        start() {}
        setChannel() {}
        dispose() {}
    }
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("AudioEqualizer", () => {
    it("se suscribe al efecto equalizer con canal e id", () => {
        render(<AudioEqualizer channelId="ch1" effectId="e1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("equalizer", expect.any(Function), "ch1", "e1")
    })

    it("dibuja un control por cada banda por defecto", () => {
        const { container } = render(<AudioEqualizer />)
        expect(container.querySelectorAll("[data-band-index]").length).toBe(AudioEqualizerEngine.getDefaultBands().length)
    })

    it("inicia el analizador de espectro con el canal elegido", () => {
        render(<AudioEqualizer channelId="ch1" />)
        expect(document.querySelector("canvas")).toBeTruthy()
    })

    it("escribe las bandas al arrastrar un control", () => {
        const { container } = render(<AudioEqualizer channelId="ch1" effectId="e1" />)
        const handle = container.querySelector('[data-band-index="0"]') as HTMLElement
        fireEvent.mouseDown(handle, { button: 0 })
        fireEvent.mouseMove(document, { clientX: 120, clientY: 80 })
        expect(updateEqualizerBands).toHaveBeenCalled()
        const bands = vi.mocked(updateEqualizerBands).mock.calls[0][0]
        expect(bands).toHaveLength(AudioEqualizerEngine.getDefaultBands().length)
    })
})
