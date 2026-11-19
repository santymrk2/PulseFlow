// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { ToMain } from "../../../types/IPC/ToMain"
import { receiveToMain, requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage, autosave, cloudSyncData, dataPath, driveData, driveKeys, providerConnections, saved, special, statusIndicator } from "../../shared/core/stores"
import { changeTeam, setupCloudSync, socketDisconnect, updateCloudDeviceName } from "../../utils/cloudSync"
import { startAutosave, wait } from "../../shared/utils/common"
import { validateKeys } from "../../shared/utils/drive"
import { save } from "../../utils/save"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Files } from "./Files"

const ahora = vi.hoisted(() => ({ previousAutosave: 0 }))
vi.mock("../../shared/utils/common", () => ({
    isMainWindow: () => false,
    get previousAutosave() {
        return ahora.previousAutosave
    },
    startAutosave: vi.fn(),
    wait: vi.fn(async () => "ended")
}))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener"), destroyMain: vi.fn() }))
vi.mock("../../utils/save", () => ({ save: vi.fn() }))
vi.mock("../../shared/utils/drive", () => ({ validateKeys: vi.fn() }))
vi.mock("../../utils/cloudSync", () => ({ changeTeam: vi.fn(), setupCloudSync: vi.fn(), socketDisconnect: vi.fn(async () => {}), updateCloudDeviceName: vi.fn() }))
// getFileName (FileField) vive en helpers/media, que arrastra el módulo de audio
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const respuestas: { mediaPath: string; providerDisconnect: { success: boolean }; readFile: { content?: string }; restore: { success: boolean; error?: string } } = { mediaPath: "", providerDisconnect: { success: true }, readFile: {}, restore: { success: true } }

let restaurar: () => void = () => {}
function preparar() {
    restaurar()
    restaurar = setStoresForTest([storeEntry(special, {}), storeEntry(autosave, "15min"), storeEntry(dataPath, "/datos/viejo"), storeEntry(saved, true), storeEntry(activePopup, null), storeEntry(alertMessage, ""), storeEntry(statusIndicator, ""), storeEntry(providerConnections, {}), storeEntry(cloudSyncData, {}), storeEntry(driveKeys, {}), storeEntry(driveData, { mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })])
}

beforeEach(() => {
    ahora.previousAutosave = 0
    respuestas.mediaPath = ""
    respuestas.providerDisconnect = { success: true }
    respuestas.readFile = {}
    respuestas.restore = { success: true }
    vi.mocked(requestMain).mockImplementation((async (id: Main, _value?: unknown, callback?: (v: unknown) => void) => {
        if (id === Main.GET_MEDIA_FOLDER_PATH) return respuestas.mediaPath
        if (id === Main.PROVIDER_DISCONNECT) return void callback?.(respuestas.providerDisconnect)
        if (id === Main.READ_FILE) return respuestas.readFile
        if (id === Main.RESTORE_CLOUD_BACKUP) return respuestas.restore
        return undefined
    }) as never)
    preparar()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
    vi.clearAllMocks()
})

const toggle = (label: string, index = 0) => screen.getAllByText(label)[index].closest('[role="switch"]') as HTMLElement
const pulsar = (label: string, index = 0) => fireEvent.click(toggle(label, index))
const campo = (label: string, indice = 0) => screen.getAllByText(label)[indice].closest(".textfield") as HTMLElement
const emit = (id: ToMain, data: object) =>
    act(() =>
        vi
            .mocked(receiveToMain)
            .mock.calls.filter((c) => c[0] === id)
            .forEach((c) => (c[1] as (d: object) => void)(data))
    )
const abrirMenuNube = () => fireEvent.click(document.querySelector('[data-title="main.open"]') as HTMLElement)
function elegirCarpeta(label: string, path: string, indice = 0) {
    fireEvent.click(campo(label, indice).querySelector('[role="button"]') as HTMLElement)
    const canal = (
        vi
            .mocked(sendMain)
            .mock.calls.filter((c) => c[0] === Main.OPEN_FOLDER)
            .at(-1)![1] as { channel: string }
    ).channel
    return emit(ToMain.OPEN_FOLDER2, { channel: canal, path })
}
function elegirOpcion(indiceSelect: number, opcion: string) {
    fireEvent.click(document.querySelectorAll(".dropdown-trigger")[indiceSelect] as HTMLElement)
    fireEvent.click(screen.getByText(opcion))
}
const conectarChurchApps = (extra: object = {}) => {
    providerConnections.set({ churchApps: true })
    special.set({ churchAppsCloudOnly: true })
    cloudSyncData.set(extra)
}

describe("Files", () => {
    it("renderiza_lo_principal_sin_conexion", () => {
        render(<Files />)
        expect(screen.getAllByText(/settings.autosave/)[0]).toBeTruthy()
        expect(screen.getByText("settings.data_location")).toBeTruthy()
        expect(screen.getByText("settings.cloud")).toBeTruthy()
        expect(screen.getByText("[settings.connect_to]")).toBeTruthy()
        expect(screen.queryByText("[settings.disconnect_from]")).toBeNull()
        expect(screen.queryByText("Google API service account key")).toBeNull()
    })

    it("autosave_escribe_el_store_y_reinicia_el_timer", () => {
        render(<Files />)
        elegirOpcion(0, "5 settings.minutes")
        expect(get(autosave)).toBe("5min")
        expect(startAutosave).toHaveBeenCalledTimes(1)
    })

    it("el_autosave_sin_valor_usa_15min_y_ofrece_las_ocho_opciones", () => {
        render(<Files />)
        fireEvent.click(document.querySelectorAll(".dropdown-trigger")[0] as HTMLElement)
        expect([...document.querySelectorAll(".select-menu li")].map((li) => li.textContent)).toEqual(["settings.never", "2 settings.minutes", "5 settings.minutes", "10 settings.minutes", "15 settings.minutes", "30 settings.minutes", "60 settings.minutes", "120 settings.minutes"])
    })

    it("auto_backup_escribe_special_autoBackup_y_por_defecto_es_weekly", () => {
        render(<Files />)
        expect(document.querySelectorAll(".dropdown-trigger")[1].textContent).toContain("interval.weekly")
        elegirOpcion(1, "interval.daily")
        expect(get(special)).toEqual({ autoBackup: "daily" })
    })

    it("la_etiqueta_de_autosave_muestra_el_tiempo_restante_y_avanza_cada_segundo", () => {
        vi.useFakeTimers()
        ahora.previousAutosave = Date.now()
        render(<Files />)
        const etiqueta = () => document.querySelectorAll(".textfield")[0].querySelector("label")!
        expect(etiqueta().textContent).toContain("15:00")
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(etiqueta().textContent).toContain("14:59")
        expect(etiqueta().innerHTML).toContain('<span style="color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;">')
    })

    it("con_autosave_never_no_hay_tiempo_restante", () => {
        vi.useFakeTimers()
        ahora.previousAutosave = Date.now()
        autosave.set("never")
        render(<Files />)
        expect(document.querySelectorAll(".textfield")[0].querySelector("label")!.innerHTML).toBe("settings.autosave")
    })

    it("el_intervalo_se_detiene_al_desmontar", () => {
        vi.useFakeTimers()
        const { unmount } = render(<Files />)
        unmount()
        expect(vi.getTimerCount()).toBe(0)
    })

    it("la_etiqueta_de_auto_backup_con_never_no_tiene_tiempo", () => {
        special.set({ autoBackup: "never" })
        render(<Files />)
        expect(document.querySelectorAll(".textfield")[1].querySelector("label")!.innerHTML).toBe("settings.auto_backup")
    })

    it("data_location_guardada_manda_el_cambio_de_ruta_y_refresca_shows", async () => {
        render(<Files />)
        await elegirCarpeta("settings.data_location", "/datos/nuevo")
        expect(sendMain).toHaveBeenCalledWith(Main.UPDATE_DATA_PATH, { newPath: "/datos/nuevo", oldPath: "/datos/viejo" })
        expect(get(dataPath)).toBe("/datos/nuevo")
        expect(sendMain).toHaveBeenLastCalledWith(Main.REFRESH_SHOWS)
        expect(save).not.toHaveBeenCalled()
    })

    it("data_location_sin_guardar_primero_guarda_con_backup_y_espera", async () => {
        saved.set(false)
        render(<Files />)
        await elegirCarpeta("settings.data_location", "/datos/nuevo")
        expect(save).toHaveBeenCalledWith(false, { backup: true, isAutoBackup: true })
        expect(wait).toHaveBeenCalledWith(1500)
        expect(sendMain).toHaveBeenCalledWith(Main.UPDATE_DATA_PATH, { newPath: "/datos/nuevo", oldPath: "/datos/viejo" })
    })

    it("conectar_con_churchApps_limpia_la_nube_y_pide_los_servicios", () => {
        cloudSyncData.set({ enabled: true })
        render(<Files />)
        fireEvent.click(screen.getByText("[settings.connect_to]"))
        expect(get(cloudSyncData)).toEqual({})
        expect(get(special)).toEqual({ churchAppsCloudOnly: true })
        expect(sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "churchApps", cloudOnly: true })
    })

    it("conectado_solo_nube_muestra_desconectar_y_no_el_boton_de_sincronizar", () => {
        conectarChurchApps()
        render(<Files />)
        expect(screen.getByText("[settings.disconnect_from]")).toBeTruthy()
        expect(screen.queryByText("[cloud.sync]")).toBeNull()
    })

    it("desconectar_corta_el_socket_pide_la_baja_y_marca_la_conexion_en_false", async () => {
        conectarChurchApps({ id: "churchApps", enabled: true })
        render(<Files />)
        await act(async () => {
            fireEvent.click(screen.getByText("[settings.disconnect_from]"))
        })
        expect(socketDisconnect).toHaveBeenCalledTimes(1)
        expect(requestMain).toHaveBeenCalledWith(Main.PROVIDER_DISCONNECT, { providerId: "churchApps" }, expect.any(Function))
        expect(get(providerConnections)).toEqual({ churchApps: false })
        expect(get(cloudSyncData)).toEqual({})
    })

    it("si_la_baja_falla_la_conexion_queda_y_el_boton_se_rehabilita", async () => {
        respuestas.providerDisconnect = { success: false }
        conectarChurchApps({ id: "otro" })
        render(<Files />)
        await act(async () => {
            fireEvent.click(screen.getByText("[settings.disconnect_from]"))
        })
        expect(get(providerConnections)).toEqual({ churchApps: true })
        expect(get(cloudSyncData)).toEqual({ id: "otro" })
        expect((screen.getByText("[settings.disconnect_from]").closest("button") as HTMLButtonElement).disabled).toBe(false)
    })

    it("el_boton_de_desconectar_conserva_el_borde_conectado", () => {
        conectarChurchApps()
        render(<Files />)
        const boton = screen.getByText("[settings.disconnect_from]").closest("button") as HTMLElement
        expect(boton.className).toMatch(/connected/)
    })

    it("conectado_sin_cloudOnly_y_sin_sync_el_boton_conectar_activa_la_sincronizacion", () => {
        providerConnections.set({ churchApps: true })
        render(<Files />)
        fireEvent.click(screen.getByText("[settings.connect_to]"))
        expect(get(cloudSyncData)).toEqual({ enabled: true, id: "churchApps" })
        expect(setupCloudSync).toHaveBeenCalledTimes(1)
        expect(sendMain).not.toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, expect.anything())
    })

    it("conectado_sin_cloudOnly_y_con_sync_activa_el_boton_desconectar_la_apaga_sin_setupCloudSync", () => {
        providerConnections.set({ churchApps: true })
        cloudSyncData.set({ enabled: true })
        render(<Files />)
        fireEvent.click(screen.getByText("[settings.disconnect_from]"))
        expect(get(cloudSyncData)).toEqual({ enabled: false, id: "churchApps" })
        expect(setupCloudSync).not.toHaveBeenCalled()
        expect(socketDisconnect).not.toHaveBeenCalled()
    })

    it("con_sync_activa_aparece_sincronizar_ahora_que_guarda_con_autosave", () => {
        conectarChurchApps({ enabled: true })
        render(<Files />)
        fireEvent.click(screen.getByText("[cloud.sync]"))
        expect(get(saved)).toBe(false)
        expect(save).toHaveBeenCalledWith(false, { autosave: true })
    })

    it("sincronizar_ahora_se_deshabilita_mientras_statusIndicator_es_syncing", () => {
        conectarChurchApps({ enabled: true })
        statusIndicator.set("syncing")
        render(<Files />)
        expect((screen.getByText("[cloud.sync]").closest("button") as HTMLButtonElement).disabled).toBe(true)
    })

    it("cambiar_de_equipo_solo_aparece_con_mas_de_un_equipo_y_llama_a_changeTeam", () => {
        conectarChurchApps({ enabled: true, team: { id: "t", churchId: "c", name: "Equipo", count: 1 } })
        const { unmount } = render(<Files />)
        expect(screen.queryByText("[cloud.change_team]")).toBeNull()
        unmount()
        cloudSyncData.set({ enabled: true, team: { id: "t", churchId: "c", name: "Equipo", count: 2 } })
        render(<Files />)
        fireEvent.click(screen.getByText("[cloud.change_team]"))
        expect(changeTeam).toHaveBeenCalledTimes(1)
        expect(screen.getByText("Equipo")).toBeTruthy()
    })

    it("enable_sync_activa_con_setupCloudSync_y_desactiva_con_enabled_false", () => {
        conectarChurchApps()
        const { unmount } = render(<Files />)
        pulsar("cloud.enable_sync")
        expect(setupCloudSync).toHaveBeenCalledTimes(1)
        unmount()
        cloudSyncData.set({ enabled: true })
        render(<Files />)
        pulsar("cloud.enable_sync")
        expect(get(cloudSyncData)).toEqual({ enabled: false })
    })

    it("el_menu_de_nube_solo_aparece_con_sync_activa_y_hay_que_abrirlo", () => {
        conectarChurchApps()
        const { unmount } = render(<Files />)
        expect(document.querySelector('[data-title="main.open"]')).toBeNull()
        unmount()
        cloudSyncData.set({ enabled: true })
        render(<Files />)
        expect(screen.queryByText("settings.device_name")).toBeNull()
        abrirMenuNube()
        expect(screen.getByText("settings.device_name")).toBeTruthy()
    })

    it("nombre_de_dispositivo_actualiza_cloudSyncData_y_avisa", () => {
        conectarChurchApps({ enabled: true })
        render(<Files />)
        abrirMenuNube()
        fireEvent.change(campo("settings.device_name").querySelector("input")!, { target: { value: "Sala" } })
        expect(get(cloudSyncData)).toEqual({ enabled: true, deviceName: "Sala" })
        expect(updateCloudDeviceName).toHaveBeenCalledTimes(1)
    })

    it("cloud_read_only_escribe_cloudMethod_read_only_o_merge", () => {
        conectarChurchApps({ enabled: true })
        render(<Files />)
        abrirMenuNube()
        pulsar("cloud.read_only")
        expect(get(cloudSyncData)).toEqual({ enabled: true, cloudMethod: "read_only" })
        pulsar("cloud.read_only")
        expect(get(cloudSyncData)).toEqual({ enabled: true, cloudMethod: "merge" })
        expect(updateCloudDeviceName).not.toHaveBeenCalled()
    })

    it("carpeta_de_media_al_activar_guarda_special_pide_la_ruta_y_empaqueta_una_sola_vez", async () => {
        respuestas.mediaPath = "/Users/x/Documents/PulseFlow/Media"
        conectarChurchApps({ enabled: true })
        render(<Files />)
        abrirMenuNube()
        await act(async () => {
            pulsar("media.media_sync_folder")
        })
        expect(get(special)).toEqual({ churchAppsCloudOnly: true, cloudSyncMediaFolder: true })
        expect(sendMain).toHaveBeenCalledWith(Main.BUNDLE_MEDIA_FILES, { openFolder: true, outputPath: "/Users/x/Documents/PulseFlow/Media" })
        vi.mocked(sendMain).mockClear()
        await act(async () => {
            pulsar("media.media_sync_folder")
        })
        await act(async () => {
            pulsar("media.media_sync_folder")
        })
        expect(get(special)).toEqual({ churchAppsCloudOnly: true, cloudSyncMediaFolder: true })
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("al_desactivar_la_carpeta_de_media_borra_la_clave_y_no_empaqueta", async () => {
        conectarChurchApps({ enabled: true })
        special.set({ churchAppsCloudOnly: true, cloudSyncMediaFolder: true })
        render(<Files />)
        abrirMenuNube()
        await act(async () => {
            pulsar("media.media_sync_folder")
        })
        expect(get(special)).toEqual({ churchAppsCloudOnly: true })
        expect(sendMain).not.toHaveBeenCalledWith(Main.BUNDLE_MEDIA_FILES, expect.anything())
    })

    it("con_la_carpeta_activa_al_montar_se_lee_la_ruta_y_se_puede_elegir_otra", async () => {
        respuestas.mediaPath = "/Users/x/Documents/PulseFlow/Media"
        conectarChurchApps({ enabled: true })
        special.set({ churchAppsCloudOnly: true, cloudSyncMediaFolder: true })
        await act(async () => {
            render(<Files />)
        })
        abrirMenuNube()
        expect(requestMain).toHaveBeenCalledWith(Main.GET_MEDIA_FOLDER_PATH)
        expect(campo("media.media_sync_folder", 1).querySelector('[role="button"]')?.textContent).toBe("Documents/PulseFlow/Media")
        await elegirCarpeta("media.media_sync_folder", "/otra/carpeta", 1)
        expect(sendMain).toHaveBeenCalledWith(Main.SET_MEDIA_FOLDER_PATH, "/otra/carpeta")
        expect(sendMain).toHaveBeenCalledWith(Main.BUNDLE_MEDIA_FILES, { outputPath: "/otra/carpeta" })
    })

    it("restaurar_backup_pide_el_backup_de_la_nube_y_avisa_el_resultado", async () => {
        conectarChurchApps({ enabled: true, id: "churchApps", team: { id: "t1", churchId: "c1", name: "E" } })
        render(<Files />)
        abrirMenuNube()
        await act(async () => {
            fireEvent.click(screen.getByText("[cloud.restore_weekly_backup]"))
        })
        expect(requestMain).toHaveBeenCalledWith(Main.RESTORE_CLOUD_BACKUP, { id: "churchApps", churchId: "c1", teamId: "t1" })
        expect(get(alertMessage)).toBe("Cloud backup restored.")
        expect(get(activePopup)).toBe("alert")
    })

    it("restaurar_backup_con_error_muestra_el_error_y_sin_equipo_no_hace_nada", async () => {
        respuestas.restore = { success: false, error: "falló" }
        conectarChurchApps({ enabled: true, id: "churchApps", team: { id: "t1", churchId: "c1", name: "E" } })
        const { unmount } = render(<Files />)
        abrirMenuNube()
        await act(async () => {
            fireEvent.click(screen.getByText("[cloud.restore_weekly_backup]"))
        })
        expect(get(alertMessage)).toBe("falló")
        unmount()
        vi.mocked(requestMain).mockClear()
        cloudSyncData.set({ enabled: true })
        render(<Files />)
        abrirMenuNube()
        await act(async () => {
            fireEvent.click(screen.getByText("[cloud.restore_weekly_backup]"))
        })
        expect(requestMain).not.toHaveBeenCalledWith(Main.RESTORE_CLOUD_BACKUP, expect.anything())
    })

    it("abrir_un_popup_remonta_el_interruptor_de_sync_para_descartar_su_estado", () => {
        conectarChurchApps()
        render(<Files />)
        const antes = toggle("cloud.enable_sync")
        act(() => activePopup.set("alert"))
        expect(toggle("cloud.enable_sync")).not.toBe(antes)
    })

    describe("claves_antiguas_de_google_drive", () => {
        beforeEach(() => driveKeys.set({ client_email: "x" }))

        it("aparecen_sin_conexion_a_churchApps_y_con_claves", () => {
            render(<Files />)
            for (const l of ["Google API service account key", "Disable uploading data", "cloud.enable"]) expect(screen.getByText(l)).toBeTruthy()
        })

        it("no_aparecen_con_churchApps_conectado", () => {
            providerConnections.set({ churchApps: true })
            render(<Files />)
            expect(screen.queryByText("Google API service account key")).toBeNull()
        })

        it("disableUpload_y_enable_escriben_driveData_con_enable_invertido", () => {
            render(<Files />)
            pulsar("Disable uploading data")
            expect(get(driveData).disableUpload).toBe(true)
            expect(toggle("cloud.enable").getAttribute("aria-checked")).toBe("true")
            pulsar("cloud.enable")
            expect(get(driveData).disabled).toBe(true)
            pulsar("cloud.enable")
            expect(get(driveData).disabled).toBe(false)
        })

        it("carpeta_principal_manual_guarda_mainFolderId_y_ignora_el_vacio", () => {
            render(<Files />)
            const input = () => campo("Set main folder manually").querySelector("input") as HTMLInputElement
            fireEvent.change(input(), { target: { value: "abc123" } })
            expect(get(driveData).mainFolderId).toBe("abc123")
            fireEvent.change(input(), { target: { value: "" } })
            expect(get(driveData).mainFolderId).toBe("abc123")
        })

        it("archivo_de_claves_lee_el_archivo_y_valida_su_contenido", async () => {
            respuestas.readFile = { content: '{"k":1}' }
            render(<Files />)
            fireEvent.click(campo("Google API service account key").querySelector('[role="button"]') as HTMLElement)
            const { id } = vi.mocked(sendMain).mock.calls.find((c) => c[0] === Main.OPEN_FILE)![1] as unknown as { id: string }
            await emit(ToMain.OPEN_FILE2, { id, channel: "MEDIA", files: ["/claves.json"] })
            await act(async () => {})
            expect(requestMain).toHaveBeenCalledWith(Main.READ_FILE, { path: "/claves.json" })
            expect(validateKeys).toHaveBeenCalledWith('{"k":1}')
        })

        it("borrar_el_archivo_de_claves_vacia_driveKeys_y_resetea_driveData", async () => {
            driveData.set({ mainFolderId: "abc", disabled: true, initializeMethod: "x", disableUpload: true })
            render(<Files />)
            fireEvent.click(campo("Google API service account key").querySelector(".remove button") as HTMLElement)
            await act(async () => {})
            expect(get(driveKeys)).toEqual({})
            expect(get(driveData)).toEqual({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })
            expect(requestMain).not.toHaveBeenCalledWith(Main.READ_FILE, expect.anything())
        })

        it("archivo_de_claves_sin_contenido_no_valida", async () => {
            render(<Files />)
            fireEvent.click(campo("Google API service account key").querySelector('[role="button"]') as HTMLElement)
            const { id } = vi.mocked(sendMain).mock.calls.find((c) => c[0] === Main.OPEN_FILE)![1] as unknown as { id: string }
            await emit(ToMain.OPEN_FILE2, { id, channel: "MEDIA", files: ["/claves.json"] })
            await act(async () => {})
            expect(validateKeys).not.toHaveBeenCalled()
        })
    })
})
