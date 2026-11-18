// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeAudioEffects, activePopup, dataPath, special } from "../../../stores"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { AudioInfo } from "./AudioInfo"

const fading = vi.hoisted(() => ({ fadein: vi.fn(), fadeout: vi.fn(), audible: false, fading: false }))
vi.mock("../../../audio/audioFading", () => ({
    fadeinAllPlayingAudio: () => fading.fadein(),
    fadeoutAllPlayingAudio: () => fading.fadeout(),
    get isAllAudioFading() {
        return fading.fading
    }
}))
vi.mock("../../../components/media/video/videoPlayer", () => ({ VideoPlayer: { hasAudibleVideo: () => fading.audible } }))
vi.mock("../../../IPC/main", () => ({ sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener"), destroyMain: vi.fn() }))
vi.mock("../../../components/drawer/audio/AudioMixers.svelte", () => ({ default: { isla: "AudioMixers" } }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../audio/effects/AudioEffects", () => ({ AudioEffects: () => <div data-testid="efectos" /> }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {}, wait: () => Promise.resolve() }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    fading.audible = false
    fading.fading = false
    restaurar = setStoresForTest([looseEntry(activeAudioEffects, ""), looseEntry(dataPath, "/datos"), looseEntry(special, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearIslands()
})

describe("AudioInfo", () => {
    it("monta AudioMixers y la barra de ajustes cuando no hay efectos activos", () => {
        render(<AudioInfo />)
        expect(islands["AudioMixers"]).toBeTruthy()
        expect(document.querySelector('[data-title="audio.settings"]')).toBeTruthy()
    })

    it("muestra los efectos React cuando hay un canal activo, sin barra de ajustes", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeAudioEffects, "main"), looseEntry(dataPath, "/datos"), looseEntry(special, {})])
        render(<AudioInfo />)
        expect(screen.getByTestId("efectos")).toBeTruthy()
        expect(document.querySelector('[data-title="audio.settings"]')).toBeNull()
    })

    it("abre los ajustes y escribe la duración del fade", () => {
        render(<AudioInfo />)
        fireEvent.click(document.querySelector('[data-title="audio.settings"]') as HTMLElement)
        const input = screen.getByRole("textbox") as HTMLInputElement
        fireEvent.change(input, { target: { value: "2.5" } })
        fireEvent.blur(input)
        expect(get(special).audio_fade_duration).toBe(2.5)
    })

    it("silencia el audio activo al activar 'mute when video plays' con video audible", () => {
        fading.audible = true
        render(<AudioInfo />)
        fireEvent.click(document.querySelector('[data-title="audio.settings"]') as HTMLElement)
        fireEvent.click(document.querySelector('[data-title="audio.mute_when_video_plays"]') as HTMLElement)
        expect(fading.fadeout).toHaveBeenCalled()
        expect(get(special).muteAudioWhenVideoPlays).toBe(true)
    })

    it("abre el popup now_playing desde los ajustes", () => {
        render(<AudioInfo />)
        fireEvent.click(document.querySelector('[data-title="audio.settings"]') as HTMLElement)
        fireEvent.click(screen.getByText("[popup.now_playing]"))
        expect(get(activePopup)).toBe("now_playing")
    })
})
