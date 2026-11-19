// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeAudioEffects, dictionary, popupData } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { AudioEffect } from "./AudioEffect"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

// Los efectos ya son React: verificamos cuál se monta y con qué props.
vi.mock("../drawer/audio/effects/AudioCompressor", () => ({ AudioCompressor: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioCompressor" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioDelay", () => ({ AudioDelay: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioDelay" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioEqualizer", () => ({ AudioEqualizer: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioEqualizer" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioFilter", () => ({ AudioFilter: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioFilter" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioLimiter", () => ({ AudioLimiter: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioLimiter" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioNoiseGate", () => ({ AudioNoiseGate: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioNoiseGate" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioReverb", () => ({ AudioReverb: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioReverb" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioStereoShaper", () => ({ AudioStereoShaper: ({ effectId, channelId }: { effectId?: string; channelId?: string }) => <div data-efecto="AudioStereoShaper" data-effect-id={effectId} data-channel-id={channelId} /> }))
vi.mock("../drawer/audio/effects/AudioEffectPresets", () => ({
    AudioEffectPresets: ({ effectKey, channelId, effectId }: { effectKey?: string; channelId?: string; effectId?: string }) => <div data-efecto="AudioEffectPresets" data-effect-key={effectKey} data-channel-id={channelId} data-effect-id={effectId} />
}))

let restaurar: () => void = () => {}
function montar(data: object, activo = "") {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activeAudioEffects, activo), storeEntry(dictionary, {})] as never)
    return render(<AudioEffect />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioEffect", () => {
    it("monta el efecto de popupData con effectId y channelId", () => {
        montar({ channelId: "ch1", effect: "reverb", effectId: "r1" })
        const efecto = document.querySelector("[data-efecto='AudioReverb']")
        expect(efecto?.getAttribute("data-effect-id")).toBe("r1")
        expect(efecto?.getAttribute("data-channel-id")).toBe("ch1")
    })

    it("sin effect usa el ecualizador y sin canal main", () => {
        montar({})
        expect(document.querySelector("[data-efecto='AudioEqualizer']")).toBeTruthy()
        expect(get(activeAudioEffects)).toBe("main")
    })

    it("un efecto desconocido no monta nada", () => {
        montar({ effect: "nada" })
        expect(document.querySelector("[data-efecto]")).toBeNull()
    })

    it("el canal activo se sincroniza con el del popup", () => {
        montar({ channelId: "ch2" }, "otro")
        expect(get(activeAudioEffects)).toBe("ch2")
    })

    it("opciones muestra los presets con el effectKey del popup", () => {
        montar({ channelId: "ch1", effect: "delay", effectId: "d1" })
        expect(document.querySelector("[data-efecto='AudioEffectPresets']")).toBeNull()
        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        const presets = document.querySelector("[data-efecto='AudioEffectPresets']")
        expect(presets?.getAttribute("data-effect-key")).toBe("delay")
        expect(presets?.getAttribute("data-channel-id")).toBe("ch1")
        expect(presets?.getAttribute("data-effect-id")).toBe("d1")
        expect(document.querySelector("button.popup-options")?.classList.contains("active")).toBe(true)
    })
})
