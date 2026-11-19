// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addEffectToStack } from "../../audio/effects/audioEffectsHelpers"
import { activeAudioEffects, activePopup, dictionary, popupData } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { AddAudioEffect } from "./AddAudioEffect"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/effects/audioEffectsHelpers", () => ({
    EFFECTS_LIST: [
        { id: "equalizer", label: "audio_effects.equalizer", description: "audio_effects.equalizer_desc", color: "#112233" },
        { id: "reverb", label: "audio_effects.reverb", description: "audio_effects.reverb_desc", color: "#445566" }
    ],
    addEffectToStack: vi.fn((effect: string) => ({ id: `${effect}_1` }))
}))

let restaurar: () => void = () => {}
function montar(data: object, canal = "") {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activeAudioEffects, canal), storeEntry(activePopup, "add_audio_effect"), storeEntry(dictionary, { audio_effects: { equalizer: "Ecualizador", reverb: "Reverb" } })] as never)
    return render(<AddAudioEffect />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AddAudioEffect", () => {
    it("lista_un_boton_por_efecto", () => {
        montar({})
        expect(screen.getByText("Ecualizador")).toBeTruthy()
        expect(screen.getByText("Reverb")).toBeTruthy()
    })

    it("elegir_agrega_el_efecto_al_canal_de_popupData_y_abre_audio_effect", () => {
        montar({ channelId: "ch1" }, "otro")
        fireEvent.click(screen.getByText("Reverb"))
        expect(addEffectToStack).toHaveBeenCalledWith("reverb", "ch1")
        expect(get(popupData)).toEqual({ channelId: "ch1", effectId: "reverb_1", effect: "reverb" })
        expect(get(activePopup)).toBe("audio_effect")
    })

    it("sin_canal_en_popupData_usa_activeAudioEffects_y_si_no_main", () => {
        montar({}, "activo")
        fireEvent.click(screen.getByText("Ecualizador"))
        expect(addEffectToStack).toHaveBeenLastCalledWith("equalizer", "activo")
        cleanup()
        restaurar()
        montar({}, "")
        fireEvent.click(screen.getByText("Ecualizador"))
        expect(addEffectToStack).toHaveBeenLastCalledWith("equalizer", "main")
    })

    it("cada_boton_lleva_el_borde_con_el_color_del_efecto", () => {
        montar({})
        expect(screen.getByText("Reverb").closest("button")?.style.borderLeft).toContain("4px solid")
    })
})
