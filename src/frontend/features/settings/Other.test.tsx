// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage, special } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Other } from "./Other"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
// SelectField llega a helpers/media (getFileName), que arrastra el módulo de audio
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

type Respuestas = { autoErrorReporting?: unknown; disableHardwareAcceleration?: unknown; graphicsDevice?: unknown; devices?: { value: string; label?: string }[] }
function responder(r: Respuestas) {
    vi.mocked(requestMain).mockImplementation((async (id: Main, value?: { key: string }, callback?: (v: unknown) => void) => {
        if (id === Main.GET_STORE_VALUE) callback?.((r as Record<string, unknown>)[value!.key])
        if (id === Main.GET_GRAPHICS_DEVICES) callback?.(r.devices)
    }) as never)
}

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(special, {}), storeEntry(activePopup, null), storeEntry(alertMessage, "")])
    responder({})
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

const toggle = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const guardado = (key: string, value: unknown) => expect(sendMain).toHaveBeenCalledWith(Main.SET_STORE_VALUE, { file: "config", key, value })
const avisoDeReinicio = () => {
    expect(get(alertMessage)).toBe("settings.restart_for_change")
    expect(get(activePopup)).toBe("alert")
}

describe("Other", () => {
    it("renderiza_lo_principal_y_pide_la_config_al_montar", () => {
        render(<Other />)
        expect(screen.getByText("[about.check_updates]")).toBeTruthy()
        for (const l of ["settings.popup_before_close", "settings.auto_error_reporting", "settings.disable_hardware_acceleration"]) expect(screen.getByText(l)).toBeTruthy()
        expect(screen.queryByText("settings.graphics_device")).toBeNull()
        for (const key of ["autoErrorReporting", "disableHardwareAcceleration", "graphicsDevice"]) expect(requestMain).toHaveBeenCalledWith(Main.GET_STORE_VALUE, { file: "config", key }, expect.any(Function))
        expect(requestMain).toHaveBeenCalledWith(Main.GET_GRAPHICS_DEVICES, undefined, expect.any(Function))
    })

    it("comprobar_actualizaciones_abre_update_manager", () => {
        render(<Other />)
        fireEvent.click(screen.getByText("[about.check_updates]"))
        expect(get(activePopup)).toBe("update_manager")
    })

    it("popup_before_close_guarda_showClosePopup_true_y_borra_la_clave_al_apagar", () => {
        render(<Other />)
        fireEvent.click(toggle("settings.popup_before_close"))
        expect(get(special)).toEqual({ showClosePopup: true })
        fireEvent.click(toggle("settings.popup_before_close"))
        expect(get(special)).toEqual({})
    })

    it("los_valores_guardados_en_config_inicializan_los_interruptores", () => {
        responder({ autoErrorReporting: false, disableHardwareAcceleration: true })
        render(<Other />)
        expect(toggle("settings.auto_error_reporting").getAttribute("aria-checked")).toBe("false")
        expect(toggle("settings.disable_hardware_acceleration").getAttribute("aria-checked")).toBe("true")
    })

    it("sin_valor_guardado_autoErrorReporting_es_true_y_hardware_false", () => {
        render(<Other />)
        expect(toggle("settings.auto_error_reporting").getAttribute("aria-checked")).toBe("true")
        expect(toggle("settings.disable_hardware_acceleration").getAttribute("aria-checked")).toBe("false")
    })

    it("auto_error_reporting_guarda_en_config_y_avisa_del_reinicio", () => {
        render(<Other />)
        fireEvent.click(toggle("settings.auto_error_reporting"))
        guardado("autoErrorReporting", false)
        avisoDeReinicio()
    })

    it("hardware_acceleration_guarda_en_config_y_avisa_del_reinicio", () => {
        render(<Other />)
        fireEvent.click(toggle("settings.disable_hardware_acceleration"))
        guardado("disableHardwareAcceleration", true)
        avisoDeReinicio()
    })

    it("con_dispositivos_graficos_aparece_el_select_con_auto_y_las_etiquetas_por_defecto", async () => {
        responder({ graphicsDevice: "high-performance", devices: [{ value: "high-performance" }, { value: "low-power" }, { value: "gpu-1", label: "Mi GPU" }] })
        render(<Other />)
        await act(async () => {})
        expect(screen.getByText("settings.graphics_device")).toBeTruthy()
        fireEvent.click(document.querySelector(".dropdown-trigger") as HTMLElement)
        expect([...document.querySelectorAll(".select-menu li")].map((li) => li.textContent)).toEqual(["settings.auto", "settings.gpu_high_performance", "settings.gpu_low_power", "Mi GPU"])
    })

    it("elegir_dispositivo_guarda_graphicsDevice_y_auto_guarda_null", async () => {
        responder({ graphicsDevice: "high-performance", devices: [{ value: "high-performance" }, { value: "gpu-1", label: "Mi GPU" }] })
        render(<Other />)
        await act(async () => {})
        fireEvent.click(document.querySelector(".dropdown-trigger") as HTMLElement)
        fireEvent.click(screen.getByText("Mi GPU"))
        guardado("graphicsDevice", "gpu-1")
        avisoDeReinicio()
        fireEvent.click(document.querySelector(".dropdown-trigger") as HTMLElement)
        fireEvent.click(screen.getByText("settings.auto"))
        guardado("graphicsDevice", null)
    })
})
