// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { deleteAction } from "../../shared/utils/helpers/clipboard"
import { addOutput, enableStageOutput } from "../../shared/utils/helpers/output"
import { requestMain } from "../../shared/core/ipc/main"
import { invokeCommand } from "../../shared/core/ipc/tauri"
import { currentOutputSettings, outputs, outputState } from "../../shared/core/stores"
import { send } from "../../shared/utils/request"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { ScreenConfig } from "./ScreenConfig"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 36 }))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn() }))
vi.mock("../../shared/core/ipc/tauri", () => ({ invokeCommand: vi.fn() }))
vi.mock("../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../../shared/utils/helpers/clipboard", () => ({ deleteAction: vi.fn(), duplicate: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({ toggleOutputs: vi.fn(), addOutput: vi.fn(), enableStageOutput: vi.fn() }))
vi.mock("./ScreenOutputOptions", () => ({ ScreenOutputOptions: () => null }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

class FakeResizeObserver {
    observe = vi.fn()
    disconnect = vi.fn()
}

const monitores = [{ id: "m1", label: "Monitor 1", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, primary: true }]
const salida = (name: string, extra = {}) => ({ name, enabled: true, active: false, color: "", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, ...extra })

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.mocked(requestMain).mockResolvedValue(monitores as never)
    vi.mocked(invokeCommand).mockResolvedValue({ ok: true } as never)
    restaurar = setStoresForTest([storeEntry(outputs, { a: salida("Alfa"), b: salida("Beta"), s: salida("Escenario", { stageOutput: "lay" }) }), storeEntry(currentOutputSettings, "b"), storeEntry(outputState, [])] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const montar = async () => {
    const r = render(<ScreenConfig />)
    await act(async () => {})
    return r
}
const nombre = () => (document.querySelector("input") as HTMLInputElement).value
const fila = (texto: string) => screen.getByText(texto)

describe("ScreenConfig", () => {
    it("renderiza_lo_principal_lista_sistema_ndi_y_el_detalle_de_la_salida_actual", async () => {
        await montar()
        expect(screen.getByRole("dialog")).toBeTruthy()
        expect(screen.getByText("screen_config.title")).toBeTruthy()
        expect(fila("Alfa")).toBeTruthy()
        expect(screen.getByText("screen_config.system")).toBeTruthy()
        expect(screen.getByText("screen_config.new_ndi ›")).toBeTruthy()
        expect(nombre()).toBe("Beta")
    })

    it("al_montar_pide_los_monitores_con_GET_DISPLAYS_y_los_dibuja", async () => {
        await montar()
        expect(requestMain).toHaveBeenCalledWith(Main.GET_DISPLAYS)
        expect(screen.queryByText("screen_config.no_monitors")).toBeNull()
        expect(document.querySelector('[role="button"][data-title="Monitor 1"]')).toBeTruthy()
    })

    it("sin_respuesta_de_monitores_muestra_el_aviso", async () => {
        vi.mocked(requestMain).mockResolvedValue(undefined as never)
        await montar()
        expect(screen.getByText("screen_config.no_monitors")).toBeTruthy()
    })

    it("refrescar_vuelve_a_pedir_los_monitores", async () => {
        await montar()
        await act(async () => fireEvent.click(screen.getByText("screen_config.refresh")))
        expect(vi.mocked(requestMain).mock.calls.filter((c) => c[0] === Main.GET_DISPLAYS)).toHaveLength(2)
    })

    it("identificar_manda_IDENTIFY_SCREENS_con_los_monitores", async () => {
        await montar()
        const sistema = screen.getByText("screen_config.system").parentElement as HTMLElement
        fireEvent.click(within(sistema).getByText("screen_config.identify"))
        expect(send).toHaveBeenCalledWith(OUTPUT, ["IDENTIFY_SCREENS"], monitores)
    })

    it("elegir_una_fila_cambia_el_detalle_y_escribe_currentOutputSettings", async () => {
        await montar()
        fireEvent.click(fila("Alfa"))
        expect(get(currentOutputSettings)).toBe("a")
        expect(nombre()).toBe("Alfa")
    })

    it("sin_currentOutputSettings_valido_elige_la_primera_salida_y_la_escribe", async () => {
        currentOutputSettings.set(null)
        await montar()
        expect(get(currentOutputSettings)).toBe("a")
        expect(nombre()).toBe("Alfa")
    })

    it("sin_salidas_muestra_el_texto_de_vacio", async () => {
        outputs.set({})
        currentOutputSettings.set(null)
        await montar()
        expect(screen.getByText("screen_config.no_outputs")).toBeTruthy()
    })

    it("agregar_audiencia_crea_con_addOutput_y_la_selecciona", async () => {
        vi.mocked(addOutput).mockImplementation((() => {
            outputs.update((o) => ({ ...o, nueva: salida("Nueva") }))
            return "nueva"
        }) as never)
        await montar()
        const audiencia = screen.getByText("screen_config.audience").closest('[data-slot="section-header"]') as HTMLElement
        await act(async () => fireEvent.click(within(audiencia).getAllByRole("button")[1]))
        expect(addOutput).toHaveBeenCalledWith(false)
        expect(get(currentOutputSettings)).toBe("nueva")
        expect(nombre()).toBe("Nueva")
    })

    it("agregar_escenario_crea_con_enableStageOutput_y_lo_selecciona", async () => {
        vi.mocked(enableStageOutput).mockImplementation((() => {
            outputs.update((o) => ({ ...o, nuevo: salida("Nuevo", { stageOutput: "" }) }))
            return "nuevo"
        }) as never)
        await montar()
        const escenario = screen.getByText("screen_config.stage").closest('[data-slot="section-header"]') as HTMLElement
        await act(async () => fireEvent.click(within(escenario).getAllByRole("button")[1]))
        expect(enableStageOutput).toHaveBeenCalledWith({})
        expect(get(currentOutputSettings)).toBe("nuevo")
    })

    it("si_addOutput_no_devuelve_id_no_cambia_la_seleccion", async () => {
        vi.mocked(addOutput).mockReturnValue("")
        await montar()
        const audiencia = screen.getByText("screen_config.audience").closest('[data-slot="section-header"]') as HTMLElement
        fireEvent.click(within(audiencia).getAllByRole("button")[1])
        expect(get(currentOutputSettings)).toBe("b")
    })

    it("nueva_ndi_crea_la_salida_marcada_ndi_invisible_y_transparente_con_nombre_NDI", async () => {
        vi.mocked(addOutput).mockImplementation((() => {
            outputs.update((o) => ({ ...o, ndi1: salida("") }))
            return "ndi1"
        }) as never)
        await montar()
        await act(async () => fireEvent.click(screen.getByText("screen_config.new_ndi ›")))
        expect(get(outputs).ndi1).toMatchObject({ ndi: true, invisible: true, transparent: true, name: "NDI" })
        expect(get(currentOutputSettings)).toBe("ndi1")
    })

    it("nueva_ndi_conserva_el_nombre_que_ya_traia", async () => {
        vi.mocked(addOutput).mockImplementation((() => {
            outputs.update((o) => ({ ...o, ndi1: salida("Camara") }))
            return "ndi1"
        }) as never)
        await montar()
        await act(async () => fireEvent.click(screen.getByText("screen_config.new_ndi ›")))
        expect(get(outputs).ndi1.name).toBe("Camara")
    })

    it("eliminar_la_actual_pasa_a_la_siguiente_del_mismo_grupo_y_manda_REMOVE_SCREEN", async () => {
        // el historial real borra la salida del store; acá se simula
        vi.mocked(deleteAction).mockImplementation((() => outputs.update((o) => (delete o.b, o))) as never)
        await montar()
        const botonesDetalle = [...document.querySelectorAll("input")][0].parentElement!.querySelectorAll("button")
        await act(async () => fireEvent.click(botonesDetalle[1]))
        expect(invokeCommand).toHaveBeenCalledWith("REMOVE_SCREEN", { id: "b" })
        expect(get(currentOutputSettings)).toBe("a")
        expect(nombre()).toBe("Alfa")
    })
})
