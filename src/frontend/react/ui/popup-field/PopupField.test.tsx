// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../../lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { PopupField } from "./PopupField"
import styles from "./PopupField.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const raiz = () => document.querySelector(".textfield") as HTMLElement
const trigger = () => document.querySelector('[role="button"]') as HTMLElement
const limpiarStores = () => (restaurar = setStoresForTest([storeEntry(activePopup, null), storeEntry(popupData, {})]))

describe("PopupField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { popup: { color_gradient: "Degradé" } }), storeEntry(activePopup, null), storeEntry(popupData, {})])
        render(<PopupField id="p" label="Etiqueta" value="v" name="Mi nombre" popupId="color_gradient" />)
        expect(raiz().id).toBe("p")
        expect(raiz().getAttribute("data-title")).toBe("Degradé")
        expect(trigger().classList.contains("edit")).toBe(true)
        expect(trigger().textContent).toBe("Mi nombre")
        expect(document.querySelector("label")?.textContent).toBe("Etiqueta")
        expect(document.querySelector("label")?.classList.contains(styles.selected)).toBe(true)
    })

    it("sin_value_no_muestra_el_nombre_y_sin_name_muestra_sin_nombre", () => {
        const { rerender } = render(<PopupField label="x" value="" name="Nombre" popupId="alert" />)
        expect(trigger().textContent).toBe("")
        rerender(<PopupField label="x" value="v" name="" popupId="alert" />)
        expect(trigger().textContent).toBe("main.unnamed")
    })

    it("el_nombre_se_interpreta_como_html", () => {
        render(<PopupField label="x" value="v" name="<b>negrita</b>" popupId="alert" />)
        expect(trigger().querySelector("b")?.textContent).toBe("negrita")
    })

    it("click_guarda_popupData_y_abre_el_popup_y_trigger_despacha_change", () => {
        limpiarStores()
        const onChange = vi.fn()
        render(<PopupField id="p" label="x" value="actual" name="n" popupId="color_gradient" data={{ extra: 1 }} onChange={onChange} />)
        fireEvent.click(trigger())
        const data = get(popupData)
        expect(data).toMatchObject({ extra: 1, active: "actual", id: "p" })
        expect(Object.keys(data).sort()).toEqual(["active", "extra", "id", "trigger"])
        expect(get(activePopup)).toBe("color_gradient")
        data.trigger("nuevo")
        expect(onChange).toHaveBeenCalledWith("nuevo")
    })

    it("openEvent_reemplaza_la_apertura_estandar", () => {
        limpiarStores()
        const openEvent = vi.fn()
        render(<PopupField label="x" value="v" name="n" popupId="alert" openEvent={openEvent} />)
        fireEvent.click(trigger())
        expect(openEvent).toHaveBeenCalledTimes(1)
        expect(get(activePopup)).toBeNull()
    })

    it("Enter_y_espacio_abren_con_preventDefault_y_otras_teclas_no", () => {
        limpiarStores()
        render(<PopupField label="x" value="v" name="n" popupId="alert" />)
        const enter = fireEvent.keyDown(trigger(), { key: "Enter" })
        expect(enter).toBe(false)
        expect(get(activePopup)).toBe("alert")
        activePopup.set(null)
        fireEvent.keyDown(trigger(), { key: " " })
        expect(get(activePopup)).toBe("alert")
        activePopup.set(null)
        fireEvent.keyDown(trigger(), { key: "a" })
        expect(get(activePopup)).toBeNull()
    })

    it("disabled_no_abre_no_tiene_tabindex_y_aplica_la_clase", () => {
        limpiarStores()
        render(<PopupField label="x" value="v" name="n" popupId="alert" disabled />)
        expect(raiz().classList.contains(styles.disabled)).toBe(true)
        expect(trigger().getAttribute("tabindex")).toBeNull()
        fireEvent.click(trigger())
        fireEvent.keyDown(trigger(), { key: "Enter" })
        expect(get(activePopup)).toBeNull()
    })

    it("allowEmpty_con_value_borra_con_null_sin_abrir_el_popup", () => {
        limpiarStores()
        const onChange = vi.fn()
        render(<PopupField label="x" value="v" name="n" popupId="alert" allowEmpty onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="clear.general"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith(null)
        expect(get(activePopup)).toBeNull()
    })

    it("allowEmpty_no_muestra_borrar_sin_value_ni_deshabilitado", () => {
        const { rerender } = render(<PopupField label="x" value="" name="n" popupId="alert" allowEmpty />)
        expect(document.querySelector("button")).toBeNull()
        rerender(<PopupField label="x" value="v" name="n" popupId="alert" allowEmpty disabled />)
        expect(document.querySelector("button")).toBeNull()
    })

    it("reset_despacha_defaultValue_y_deshacer_devuelve_el_anterior", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const { rerender } = render(<PopupField label="x" value={{ a: 1 }} defaultValue={{ a: 0 }} name="n" popupId="alert" onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith({ a: 0 })

        rerender(<PopupField label="x" value={{ a: 0 }} defaultValue={{ a: 0 }} name="n" popupId="alert" onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith({ a: 1 })
        expect(document.querySelector("button")).toBeNull()
    })

    it("el_deshacer_desaparece_a_los_3_segundos", () => {
        vi.useFakeTimers()
        const { rerender } = render(<PopupField label="x" value="b" defaultValue="a" name="n" popupId="alert" />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        rerender(<PopupField label="x" value="a" defaultValue="a" name="n" popupId="alert" />)
        expect(document.querySelector('[data-title="actions.undo"]')).toBeTruthy()
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(document.querySelector("button")).toBeNull()
    })

    it("usa_el_icono_o_la_flecha_por_defecto", () => {
        const { rerender } = render(<PopupField label="x" value="v" name="n" popupId="alert" />)
        expect(trigger().querySelector("svg path")).toBeTruthy()
        rerender(<PopupField label="x" value="v" name="n" popupId="alert" icon="check" />)
        expect(trigger().querySelectorAll("svg").length).toBe(1)
    })
})
