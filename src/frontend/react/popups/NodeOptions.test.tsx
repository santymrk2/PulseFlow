// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { AudioPlayer } from "../../audio/audioPlayer"
import { audioChannelsData, audioRouting, popupData, special } from "../../shared/core/stores"
import { clearFields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { NodeOptions } from "./NodeOptions"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: { updateVolume: vi.fn() } }))
vi.mock("../../audio/audioMicrophone", () => ({ AudioMicrophone: { setChannelCount: vi.fn() } }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(info: object, routing: object = { channels: [], connections: [] }, channels: object = {}, specialData: object = {}) {
    restaurar = setStoresForTest([storeEntry(popupData, info), looseEntry(audioRouting, routing), looseEntry(audioChannelsData, channels), looseEntry(special, specialData)] as never)
    return render(<NodeOptions />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("NodeOptions", () => {
    it("icecast_escribe_los_campos_en_special_y_no_muestra_el_resto", () => {
        montar({ nodeId: "icecast" })
        fire("IP", "onChange", "10.0.0.1")
        expect(get(special).icecast.host).toBe("10.0.0.1")
        fire("settings.port", "onChange", 9000)
        expect(get(special).icecast.port).toBe(9000)
        fire("settings.enabled", "onChange", false)
        expect(get(special).icecast.enabled).toBe(false)
        expect(screen.queryByText("Canales de audio")).toBeNull()
    })

    it("icecast_usa_los_valores_por_defecto_cuando_no_hay_configuración", () => {
        const { container } = montar({ nodeId: "icecast" })
        expect(container.querySelector('[data-field="IP"]')?.getAttribute("data-value")).toBe("localhost")
        expect(container.querySelector('[data-field="Mountpoint"]')?.getAttribute("data-value")).toBe("/stream.opus")
        expect(container.querySelector('[data-field="remote.password"]')?.getAttribute("data-value")).toBe("hackme")
    })

    it("canal_principal_convierte_dB_a_gain_y_llama_a_updateVolume", () => {
        montar({ nodeId: "main" }, { channels: [], connections: [] }, { main: { volume: 1, isMuted: false } })
        fire("media.volume (dB)", "onChange", 6)
        expect(get(audioChannelsData).main.volume).toBeCloseTo(Math.pow(10, 6 / 20))
        expect(AudioPlayer.updateVolume).toHaveBeenCalled()
        fire("audio.volume_fade_duration (ms)", "onChange", 500)
        expect(get(audioChannelsData).main.fadeDuration).toBe(500)
        fire("audio.delay (ms)", "onChange", 20)
        expect(get(audioChannelsData).main.delay).toBe(20)
    })

    it("el_botón_de_mute_escribe_isMuted", () => {
        montar({ nodeId: "main" }, { channels: [], connections: [] }, { main: { volume: 1 } })
        const mute = [...document.querySelectorAll("button")].find((b) => b.getAttribute("title") === "actions.mute")
        expect(mute).toBeTruthy()
        fireEvent.click(mute as HTMLElement)
        expect(get(audioChannelsData).main.isMuted).toBe(true)
    })

    it("mic_guarda_los_canales_en_audioRouting_y_llama_a_setChannelCount", () => {
        montar({ nodeId: "mic_sub_abc123", type: "mic", channels: 2, name: "Mic" }, { channels: [], connections: [] })
        fire("audio.channels", "onChange", 8)
        expect(get(audioRouting)?.inputs?.[0]).toMatchObject({ id: "mic_sub_abc123", deviceId: "abc123", type: "mic", channels: 8, name: "Mic" })
        expect(AudioMicrophone.setChannelCount).toHaveBeenCalledWith("abc123", 8)
    })

    it("mic_actualiza_un_input_existente_en_lugar_de_agregarlo", () => {
        montar({ nodeId: "mic0", type: "mic" }, { channels: [], connections: [], inputs: [{ id: "mic0", name: "Mic", type: "mic", channels: 2 }] })
        fire("audio.channels", "onChange", 4)
        expect(get(audioRouting)?.inputs?.length).toBe(1)
        expect(get(audioRouting)?.inputs?.[0].channels).toBe(4)
        expect(AudioMicrophone.setChannelCount).toHaveBeenCalledWith("mic0", 4)
    })

    it("vacia_popupData_al_montar_y_no_muestra_nada_sin_tipo_conocido", () => {
        const { container } = montar({ nodeId: "otro" })
        expect(get(popupData)).toEqual({})
        expect(container.querySelector('[data-field="audio.channels"]')).toBeNull()
    })
})
