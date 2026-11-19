// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toggleOutputs } from "../../shared/utils/helpers/output"
import { outputs, outputState } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ScreenList } from "./ScreenList"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/utils/helpers/output", () => ({ toggleOutputs: vi.fn() }))

const salida = (name: string, extra = {}) => ({ name, enabled: true, active: false, color: "", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, ...extra })

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(outputs, { a1: salida("Beta"), a2: salida("Alfa", { active: true, bounds: { x: 0, y: 0, width: 1280, height: 720 } }), s1: salida("Escenario", { stageOutput: "lay" }) }), storeEntry(outputState, [])] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

const grupo = (titulo: string) => screen.getByText(titulo).closest('[data-slot="section-header"]')!.parentElement as HTMLElement

describe("ScreenList", () => {
    it("renderiza_lo_principal_audiencia_ordenada_por_nombre_y_escenario_aparte", () => {
        render(<ScreenList />)
        expect(
            within(grupo("screen_config.audience"))
                .getAllByText(/Alfa|Beta/)
                .map((n) => n.textContent)
        ).toEqual(["Alfa", "Beta"])
        expect(within(grupo("screen_config.stage")).getByText("Escenario")).toBeTruthy()
        expect(within(grupo("screen_config.audience")).getByText("1280×720")).toBeTruthy()
    })

    it("marca_la_fila_activa_y_el_punto_de_las_salidas_habilitadas_y_activas", () => {
        render(<ScreenList selectedOutputId="a1" />)
        const filas = document.querySelectorAll('[data-slot="list-row"]')
        const alfa = [...filas].find((f) => f.textContent?.includes("Alfa")) as HTMLElement
        const beta = [...filas].find((f) => f.textContent?.includes("Beta")) as HTMLElement
        expect(beta.getAttribute("aria-current")).toBe("true")
        expect(alfa.getAttribute("aria-current")).toBeNull()
        expect(alfa.querySelector("span[class*=dot]")).toBeTruthy()
        expect(beta.querySelector("span[class*=dot]")).toBeNull()
    })

    it("clic_en_una_fila_llama_a_onSelect_con_el_id", () => {
        const onSelect = vi.fn()
        render(<ScreenList onSelect={onSelect} />)
        fireEvent.click(screen.getByText("Beta"))
        expect(onSelect).toHaveBeenCalledWith("a1")
        fireEvent.click(screen.getByText("Escenario"))
        expect(onSelect).toHaveBeenLastCalledWith("s1")
    })

    it("los_botones_agregar_llaman_a_onAddAudience_y_onAddStage", () => {
        const onAddAudience = vi.fn()
        const onAddStage = vi.fn()
        render(<ScreenList onAddAudience={onAddAudience} onAddStage={onAddStage} />)
        fireEvent.click(within(grupo("screen_config.audience")).getAllByRole("button")[1])
        expect(onAddAudience).toHaveBeenCalledTimes(1)
        fireEvent.click(within(grupo("screen_config.stage")).getAllByRole("button")[1])
        expect(onAddStage).toHaveBeenCalledTimes(1)
    })

    it("el_boton_de_mostrar_alterna_las_salidas_de_su_grupo_con_toggleOutputs", () => {
        render(<ScreenList />)
        fireEvent.click(within(grupo("screen_config.audience")).getAllByRole("button")[0])
        expect(toggleOutputs).toHaveBeenLastCalledWith(["a2", "a1"])
        fireEvent.click(within(grupo("screen_config.stage")).getAllByRole("button")[0])
        expect(toggleOutputs).toHaveBeenLastCalledWith(["s1"])
    })

    it("aria_pressed_sigue_a_outputState_por_grupo", () => {
        outputState.set([{ id: "a2", active: true }] as never)
        render(<ScreenList />)
        expect(within(grupo("screen_config.audience")).getAllByRole("button")[0].getAttribute("aria-pressed")).toBe("true")
        expect(within(grupo("screen_config.stage")).getAllByRole("button")[0].getAttribute("aria-pressed")).toBe("false")
    })
})
