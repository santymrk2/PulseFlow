// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { AudioAnalyser } from "../../shared/audio/audioAnalyser"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, dictionary, maxConnections, os, outputs, popupData, ports, serverData, special } from "../../shared/core/stores"
import { startRemoteController, stopRemoteController } from "../../app/wiring/remoteController"
import { clearFields, fields, fire } from "../../shared/test/kitMocks"
import { clearIslands, islands } from "../../shared/test/islandMock"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Connect } from "./Connect"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: { recorderActivate: vi.fn() } }))
vi.mock("../../app/wiring/remoteController", () => ({ startRemoteController: vi.fn(), stopRemoteController: vi.fn() }))
vi.mock("qrcode-generator", () => ({
    default: () => {
        let text = ""
        return { addData: (t: string) => (text = t), make: () => {}, createImgTag: () => `<img data-qr="${text}">` }
    }
}))
vi.mock("../../react/main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Tip") }))
vi.mock("../../shared/ui/kit/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(data: object, extra: ReturnType<typeof looseEntry>[] = []) {
    restaurar = setStoresForTest([
        looseEntry(popupData, data),
        looseEntry(special, { remoteControllerId: "abc123" }),
        looseEntry(ports, { stage: 5511, remote: 5510 }),
        looseEntry(os, { name: "MiMac", platform: "darwin" }),
        looseEntry(serverData, {}),
        looseEntry(outputs, { o1: { name: "Salida", enabled: true }, o2: { name: "Off", enabled: false } }),
        storeEntry(maxConnections, 10),
        storeEntry(activePopup, "connect"),
        storeEntry(dictionary, { settings: { connect: "Conectar" }, error: { ip: "Sin IP" } }),
        ...extra
    ] as never)
    return render(<Connect />)
}
const qr = () => document.querySelector("img[data-qr]")?.getAttribute("data-qr")
const abrirOpciones = () => fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Connect", () => {
    it("muestra_la_url_con_ip_y_puerto_el_QR_y_vacía_popupData", () => {
        montar({ id: "stage", ip: "192.168.1.5" })
        expect(screen.getByText("http://192.168.1.5:5511")).toBeTruthy()
        expect(qr()).toBe("http://192.168.1.5:5511")
        expect(get(popupData)).toEqual({})
    })

    it("con_ip_localhost_avisa_y_no_muestra_QR", () => {
        montar({ id: "stage", ip: "localhost" })
        expect(screen.getByText("Sin IP")).toBeTruthy()
        expect(qr()).toBeUndefined()
    })

    it("usa_el_puerto_por_defecto_si_no_hay_uno_guardado", () => {
        montar({ id: "output_stream", ip: "10.0.0.2" })
        expect(screen.getByText("http://10.0.0.2:5513")).toBeTruthy()
    })

    it("con_nombre_de_host_arma_la_url_con_el_nombre_del_equipo", () => {
        montar({ id: "remote", ip: "10.0.0.2" }, [looseEntry(special, { remoteControllerId: "abc123", connectionHostname: true })])
        expect(screen.getByText("http://mimac:5510")).toBeTruthy()
    })

    it("en_Windows_el_host_lleva_.local", () => {
        montar({ id: "remote", ip: "10.0.0.2" }, [looseEntry(special, { remoteControllerId: "abc123", connectionHostname: true }), looseEntry(os, { name: "PC", platform: "win32" })])
        expect(screen.getByText("http://pc.local:5510")).toBeTruthy()
    })

    it("companion_muestra_los_links_a_la_documentación_y_su_contraseña", () => {
        montar({ id: "companion", ip: "10.0.0.2" }, [looseEntry(serverData, { companion: { password: "clave" } })])
        expect(screen.getByText(/API Docs/)).toBeTruthy()
        expect(screen.getByText(/Bitfocus Companion Connection/)).toBeTruthy()
        expect(screen.getByText("clave")).toBeTruthy()
        expect(qr()).toBeUndefined()
        fireEvent.click(screen.getByText(/API Docs/))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://freeshow.app/api")
    })

    it("la_contraseña_de_remote_se_muestra", () => {
        montar({ id: "remote", ip: "10.0.0.2" }, [looseEntry(serverData, { remote: { password: "r1" } })])
        expect(screen.getByText("r1")).toBeTruthy()
    })

    it("hacer_clic_en_un_link_cierra_el_popup", () => {
        montar({ id: "stage", ip: "10.0.0.2" })
        fireEvent.mouseUp(screen.getByText("http://10.0.0.2:5511"))
        expect(get(activePopup)).toBeNull()
    })

    it("control_remoto_usa_la_url_del_controlador_el_tip_y_el_botón_reset_regenera_el_id", () => {
        montar({ remoteController: true, id: "stage", ip: "localhost" })
        expect(screen.getByText("https://freeshow.net/control?id=abc123")).toBeTruthy()
        expect(islands.Tip.props).toMatchObject({ value: "With this you don't need to connect to the same router.", top: 15 })
        expect(startRemoteController).not.toHaveBeenCalled()

        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        expect(stopRemoteController).toHaveBeenCalledWith("abc123")
        const nuevo = get(special).remoteControllerId as string
        expect(nuevo).not.toBe("abc123")
        expect(nuevo).toHaveLength(6)
        expect(startRemoteController).toHaveBeenCalledWith(nuevo)
    })

    it("sin_id_de_controlador_crea_uno_y_lo_arranca_sin_detener_nada", () => {
        montar({ remoteController: true, id: "stage", ip: "x" }, [looseEntry(special, {})])
        const nuevo = get(special).remoteControllerId as string
        expect(nuevo).toHaveLength(6)
        expect(startRemoteController).toHaveBeenCalledWith(nuevo)
        expect(stopRemoteController).not.toHaveBeenCalled()
    })

    it("el_botón_de_ayuda_abre_la_documentación", () => {
        montar({ id: "stage", ip: "10.0.0.2" })
        fireEvent.click(document.querySelector("button.popup-reset") as HTMLElement)
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://freeshow.app/docs/connecting")
    })

    it("opciones_cambiar_el_puerto_lo_guarda_en_ports", () => {
        montar({ id: "stage", ip: "10.0.0.2" })
        abrirOpciones()
        expect(fields["settings.port"]).toMatchObject({ value: 5511, min: 1025, max: 65535, defaultValue: 5511 })
        fire("settings.port", "onChange", 6000)
        expect(get(ports).stage).toBe(6000)
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("un_puerto_reservado_de_otro_servicio_marca_el_campo", () => {
        montar({ id: "stage", ip: "10.0.0.2" }, [looseEntry(ports, { stage: 5510 })])
        abrirOpciones()
        expect(document.querySelector(".isReserved, [class*='isReserved']")).toBeTruthy()
    })

    it("companion_cambiar_el_puerto_reinicia_el_websocket_si_está_activo", () => {
        montar({ id: "companion", ip: "10.0.0.2" }, [looseEntry(serverData, { companion: { enabled: true, password: "p" } })])
        abrirOpciones()
        fire("settings.port", "onChange", 5600)
        expect(get(ports).companion).toBe(5600)
        expect(sendMain).toHaveBeenCalledWith(Main.WEBSOCKET_START, { port: 5600, password: "p" })
    })

    it("companion_inactivo_no_reinicia", () => {
        montar({ id: "companion", ip: "10.0.0.2" })
        abrirOpciones()
        fire("settings.port", "onChange", 5600)
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("la_contraseña_de_remote_se_guarda_en_serverData_y_se_envía", () => {
        montar({ id: "remote", ip: "10.0.0.2" })
        abrirOpciones()
        fire("remote.password", "onChange", "nueva")
        expect(get(serverData)).toEqual({ remote: { password: "nueva" } })
        expect(sendMain).toHaveBeenCalledWith(Main.SERVER_DATA, { remote: { password: "nueva" } })
    })

    it("la_contraseña_de_companion_se_guarda_se_envía_y_reinicia", () => {
        montar({ id: "companion", ip: "10.0.0.2" }, [looseEntry(serverData, { companion: { enabled: true } })])
        abrirOpciones()
        fire("remote.password", "onChange", "x")
        expect(sendMain).toHaveBeenNthCalledWith(1, Main.SERVER_DATA, { companion: { enabled: true, password: "x" } })
        expect(sendMain).toHaveBeenNthCalledWith(2, Main.WEBSOCKET_START, { port: 5505, password: "x" })
    })

    it("output_stream_elige_la_salida_entre_las_activas_y_el_audio_activa_el_grabador", () => {
        montar({ id: "output_stream", ip: "10.0.0.2" }, [looseEntry(serverData, { output_stream: { sendAudio: true } })])
        abrirOpciones()
        expect(fields["midi.output"].options).toEqual([{ label: "Salida", value: "o1" }])
        expect(fields["midi.output"].allowEmpty).toBe(true)
        fire("midi.output", "onChange", "o1")
        expect(sendMain).toHaveBeenCalledWith(Main.SERVER_DATA, { output_stream: { sendAudio: true, outputId: "o1" } })

        fire("preview.audio", "onChange", true)
        expect(get(serverData).output_stream.sendAudio).toBe(true)
        expect(AudioAnalyser.recorderActivate).toHaveBeenCalledTimes(1)
        fire("preview.audio", "onChange", false)
        expect(AudioAnalyser.recorderActivate).toHaveBeenCalledTimes(1)
        expect(get(serverData).output_stream.sendAudio).toBe(false)
    })

    it("el_audio_sólo_aparece_si_ya_estaba_activado", () => {
        montar({ id: "output_stream", ip: "10.0.0.2" })
        abrirOpciones()
        expect(fields["preview.audio"]).toBeUndefined()
    })

    it("máximo_de_conexiones_y_nombre_de_host_se_guardan_y_companion_no_los_muestra", () => {
        montar({ id: "stage", ip: "10.0.0.2" })
        abrirOpciones()
        fire("settings.max_connections", "onChange", 25)
        expect(get(maxConnections)).toBe(25)
        fire("settings.use_hostname", "onChange", true)
        expect(get(special).connectionHostname).toBe(true)

        cleanup()
        restaurar()
        clearFields()
        montar({ id: "companion", ip: "10.0.0.2" })
        abrirOpciones()
        expect(fields["settings.max_connections"]).toBeUndefined()
    })

    it("cerrar_las_opciones_vuelve_a_la_url", () => {
        montar({ id: "stage", ip: "10.0.0.2" })
        abrirOpciones()
        expect(screen.queryByText("http://10.0.0.2:5511")).toBeNull()
        abrirOpciones()
        expect(screen.getByText("http://10.0.0.2:5511")).toBeTruthy()
    })
})
