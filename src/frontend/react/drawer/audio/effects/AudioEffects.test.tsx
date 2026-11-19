// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeAudioEffects, activePopup, audioEffects, popupData } from "../../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../test/storeTestKit"
import { AudioEffects } from "./AudioEffects"

vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))

const STACK = [
    { id: "c1", type: "compressor", enabled: true, config: { enabled: true } },
    { id: "r1", type: "reverb", enabled: false, config: { enabled: false } }
]

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(audioEffects, { ch1: { stack: STACK } }), looseEntry(activeAudioEffects, "ch1"), looseEntry(activePopup, ""), looseEntry(popupData, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioEffects", () => {
    it("muestra el stack del canal activo con sus nombres traducidos", () => {
        render(<AudioEffects />)
        expect(screen.getByText("audio.compressor")).toBeTruthy()
        expect(screen.getByText("audio.reverb")).toBeTruthy()
    })

    it("alterna el enabled del efecto al pulsar su botón de encendido", () => {
        render(<AudioEffects />)
        const buttons = document.querySelectorAll('[data-title="actions.disable"]')
        fireEvent.click(buttons[0])
        expect((get(audioEffects).ch1.stack as { enabled: boolean }[])[0].enabled).toBe(false)
    })

    it("abre el popup del efecto al pulsar su tarjeta", () => {
        render(<AudioEffects />)
        fireEvent.click(screen.getByText("audio.compressor"))
        expect(get(popupData)).toEqual({ channelId: "ch1", effectId: "c1", effect: "compressor" })
        expect(get(activePopup)).toBe("audio_effect")
    })

    it("abre el popup para agregar un efecto", () => {
        render(<AudioEffects />)
        fireEvent.click(screen.getByText(/new\.effect/))
        expect(get(popupData)).toEqual({ channelId: "ch1" })
        expect(get(activePopup)).toBe("add_audio_effect")
    })

    it("muestra el estado vacío cuando el stack está vacío", () => {
        audioEffects.set({ ch1: { stack: [] } } as never)
        render(<AudioEffects />)
        expect(screen.getByText(/empty\.general/)).toBeTruthy()
    })
})
