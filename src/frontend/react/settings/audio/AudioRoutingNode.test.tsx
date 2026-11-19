// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { activePopup, dictionary, playingAudio, popupData, special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { AudioRoutingNode, type AudioRoutingNodeProps } from "./AudioRoutingNode"
import styles from "./AudioRoutingNode.module.css"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioMicrophone", () => ({ AudioMicrophone: { start: vi.fn() } }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../drawer/audio/AudioMeter", () => ({ AudioMeter: ({ channelId }: { channelId: string }) => <div data-meter={channelId} /> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(playingAudio, {}), storeEntry(special, {}), storeEntry(popupData, {}), storeEntry(activePopup, null), storeEntry(dictionary, { midi: { channel: "Canal" }, audio: { sidechain: "Sidechain" }, actions: { muted: "Silenciado" }, tabs: { effects: "Efectos" } })] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})
afterAll(() => vi.unstubAllGlobals())

const handlers = () => ({ onMouseDown: vi.fn(), onMouseEnter: vi.fn(), onMouseLeave: vi.fn(), onMouseEnterPort: vi.fn(), onMouseLeavePort: vi.fn(), onHoverPort: vi.fn(), onHoverPortEnd: vi.fn(), onPortContextMenu: vi.fn() })
const montar = (props: Partial<AudioRoutingNodeProps> & Pick<AudioRoutingNodeProps, "id" | "name" | "type" | "nodeType">) => {
    const h = handlers()
    const view = render(<AudioRoutingNode {...h} {...props} />)
    return { h, ...view }
}
const card = () => document.querySelector(".node-card") as HTMLElement
const q = (sel: string) => document.querySelector(sel) as HTMLElement

describe("AudioRoutingNode", () => {
    it("renderiza_lo_principal_de_una_entrada", () => {
        montar({ id: "metronome", name: "Metrónomo", type: "metronome", nodeType: "input" })
        expect(card().getAttribute("data-node-id")).toBe("metronome")
        expect(card().id).toBe("metronome")
        expect(card().classList.contains("metronome")).toBe(true)
        expect(q(".card-content, [class*=card-content]").textContent).toBe("Metrónomo")
        expect(document.querySelector('[data-meter="metronome"]')).toBeTruthy()
        expect(document.querySelectorAll(".port-in")).toHaveLength(0)
        expect(document.querySelectorAll(".port-out")).toHaveLength(1)
    })

    it("el_nombre_de_un_nodo_que_no_es_canal_se_inserta_como_html", () => {
        montar({ id: "output_window", name: 'Pantallas <span class="x">(v)</span>', type: "output_window", nodeType: "input" })
        expect(document.querySelector("span.x")?.textContent).toBe("(v)")
    })

    it("conserva_la_clase_de_menu_contextual_del_canal_y_la_del_principal", () => {
        montar({ id: "channel_a", name: "A", type: "channel", nodeType: "channel" })
        expect(card().classList.contains("context")).toBe(true)
        expect(card().classList.contains("#audio_channel")).toBe(true)
        cleanup()
        montar({ id: "main", name: "Main", type: "channel", nodeType: "channel" })
        expect(card().classList.contains("#audio_channel_main")).toBe(true)
        expect(card().classList.contains("#audio_channel")).toBe(false)
    })

    it("un_canal_tiene_puerto_in_y_sidechain_y_muestra_silenciado_y_efectos", () => {
        montar({ id: "channel_a", name: "A", type: "channel", nodeType: "channel", isMuted: true, hasEffects: true, icon: "display" })
        expect(document.querySelectorAll(".port-sidechain")).toHaveLength(1)
        expect(document.querySelectorAll(".port-in")).toHaveLength(1)
        expect(q(".port-in").className).toContain(styles.hasSidechainPort)
        expect(q(".port-sidechain").getAttribute("data-title")).toBe("Sidechain")
        expect(document.querySelector('svg[data-title="Silenciado"]')).toBeTruthy()
        expect(document.querySelector('svg[data-title="Efectos"]')).toBeTruthy()
    })

    it("el_alto_minimo_y_el_color_del_puerto_salen_de_los_props", () => {
        montar({ id: "x", name: "X", type: "speaker", nodeType: "output", isSubNode: true, channels: 3, color: "red", autoColor: "blue" })
        expect(card().style.minHeight).toBe("90px")
        expect(card().style.getPropertyValue("--port-color")).toBe("red")
        cleanup()
        montar({ id: "x", name: "X", type: "speaker", nodeType: "output", autoColor: "blue" })
        expect(card().style.getPropertyValue("--port-color")).toBe("blue")
        expect(card().style.minHeight).toBe("")
    })

    it("un_subnodo_de_salida_multicanal_tiene_un_puerto_por_canal_con_data_ch_index", () => {
        const { h } = montar({ id: "speaker_sub_a", name: "Altavoz", type: "speaker", nodeType: "output", isSubNode: true, channels: 2 })
        const ports = [...document.querySelectorAll(".port-in")] as HTMLElement[]
        expect(ports.map((p) => p.getAttribute("data-ch-index"))).toEqual(["0", "1"])
        expect(ports[1].getAttribute("data-title")).toBe("Canal 2")
        fireEvent.mouseDown(ports[1])
        expect(h.onMouseDown).toHaveBeenCalledWith(expect.anything(), "in", 1)
    })

    it("un_subnodo_de_entrada_multicanal_tiene_un_puerto_out_por_canal", () => {
        const { h } = montar({ id: "mic_sub_a", name: "Mic", type: "mic", nodeType: "input", isSubNode: true, channels: 2 })
        const ports = [...document.querySelectorAll(".port-out")] as HTMLElement[]
        expect(ports).toHaveLength(2)
        fireEvent.contextMenu(ports[0])
        expect(h.onPortContextMenu).toHaveBeenCalledWith(expect.anything(), "out", 0)
    })

    it("los_cuatro_eventos_de_un_puerto_llaman_a_los_callbacks_con_el_mismo_tipo", () => {
        const { h } = montar({ id: "channel_a", name: "A", type: "channel", nodeType: "channel" })
        const sc = q(".port-sidechain")
        fireEvent.mouseEnter(sc)
        expect(h.onMouseEnterPort).toHaveBeenCalledWith(expect.anything(), "sidechain", undefined)
        expect(h.onHoverPort).toHaveBeenCalledWith(expect.anything(), "sidechain", undefined)
        fireEvent.mouseLeave(sc)
        expect(h.onMouseLeavePort).toHaveBeenCalledTimes(1)
        expect(h.onHoverPortEnd).toHaveBeenCalledTimes(1)
        fireEvent.mouseDown(q(".port-in"))
        expect(h.onMouseDown).toHaveBeenCalledWith(expect.anything(), "in", undefined)
        fireEvent.contextMenu(q(".port-in"))
        expect(h.onPortContextMenu).toHaveBeenCalledWith(expect.anything(), "in", undefined)
    })

    it("mouseenter_y_mouseleave_de_la_tarjeta_llaman_a_sus_callbacks", () => {
        const { h } = montar({ id: "x", name: "X", type: "speaker", nodeType: "output" })
        fireEvent.mouseEnter(card())
        fireEvent.mouseLeave(card())
        expect(h.onMouseEnter).toHaveBeenCalledTimes(1)
        expect(h.onMouseLeave).toHaveBeenCalledTimes(1)
    })

    it("el_boton_de_expandir_llama_a_onToggleExpand", () => {
        const onToggleExpand = vi.fn()
        montar({ id: "mic_default", name: "Mics", type: "mic", nodeType: "input", hasSubNodes: true, onToggleExpand })
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(onToggleExpand).toHaveBeenCalledTimes(1)
    })

    it("sin_subnodos_o_en_output_window_y_network_no_hay_boton_de_expandir", () => {
        montar({ id: "output_window", name: "P", type: "output_window", nodeType: "input", hasSubNodes: true })
        expect(document.querySelector("button")).toBeNull()
    })

    it("el_switch_de_un_mic_subnodo_arranca_el_microfono_con_el_id_sin_prefijo", () => {
        montar({ id: "mic_sub_dev1", name: "Mic 1", type: "mic", nodeType: "input", isSubNode: true })
        fireEvent.click(q('[role="switch"]'))
        expect(AudioMicrophone.start).toHaveBeenCalledWith("dev1", { name: "Mic 1" }, { pauseIfPlaying: true })
    })

    it("el_switch_del_mic_refleja_playingAudio", () => {
        playingAudio.set({ mic_sub_dev1: {} } as never)
        montar({ id: "mic_sub_dev1", name: "Mic 1", type: "mic", nodeType: "input", isSubNode: true })
        expect(q('[role="switch"]').getAttribute("aria-checked")).toBe("true")
    })

    it("el_switch_de_icecast_alterna_special_icecast_enabled", () => {
        special.set({ icecast: { enabled: true } } as never)
        montar({ id: "icecast", name: "Icecast", type: "icecast", nodeType: "output" })
        act(() => fireEvent.click(q('[role="switch"]')))
        expect(get(special).icecast.enabled).toBe(false)
    })

    it("sin_icecast_enabled_definido_no_hay_switch_de_icecast", () => {
        montar({ id: "icecast", name: "Icecast", type: "icecast", nodeType: "output" })
        expect(document.querySelector('[role="switch"]')).toBeNull()
    })

    it("el_switch_de_audio_de_escritorio_llama_a_onToggleEnabled_con_el_valor_nuevo", () => {
        const onToggleEnabled = vi.fn()
        montar({ id: "desktop_default", name: "Desktop", type: "desktop_audio", nodeType: "input", isEnabled: false, onToggleEnabled })
        fireEvent.click(q('[role="switch"]'))
        expect(onToggleEnabled).toHaveBeenCalledWith(true)
    })

    it("el_boton_de_opciones_abre_node_options_con_los_datos_del_nodo", () => {
        montar({ id: "channel_a", name: "A", type: "channel", nodeType: "channel", channels: 2 })
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(get(popupData)).toEqual({ nodeId: "channel_a", name: "A", type: "channel", channels: 2 })
        expect(get(activePopup)).toBe("node_options")
    })

    it("sin_conexion_de_entrada_o_deshabilitado_no_hay_medidor", () => {
        montar({ id: "channel_a", name: "A", type: "channel", nodeType: "channel", hasInputConnection: false })
        expect(document.querySelector("[data-meter]")).toBeNull()
        cleanup()
        montar({ id: "metronome", name: "M", type: "metronome", nodeType: "input", isEnabled: false })
        expect(document.querySelector("[data-meter]")).toBeNull()
        cleanup()
        montar({ id: "network_default", name: "N", type: "network", nodeType: "output" })
        expect(document.querySelector("[data-meter]")).toBeNull()
    })

    it("clases_de_estado_disabled_invalid_hover_valid_y_sub_card", () => {
        montar({ id: "channel_c", name: "C", type: "channel", nodeType: "channel", isEnabled: false, isSubNode: true })
        expect(card().className).toContain(styles.disabled)
        expect(card().className).toContain(styles["sub-card"])
        cleanup()
        // una salida deshabilitada no se atenúa (salvo network)
        montar({ id: "speaker_default", name: "S", type: "speaker", nodeType: "output", isEnabled: false })
        expect(card().className).not.toContain(styles.disabled)
        cleanup()
        montar({ id: "network_sub_x", name: "N", type: "network", nodeType: "output", isEnabled: false, isSubNode: true })
        expect(card().className).toContain(styles.disabled)
        cleanup()
        // una entrada deshabilitada no se atenúa (salvo output_window)
        montar({ id: "metronome", name: "M", type: "metronome", nodeType: "input", isEnabled: false })
        expect(card().className).not.toContain(styles.disabled)
        cleanup()
        montar({ id: "channel_b", name: "B", type: "channel", nodeType: "channel", isConnecting: true, dragStartId: "metronome", dragStartType: "input", hoverTargetId: "channel_b" })
        expect(card().className).not.toContain(styles.invalid)
        expect(card().className).toContain(styles["hover-valid"])
        cleanup()
        montar({ id: "metronome2", name: "M", type: "metronome", nodeType: "input", isConnecting: true, dragStartId: "metronome", dragStartType: "input" })
        expect(card().className).toContain(styles.invalid)
    })
})
