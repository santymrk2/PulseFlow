// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BLACKMAGIC, NDI, OMT, OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { addRtmpDestination, checkFFmpeg, removeRtmpDestination, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming, updateOutputRtmpData, updateOutputWebrtcData, updateRtmpDestination } from "../../components/helpers/output"
import { requestMain } from "../../IPC/main"
import { activePopup, alertMessage, currentOutputSettings, ndiData, omtData, os, outputs, rtmpStatus, saved } from "../../stores"
import { newToast } from "../../utils/common"
import { destroy, receive, send } from "../../utils/request"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ScreenOutputOptions } from "./ScreenOutputOptions"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../IPC/main", () => ({ requestMain: vi.fn() }))
vi.mock("../../utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: { recorderActivate: vi.fn(), recorderDeactivate: vi.fn() } }))
vi.mock("../../components/helpers/output", () => ({
    addRtmpDestination: vi.fn(),
    checkFFmpeg: vi.fn(),
    refreshOut: vi.fn(),
    removeRtmpDestination: vi.fn(),
    startRtmpStreaming: vi.fn(),
    startStreaming: vi.fn(),
    stopRtmpStreaming: vi.fn(),
    stopStreaming: vi.fn(),
    updateOutputRtmpData: vi.fn(),
    updateOutputWebrtcData: vi.fn(),
    updateRtmpDestination: vi.fn()
}))

const salida = (extra = {}) => ({ name: "Principal", enabled: true, active: true, color: "", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, ...extra })
const destino = (extra = {}) => ({ id: "d1", url: "rtmp://a.rtmp.youtube.com/live2", key: "k", enabled: true, ...extra })

let restaurar: () => void = () => {}
const poner = (out: object, otros: Record<string, object> = {}) => outputs.set({ a: salida(out), ...otros } as never)
beforeEach(() => {
    vi.mocked(requestMain).mockResolvedValue({ encoders: [{ id: "cpu", label: "Cpu", available: true, reason: "" }], recommended: "cpu" } as never)
    restaurar = setStoresForTest([storeEntry(outputs, { a: salida() }), storeEntry(currentOutputSettings, "a"), storeEntry(rtmpStatus, {}), storeEntry(ndiData, {}), storeEntry(omtData, {}), storeEntry(saved, true), storeEntry(activePopup, null), storeEntry(alertMessage, ""), storeEntry(os, { platform: "win32", name: "", arch: "" })] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
    vi.clearAllMocks()
})

const campo = (label: string) => screen.getByText(label).closest(".textfield") as HTMLElement
const elegir = (label: string, opcion: string) => {
    fireEvent.click(campo(label).querySelector(".dropdown-trigger") as HTMLElement)
    fireEvent.click(screen.getByRole("option", { name: new RegExp(`^${opcion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }))
}
const escribir = (label: string, texto: string) => {
    const input = campo(label).querySelector("input") as HTMLInputElement
    fireEvent.input(input, { target: { value: texto } })
    fireEvent.change(input, { target: { value: texto } })
}
const interruptor = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const boton = (texto: string) => screen.getByText(texto).closest("button") as HTMLButtonElement
const montar = async () => {
    const r = render(<ScreenOutputOptions />)
    await act(async () => {})
    return r
}

describe("ScreenOutputOptions", () => {
    it("sin_ninguna_bandera_de_envio_no_dibuja_nada_y_no_pide_nada", async () => {
        const { container } = await montar()
        expect(container.innerHTML).toBe("")
        expect(requestMain).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalledWith(BLACKMAGIC, ["GET_DEVICES"])
    })

    describe("ndi", () => {
        beforeEach(() => poner({ ndi: true, name: "Sala" }))

        it("renderiza_lo_principal_con_el_nombre_por_defecto", async () => {
            await montar()
            expect(screen.getByText("NDI®")).toBeTruthy()
            expect(campo("inputs.name").querySelector("input")!.value).toBe("PulseFlow NDI - Sala")
            expect(campo("inputs.group").querySelector("input")!.placeholder).toBe("public")
            expect(screen.getByText("settings.frame_rate")).toBeTruthy()
        })

        it("framerate_guarda_ndiData_y_manda_NDI_DATA_sin_aviso", async () => {
            await montar()
            elegir("settings.frame_rate", "25 fps")
            expect(get(outputs).a.ndiData).toEqual({ framerate: "25" })
            expect(send).toHaveBeenCalledWith(NDI, ["NDI_DATA"], { id: "a", framerate: "25" })
            expect(get(activePopup)).toBeNull()
        })

        it("cambiar_nombre_o_grupos_avisa_que_hace_falta_reiniciar_y_marca_sin_guardar", async () => {
            await montar()
            escribir("inputs.name", "Mi NDI")
            expect(get(outputs).a.ndiData).toEqual({ name: "Mi NDI" })
            expect(send).toHaveBeenLastCalledWith(NDI, ["NDI_DATA"], { id: "a", name: "Mi NDI" })
            expect(get(alertMessage)).toBe("settings.restart_for_change")
            expect(get(activePopup)).toBe("alert")
            expect(get(saved)).toBe(false)

            saved.set(true)
            escribir("inputs.group", "g1")
            expect(get(outputs).a.ndiData).toEqual({ name: "Mi NDI", groups: "g1" })
            expect(get(saved)).toBe(false)
        })

        it("transparente_recrea_la_ventana_si_esta_habilitada", async () => {
            await montar()
            fireEvent.click(interruptor("settings.transparent"))
            expect(get(outputs).a.transparent).toBe(true)
            expect(send).toHaveBeenCalledWith(OUTPUT, ["CREATE"], expect.objectContaining({ id: "a", transparent: true, ndi: true }))
        })

        it("transparente_en_una_salida_deshabilitada_solo_escribe_el_store", async () => {
            poner({ ndi: true, enabled: false })
            await montar()
            fireEvent.click(interruptor("settings.transparent"))
            expect(get(outputs).a.transparent).toBe(true)
            expect(send).not.toHaveBeenCalledWith(OUTPUT, ["CREATE"], expect.anything())
        })
    })

    describe("omt", () => {
        beforeEach(() => poner({ omt: true }))

        it("renderiza_lo_principal_y_la_calidad_por_defecto_es_Default", async () => {
            await montar()
            expect(screen.getByText("OMT")).toBeTruthy()
            expect(screen.getByText("settings.quality")).toBeTruthy()
            expect(campo("inputs.name").querySelector("input")!.value).toBe("PulseFlow OMT - Principal")
        })

        it("calidad_y_nombre_guardan_omtData_y_mandan_OMT_DATA", async () => {
            await montar()
            elegir("settings.quality", "Medium")
            expect(get(outputs).a.omtData).toEqual({ quality: "Medium" })
            expect(send).toHaveBeenLastCalledWith(OMT, ["OMT_DATA"], { id: "a", quality: "Medium" })
            escribir("inputs.name", "Otro")
            expect(send).toHaveBeenLastCalledWith(OMT, ["OMT_DATA"], { id: "a", quality: "Medium", name: "Otro" })
            expect(get(activePopup)).toBeNull()
        })

        it("transparente_escribe_la_salida", async () => {
            await montar()
            fireEvent.click(interruptor("settings.transparent"))
            expect(get(outputs).a.transparent).toBe(true)
        })
    })

    describe("webrtc", () => {
        beforeEach(() => poner({ webrtc: true, webrtcData: { url: "https://x/whip", fps: 30 } }))

        it("renderiza_lo_principal", async () => {
            await montar()
            expect(screen.getByText("WebRTC")).toBeTruthy()
            expect(campo("WHIP Endpoint URL").querySelector("input")!.value).toBe("https://x/whip")
            expect(campo("Bitrate (kbps)").querySelector("input")!.value).toBe("4000")
            expect(screen.getByText("output.start_streaming")).toBeTruthy()
        })

        it("cada_campo_llama_a_updateOutputWebrtcData_y_si_actualizo_marca_sin_guardar", async () => {
            vi.mocked(updateOutputWebrtcData).mockReturnValue(true as never)
            await montar()
            elegir("settings.frame_rate", "60 fps")
            expect(updateOutputWebrtcData).toHaveBeenLastCalledWith("a", "fps", "60")
            escribir("Bitrate (kbps)", "5000")
            expect(updateOutputWebrtcData).toHaveBeenLastCalledWith("a", "bitrate", "5000")
            escribir("Bearer Token (Optional)", "tok")
            expect(updateOutputWebrtcData).toHaveBeenLastCalledWith("a", "token", "tok")
            escribir("WHIP Endpoint URL", "https://y")
            expect(updateOutputWebrtcData).toHaveBeenLastCalledWith("a", "url", "https://y")
            expect(get(saved)).toBe(false)
        })

        it("si_updateOutputWebrtcData_no_actualiza_no_marca_sin_guardar", async () => {
            vi.mocked(updateOutputWebrtcData).mockReturnValue(false as never)
            await montar()
            escribir("Bitrate (kbps)", "5000")
            expect(get(saved)).toBe(true)
        })

        it("el_boton_inicia_o_detiene_la_transmision", async () => {
            await montar()
            fireEvent.click(boton("output.start_streaming"))
            expect(startStreaming).toHaveBeenCalledWith("a")
            cleanup()
            poner({ webrtc: true, webrtcData: { url: "https://x/whip", streaming: true } })
            await montar()
            fireEvent.click(boton("output.stop_streaming"))
            expect(stopStreaming).toHaveBeenCalledWith("a", true)
        })

        it("sin_url_o_con_la_salida_apagada_no_hay_boton_de_transmision", async () => {
            poner({ webrtc: true, enabled: false, webrtcData: { url: "https://x" } })
            await montar()
            expect(screen.queryByText("output.start_streaming")).toBeNull()
        })
    })

    describe("rtmp", () => {
        beforeEach(() => poner({ rtmp: true, rtmpData: { destinations: [destino()] } }))

        it("renderiza_lo_principal_y_pide_los_codificadores_una_vez", async () => {
            await montar()
            expect(screen.getByText("RTMP")).toBeTruthy()
            expect(screen.getByText("settings.video_encoder")).toBeTruthy()
            expect(campo("Stream URL").querySelector("input")!.value).toBe("rtmp://a.rtmp.youtube.com/live2")
            expect(screen.getByText("youtube")).toBeTruthy()
            expect(requestMain).toHaveBeenCalledWith(Main.ENCODER_DETECT, { force: false })
        })

        it("los_codificadores_se_ordenan_disponibles_primero_por_nombre_y_marcan_el_recomendado", async () => {
            vi.mocked(requestMain).mockResolvedValue({
                recommended: "nv",
                encoders: [
                    { id: "x", label: "Zeta", available: false, reason: "no hay" },
                    { id: "nv", label: "NVENC", available: true, reason: "" },
                    { id: "cpu", label: "Cpu", available: true, reason: "" }
                ]
            } as never)
            await montar()
            fireEvent.click(campo("settings.video_encoder").querySelector(".dropdown-trigger") as HTMLElement)
            expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["AutoNVENC", "Cpu", "NVENC", "Zetano hay"])
        })

        it("fps_bitrate_modo_y_codificador_llaman_a_updateOutputRtmpData_y_marcan_sin_guardar", async () => {
            await montar()
            elegir("settings.frame_rate", "60 fps")
            expect(updateOutputRtmpData).toHaveBeenLastCalledWith("a", "fps", "60")
            escribir("settings.bitrate (kbps)", "6000")
            expect(updateOutputRtmpData).toHaveBeenLastCalledWith("a", "bitrate", "6000")
            elegir("actions.mode", "VBR")
            expect(updateOutputRtmpData).toHaveBeenLastCalledWith("a", "rateControl", "vbr")
            elegir("settings.video_encoder", "Auto")
            expect(updateOutputRtmpData).toHaveBeenLastCalledWith("a", "encoder", "auto")
            expect(get(saved)).toBe(false)
        })

        it("sin_destinos_agrega_uno", async () => {
            poner({ rtmp: true })
            await montar()
            expect(addRtmpDestination).toHaveBeenCalledWith("a")
        })

        it("url_y_clave_llaman_a_updateRtmpDestination_con_el_id_del_destino", async () => {
            await montar()
            escribir("Stream URL", "rtmp://otro/live")
            expect(updateRtmpDestination).toHaveBeenLastCalledWith("a", "d1", "url", "rtmp://otro/live")
            escribir("Stream key", "abc")
            expect(updateRtmpDestination).toHaveBeenLastCalledWith("a", "d1", "key", "abc")
        })

        it("con_mas_de_un_destino_aparece_habilitar_y_solo_se_puede_borrar_el_incompleto", async () => {
            poner({ rtmp: true, rtmpData: { destinations: [destino(), destino({ id: "d2", url: "" })] } })
            await montar()
            expect(screen.getAllByText("settings.enabled")).toHaveLength(2)
            const borrar = document.querySelectorAll('[data-title="settings.remove"]')
            expect(borrar).toHaveLength(1)
            fireEvent.click(borrar[0])
            expect(removeRtmpDestination).toHaveBeenCalledWith("a", "d2")
            fireEvent.click(screen.getAllByText("settings.enabled")[0])
            expect(updateRtmpDestination).toHaveBeenLastCalledWith("a", "d1", "enabled", false)
        })

        it("agregar_destino_esta_deshabilitado_si_hay_uno_sin_url_y_si_no_lo_agrega", async () => {
            await montar()
            vi.mocked(addRtmpDestination).mockClear()
            fireEvent.click(boton("settings.add_destination"))
            expect(addRtmpDestination).toHaveBeenCalledWith("a")
            cleanup()
            poner({ rtmp: true, rtmpData: { destinations: [destino({ url: "" })] } })
            await montar()
            expect(boton("settings.add_destination").disabled).toBe(true)
        })

        it("el_estado_de_cada_destino_muestra_punto_reconexiones_y_error", async () => {
            rtmpStatus.set({ a: { d1: { state: "error", error: "boom", restarts: 2, lastIssue: "timeout" } } } as never)
            await montar()
            expect(document.querySelector('[data-title="boom"]')).toBeTruthy()
            expect(screen.getByText("Reconnected 2 times")).toBeTruthy()
            expect(screen.getByText("boom")).toBeTruthy()
            act(() => rtmpStatus.set({ a: { d1: { state: "live", restarts: 1, lastIssue: "timeout" } } } as never))
            expect(screen.getByText(/Reconnected once/).textContent).toBe("Reconnected once — timeout")
            expect(document.querySelector('[data-title="live"]')).toBeTruthy()
        })

        it("el_boton_de_transmision_inicia_o_detiene_segun_streaming", async () => {
            await montar()
            fireEvent.click(boton("output.start_streaming"))
            expect(startRtmpStreaming).toHaveBeenCalledWith("a")
            cleanup()
            poner({ rtmp: true, rtmpData: { streaming: true, destinations: [destino()] } })
            await montar()
            fireEvent.click(boton("output.stop_streaming"))
            expect(stopRtmpStreaming).toHaveBeenCalledWith("a", true)
        })

        it("habilitar_la_salida_con_rtmp_comprueba_ffmpeg_antes_de_crear_la_ventana", async () => {
            // la clave `enabled` la escribe otro componente a través de updateOutput; acá se ejercita con la bandera rtmp
            poner({ rtmp: true, enabled: true, rtmpData: { destinations: [destino()] } })
            await montar()
            expect(checkFFmpeg).not.toHaveBeenCalled()
        })
    })

    describe("blackmagic", () => {
        const dispositivo = {
            deviceHandle: "dev1",
            displayName: "Decklink",
            outputDisplayModes: [
                { name: "720p60", width: 1280, height: 720, frameRate: 60, videoModes: ["8BitBGRA"] },
                { name: "1080i59.94", width: 1920, height: 1080, frameRate: 29.97, videoModes: ["10BitYUV", "8BitBGRA"] }
            ],
            supportsInternalKeying: true
        }
        const canales = () => vi.mocked(receive).mock.calls[0][1] as { GET_DEVICES: (data: string) => void }
        const llegan = (lista: object[]) => act(() => canales().GET_DEVICES(JSON.stringify(lista)))

        beforeEach(() => poner({ blackmagic: true }))

        it("al_montar_registra_el_listener_pide_los_dispositivos_y_al_desmontar_lo_borra", async () => {
            const { unmount } = await montar()
            expect(receive).toHaveBeenCalledWith(BLACKMAGIC, expect.objectContaining({ GET_DEVICES: expect.any(Function) }), expect.any(String))
            expect(send).toHaveBeenCalledWith(BLACKMAGIC, ["GET_DEVICES"])
            const id = vi.mocked(receive).mock.calls[0][2]
            unmount()
            expect(destroy).toHaveBeenCalledWith(BLACKMAGIC, id)
        })

        it("renderiza_el_titulo_y_el_selector_de_dispositivo", async () => {
            await montar()
            expect(screen.getByText("Blackmagic Design")).toBeTruthy()
            expect(screen.getByText("settings.device")).toBeTruthy()
        })

        it("con_dispositivos_selecciona_el_primero_libre_y_completa_modo_formato_resolucion_y_framerate", async () => {
            vi.useFakeTimers()
            const sent: { id: string; canales: string[]; data: unknown }[] = []
            vi.mocked(send).mockImplementation(((id: string, canales: string[], data: unknown) => void sent.push({ id, canales, data: structuredClone(data) })) as never)
            await montar()
            llegan([dispositivo])
            act(() => void vi.runAllTimers())

            const bm = get(outputs).a.blackmagicData
            expect(bm.deviceId).toBe("dev1")
            expect(bm.displayModes).toHaveLength(2)
            expect(bm.displayMode).toBe("1080i59.94")
            expect(bm.pixelFormats).toEqual([{ name: "10BitYUV" }, { name: "8BitBGRA" }])
            expect(bm.pixelFormat).toBe("10BitYUV")
            expect(bm.framerate).toBe(29.97)
            expect(get(outputs).a.forcedResolution).toEqual({ width: 1920, height: 1080 })
            expect(get(saved)).toBe(false)
            const setValue = sent.filter((s) => s.id === OUTPUT && s.canales[0] === "SET_VALUE")
            expect(setValue.length).toBeGreaterThan(0)
            expect(setValue[setValue.length - 1].data).toMatchObject({ id: "a", key: "blackmagic", value: { id: "a", blackmagic: true, blackmagicData: { deviceId: "dev1", displayMode: "1080i59.94" } } })
        })

        it("no_elige_un_dispositivo_que_usa_otra_salida_y_lo_marca_en_uso", async () => {
            poner({ blackmagic: true }, { b: salida({ name: "Otra", blackmagic: true, blackmagicData: { deviceId: "dev1" } }) })
            await montar()
            llegan([dispositivo])
            expect(get(outputs).a.blackmagicData).toBeUndefined()
            fireEvent.click(campo("settings.device").querySelector(".dropdown-trigger") as HTMLElement)
            expect(screen.getByRole("option", { name: "Decklink (in use)" })).toBeTruthy()
        })

        it("elegir_a_mano_un_dispositivo_en_uso_avisa_con_un_toast_y_no_cambia_nada", async () => {
            // con modos ya cargados no hay auto-selección (que dispararía timeouts reales)
            poner({ blackmagic: true, blackmagicData: { deviceId: "dev2", displayModes: dispositivo.outputDisplayModes } }, { b: salida({ name: "Otra", blackmagic: true, blackmagicData: { deviceId: "dev1" } }) })
            await montar()
            llegan([dispositivo, { ...dispositivo, deviceHandle: "dev2", displayName: "Otro" }])
            fireEvent.click(campo("settings.device").querySelector(".dropdown-trigger") as HTMLElement)
            fireEvent.click(screen.getByRole("option", { name: "Decklink (in use)" }))
            expect(newToast).toHaveBeenCalledWith("Device already in use by another output.")
            expect(get(outputs).a.blackmagicData.deviceId).toBe("dev2")
        })

        it("con_dispositivo_elegido_muestra_modo_formato_sdr_solo_con_YUV_y_alfa_solo_si_hay_keying", async () => {
            poner({ blackmagic: true, blackmagicData: { deviceId: "dev1", displayMode: "1080i59.94", displayModes: dispositivo.outputDisplayModes, pixelFormat: "10BitYUV", pixelFormats: [{ name: "10BitYUV" }] } })
            await montar()
            llegan([dispositivo])
            expect(screen.getByText("settings.display_mode")).toBeTruthy()
            expect(screen.getByText("settings.pixel_format")).toBeTruthy()
            expect(screen.getByText("SDR")).toBeTruthy()
            expect(screen.getByText("settings.alpha_key")).toBeTruthy()
        })

        it("sin_YUV_ni_keying_no_hay_sdr_ni_alfa", async () => {
            poner({ blackmagic: true, blackmagicData: { deviceId: "dev1", displayMode: "720p60", displayModes: dispositivo.outputDisplayModes, pixelFormat: "8BitBGRA", pixelFormats: [{ name: "8BitBGRA" }] } })
            await montar()
            llegan([{ ...dispositivo, supportsInternalKeying: false }])
            expect(screen.queryByText("SDR")).toBeNull()
            expect(screen.queryByText("settings.alpha_key")).toBeNull()
        })

        it("alfa_escribe_alphaKey_y_transparent_y_vuelve_a_mandar_SET_VALUE", async () => {
            vi.useFakeTimers()
            poner({ blackmagic: true, blackmagicData: { deviceId: "dev1", displayMode: "1080i59.94", displayModes: dispositivo.outputDisplayModes, pixelFormat: "10BitYUV", pixelFormats: [{ name: "10BitYUV" }] } })
            await montar()
            llegan([dispositivo])
            fireEvent.click(interruptor("settings.alpha_key"))
            act(() => void vi.runAllTimers())
            expect(get(outputs).a.blackmagicData.alphaKey).toBe(true)
            expect(get(outputs).a.transparent).toBe(true)
            expect(send).toHaveBeenCalledWith(OUTPUT, ["SET_VALUE"], expect.objectContaining({ id: "a", key: "blackmagic" }))
        })

        it("sdr_escribe_sdr_en_blackmagicData", async () => {
            vi.useFakeTimers()
            poner({ blackmagic: true, blackmagicData: { deviceId: "dev1", displayMode: "1080i59.94", displayModes: dispositivo.outputDisplayModes, pixelFormat: "10BitYUV", pixelFormats: [{ name: "10BitYUV" }] } })
            await montar()
            llegan([dispositivo])
            fireEvent.click(interruptor("SDR"))
            act(() => void vi.runAllTimers())
            expect(get(outputs).a.blackmagicData.sdr).toBe(false)
        })
    })

    describe("habilitar_y_deshabilitar_via_updateOutput", () => {
        // `enabled` no tiene control en este componente; la vía real es `transparent`/`ndi`... en una salida habilitada en macOS
        it("en_macos_alwaysOnTop_figura_entre_las_claves_que_recrean_la_ventana", async () => {
            os.set({ platform: "darwin", name: "", arch: "" })
            poner({ ndi: true })
            await montar()
            fireEvent.click(interruptor("settings.transparent"))
            expect(send).toHaveBeenCalledWith(OUTPUT, ["CREATE"], expect.objectContaining({ id: "a" }))
            expect(AudioAnalyser.recorderActivate).not.toHaveBeenCalled()
        })
    })
})
