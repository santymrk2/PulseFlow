// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeAudioEffects, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { AudioEffect } from "./AudioEffect"

vi.mock("../../utils/common", () => commonMock())
// Los efectos siguen siendo Svelte: acá sólo importa cuál se monta y con qué props
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: ({ component, props }: { component: { isla: string }; props?: object }) => <div data-isla={component.isla} data-props={JSON.stringify(props ?? {})} /> }))
vi.mock("../../components/drawer/audio/effects/AudioCompressor.svelte", () => ({ default: { isla: "AudioCompressor" } }))
vi.mock("../../components/drawer/audio/effects/AudioDelay.svelte", () => ({ default: { isla: "AudioDelay" } }))
vi.mock("../../components/drawer/audio/effects/AudioEffectPresets.svelte", () => ({ default: { isla: "AudioEffectPresets" } }))
vi.mock("../../components/drawer/audio/effects/AudioEqualizer.svelte", () => ({ default: { isla: "AudioEqualizer" } }))
vi.mock("../../components/drawer/audio/effects/AudioFilter.svelte", () => ({ default: { isla: "AudioFilter" } }))
vi.mock("../../components/drawer/audio/effects/AudioLimiter.svelte", () => ({ default: { isla: "AudioLimiter" } }))
vi.mock("../../components/drawer/audio/effects/AudioNoiseGate.svelte", () => ({ default: { isla: "AudioNoiseGate" } }))
vi.mock("../../components/drawer/audio/effects/AudioReverb.svelte", () => ({ default: { isla: "AudioReverb" } }))
vi.mock("../../components/drawer/audio/effects/AudioStereoShaper.svelte", () => ({ default: { isla: "AudioStereoShaper" } }))

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
    it("monta_el_efecto_de_popupData_con_effectId_y_channelId", () => {
        const { container } = montar({ channelId: "ch1", effect: "reverb", effectId: "r1" })
        const isla = container.querySelector("[data-isla='AudioReverb']") as HTMLElement
        expect(JSON.parse(isla.dataset.props ?? "{}")).toEqual({ effectId: "r1", channelId: "ch1" })
    })

    it("sin_effect_usa_el_ecualizador_y_sin_canal_main", () => {
        const { container } = montar({})
        expect(container.querySelector("[data-isla='AudioEqualizer']")).toBeTruthy()
        expect(get(activeAudioEffects)).toBe("main")
    })

    it("un_efecto_desconocido_no_monta_nada", () => {
        const { container } = montar({ effect: "nada" })
        expect(container.querySelector("[data-isla]")).toBeNull()
    })

    it("el_canal_activo_se_sincroniza_con_el_del_popup", () => {
        montar({ channelId: "ch2" }, "otro")
        expect(get(activeAudioEffects)).toBe("ch2")
    })

    it("opciones_muestra_y_oculta_los_presets", () => {
        const { container } = montar({ channelId: "ch1", effect: "delay", effectId: "d1" })
        expect(container.querySelector("[data-isla='AudioEffectPresets']")).toBeNull()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        const presets = container.querySelector("[data-isla='AudioEffectPresets']") as HTMLElement
        expect(JSON.parse(presets.dataset.props ?? "{}")).toEqual({ effectKey: "delay", channelId: "ch1", effectId: "d1" })
        expect(container.querySelector("button.popup-options")?.classList.contains("active")).toBe(true)
    })
})
