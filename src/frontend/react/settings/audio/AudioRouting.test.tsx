// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, audioChannelsData, audioEffects, audioPlaylists, audioRouting, dictionary, outputs, popupData, selected, special } from "../../../shared/core/stores"
import type { AudioRoutingConfig } from "../../../../types/AudioRouting"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { syncOutputAudioChannels } from "../../../audio/routing/audioRoutingInit"
import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { getAllOutputs } from "../../../shared/utils/helpers/output"
import { newToast } from "../../../shared/utils/common"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { AudioRouting } from "./AudioRouting"
import styles from "./AudioRouting.module.css"
import nodeStyles from "./AudioRoutingNode.module.css"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../../audio/audioMicrophone", () => ({ AudioMicrophone: { getInputs: vi.fn(), start: vi.fn() } }))
vi.mock("../../../audio/audioPlayer", () => ({ AudioPlayer: { getOutputs: vi.fn() } }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
// deduplicateConnections real sólo quita repetidos exactos; acá basta la identidad (las pruebas no repiten conexiones)
vi.mock("../../../audio/routing/audioRoutingInit", () => ({ syncOutputAudioChannels: vi.fn(), deduplicateConnections: (c: unknown) => c }))
vi.mock("../../../audio/routing/audioRoutingManager", () => ({ AudioRoutingManager: { sortChannels: vi.fn((a: unknown) => a) } }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getAllOutputs: vi.fn() }))
vi.mock("../../drawer/audio/AudioMeter", () => ({ AudioMeter: () => <div data-meter /> }))

const addDevice = vi.fn()
const removeDevice = vi.fn()
class FakeResizeObserver {
    static instances: FakeResizeObserver[] = []
    disconnect = vi.fn()
    observe = vi.fn()
    callback: () => void
    constructor(callback: () => void) {
        this.callback = callback
        FakeResizeObserver.instances.push(this)
    }
}

const baseConfig = (): AudioRoutingConfig => ({
    channels: [
        { id: "main", name: "Main" },
        { id: "channel_a", name: "Canal A", color: "red" }
    ],
    connections: []
})

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    Object.defineProperty(navigator, "mediaDevices", { value: { addEventListener: addDevice, removeEventListener: removeDevice }, configurable: true })
    vi.mocked(AudioPlayer.getOutputs).mockResolvedValue([{ value: "dev1", label: "Altavoz 1", channels: 2 }])
    vi.mocked(AudioMicrophone.getInputs).mockResolvedValue([{ value: "mic_sub_m1", label: "Micro 1", channels: 2 }])
    vi.mocked(getAllOutputs).mockReturnValue([])
    restaurar = setStoresForTest([
        storeEntry(audioRouting, baseConfig()),
        storeEntry(outputs, {}),
        storeEntry(audioPlaylists, {}),
        storeEntry(audioEffects, {}),
        storeEntry(audioChannelsData, {}),
        storeEntry(special, {}),
        storeEntry(selected, { id: null, data: [] }),
        storeEntry(activePopup, null),
        storeEntry(popupData, {}),
        storeEntry(dictionary, {
            audio: { inputs: "Entradas", channels: "Canales", outputs: "Salidas", playlists: "Playlists", metronome: "Metrónomo", desktop_audio: "Audio escritorio", speakers: "Altavoces" },
            tabs: { audio: "Audio" },
            live: { microphones: "Micrófonos" },
            midi: { channel: "Canal" },
            settings: { display_settings: "Pantallas", network_output: "Salida de red" },
            category: { videos: "Videos" }
        })
    ] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
    FakeResizeObserver.instances = []
})
afterAll(() => vi.unstubAllGlobals())

const montar = async () => {
    const view = render(<AudioRouting />)
    await act(async () => {})
    return view
}
const node = (id: string) => document.querySelector(`[data-node-id="${id}"]`) as HTMLElement
const port = (id: string, kind: string) => node(id).querySelector(`.port-${kind}`) as HTMLElement
const connections = () => get(audioRouting)?.connections
const paths = () => [...document.querySelectorAll(`.${styles["connection-path"]}`)] as SVGPathElement[]
const soltar = async () => void fireEvent.mouseUp(window)

// arrastra desde el puerto `from` y suelta sobre la tarjeta `to`
async function conectar(fromId: string, fromPort: string, toId: string) {
    fireEvent.mouseDown(port(fromId, fromPort))
    fireEvent.mouseEnter(node(toId))
    await soltar()
}

describe("AudioRouting", () => {
    it("renderiza_las_tres_columnas_con_sus_nodos", async () => {
        await montar()
        expect([...document.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Entradas", "Canales", "Salidas"])
        for (const id of ["drawer_audio", "playlists_default", "mic_default", "metronome", "desktop_default", "main", "channel_a", "speaker_default", "icecast"]) expect(node(id), id).toBeTruthy()
        expect(node("main").textContent).toContain("Main")
        expect(node("metronome").textContent).toContain("Metrónomo")
        expect(node("speaker_default").textContent).toContain("Altavoces")
        // output_window y network_default siempre están expandidos: sin subnodos no se muestran
        expect(node("output_window")).toBeNull()
        expect(node("network_default")).toBeNull()
    })

    it("al_montar_sincroniza_los_canales_los_ordena_y_pide_los_dispositivos", async () => {
        await montar()
        expect(syncOutputAudioChannels).toHaveBeenCalledTimes(1)
        expect(AudioRoutingManager.sortChannels).toHaveBeenCalledTimes(1)
        expect(AudioPlayer.getOutputs).toHaveBeenCalledTimes(1)
        expect(AudioMicrophone.getInputs).toHaveBeenCalledTimes(1)
        expect(addDevice).toHaveBeenCalledWith("devicechange", expect.any(Function))
        expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledTimes(1)
    })

    it("devicechange_vuelve_a_pedir_los_dispositivos_y_al_desmontar_se_limpia_todo", async () => {
        const { unmount } = await montar()
        const handler = addDevice.mock.calls[0][1] as () => Promise<void>
        await act(async () => void (await handler()))
        expect(AudioPlayer.getOutputs).toHaveBeenCalledTimes(2)
        unmount()
        expect(removeDevice).toHaveBeenCalledWith("devicechange", handler)
        expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)
    })

    it("si_falla_getInputs_se_avisa_por_consola_y_los_altavoces_igual_aparecen", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.mocked(AudioMicrophone.getInputs).mockRejectedValue(new Error("x"))
        await montar()
        expect(warn).toHaveBeenCalledWith("Could not enumerate audio inputs:", expect.any(Error))
        fireEvent.click(node("speaker_default").querySelector("button") as HTMLElement)
        expect(node("speaker_sub_dev1")).toBeTruthy()
        warn.mockRestore()
    })

    it("expandir_muestra_los_subnodos_de_dispositivos_y_colapsar_los_oculta", async () => {
        await montar()
        expect(node("mic_sub_m1")).toBeNull()
        fireEvent.click(node("mic_default").querySelector("button") as HTMLElement)
        expect(node("mic_sub_m1").textContent).toContain("Micro 1")
        // mic de 2 canales -> dos puertos de salida
        expect(node("mic_sub_m1").querySelectorAll(".port-out")).toHaveLength(2)
        fireEvent.click(node("mic_default").querySelector("button") as HTMLElement)
        expect(node("mic_sub_m1")).toBeNull()
    })

    it("un_subnodo_colapsado_con_conexion_sigue_visible", async () => {
        audioRouting.set({ ...baseConfig(), connections: [{ from: "mic_sub_m1", to: "main", type: "audio", channelIndex: 0, fromChannelIndex: 0 }] })
        await montar()
        expect(node("mic_sub_m1")).toBeTruthy()
    })

    it("las_playlists_son_subnodos_con_el_id_playlist_sub", async () => {
        audioPlaylists.set({ p1: { name: "Domingo" } } as never)
        await montar()
        fireEvent.click(node("playlists_default").querySelector("button") as HTMLElement)
        expect(node("playlist_sub_p1").textContent).toContain("Domingo")
    })

    it("las_salidas_de_pantalla_se_calculan_una_sola_vez_y_las_de_red_siguen_a_la_configuracion", async () => {
        vi.mocked(getAllOutputs).mockReturnValue([{ id: "o1", name: "Principal", color: "blue", enabled: true, rtmp: true }] as never)
        await montar()
        expect(node("output_win_sub_o1").textContent).toContain("Principal")
        expect(node("network_sub_o1").textContent).toContain("Principal")
        expect(node("network_sub_o1").querySelector(".port-in")).toBeTruthy()
    })

    it("la_columna_de_canales_muestra_silenciado_efectos_e_icono_de_salida", async () => {
        audioChannelsData.set({ channel_a: { isMuted: true } } as never)
        audioEffects.set({ channel_a: { stack: [{}] } } as never)
        await montar()
        expect(node("channel_a").querySelector('svg[data-title="actions.muted"]')).toBeTruthy()
        expect(node("channel_a").querySelector('svg[data-title="tabs.effects"]')).toBeTruthy()
        expect(node("main").querySelector("svg")).toBeTruthy()
    })

    it("un_canal_de_una_salida_inactiva_queda_atenuado", async () => {
        outputs.set({ o1: { enabled: false } } as never)
        audioRouting.set({ ...baseConfig(), channels: [...baseConfig().channels, { id: "channel_o1", name: "O1", outputLink: "o1" }] })
        await montar()
        expect(node("channel_o1").className).toContain(nodeStyles.disabled)
    })

    it("conectar_arrastrando_de_una_entrada_a_un_canal_agrega_la_conexion", async () => {
        await montar()
        await conectar("metronome", "out", "main")
        expect(connections()).toEqual([{ from: "metronome", to: "main", type: "audio" }])
    })

    it("conectar_arrastrando_de_un_canal_a_una_salida_agrega_la_conexion", async () => {
        await montar()
        await conectar("main", "out", "icecast")
        expect(connections()).toEqual([{ from: "main", to: "icecast", type: "audio" }])
    })

    it("arrastrar_desde_el_puerto_de_entrada_de_un_canal_a_una_entrada_invierte_el_sentido", async () => {
        await montar()
        await conectar("main", "in", "metronome")
        expect(connections()).toEqual([{ from: "metronome", to: "main", type: "audio" }])
    })

    it("repetir_el_arrastre_desconecta", async () => {
        audioRouting.set({ ...baseConfig(), connections: [{ from: "metronome", to: "main", type: "audio" }] })
        await montar()
        await conectar("metronome", "out", "main")
        expect(connections()).toEqual([])
    })

    it("el_sidechain_se_crea_arrastrando_del_puerto_sidechain_al_canal_origen", async () => {
        await montar()
        await conectar("channel_a", "sidechain", "main")
        expect(connections()).toEqual([{ from: "main", to: "channel_a", type: "sidechain" }])
    })

    it("un_sidechain_circular_muestra_el_aviso_y_no_cambia_nada", async () => {
        audioRouting.set({ ...baseConfig(), connections: [{ from: "channel_a", to: "main", type: "sidechain" }] })
        await montar()
        await conectar("channel_a", "sidechain", "main")
        expect(newToast).toHaveBeenCalledWith("Cannot create circular sidechain.")
        expect(connections()).toEqual([{ from: "channel_a", to: "main", type: "sidechain" }])
    })

    it("soltar_sin_destino_o_sobre_un_nodo_invalido_no_cambia_la_configuracion", async () => {
        await montar()
        fireEvent.mouseDown(port("metronome", "out"))
        await soltar()
        expect(connections()).toEqual([])
        await conectar("metronome", "out", "icecast")
        expect(connections()).toEqual([])
    })

    it("soltar_sobre_un_puerto_de_canal_de_un_mic_conecta_solo_ese_canal", async () => {
        await montar()
        fireEvent.click(node("mic_default").querySelector("button") as HTMLElement)
        const pin = node("mic_sub_m1").querySelectorAll(".port-out")[1] as HTMLElement
        fireEvent.mouseDown(pin)
        fireEvent.mouseEnter(node("main"))
        await soltar()
        expect(connections()).toEqual([{ from: "mic_sub_m1", to: "main", type: "audio", channelIndex: 1, fromChannelIndex: 1 }])
    })

    it("soltar_un_parlante_multicanal_sobre_la_tarjeta_conecta_todos_los_canales", async () => {
        await montar()
        fireEvent.click(node("speaker_default").querySelector("button") as HTMLElement)
        fireEvent.mouseDown(port("main", "out"))
        fireEvent.mouseEnter(node("speaker_sub_dev1"))
        await soltar()
        expect(connections()).toEqual([
            { from: "main", to: "speaker_sub_dev1", channelIndex: 0, toChannelIndex: 0 },
            { from: "main", to: "speaker_sub_dev1", channelIndex: 1, toChannelIndex: 1 }
        ])
    })

    it("al_arrastrar_se_dibuja_la_curva_de_arrastre_y_al_soltar_desaparece_junto_con_los_listeners", async () => {
        const add = vi.spyOn(window, "addEventListener")
        const remove = vi.spyOn(window, "removeEventListener")
        await montar()
        expect(document.querySelector(`.${styles["drag-path"]}`)).toBeNull()
        fireEvent.mouseDown(port("metronome", "out"))
        expect(document.querySelector(`.${styles["drag-path"]}`)).toBeTruthy()
        expect(add.mock.calls.filter(([t]) => t === "mousemove" || t === "mouseup")).toHaveLength(2)
        await soltar()
        expect(document.querySelector(`.${styles["drag-path"]}`)).toBeNull()
        expect(remove.mock.calls.filter(([t]) => t === "mousemove" || t === "mouseup")).toHaveLength(2)
        add.mockRestore()
        remove.mockRestore()
    })

    it("desmontar_en_medio_de_un_arrastre_quita_los_listeners_de_window", async () => {
        const remove = vi.spyOn(window, "removeEventListener")
        const { unmount } = await montar()
        fireEvent.mouseDown(port("metronome", "out"))
        unmount()
        expect(remove.mock.calls.filter(([t]) => t === "mousemove" || t === "mouseup")).toHaveLength(2)
        remove.mockRestore()
    })

    it("durante_el_arrastre_los_nodos_no_validos_se_atenuan", async () => {
        await montar()
        fireEvent.mouseDown(port("metronome", "out"))
        expect(node("icecast").className).toContain(nodeStyles.invalid)
        expect(node("main").className).not.toContain(nodeStyles.invalid)
    })

    it("las_lineas_se_dibujan_con_las_posiciones_de_los_puertos_y_doble_clic_las_borra", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "metronome", to: "main", type: "audio" },
                { from: "main", to: "icecast", type: "audio" }
            ]
        })
        await montar()
        await waitFor(() => expect(paths()).toHaveLength(2))
        expect(paths()[0].getAttribute("d")).toMatch(/^M [-\d.]+ [-\d.]+ C /)
        fireEvent.doubleClick(paths()[0])
        expect(connections()).toEqual([{ from: "main", to: "icecast", type: "audio" }])
        await waitFor(() => expect(paths()).toHaveLength(1))
    })

    it("doble_clic_en_una_linea_sidechain_solo_borra_ese_tipo", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "main", to: "channel_a", type: "audio" },
                { from: "main", to: "channel_a", type: "sidechain" }
            ]
        })
        await montar()
        await waitFor(() => expect(paths()).toHaveLength(2))
        const side = paths().find((p) => p.getAttribute("class")?.includes(styles["sidechain-path"]))!
        expect(side.getAttribute("stroke")).toBe("#f59e0b")
        fireEvent.doubleClick(side)
        expect(connections()).toEqual([{ from: "main", to: "channel_a", type: "audio" }])
    })

    it("el_color_de_la_linea_sale_del_nodo_de_origen_o_del_tono_por_posicion", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "channel_a", to: "icecast", type: "audio" },
                { from: "metronome", to: "main", type: "audio" }
            ]
        })
        await montar()
        await waitFor(() => expect(paths()).toHaveLength(2))
        const strokes = paths().map((p) => p.getAttribute("stroke"))
        expect(strokes).toContain("red")
        // metronome: índice 4 de la columna (los subnodos de mic_default cuentan aunque estén colapsados): 275 + 24
        expect(strokes).toContain("hsl(299, 80%, 65%)")
    })

    it("al_pasar_por_un_puerto_se_resaltan_sus_lineas_y_se_atenuan_las_demas", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "metronome", to: "main", type: "audio" },
                { from: "main", to: "icecast", type: "audio" }
            ]
        })
        await montar()
        await waitFor(() => expect(paths()).toHaveLength(2))
        fireEvent.mouseEnter(port("metronome", "out"))
        const classes = paths().map((p) => p.getAttribute("class") ?? "")
        expect(classes.filter((c) => c.includes(styles.highlighted))).toHaveLength(1)
        expect(classes.filter((c) => c.includes(styles.dimmed))).toHaveLength(1)
        fireEvent.mouseLeave(port("metronome", "out"))
        expect(paths().every((p) => !(p.getAttribute("class") ?? "").includes(styles.dimmed))).toBe(true)
    })

    it("clic_derecho_en_un_puerto_in_quita_las_conexiones_que_llegan_y_previene_el_menu", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "metronome", to: "main", type: "audio" },
                { from: "main", to: "icecast", type: "audio" }
            ]
        })
        await montar()
        const cancelado = !fireEvent.contextMenu(port("main", "in"))
        expect(cancelado).toBe(true)
        expect(connections()).toEqual([{ from: "main", to: "icecast", type: "audio" }])
    })

    it("clic_derecho_en_un_puerto_out_quita_las_que_salen_y_en_sidechain_las_sidechain", async () => {
        audioRouting.set({
            ...baseConfig(),
            connections: [
                { from: "main", to: "icecast", type: "audio" },
                { from: "main", to: "channel_a", type: "sidechain" }
            ]
        })
        await montar()
        fireEvent.contextMenu(port("channel_a", "sidechain"))
        expect(connections()).toEqual([{ from: "main", to: "icecast", type: "audio" }])
        fireEvent.contextMenu(port("main", "out"))
        expect(connections()).toEqual([])
    })

    it("la_tarjeta_del_canal_conserva_la_clase_de_menu_contextual", async () => {
        await montar()
        expect(node("channel_a").classList.contains("#audio_channel")).toBe(true)
        expect(node("main").classList.contains("#audio_channel_main")).toBe(true)
    })

    it("agregar_un_canal_lo_crea_lo_selecciona_y_abre_rename", async () => {
        await montar()
        const lista = document.querySelectorAll(`.${styles["nodes-list"]}`)[1]
        fireEvent.click(lista.lastElementChild as HTMLElement)
        const channels = get(audioRouting)!.channels
        expect(channels).toHaveLength(3)
        expect(channels[2].name).toBe("Canal 3")
        expect(channels[2].id).toMatch(/^channel_/)
        expect(get(selected)).toEqual({ id: "audio_channel", data: [{ id: channels[2].id }] })
        expect(get(activePopup)).toBe("rename")
    })

    it("el_switch_de_audio_de_escritorio_guarda_desktopAudioEnabled", async () => {
        await montar()
        fireEvent.click(node("desktop_default").querySelector('[role="switch"]') as HTMLElement)
        expect(get(audioRouting)!.desktopAudioEnabled).toBe(true)
        expect(node("desktop_default").querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("true")
    })

    it("renombrar_un_canal_mutando_el_store_en_el_lugar_se_refleja", async () => {
        await montar()
        act(() =>
            audioRouting.update((c) => {
                c!.channels[1].name = "Renombrado"
                return c
            })
        )
        expect(node("channel_a").textContent).toContain("Renombrado")
    })

    it("el_icecast_de_special_atenua_la_linea_pero_no_la_tarjeta", async () => {
        special.set({ icecast: { enabled: false } } as never)
        audioRouting.set({ ...baseConfig(), connections: [{ from: "main", to: "icecast", type: "audio" }] })
        await montar()
        await waitFor(() => expect(paths()).toHaveLength(1))
        expect(node("icecast").querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("false")
    })

    it("arrastrar_el_fondo_desplaza_el_contenedor_y_soltar_termina_el_paneo", async () => {
        await montar()
        const container = document.querySelector(".checkered") as HTMLElement
        container.scrollLeft = 100
        container.scrollTop = 40
        fireEvent.mouseDown(container, { button: 0, clientX: 50, clientY: 50 })
        expect(container.className).toContain(styles["is-panning"])
        fireEvent.mouseMove(window, { clientX: 30, clientY: 70 })
        expect(container.scrollLeft).toBe(120)
        expect(container.scrollTop).toBe(20)
        await soltar()
        expect(container.className).not.toContain(styles["is-panning"])
        fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
        expect(container.scrollLeft).toBe(120)
    })

    it("no_panea_con_el_boton_derecho_ni_sobre_una_tarjeta_o_boton", async () => {
        await montar()
        const container = document.querySelector(".checkered") as HTMLElement
        fireEvent.mouseDown(container, { button: 2 })
        expect(container.className).not.toContain(styles["is-panning"])
        fireEvent.mouseDown(node("main"), { button: 0 })
        expect(container.className).not.toContain(styles["is-panning"])
    })

    it("la_escena_usa_zoom_1", async () => {
        await montar()
        const space = document.querySelector(`.${styles["routing-space"]}`) as HTMLElement
        expect(space.style.transform).toBe("scale(1)")
        expect(space.style.width).toBe("100%")
        expect(space.style.transformOrigin).toBe("0 0")
    })
})
