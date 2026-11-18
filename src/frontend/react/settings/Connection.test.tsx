// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { checkWindowCapture } from "../../components/helpers/output"
import { requestMain, sendMain } from "../../IPC/main"
import { activePage, activePopup, activeShow, activeTriggerFunction, cloudSyncData, connections, contentProviderData, dictionary, disabledServers, maxConnections, notFound, obsData, outputs, popupData, ports, providerConnections, saved, serverData, special } from "../../stores"
import { startRemoteController, stopRemoteController } from "../../utils/remoteController"
import { contentProviderSync } from "../../utils/startup"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Connection } from "./Connection"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../IPC/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../components/helpers/output", () => ({ checkWindowCapture: vi.fn() }))
vi.mock("../../utils/remoteController", () => ({ startRemoteController: vi.fn(), stopRemoteController: vi.fn() }))
vi.mock("../../utils/startup", () => ({ contentProviderSync: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
// El port Tip se mockea como isla: acá sólo importa con qué props se monta.
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

const respuestas: { ip?: string[]; teams: { id: string; name: string; current: boolean }[]; switchTeam: { success: boolean }; disconnect: { success: boolean } } = { ip: undefined, teams: [], switchTeam: { success: true }, disconnect: { success: true } }

let restaurar: () => void = () => {}
beforeEach(() => {
    respuestas.ip = ["10.0.0.5"]
    respuestas.teams = []
    respuestas.switchTeam = { success: true }
    respuestas.disconnect = { success: true }
    vi.mocked(requestMain).mockImplementation((async (id: Main, _value?: unknown, callback?: (v: unknown) => void) => {
        if (id === Main.IP) return respuestas.ip
        if (id === Main.ONSTAGE_GET_TEAMS) return respuestas.teams
        if (id === Main.ONSTAGE_SWITCH_TEAM) return respuestas.switchTeam
        if (id === Main.PROVIDER_DISCONNECT) return void callback?.(respuestas.disconnect)
        return undefined
    }) as never)
    restaurar = setStoresForTest([
        storeEntry(connections, {}),
        storeEntry(serverData, {}),
        storeEntry(disabledServers, { remote: false, stage: false, controller: true, output_stream: true }),
        storeEntry(ports, { remote: 5510, stage: 5511, controller: 5512, output_stream: 5513, companion: 5514 }),
        storeEntry(maxConnections, 10),
        storeEntry(special, {}),
        storeEntry(outputs, {}),
        storeEntry(cloudSyncData, {}),
        storeEntry(providerConnections, {}),
        storeEntry(contentProviderData, {}),
        storeEntry(obsData, {}),
        storeEntry(activeTriggerFunction, ""),
        storeEntry(popupData, {}),
        storeEntry(activePopup, null),
        storeEntry(activeShow, null),
        storeEntry(activePage, "edit"),
        storeEntry(notFound, { show: [], bible: [] }),
        storeEntry(saved, true),
        storeEntry(dictionary, { settings: { connect_to: "Conectar $1", disconnect_from: "Desconectar $1" }, cloud: { sync: "Sincronizar" } })
    ] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

const montar = async () => {
    render(<Connection />)
    await act(async () => {})
}
const interruptores = () => [...document.querySelectorAll('[role="switch"]')] as HTMLElement[]
const toggle = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const boton = (texto: string) => screen.getByText(texto).closest("button") as HTMLButtonElement
const arranque = () => vi.mocked(sendMain).mock.calls.filter((c) => c[0] === Main.START)
const islas = () => [...document.querySelectorAll("[data-isla]")].map((e) => JSON.parse(e.getAttribute("data-props")!))

describe("Connection", () => {
    it("renderiza_lo_principal_servidores_remote_clicker_proveedores_y_obs", async () => {
        await montar()
        for (const t of ["RemoteShow", "StageShow", "ControlShow", "OutputShow", "API", "Remote Clicker", "Conectar ChurchApps", "Conectar APlay", "Conectar OnStage", "OBS Studio Controller"]) expect(screen.getByText(t)).toBeTruthy()
        expect(screen.getByText("WebSocket/REST/OSC/Companion")).toBeTruthy()
        expect(screen.getByText("settings.content_provider")).toBeTruthy()
        expect(requestMain).toHaveBeenCalledWith(Main.IP)
        expect(interruptores()).toHaveLength(7)
    })

    it("sin_ip_conocida_usa_localhost_y_no_arranca_los_servidores_al_montar", async () => {
        respuestas.ip = undefined
        await montar()
        fireEvent.click(boton("RemoteShow"))
        expect(get(popupData)).toEqual({ ip: "localhost", id: "remote" })
        expect(arranque()).toHaveLength(0)
    })

    it("el_boton_de_cada_servidor_abre_connect_con_la_ip_y_el_id", async () => {
        disabledServers.set({ remote: false, stage: false, controller: false, output_stream: false })
        await montar()
        for (const [nombre, id] of [
            ["RemoteShow", "remote"],
            ["StageShow", "stage"],
            ["ControlShow", "controller"],
            ["OutputShow", "output_stream"]
        ]) {
            popupData.set({})
            activePopup.set(null)
            fireEvent.click(boton(nombre))
            expect(get(popupData)).toEqual({ ip: "10.0.0.5", id })
            expect(get(activePopup)).toBe("connect")
        }
    })

    it("un_servidor_apagado_tiene_su_boton_deshabilitado", async () => {
        await montar()
        expect(boton("RemoteShow").disabled).toBe(false)
        expect(boton("ControlShow").disabled).toBe(true)
        expect(boton("OutputShow").disabled).toBe(true)
        expect(boton("API").disabled).toBe(true)
    })

    it("el_contador_de_conexiones_sale_de_connections_en_mayusculas", async () => {
        connections.set({ REMOTE: { a: {}, b: {} } })
        await montar()
        expect(boton("RemoteShow").textContent).toContain("2")
        expect(boton("StageShow").textContent).not.toMatch(/\d/)
    })

    it("output_stream_con_sendAudio_muestra_el_icono_de_volumen", async () => {
        const sin = (await montar(), boton("OutputShow").querySelectorAll("svg").length)
        cleanup()
        serverData.set({ output_stream: { sendAudio: true } } as never)
        await montar()
        expect(boton("OutputShow").querySelectorAll("svg").length).toBe(sin + 1)
    })

    it("apagar_remote_escribe_disabledServers_true_y_reinicia_los_servidores", async () => {
        await montar()
        fireEvent.click(interruptores()[0])
        expect(get(disabledServers).remote).toBe(true)
        expect(get(activePopup)).toBeNull()
        expect(arranque()).toEqual([[Main.START, { ports: get(ports), max: 10, disabled: get(disabledServers), data: get(serverData) }]])
    })

    it("encender_remote_escribe_false_abre_connect_y_reinicia", async () => {
        disabledServers.set({ remote: true, stage: false, controller: true, output_stream: true })
        await montar()
        fireEvent.click(interruptores()[0])
        expect(get(disabledServers).remote).toBe(false)
        expect(get(popupData)).toEqual({ ip: "10.0.0.5", id: "remote" })
        expect(get(activePopup)).toBe("connect")
        expect(arranque()).toHaveLength(1)
    })

    it("los_servidores_apagados_por_defecto_se_encienden_con_false_explicito", async () => {
        await montar()
        expect(interruptores()[2].getAttribute("aria-checked")).toBe("false")
        fireEvent.click(interruptores()[2])
        expect(get(disabledServers).controller).toBe(false)
        expect(interruptores()[2].getAttribute("aria-checked")).toBe("true")
        expect(get(activePopup)).toBe("connect")
    })

    it("encender_output_stream_pide_captura_de_ventana_y_borra_un_outputId_inexistente", async () => {
        serverData.set({ output_stream: { outputId: "fantasma", sendAudio: true } } as never)
        await montar()
        fireEvent.click(interruptores()[3])
        expect(get(disabledServers).output_stream).toBe(false)
        expect(get(serverData).output_stream).toEqual({ sendAudio: true })
        expect(checkWindowCapture).toHaveBeenCalledTimes(1)
    })

    it("el_reinicio_al_encender_output_stream_sale_con_el_outputId_inexistente_ya_borrado", async () => {
        const enviados: unknown[] = []
        vi.mocked(sendMain).mockImplementation(((id: Main, data?: unknown) => {
            if (id === Main.START) enviados.push(structuredClone(data))
        }) as never)
        serverData.set({ output_stream: { outputId: "fantasma", sendAudio: true } } as never)
        await montar()
        fireEvent.click(interruptores()[3])
        expect(enviados).toHaveLength(1)
        expect((enviados[0] as { data: { output_stream: object } }).data.output_stream).toEqual({ sendAudio: true })
    })

    it("encender_output_stream_conserva_un_outputId_que_existe", async () => {
        outputs.set({ o1: {} } as never)
        serverData.set({ output_stream: { outputId: "o1" } } as never)
        await montar()
        fireEvent.click(interruptores()[3])
        expect(get(serverData).output_stream).toEqual({ outputId: "o1" })
    })

    it("apagar_output_stream_no_pide_captura", async () => {
        disabledServers.set({ remote: false, stage: false, controller: true, output_stream: false })
        await montar()
        fireEvent.click(interruptores()[3])
        expect(get(disabledServers).output_stream).toBe(true)
        expect(checkWindowCapture).not.toHaveBeenCalled()
    })

    it("companion_encendido_guarda_enabled_manda_SERVER_DATA_y_arranca_el_websocket_con_puerto_y_clave", async () => {
        serverData.set({ companion: { password: "pw" } } as never)
        await montar()
        fireEvent.click(interruptores()[4])
        expect(get(serverData).companion).toEqual({ password: "pw", enabled: true })
        expect(sendMain).toHaveBeenCalledWith(Main.SERVER_DATA, get(serverData))
        expect(sendMain).toHaveBeenCalledWith(Main.WEBSOCKET_START, { port: 5514, password: "pw" })
        expect(arranque()).toHaveLength(0)
    })

    it("companion_apagado_para_el_websocket", async () => {
        serverData.set({ companion: { enabled: true } } as never)
        await montar()
        expect(boton("API").disabled).toBe(false)
        fireEvent.click(interruptores()[4])
        expect(get(serverData).companion.enabled).toBe(false)
        expect(sendMain).toHaveBeenCalledWith(Main.WEBSOCKET_STOP)
    })

    it("remote_clicker_esta_deshabilitado_sin_remoteController_y_abre_connect_con_el_", async () => {
        await montar()
        expect(boton("Remote Clicker").disabled).toBe(true)
        special.set({ remoteController: true })
        await act(async () => {})
        fireEvent.click(boton("Remote Clicker"))
        expect(get(popupData)).toEqual({ remoteController: true })
        expect(get(activePopup)).toBe("connect")
    })

    it("encender_el_remote_clicker_guarda_abre_connect_y_arranca_si_hay_id", async () => {
        special.set({ remoteControllerId: "abc", otro: 1 })
        await montar()
        fireEvent.click(interruptores()[5])
        expect(get(special)).toEqual({ remoteControllerId: "abc", otro: 1, remoteController: true })
        expect(get(popupData)).toEqual({ remoteController: true })
        expect(get(activePopup)).toBe("connect")
        expect(startRemoteController).toHaveBeenCalledTimes(1)
    })

    it("encender_el_remote_clicker_sin_id_no_arranca", async () => {
        await montar()
        fireEvent.click(interruptores()[5])
        expect(startRemoteController).not.toHaveBeenCalled()
    })

    it("apagar_el_remote_clicker_guarda_false_y_lo_detiene", async () => {
        special.set({ remoteController: true })
        await montar()
        fireEvent.click(interruptores()[5])
        expect(get(special).remoteController).toBe(false)
        expect(stopRemoteController).toHaveBeenCalledTimes(1)
        expect(get(activePopup)).toBeNull()
    })

    it("open_connection_abre_connect_para_ese_servidor_y_limpia_el_disparador", async () => {
        await montar()
        act(() => activeTriggerFunction.set("open_connection_stage"))
        expect(get(popupData)).toEqual({ ip: "10.0.0.5", id: "stage" })
        expect(get(activePopup)).toBe("connect")
        expect(get(activeTriggerFunction)).toBe("")
    })

    it("open_connection_espera_a_conocer_la_ip", async () => {
        respuestas.ip = undefined
        await montar()
        act(() => activeTriggerFunction.set("open_connection_stage"))
        expect(get(activePopup)).toBeNull()
        expect(get(activeTriggerFunction)).toBe("open_connection_stage")
    })

    describe("proveedores de contenido", () => {
        it("conectar_ChurchApps_limpia_cloudOnly_inicializa_cloudSyncData_y_pide_los_servicios", async () => {
            special.set({ churchAppsCloudOnly: true, x: 1 })
            providerConnections.set({})
            await montar()
            fireEvent.click(boton("Conectar ChurchApps"))
            expect(sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "churchApps", cloudOnly: true })
            expect(get(special)).toEqual({ x: 1 })
            expect(get(cloudSyncData)).toEqual({ enabled: false, id: "churchApps" })
        })

        it("conectar_ChurchApps_no_pisa_un_cloudSyncData_existente", async () => {
            cloudSyncData.set({ enabled: true, id: "churchApps" })
            await montar()
            fireEvent.click(boton("Conectar ChurchApps"))
            expect(get(cloudSyncData)).toEqual({ enabled: true, id: "churchApps" })
            expect(sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "churchApps", cloudOnly: false })
        })

        it("conectar_APlay_y_OnStage_piden_sus_servicios_sin_tocar_special", async () => {
            await montar()
            fireEvent.click(boton("Conectar APlay"))
            expect(sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "amazinglife", cloudOnly: false })
            fireEvent.click(boton("Conectar OnStage"))
            expect(sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "onstage", cloudOnly: false })
            expect(get(special)).toEqual({})
        })

        it("con_ChurchApps_conectado_muestra_desconectar_sync_opciones_y_origen", async () => {
            providerConnections.set({ churchApps: true })
            await montar()
            expect(screen.queryByText("Conectar ChurchApps")).toBeNull()
            expect(screen.getByText("Content Provider: ChurchApps")).toBeTruthy()
            expect(screen.getByText("Song origin")).toBeTruthy()
            expect(islas()).toEqual([])
        })

        it("desconectar_ChurchApps_pide_PROVIDER_DISCONNECT_y_en_exito_marca_false", async () => {
            providerConnections.set({ churchApps: true })
            await montar()
            fireEvent.click(boton("Desconectar ChurchApps"))
            expect(requestMain).toHaveBeenCalledWith(Main.PROVIDER_DISCONNECT, { providerId: "churchApps" }, expect.any(Function))
            expect(get(providerConnections).churchApps).toBe(false)
        })

        it("si_el_disconnect_falla_sigue_conectado", async () => {
            respuestas.disconnect = { success: false }
            providerConnections.set({ churchApps: true })
            await montar()
            fireEvent.click(boton("Desconectar ChurchApps"))
            expect(get(providerConnections).churchApps).toBe(true)
        })

        it("con_cloud_sync_de_churchApps_activo_desconectar_solo_marca_cloudOnly", async () => {
            providerConnections.set({ churchApps: true })
            cloudSyncData.set({ enabled: true, id: "churchApps" })
            await montar()
            fireEvent.click(boton("Desconectar ChurchApps"))
            expect(requestMain).not.toHaveBeenCalledWith(Main.PROVIDER_DISCONNECT, expect.anything(), expect.anything())
            expect(get(special).churchAppsCloudOnly).toBe(true)
        })

        it("con_cloudOnly_se_ofrecen_otra_vez_las_conexiones", async () => {
            providerConnections.set({ churchApps: true })
            special.set({ churchAppsCloudOnly: true })
            await montar()
            expect(screen.getByText("Conectar ChurchApps")).toBeTruthy()
        })

        it("sincronizar_llama_a_contentProviderSync_y_vuelve_a_la_pantalla_de_shows", async () => {
            providerConnections.set({ churchApps: true })
            activeShow.set({ id: "x", type: "show" } as never)
            notFound.set({ show: ["a"], bible: ["b"] })
            await montar()
            fireEvent.click(boton("Sincronizar"))
            expect(contentProviderSync).toHaveBeenCalledWith()
            expect(get(activeShow)).toBeNull()
            expect(get(activePage)).toBe("show")
            expect(get(notFound)).toEqual({ show: [], bible: [] })
        })

        it("el_boton_de_categorias_abre_sync_categories_y_el_de_b1_abre_la_url", async () => {
            providerConnections.set({ churchApps: true })
            await montar()
            fireEvent.click(document.querySelector('[data-title="<b>popup.sync_categories:</b> settings.sync_categories_tip"]') as HTMLElement)
            expect(get(activePopup)).toBe("sync_categories")
            fireEvent.click(document.querySelector('[data-title="B1.Church"]') as HTMLElement)
            expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://b1.church")
        })

        it("el_origen_de_canciones_de_churchApps_escribe_songOrigin_y_marca_sin_guardar", async () => {
            providerConnections.set({ churchApps: true })
            await montar()
            fireEvent.click(screen.getByText("Song origin").closest(".textfield, div")!.parentElement!.querySelector(".dropdown-trigger") as HTMLElement)
            fireEvent.click(screen.getByText("Always use local instance"))
            expect(get(contentProviderData).churchApps).toEqual({ songOrigin: "local" })
            expect(get(saved)).toBe(false)
        })

        it("con_cloud_sync_activo_avisa_con_un_Tip_de_tipo_warning", async () => {
            providerConnections.set({ churchApps: true })
            cloudSyncData.set({ enabled: true })
            await montar()
            expect(islas()).toEqual([{ type: "warning", value: "This is unrelated to the Cloud sync found in 'Files'. This is for the content manager / curriculum.", top: 20 }])
        })

        it("APlay_conectado_solo_ofrece_desconectar", async () => {
            providerConnections.set({ amazinglife: true })
            await montar()
            expect(screen.getByText("Content Provider: APlay")).toBeTruthy()
            fireEvent.click(boton("Desconectar APlay"))
            expect(requestMain).toHaveBeenCalledWith(Main.PROVIDER_DISCONNECT, { providerId: "amazinglife" }, expect.any(Function))
            expect(get(providerConnections).amazinglife).toBe(false)
        })

        it("OnStage_conectado_pide_los_equipos_y_ofrece_sync_url_y_autoSync", async () => {
            providerConnections.set({ onstage: true })
            await montar()
            expect(requestMain).toHaveBeenCalledWith(Main.ONSTAGE_GET_TEAMS)
            expect(screen.getByText("Content Provider: OnStage")).toBeTruthy()
            expect(toggle("settings.auto_sync_startup").getAttribute("aria-checked")).toBe("true")
            fireEvent.click(toggle("settings.auto_sync_startup"))
            expect(get(contentProviderData).onstage).toEqual({ autoSync: false })
            expect(get(saved)).toBe(false)
            fireEvent.click(document.querySelector('[data-title="OnStage"]') as HTMLElement)
            expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://getonstage.app")
            fireEvent.click(boton("Sincronizar"))
            expect(contentProviderSync).toHaveBeenCalledTimes(1)
        })

        it("el_selector_de_equipo_solo_aparece_con_mas_de_un_equipo_y_cambiar_pide_ONSTAGE_SWITCH_TEAM", async () => {
            providerConnections.set({ onstage: true })
            respuestas.teams = [{ id: "t1", name: "Uno", current: true }]
            await montar()
            expect(screen.queryByText("Team")).toBeNull()
            cleanup()
            respuestas.teams = [
                { id: "t1", name: "Uno", current: true },
                { id: "t2", name: "Dos", current: false }
            ]
            await montar()
            expect(screen.getByText("Team")).toBeTruthy()
            const pedidos = () => vi.mocked(requestMain).mock.calls.filter((c) => c[0] === Main.ONSTAGE_GET_TEAMS).length
            const antes = pedidos()
            fireEvent.click(screen.getByText("Team").closest("div")!.parentElement!.querySelector(".dropdown-trigger") as HTMLElement)
            fireEvent.click(screen.getByText("Dos"))
            await act(async () => {})
            expect(requestMain).toHaveBeenCalledWith(Main.ONSTAGE_SWITCH_TEAM, { teamId: "t2" })
            expect(contentProviderSync).toHaveBeenCalledTimes(1)
            expect(pedidos()).toBe(antes + 1)
        })

        it("si_el_cambio_de_equipo_falla_no_sincroniza", async () => {
            providerConnections.set({ onstage: true })
            respuestas.switchTeam = { success: false }
            respuestas.teams = [
                { id: "t1", name: "Uno", current: true },
                { id: "t2", name: "Dos", current: false }
            ]
            await montar()
            fireEvent.click(screen.getByText("Team").closest("div")!.parentElement!.querySelector(".dropdown-trigger") as HTMLElement)
            fireEvent.click(screen.getByText("Dos"))
            await act(async () => {})
            expect(contentProviderSync).not.toHaveBeenCalled()
        })

        it("el_origen_de_canciones_de_onstage_escribe_en_contentProviderData_onstage", async () => {
            providerConnections.set({ onstage: true })
            await montar()
            fireEvent.click(screen.getByText("Song origin").closest("div")!.parentElement!.querySelector(".dropdown-trigger") as HTMLElement)
            fireEvent.click(screen.getByText("Always use online instance"))
            expect(get(contentProviderData).onstage).toEqual({ songOrigin: "online" })
        })

        it("al_desconectar_OnStage_la_lista_de_equipos_se_vacia_y_al_reconectar_se_vuelve_a_pedir", async () => {
            providerConnections.set({ onstage: true })
            respuestas.teams = [
                { id: "t1", name: "Uno", current: true },
                { id: "t2", name: "Dos", current: false }
            ]
            await montar()
            expect(screen.getByText("Team")).toBeTruthy()
            await act(async () => providerConnections.set({}))
            expect(screen.queryByText("Team")).toBeNull()
            await act(async () => providerConnections.set({ onstage: true }))
            expect(vi.mocked(requestMain).mock.calls.filter((c) => c[0] === Main.ONSTAGE_GET_TEAMS)).toHaveLength(2)
        })
    })

    describe("OBS", () => {
        it("al_montar_escribe_ip_y_puerto_por_defecto_en_obsData", async () => {
            await montar()
            expect(get(obsData)).toEqual({ ip: "localhost", port: 4455 })
        })

        it("usa_la_ip_y_el_puerto_guardados", async () => {
            obsData.set({ ip: "10.1.1.1", port: 4466, enabled: false })
            await montar()
            expect(get(obsData)).toEqual({ ip: "10.1.1.1", port: 4466, enabled: false })
        })

        it("encender_escribe_enabled_y_muestra_el_Tip_de_posicion_y_apagar_lo_deja_listo_para_el_proximo", async () => {
            await montar()
            fireEvent.click(toggle("OBS Studio Controller"))
            expect(get(obsData).enabled).toBe(true)
            expect(islas()).toEqual([{ value: "edit.position: guide_title.drawer > tabs.functions > OBS Studio", top: 15 }])
        })

        it("si_arranca_habilitado_no_muestra_el_Tip_hasta_apagarlo_y_volver_a_encenderlo", async () => {
            obsData.set({ enabled: true })
            await montar()
            expect(islas()).toEqual([])
            fireEvent.click(toggle("OBS Studio Controller"))
            expect(get(obsData).enabled).toBe(false)
            fireEvent.click(toggle("OBS Studio Controller"))
            expect(islas()).toHaveLength(1)
        })

        it("el_menu_trae_ip_y_puerto_que_escriben_en_obsData", async () => {
            obsData.set({ enabled: true })
            await montar()
            fireEvent.click(document.querySelector('[data-title="main.open"]') as HTMLElement)
            const ip = screen.getByText("IP").closest(".textfield")!.querySelector("input") as HTMLInputElement
            ip.value = "192.168.0.9"
            fireEvent.change(ip)
            expect(get(obsData).ip).toBe("192.168.0.9")
            const puerto = document.querySelector(".numberfield input") as HTMLInputElement
            fireEvent.input(puerto, { target: { value: "4999" } })
            fireEvent.change(puerto, { target: { value: "4999" } })
            expect(get(obsData).port).toBe(4999)
            expect(get(obsData).enabled).toBe(true)
        })
    })
})
