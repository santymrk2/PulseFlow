// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, popupData, styles } from "../../stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { MaxLines } from "./MaxLines"
import css from "./MaxLines.module.css"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
const trigger = vi.fn()
function montar(popup: object = {}, estilos: object = {}) {
    restaurar = setStoresForTest([looseEntry(popupData, { trigger, ...popup }), looseEntry(styles, estilos), storeEntry(activePopup, "max_lines")] as never)
    return render(<MaxLines />)
}
const cuadricula = () => [...document.querySelectorAll(`.${css.grid} > button`)] as HTMLElement[]
const opciones = () => fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("MaxLines", () => {
    it("muestra_cinco_opciones_todas_las_lineas_y_de_1_a_4_con_esa_cantidad_de_renglones", () => {
        montar()
        const botones = cuadricula()
        expect(botones.length).toBe(5)
        expect(botones.map((b) => b.querySelector("p")?.textContent)).toEqual(["[settings.all_lines]", "1", "2", "3", "4"])
        expect(botones.map((b) => b.querySelectorAll("span").length)).toEqual([5, 1, 2, 3, 4])
        expect((botones[0].querySelector("span") as HTMLElement).style.opacity).toBe("0.6")
        expect((botones[1].querySelector("span") as HTMLElement).style.opacity).toBe("")
    })

    it("marca_como_activa_la_de_popupData_active_y_por_defecto_la_de_todas_las_lineas", () => {
        montar({ active: 3 })
        expect(cuadricula().map((b) => b.classList.contains("isActive"))).toEqual([false, false, false, true, false])
        cleanup()
        restaurar()
        montar()
        expect(cuadricula().map((b) => b.classList.contains("isActive"))).toEqual([true, false, false, false, false])
    })

    it("elegir_una_opcion_llama_a_trigger_y_la_marca_pero_no_cierra", () => {
        montar()
        fireEvent.click(cuadricula()[2])
        expect(trigger.mock.calls).toEqual([[2]])
        expect(cuadricula()[2].classList.contains("isActive")).toBe(true)
        expect(get(activePopup)).toBe("max_lines")
    })

    it("elegir_la_que_ya_estaba_activa_llama_a_trigger_y_cierra_vaciando_popupData", () => {
        montar({ active: 3 })
        fireEvent.click(cuadricula()[3])
        expect(trigger.mock.calls).toEqual([[3]])
        expect(get(activePopup)).toBeNull()
        expect(get(popupData)).toEqual({})
    })

    it("la_segunda_vez_sobre_la_misma_opcion_cierra", () => {
        montar()
        fireEvent.click(cuadricula()[1])
        fireEvent.click(cuadricula()[1])
        expect(trigger).toHaveBeenCalledTimes(2)
        expect(get(activePopup)).toBeNull()
    })

    it("sin_trigger_no_hace_nada", () => {
        montar({ trigger: undefined })
        fireEvent.click(cuadricula()[1])
        expect(get(activePopup)).toBe("max_lines")
        expect(cuadricula()[1].classList.contains("isActive")).toBe(false)
    })

    it("mas_opciones_arranca_cerrado_y_el_boton_lo_alterna", () => {
        const { container } = montar()
        expect(fields["actions.custom_key"]).toBeUndefined()
        opciones()
        expect(container.querySelector("button.popup-options")?.classList.contains("active")).toBe(true)
        expect(fields["actions.custom_key"]).toMatchObject({ value: 0, min: 0, max: 99 })
        opciones()
        expect(container.querySelector("[data-field='actions.custom_key']")).toBeNull()
    })

    it("arranca_abierto_con_un_valor_personalizado_mayor_a_4_y_el_campo_usa_trigger", () => {
        montar({ active: 7 })
        expect(fields["actions.custom_key"].value).toBe(7)
        fire("actions.custom_key", "onChange", 8)
        expect(trigger.mock.calls).toEqual([[8]])
        expect(fields["actions.custom_key"].value).toBe(8)
        fire("actions.custom_key", "onChange", 8)
        expect(get(activePopup)).toBeNull()
    })

    it("arranca_abierto_si_el_estilo_tiene_showAsFaded_o_skipVirtualBreaks", () => {
        montar({ styleId: "s1" }, { s1: { showAsFaded: true } })
        expect(fields["actions.custom_key"]).toBeTruthy()
        cleanup()
        restaurar()
        montar({ styleId: "s1" }, { s1: { skipVirtualBreaks: true } })
        expect(fields["actions.custom_key"]).toBeTruthy()
    })

    describe("estilo", () => {
        it("sin_styleId_no_ofrece_saltar_saltos_virtuales", () => {
            montar({ active: 7 })
            expect(fields["edit.skip_virtual_breaks"]).toBeUndefined()
            expect(fields["edit.show_as_faded"]).toMatchObject({ checked: false, defaultValue: false, style: { width: "100%" } })
        })

        it("los_interruptores_escriben_el_estilo_del_store", () => {
            montar({ styleId: "s1", active: 7 }, { s1: { name: "uno" } })
            fire("edit.show_as_faded", "onChange", true)
            fire("edit.skip_virtual_breaks", "onChange", true)
            expect(get(styles).s1).toEqual({ name: "uno", showAsFaded: true, skipVirtualBreaks: true })
            expect(fields["edit.show_as_faded"].checked).toBe(true)
            expect(fields["edit.skip_virtual_breaks"].checked).toBe(true)
        })

        it("la_opacidad_solo_se_ve_con_showAsFaded_abre_con_la_flecha_y_vale_50_por_defecto", () => {
            montar({ styleId: "s1", active: 7 }, { s1: { showAsFaded: true } })
            expect(fields["edit.opacity (%)"]).toBeUndefined()
            fireEvent.click(document.querySelector("[data-title='main.open']") as HTMLElement)
            expect(fields["edit.opacity (%)"]).toMatchObject({ value: 50, min: 0, max: 99 })
            fire("edit.opacity (%)", "onChange", 30)
            expect(get(styles).s1.lineOpacity).toBe(30)
            expect(fields["edit.opacity (%)"].value).toBe(30)
        })

        it("sin_showAsFaded_no_hay_flecha", () => {
            montar({ styleId: "s1", active: 7 }, { s1: {} })
            expect(screen.queryByText("main.open")).toBeNull()
            expect(document.querySelector("[data-title='main.open']")).toBeNull()
        })
    })
})
