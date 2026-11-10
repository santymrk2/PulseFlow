import { describe, expect, it, vi } from "vitest"
import type { AudioRoutingConfig, AudioRoutingConnection } from "../../../../types/AudioRouting"
import { applyDrop, connectionPath, dragPath, isLineConnectedToPort, isValidConnection, isValidHoverTarget, keepAfterPortContext, lineKey, nodeHue, type DropContext, type RenderedLine, type ValidationContext } from "./routingLogic"

const cfg = (connections: AudioRoutingConnection[] = []): AudioRoutingConfig => ({
    channels: [
        { id: "main", name: "Main" },
        { id: "channel_a", name: "A" }
    ],
    connections
})
const ctx = (over: Partial<DropContext>): DropContext => ({ fromId: "", toId: "", isSidechain: false, dragStartId: "", dragStartChannelIndex: 0, hoverTargetId: null, hoverChIndex: undefined, availableInputs: [], availableOutputs: [], notify: vi.fn(), ...over })
const vctx: ValidationContext = { channelIds: ["main", "channel_a", "channel_b"], dragStartPortType: null, hoverTargetPortType: null }

describe("isValidConnection", () => {
    it("entrada_a_canal_conserva_el_orden", () => {
        expect(isValidConnection("metronome", "main", vctx)).toEqual({ valid: true, from: "metronome", to: "main" })
    })
    it("canal_a_salida_conserva_el_orden", () => {
        expect(isValidConnection("main", "speaker_sub_x", vctx)).toEqual({ valid: true, from: "main", to: "speaker_sub_x" })
    })
    it("salida_a_canal_se_invierte", () => {
        expect(isValidConnection("icecast", "main", vctx)).toEqual({ valid: true, from: "main", to: "icecast" })
    })
    it("canal_a_entrada_se_invierte", () => {
        expect(isValidConnection("channel_a", "mic_sub_d", vctx)).toEqual({ valid: true, from: "mic_sub_d", to: "channel_a" })
    })
    it("entrada_a_salida_no_es_valida", () => {
        expect(isValidConnection("metronome", "icecast", vctx).valid).toBe(false)
    })
    it("canal_a_canal_sin_sidechain_no_es_valido", () => {
        expect(isValidConnection("main", "channel_a", vctx).valid).toBe(false)
    })
    it("sidechain_arrastrando_desde_el_puerto_sidechain_invierte", () => {
        expect(isValidConnection("channel_a", "channel_b", { ...vctx, dragStartPortType: "sidechain" })).toEqual({ valid: true, from: "channel_b", to: "channel_a" })
    })
    it("sidechain_soltando_sobre_el_puerto_sidechain_conserva", () => {
        expect(isValidConnection("channel_a", "channel_b", { ...vctx, dragStartPortType: "out", hoverTargetPortType: "sidechain" })).toEqual({ valid: true, from: "channel_a", to: "channel_b" })
    })
})

describe("isValidHoverTarget", () => {
    it("desde_entrada_o_salida_solo_canales", () => {
        expect(isValidHoverTarget("c", "channel", "input", "out")).toBe(true)
        expect(isValidHoverTarget("c", "channel", "output", "in")).toBe(true)
        expect(isValidHoverTarget("c", "output", "input", "out")).toBe(false)
    })
    it("desde_canal_in_a_entradas_menos_output_window", () => {
        expect(isValidHoverTarget("metronome", "input", "channel", "in")).toBe(true)
        expect(isValidHoverTarget("output_window", "input", "channel", "in")).toBe(false)
    })
    it("desde_canal_out_a_salidas_menos_network_default_y_a_canales", () => {
        expect(isValidHoverTarget("icecast", "output", "channel", "out")).toBe(true)
        expect(isValidHoverTarget("network_default", "output", "channel", "out")).toBe(false)
        expect(isValidHoverTarget("channel_b", "channel", "channel", "out")).toBe(true)
    })
    it("desde_canal_sidechain_a_canales_y_entradas_menos_output_window", () => {
        expect(isValidHoverTarget("channel_b", "channel", "channel", "sidechain")).toBe(true)
        expect(isValidHoverTarget("metronome", "input", "channel", "sidechain")).toBe(true)
        expect(isValidHoverTarget("output_window", "input", "channel", "sidechain")).toBe(false)
        expect(isValidHoverTarget("icecast", "output", "channel", "sidechain")).toBe(false)
    })
})

describe("applyDrop", () => {
    it("conecta_una_entrada_simple_a_un_canal", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "metronome", toId: "main", dragStartId: "metronome", hoverTargetId: "main" }))
        expect(c.connections).toEqual([{ from: "metronome", to: "main", type: "audio" }])
    })
    it("soltar_otra_vez_desconecta", () => {
        const c = cfg([{ from: "metronome", to: "main", type: "audio" }])
        applyDrop(c, ctx({ fromId: "metronome", toId: "main", dragStartId: "metronome", hoverTargetId: "main" }))
        expect(c.connections).toEqual([])
    })
    it("conectar_un_hijo_quita_la_conexion_del_padre_al_mismo_canal", () => {
        const c = cfg([
            { from: "mic_default", to: "main" },
            { from: "mic_default", to: "channel_a" }
        ])
        applyDrop(c, ctx({ fromId: "mic_sub_d", toId: "main", dragStartId: "mic_sub_d", hoverTargetId: "main", availableInputs: [{ value: "mic_sub_d", label: "d", channels: 1 }] }))
        expect(c.connections).toEqual([
            { from: "mic_default", to: "channel_a" },
            { from: "mic_sub_d", to: "main", type: "audio", channelIndex: 0, fromChannelIndex: 0 }
        ])
    })
    it("conectar_el_padre_quita_las_conexiones_de_los_hijos_al_mismo_canal", () => {
        const c = cfg([
            { from: "playlist_sub_1", to: "main" },
            { from: "playlist_sub_1", to: "channel_a" }
        ])
        applyDrop(c, ctx({ fromId: "playlists_default", toId: "main", dragStartId: "playlists_default", hoverTargetId: "main" }))
        expect(c.connections).toEqual([
            { from: "playlist_sub_1", to: "channel_a" },
            { from: "playlists_default", to: "main", type: "audio" }
        ])
    })
    it("conectar_una_salida_hija_quita_la_conexion_del_canal_al_padre", () => {
        const c = cfg([{ from: "main", to: "network_default" }])
        applyDrop(c, ctx({ fromId: "main", toId: "network_sub_x", dragStartId: "main", hoverTargetId: "network_sub_x" }))
        expect(c.connections).toEqual([{ from: "main", to: "network_sub_x", type: "audio" }])
    })
    it("conectar_a_un_parlante_hijo_quita_speaker_default_y_fija_el_canal_de_destino", () => {
        const c = cfg([{ from: "main", to: "speaker_default" }])
        applyDrop(c, ctx({ fromId: "main", toId: "speaker_sub_d", dragStartId: "main", hoverTargetId: "speaker_sub_d", hoverChIndex: "1", availableOutputs: [{ value: "d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([{ from: "main", to: "speaker_sub_d", type: "audio", channelIndex: 1, toChannelIndex: 1 }])
    })
    it("un_parlante_multicanal_soltado_en_la_tarjeta_conecta_todos_los_canales", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "main", toId: "speaker_sub_d", dragStartId: "main", hoverTargetId: "speaker_sub_d", availableOutputs: [{ value: "d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([
            { from: "main", to: "speaker_sub_d", channelIndex: 0, toChannelIndex: 0 },
            { from: "main", to: "speaker_sub_d", channelIndex: 1, toChannelIndex: 1 }
        ])
    })
    it("un_parlante_multicanal_ya_conectado_en_todos_los_canales_se_desconecta", () => {
        const c = cfg([
            { from: "main", to: "speaker_sub_d", channelIndex: 0, toChannelIndex: 0 },
            { from: "main", to: "speaker_sub_d", channelIndex: 1, toChannelIndex: 1 },
            { from: "x", to: "y" }
        ])
        applyDrop(c, ctx({ fromId: "main", toId: "speaker_sub_d", dragStartId: "main", hoverTargetId: "speaker_sub_d", availableOutputs: [{ value: "d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([{ from: "x", to: "y" }])
    })
    it("un_mic_multicanal_soltado_en_la_tarjeta_conecta_todos_los_canales", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "mic_sub_d", toId: "main", dragStartId: "main", dragStartChannelIndex: 0, hoverTargetId: "mic_sub_d", availableInputs: [{ value: "mic_sub_d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([
            { from: "mic_sub_d", to: "main", type: "audio", channelIndex: 0, fromChannelIndex: 0 },
            { from: "mic_sub_d", to: "main", type: "audio", channelIndex: 1, fromChannelIndex: 1 }
        ])
    })
    it("un_mic_multicanal_con_pin_conecta_solo_ese_canal", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "mic_sub_d", toId: "main", dragStartId: "mic_sub_d", dragStartChannelIndex: 1, hoverTargetId: "main", availableInputs: [{ value: "mic_sub_d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([{ from: "mic_sub_d", to: "main", type: "audio", channelIndex: 1, fromChannelIndex: 1 }])
    })
    it("un_mic_multicanal_conectado_en_todos_los_canales_se_desconecta", () => {
        const c = cfg([
            { from: "mic_sub_d", to: "main", type: "audio", channelIndex: 0, fromChannelIndex: 0 },
            { from: "mic_sub_d", to: "main", type: "audio", channelIndex: 1, fromChannelIndex: 1 }
        ])
        applyDrop(c, ctx({ fromId: "mic_sub_d", toId: "main", dragStartId: "main", dragStartChannelIndex: 0, hoverTargetId: "mic_sub_d", availableInputs: [{ value: "mic_sub_d", label: "d", channels: 2 }] }))
        expect(c.connections).toEqual([])
    })
    it("un_mic_multicanal_sin_nada_nuevo_avisa_del_conflicto", () => {
        const notify = vi.fn()
        const c = cfg([
            { from: "mic_sub_d", to: "main", type: "sidechain", channelIndex: 0, fromChannelIndex: 0 },
            { from: "mic_sub_d", to: "main", type: "sidechain", channelIndex: 1, fromChannelIndex: 1 }
        ])
        applyDrop(c, ctx({ fromId: "mic_sub_d", toId: "main", dragStartId: "main", dragStartChannelIndex: 0, hoverTargetId: "mic_sub_d", availableInputs: [{ value: "mic_sub_d", label: "d", channels: 2 }], notify }))
        expect(notify).toHaveBeenCalledWith("This source already has a sidechain connection to this channel.")
        expect(c.connections).toHaveLength(2)
    })
    it("un_conflicto_audio_contra_sidechain_avisa_y_no_conecta", () => {
        const notify = vi.fn()
        const c = cfg([{ from: "metronome", to: "main", type: "sidechain" }])
        applyDrop(c, ctx({ fromId: "metronome", toId: "main", dragStartId: "metronome", hoverTargetId: "main", notify }))
        expect(notify).toHaveBeenCalledWith("This source channel already has a sidechain connection to this channel.")
        expect(c.connections).toEqual([{ from: "metronome", to: "main", type: "sidechain" }])
    })
    it("el_sidechain_de_canal_a_canal_se_crea_con_tipo_sidechain", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "main", toId: "channel_a", isSidechain: true, dragStartId: "main", hoverTargetId: "channel_a" }))
        expect(c.connections).toEqual([{ from: "main", to: "channel_a", type: "sidechain" }])
    })
    it("un_sidechain_circular_avisa_y_no_conecta", () => {
        const notify = vi.fn()
        const c = cfg([{ from: "channel_a", to: "main", type: "sidechain" }])
        applyDrop(c, ctx({ fromId: "main", toId: "channel_a", isSidechain: true, dragStartId: "main", hoverTargetId: "channel_a", notify }))
        expect(notify).toHaveBeenCalledWith("Cannot create circular sidechain.")
        expect(c.connections).toHaveLength(1)
    })
    it("un_sidechain_sobre_si_mismo_no_hace_nada", () => {
        const c = cfg()
        applyDrop(c, ctx({ fromId: "main", toId: "main", isSidechain: true, dragStartId: "main", hoverTargetId: "main" }))
        expect(c.connections).toEqual([])
    })
})

describe("keepAfterPortContext", () => {
    const conns: AudioRoutingConnection[] = [
        { from: "a", to: "main" },
        { from: "b", to: "main", type: "sidechain" },
        { from: "m", to: "x", channelIndex: 1, fromChannelIndex: 1 },
        { from: "main", to: "speaker_sub_d", channelIndex: 1 }
    ]
    const keep = (nodeId: string, port: "in" | "out" | "sidechain", ch = 0) => conns.filter((c) => keepAfterPortContext(c, nodeId, port, ch))
    it("in_quita_las_conexiones_de_audio_que_llegan", () => {
        expect(keep("main", "in")).toEqual([conns[1], conns[2], conns[3]])
    })
    it("sidechain_quita_solo_los_sidechain_que_llegan", () => {
        expect(keep("main", "sidechain")).toEqual([conns[0], conns[2], conns[3]])
    })
    it("out_quita_las_que_salen", () => {
        expect(keep("a", "out")).toEqual([conns[1], conns[2], conns[3]])
    })
    it("in_de_un_parlante_hijo_solo_quita_el_canal_pedido", () => {
        expect(keep("speaker_sub_d", "in", 0)).toContain(conns[3])
        expect(keep("speaker_sub_d", "in", 1)).not.toContain(conns[3])
    })
    it("out_de_un_mic_hijo_solo_quita_el_canal_pedido", () => {
        const mic: AudioRoutingConnection[] = [
            { from: "mic_sub_d", to: "x", fromChannelIndex: 0 },
            { from: "mic_sub_d", to: "x", fromChannelIndex: 1 }
        ]
        expect(mic.filter((c) => keepAfterPortContext(c, "mic_sub_d", "out", 1))).toEqual([mic[0]])
    })
})

describe("lineas", () => {
    const line: RenderedLine = { fromId: "a", toId: "b", channelIndex: 0, x1: 0, y1: 0, x2: 100, y2: 50, type: "audio" }
    it("la_curva_de_audio_usa_la_mitad_de_la_distancia_con_minimo_20", () => {
        expect(connectionPath(line)).toBe("M 0 0 C 50 0, 50 50, 100 50")
        expect(connectionPath({ ...line, x2: 10 })).toBe("M 0 0 C 20 0, -10 50, 10 50")
    })
    it("el_sidechain_hacia_atras_usa_minimo_120_o_70_por_ciento_del_alto", () => {
        expect(connectionPath({ ...line, type: "sidechain", x1: 100, x2: 0, y2: 50 })).toBe("M 100 0 C 220 0, -120 50, 0 50")
        expect(connectionPath({ ...line, type: "sidechain", x1: 100, x2: 0, y2: 400 })).toBe("M 100 0 C 380 0, -280 400, 0 400")
    })
    it("la_curva_del_arrastre_cambia_de_signo_segun_el_puerto", () => {
        expect(dragPath({ x: 0, y: 0 }, { x: 100, y: 10 }, "out")).toBe("M 0 0 C 50 0, 50 10, 100 10")
        expect(dragPath({ x: 0, y: 0 }, { x: 100, y: 10 }, "in")).toBe("M 0 0 C -50 0, 150 10, 100 10")
    })
    it("lineKey_incluye_ambos_canales_y_el_tipo", () => {
        expect(lineKey({ ...line, fromChannelIndex: 1, toChannelIndex: 2 })).toBe("a-b-1-2-audio")
        expect(lineKey({ ...line, type: undefined })).toBe("a-b-0-0-audio")
    })
    it("el_tono_avanza_6_grados_por_nodo", () => {
        expect(nodeHue(0)).toBe(275)
        expect(nodeHue(10)).toBe(335)
        expect(nodeHue(-1)).toBe(275)
        expect(nodeHue(20)).toBe(35)
    })
    it("isLineConnectedToPort_por_tipo_de_puerto", () => {
        expect(isLineConnectedToPort(line, null)).toBe(false)
        expect(isLineConnectedToPort(line, { nodeId: "a", portType: "out" })).toBe(true)
        expect(isLineConnectedToPort(line, { nodeId: "a", portType: "out", channelIndex: 1 })).toBe(false)
        expect(isLineConnectedToPort(line, { nodeId: "b", portType: "in" })).toBe(true)
        expect(isLineConnectedToPort(line, { nodeId: "b", portType: "sidechain" })).toBe(false)
        expect(isLineConnectedToPort({ ...line, type: "sidechain" }, { nodeId: "b", portType: "sidechain" })).toBe(true)
        expect(isLineConnectedToPort({ ...line, type: "sidechain" }, { nodeId: "b", portType: "in" })).toBe(false)
    })
})
