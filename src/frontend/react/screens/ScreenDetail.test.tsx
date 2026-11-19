// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OUTPUT } from "../../../types/Channels"
import { deleteAction, duplicate } from "../../components/helpers/clipboard"
import { toggleOutputs } from "../../components/helpers/output"
import { invokeCommand } from "../../shared/core/ipc/tauri"
import { activePage, activePopup, activeStage, currentOutputSettings, outputs, popupData, stageShows } from "../../shared/core/stores"
import { send } from "../../utils/request"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ScreenDetail } from "./ScreenDetail"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/core/ipc/tauri", () => ({ invokeCommand: vi.fn() }))
vi.mock("../../components/helpers/clipboard", () => ({ deleteAction: vi.fn(), duplicate: vi.fn() }))
vi.mock("../../components/helpers/output", () => ({ toggleOutputs: vi.fn() }))
vi.mock("../../utils/request", () => ({ send: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./ScreenOutputOptions", () => ({ ScreenOutputOptions: () => <div data-testid="envio" /> }))
vi.mock("../ui/color-field/ColorField", () => ({
    ColorField: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
        <button data-testid="color" onClick={() => onChange("#123456")}>
            {value}
        </button>
    )
}))

class FakeResizeObserver {
    observe = vi.fn()
    disconnect = vi.fn()
}

const pantallaFisica = (id: string, x = 0) => ({ id, label: `Monitor ${id}`, bounds: { x, y: 10, width: 1920, height: 1080 }, primary: id === "m1" })
const displays = [pantallaFisica("m1"), pantallaFisica("m2", 1920)]
const salida = (extra = {}) => ({ name: "Principal", enabled: true, active: true, color: "#ff0000", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, ...extra })

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.mocked(invokeCommand).mockResolvedValue({ ok: true } as never)
    restaurar = setStoresForTest([storeEntry(outputs, { a: salida(), b: salida({ name: "Otra" }), s: salida({ name: "Stage", stageOutput: "lay1" }) }), storeEntry(currentOutputSettings, "a"), storeEntry(stageShows, { lay1: { name: "Layout 1" } } as never), storeEntry(activePopup, null), storeEntry(popupData, {}), storeEntry(activeStage, { id: null, items: [] }), storeEntry(activePage, "show")] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const campo = (label: string, n = 0) => screen.getAllByText(label)[n].closest(".textfield") as HTMLElement
const elegir = (label: string, opcion: string) => {
    fireEvent.click(campo(label).querySelector(".dropdown-trigger") as HTMLElement)
    fireEvent.click(screen.getByRole("option", { name: opcion }))
}
const confirmar = (label: string, texto: string, n = 0) => {
    const input = campo(label, n).querySelector("input") as HTMLInputElement
    fireEvent.input(input, { target: { value: texto } })
    fireEvent.change(input, { target: { value: texto } })
}
const interruptor = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const pestana = (texto: string) => fireEvent.click(screen.getByText(texto))
const nombre = () => document.querySelector("input") as HTMLInputElement
const botonesCabecera = () => [...document.querySelectorAll("button")].slice(0, 2)

describe("ScreenDetail", () => {
    it("renderiza_lo_principal_nombre_resolucion_tipo_monitores_y_pestanas", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(nombre().value).toBe("Principal")
        expect(screen.getByText("1920 × 1080", { selector: "div" })).toBeTruthy()
        expect(screen.getByText("settings.always_on_top")).toBeTruthy()
        expect(screen.getByText("screen_config.type")).toBeTruthy()
        expect(screen.getByText("screen_config.monitors")).toBeTruthy()
        for (const t of ["screen_config.hardware", "screen_config.cropping", "screen_config.sending"]) expect(screen.getByText(t)).toBeTruthy()
        expect(screen.getByText("screen_config.output")).toBeTruthy()
        expect(document.querySelectorAll('[role="button"][data-title^="Monitor"]')).toHaveLength(2)
    })

    it("al_montar_deja_a_la_salida_como_currentOutputSettings", () => {
        currentOutputSettings.set("b")
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(get(currentOutputSettings)).toBe("a")
    })

    it("renombrar_escribe_el_nombre_con_el_change_nativo_y_no_con_cada_tecla", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        fireEvent.input(nombre(), { target: { value: "Sala" } })
        expect(get(outputs).a.name).toBe("Principal")
        fireEvent.change(nombre(), { target: { value: "Sala" } })
        expect(get(outputs).a.name).toBe("Sala")
    })

    it("el_campo_de_nombre_sigue_al_store_cuando_cambia_por_fuera", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        act(() =>
            outputs.update((o) => {
                o.a.name = "Desde afuera"
                return o
            })
        )
        expect(nombre().value).toBe("Desde afuera")
    })

    it("siempre_visible_escribe_alwaysOnTop", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(interruptor("settings.always_on_top").getAttribute("aria-checked")).toBe("true")
        fireEvent.click(interruptor("settings.always_on_top"))
        expect(get(outputs).a.alwaysOnTop).toBe(false)
    })

    it("duplicar_llama_a_duplicate_con_la_salida", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        fireEvent.click(botonesCabecera()[0])
        expect(duplicate).toHaveBeenCalledWith({ id: "output", data: [{ id: "a" }] })
    })

    it("eliminar_manda_REMOVE_SCREEN_y_borra_con_el_historial", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        fireEvent.click(botonesCabecera()[1])
        expect(invokeCommand).toHaveBeenCalledWith("REMOVE_SCREEN", { id: "a" })
        expect(deleteAction).toHaveBeenCalledWith({ id: "output", data: [{ id: "a" }] })
    })

    it("eliminar_la_unica_audiencia_esta_deshabilitado_y_no_hace_nada", () => {
        outputs.set({ a: salida(), s: salida({ stageOutput: "lay1" }) } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        const borrar = botonesCabecera()[1] as HTMLButtonElement
        expect(borrar.disabled).toBe(true)
        fireEvent.click(borrar)
        expect(invokeCommand).not.toHaveBeenCalled()
        expect(deleteAction).not.toHaveBeenCalled()
    })

    it("un_fallo_de_REMOVE_SCREEN_se_registra_en_consola", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        vi.mocked(invokeCommand).mockResolvedValue({ ok: false, error: "x" } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        await act(async () => fireEvent.click(botonesCabecera()[1]))
        expect(error).toHaveBeenCalledWith("[outputs] REMOVE_SCREEN falló:", "x")
        error.mockRestore()
    })

    it("tipo_escribe_screenType_y_espejo_ofrece_las_otras_audiencias", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(screen.queryByText("screen_config.mirror_of")).toBeNull()
        elegir("screen_config.type", "screen_config.mirror")
        expect(get(outputs).a.screenType).toBe("mirror")
        // la propia salida y las de escenario no se ofrecen
        fireEvent.click(campo("screen_config.mirror_of").querySelector(".dropdown-trigger") as HTMLElement)
        expect(screen.queryByRole("option", { name: "Stage" })).toBeNull()
        fireEvent.click(screen.getByRole("option", { name: "Otra" }))
        expect(get(outputs).a.mirrorOf).toBe("b")
    })

    it("espejo_vacio_borra_mirrorOf_con_undefined", () => {
        outputs.set({ a: salida({ screenType: "mirror", mirrorOf: "b" }), b: salida({ name: "Otra" }) } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        elegir("screen_config.mirror_of", "screen_config.choose")
        expect(get(outputs).a.mirrorOf).toBeUndefined()
    })

    it("en_una_pantalla_de_escenario_muestra_el_layout_y_oculta_el_tipo", () => {
        render(<ScreenDetail outputId="s" displays={displays} />)
        expect(screen.queryByText("screen_config.type")).toBeNull()
        expect(screen.getByText("stage.stage_layout")).toBeTruthy()
        expect(screen.getByText("Layout 1")).toBeTruthy()
    })

    it("elegir_layout_abre_select_stage_layout_y_su_trigger_escribe_stageLayout_y_stageOutput", () => {
        render(<ScreenDetail outputId="s" displays={displays} />)
        fireEvent.click(screen.getByText("stage.stage_layout").closest(".textfield")!.querySelector('[role="button"]') as HTMLElement)
        expect(get(activePopup)).toBe("select_stage_layout")
        act(() => (get(popupData) as { trigger: (v: string) => void }).trigger("lay2"))
        expect(get(outputs).s.stageLayout).toBe("lay2")
        expect(get(outputs).s.stageOutput).toBe("lay2")
    })

    it("editar_abre_el_editor_de_stage_y_cierra_el_popup", () => {
        activePopup.set("screen_config")
        render(<ScreenDetail outputId="s" displays={displays} />)
        fireEvent.click(screen.getByText("stage.stage_layout").closest(".textfield")!.parentElement!.querySelector('[data-title="titlebar.edit"]') as HTMLElement)
        expect(get(activeStage)).toEqual({ id: "lay1", items: [] })
        expect(get(activePage)).toBe("stage")
        expect(get(activePopup)).toBeNull()
    })

    it("clic_en_un_monitor_asigna_pantalla_y_bounds_y_a_los_50ms_abre_la_salida_y_manda_UPDATE_BOUNDS", () => {
        vi.useFakeTimers()
        // el payload se copia al enviarlo: el objeto del store se muta después
        vi.mocked(send).mockImplementation(((id: string, canales: string[], data: unknown) => void sent.push({ id, canales, data: structuredClone(data) })) as never)
        const sent: { id: string; canales: string[]; data: unknown }[] = []
        render(<ScreenDetail outputId="a" displays={displays} />)
        fireEvent.click(document.querySelector('[data-title="Monitor m2"]') as HTMLElement)

        const out = get(outputs).a
        expect(out.screen).toBe("m2")
        expect(out.bounds).toEqual({ x: 1920, y: 10, width: 1920, height: 1080 })
        expect(out.display).toEqual({ screen: "m2", bounds: { x: 1920, y: 10, width: 1920, height: 1080 } })
        expect(toggleOutputs).not.toHaveBeenCalled()

        act(() => void vi.advanceTimersByTime(50))
        expect(toggleOutputs).toHaveBeenCalledWith(["a"], { state: true })
        expect(sent).toHaveLength(1)
        expect(sent[0].id).toBe(OUTPUT)
        expect(sent[0].canales).toEqual(["UPDATE_BOUNDS"])
        expect(sent[0].data).toMatchObject({ id: "a", name: "Principal", screen: "m2", bounds: { x: 1920, y: 10, width: 1920, height: 1080 } })
    })

    it("el_selector_de_salida_con_un_monitor_conocido_hace_lo_mismo_que_el_clic_en_el_monitor", () => {
        vi.useFakeTimers()
        render(<ScreenDetail outputId="a" displays={displays} />)
        elegir("screen_config.output", "Monitor m2")
        expect(get(outputs).a.screen).toBe("m2")
        expect(get(outputs).a.bounds.x).toBe(1920)
        act(() => void vi.advanceTimersByTime(50))
        expect(toggleOutputs).toHaveBeenCalledWith(["a"], { state: true })
        expect(send).toHaveBeenCalledWith(OUTPUT, ["UPDATE_BOUNDS"], expect.objectContaining({ id: "a" }))
    })

    it("el_selector_de_salida_en_ninguna_deja_screen_en_null_sin_abrir_la_salida", () => {
        vi.useFakeTimers()
        outputs.set({ a: salida({ screen: "m1", display: { screen: "m1", bounds: salida().bounds } }) } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        elegir("screen_config.output", "screen_config.none")
        expect(get(outputs).a.screen).toBeNull()
        expect(get(outputs).a.display?.screen).toBeNull()
        act(() => void vi.advanceTimersByTime(100))
        expect(toggleOutputs).not.toHaveBeenCalled()
    })

    it("destino_personalizado_muestra_x_y_ancho_alto_y_los_escribe_como_numeros", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(screen.queryByText("X")).toBeNull()
        elegir("screen_config.target", "screen_config.custom")
        expect(get(outputs).a.target).toBe("custom")
        confirmar("X", "-30")
        confirmar("Y", "40")
        confirmar("screen.width", "800")
        confirmar("screen.height", "600")
        expect(get(outputs).a.bounds).toEqual({ x: -30, y: 40, width: 800, height: 600 })
    })

    it("la_caja_de_informacion_muestra_nombre_tamano_y_relacion", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        expect(screen.getByText("screen_config.info_name: Principal")).toBeTruthy()
        expect(screen.getByText("screen_config.info_size: 1920 × 1080")).toBeTruthy()
        expect(screen.getByText("screen_config.aspect_ratio: 1.78 (16:9)")).toBeTruthy()
    })

    it("identificar_llama_a_onRefreshDisplays_y_encender_apagar_llama_a_toggleOutputs_con_el_estado_contrario", () => {
        const onRefreshDisplays = vi.fn()
        render(<ScreenDetail outputId="a" displays={displays} onRefreshDisplays={onRefreshDisplays} />)
        fireEvent.click(screen.getByText("screen_config.identify"))
        expect(onRefreshDisplays).toHaveBeenCalledWith()
        fireEvent.click(screen.getByText("screen_config.turn_off"))
        expect(toggleOutputs).toHaveBeenLastCalledWith(["a"], { state: false })
        act(() =>
            outputs.update((o) => {
                o.a.active = false
                return o
            })
        )
        fireEvent.click(screen.getByText("screen_config.turn_on"))
        expect(toggleOutputs).toHaveBeenLastCalledWith(["a"], { state: true })
    })

    it("invisible_transparente_ocultar_color_y_resolucion_forzada_escriben_la_salida", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        fireEvent.click(interruptor("settings.invisible_window"))
        fireEvent.click(interruptor("settings.transparent"))
        fireEvent.click(interruptor("context.hide_from_preview"))
        fireEvent.click(screen.getByTestId("color"))
        expect(get(outputs).a).toMatchObject({ invisible: true, transparent: true, hideFromPreview: true, color: "#123456" })
    })

    it("resolucion_forzada_necesita_ancho_y_alto_y_si_falta_uno_se_borra", () => {
        outputs.set({ a: salida({ forcedResolution: { width: 1000, height: 500 } }) } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        confirmar("screen.width", "1280")
        expect(get(outputs).a.forcedResolution).toEqual({ width: 1280, height: 500 })
        confirmar("screen.height", "0")
        expect(get(outputs).a.forcedResolution).toBeUndefined()
    })

    it("recorte_escribe_cada_lado_creando_cropping_y_el_aspecto_original_borra_aspectRatio", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        pestana("screen_config.cropping")
        confirmar("screen_config.top", "5")
        confirmar("screen_config.left", "7")
        expect(get(outputs).a.cropping).toEqual({ top: 5, right: 0, bottom: 0, left: 7 })
        elegir("screen_config.aspect_ratio", "4:3")
        expect(get(outputs).a.aspectRatio).toEqual({ width: 4, height: 3 })
        elegir("screen_config.aspect_ratio", "screen_config.original")
        expect(get(outputs).a.aspectRatio).toBeUndefined()
    })

    it("edge_blend_aparece_solo_con_ese_tipo_y_escribe_con_los_valores_por_defecto", () => {
        outputs.set({ a: salida({ screenType: "edge_blend" }) } as never)
        render(<ScreenDetail outputId="a" displays={displays} />)
        pestana("screen_config.cropping")
        expect(screen.getByText("Edge blend")).toBeTruthy()
        confirmar("screen_config.opacity", "80")
        expect(get(outputs).a.blending).toEqual({ left: 0, right: 0, rotate: 90, opacity: 80, centered: false, offset: 0 })
    })

    it("en_escenario_la_pestana_de_recorte_no_ofrece_aspecto_ni_edge_blend", () => {
        render(<ScreenDetail outputId="s" displays={displays} />)
        pestana("screen_config.cropping")
        expect(screen.queryByText("screen_config.aspect_ratio")).toBeNull()
        expect(screen.queryByText("Edge blend")).toBeNull()
    })

    it("envio_tiene_un_interruptor_por_protocolo_que_escribe_su_bandera_y_monta_las_opciones", () => {
        render(<ScreenDetail outputId="a" displays={displays} />)
        pestana("screen_config.sending")
        expect(screen.getByTestId("envio")).toBeTruthy()
        for (const [titulo, clave] of [
            ["NDI", "ndi"],
            ["OMT", "omt"],
            ["Blackmagic", "blackmagic"],
            ["WebRTC", "webrtc"],
            ["RTMP", "rtmp"]
        ]) {
            const seccion = screen.getAllByText(titulo)[0].parentElement as HTMLElement
            fireEvent.click(within(seccion).getByRole("switch"))
            expect((get(outputs).a as unknown as Record<string, unknown>)[clave]).toBe(true)
        }
    })
})
