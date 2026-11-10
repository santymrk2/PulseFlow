// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { EditChart } from "./EditChart"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../ui/color-field/ColorField", () => ({
    ColorField: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
        <button data-color={value} onClick={() => onChange("#000001")}>
            color
        </button>
    )
}))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(active: unknown) {
    restaurar = setStoresForTest([looseEntry(popupData, { active, trigger })])
    return render(<EditChart />)
}
const lastGrid = () => JSON.parse(trigger.mock.calls.at(-1)?.[0])
const inputs = () => [...document.querySelectorAll("input")] as HTMLInputElement[]
beforeEach(() => trigger.mockClear())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("EditChart", () => {
    it("sin_datos_arranca_con_una_fila_vacía_y_avisa_al_trigger", () => {
        montar(undefined)
        expect(trigger).toHaveBeenCalledTimes(1)
        expect(lastGrid()).toEqual([["", "0", "#3b82f6"]])
    })

    it("lee_el_JSON_y_completa_los_colores_vacíos", () => {
        montar(
            JSON.stringify([
                ["Label", "Valor", ""],
                ["A", "5", ""],
                ["B", "7", "#123456"]
            ])
        )
        expect(lastGrid()).toEqual([
            ["Label", "Valor", "#3b82f6"],
            ["A", "5", "#3b82f6"],
            ["B", "7", "#123456"]
        ])
    })

    it("sin_cabecera_los_colores_siguen_la_posición", () => {
        montar(
            JSON.stringify([
                ["A", "5", ""],
                ["B", "7", ""]
            ])
        )
        expect(lastGrid().map((r: string[]) => r[2])).toEqual(["#3b82f6", "#10b981"])
    })

    it("si_no_es_JSON_lee_líneas_nombre_valor", () => {
        montar("uno: 3\n\n dos :4\ntres")
        expect(lastGrid()).toEqual([
            ["uno", "3", "#3b82f6"],
            ["dos", "4", "#10b981"],
            ["tres", "0", "#f59e0b"]
        ])
    })

    it("escribir_nombre_y_valor_actualiza_la_grilla", () => {
        montar(undefined)
        fireEvent.input(inputs()[0], { target: { value: "Pan" } })
        fireEvent.input(inputs()[1], { target: { value: "12" } })
        expect(lastGrid()).toEqual([["Pan", "12", "#3b82f6"]])
    })

    it("cambiar_el_color_lo_guarda", () => {
        const { container } = montar(undefined)
        fireEvent.click(container.querySelector("[data-color]") as HTMLElement)
        expect(lastGrid()[0][2]).toBe("#000001")
    })

    it("agregar_suma_una_fila_con_el_siguiente_color_y_borrar_la_quita_salvo_la_última", () => {
        montar(undefined)
        const botones = () => [...document.querySelectorAll<HTMLButtonElement>("button:not([data-color])")]
        expect(botones()[0].disabled).toBe(true)
        fireEvent.click(botones().at(-1) as HTMLElement)
        expect(lastGrid()).toEqual([
            ["", "0", "#3b82f6"],
            ["", "0", "#10b981"]
        ])
        expect(botones()[0].disabled).toBe(false)
        fireEvent.click(botones()[0])
        expect(lastGrid()).toEqual([["", "0", "#10b981"]])
    })
})
