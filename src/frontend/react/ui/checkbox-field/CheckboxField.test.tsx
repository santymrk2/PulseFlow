// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { CheckboxField } from "./CheckboxField"
import styles from "./CheckboxField.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const raiz = () => document.querySelector(`.${styles.checkboxfield}`) as HTMLElement

describe("CheckboxField", () => {
    it("el_fondo_hover_tambien_lleva_la_clase_global_hover", () => {
        render(<CheckboxField label="x" />)
        expect(raiz().querySelector(`.${styles.hover}`)?.classList.contains("hover")).toBe(true)
    })

    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { name: "<b>Nombre</b>" } })])
        render(<CheckboxField label="inputs.name" checked data="info" icon="check" id="c" />)
        expect(raiz().getAttribute("aria-checked")).toBe("true")
        expect(raiz().classList.contains("checkboxfield")).toBe(true)
        expect(raiz().getAttribute("data-title")).toBe("<b>Nombre</b>")
        // {@html}: el marcado del texto se interpreta
        expect(raiz().querySelector("b")?.textContent).toBe("Nombre")
        expect(screen.getByText("info")).toBeTruthy()
        expect(raiz().querySelectorAll("svg").length).toBe(2) // el tilde y el ícono
        expect((document.querySelector("input") as HTMLInputElement).checked).toBe(true)
    })

    it("click_alterna_y_avisa_con_el_booleano_nuevo", () => {
        const onChange = vi.fn()
        render(<CheckboxField label="x" onChange={onChange} />)
        fireEvent.click(raiz())
        expect(onChange).toHaveBeenLastCalledWith(true)
        expect(raiz().getAttribute("aria-checked")).toBe("true")
        fireEvent.click(raiz())
        expect(onChange).toHaveBeenLastCalledWith(false)
    })

    it("Enter_y_espacio_alternan_con_preventDefault_y_otras_teclas_no", () => {
        const onChange = vi.fn()
        render(<CheckboxField label="x" onChange={onChange} />)
        for (const key of ["Enter", " "]) expect(fireEvent.keyDown(raiz(), { key })).toBe(false)
        expect(onChange).toHaveBeenCalledTimes(2)
        fireEvent.keyDown(raiz(), { key: "a" })
        expect(onChange).toHaveBeenCalledTimes(2)
    })

    it("disabled_no_alterna", () => {
        const onChange = vi.fn()
        render(<CheckboxField label="x" disabled onChange={onChange} />)
        fireEvent.click(raiz())
        fireEvent.keyDown(raiz(), { key: " " })
        expect(onChange).not.toHaveBeenCalled()
        expect(raiz().getAttribute("tabindex")).toBeNull()
    })

    it("defaultValue_marca_el_punto_de_cambiado_solo_si_difiere", () => {
        const { rerender } = render(<CheckboxField label="x" checked defaultValue={false} />)
        expect(raiz().querySelector(`.${styles.changed}`)?.classList.contains(styles.hidden)).toBe(false)
        rerender(<CheckboxField label="x" checked defaultValue />)
        expect(raiz().querySelector(`.${styles.changed}`)?.classList.contains(styles.hidden)).toBe(true)
        rerender(<CheckboxField label="x" checked />)
        expect(raiz().querySelector(`.${styles.changed}`)).toBeNull()
    })

    it("variantes_center_disabled_y_small", () => {
        for (const center of [false, true]) {
            for (const disabled of [false, true]) {
                for (const small of [false, true]) {
                    const { unmount } = render(<CheckboxField label="x" center={center} disabled={disabled} small={small} />)
                    expect(raiz().classList.contains(styles.centered)).toBe(center)
                    expect(raiz().classList.contains(styles.disabled)).toBe(disabled)
                    expect(raiz().classList.contains(styles.small)).toBe(small)
                    unmount()
                }
            }
        }
    })
})
