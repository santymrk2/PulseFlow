// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { ToggleField } from "./ToggleField"
import styles from "./ToggleField.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const campo = () => screen.getByRole("switch")

describe("ToggleField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { name: "Nombre" } })])
        render(<ToggleField label="inputs.name" checked data="info" id="t" />)
        expect(campo().getAttribute("aria-checked")).toBe("true")
        expect(campo().getAttribute("data-title")).toBe("Nombre")
        expect(campo().classList.contains("togglefield")).toBe(true)
        expect(screen.getByText("info")).toBeTruthy()
        expect((document.querySelector("input") as HTMLInputElement).checked).toBe(true)
        expect(screen.getByText("Nombre").closest("label")?.getAttribute("for")).toBe("t")
    })

    it("sin_label_no_renderiza_la_etiqueta", () => {
        render(<ToggleField label="" />)
        expect(document.querySelector("label")).toBeNull()
    })

    it("click_alterna_y_avisa_con_el_booleano_nuevo", () => {
        const onChange = vi.fn()
        render(<ToggleField label="x" checked={false} onChange={onChange} />)
        fireEvent.click(campo())
        expect(onChange).toHaveBeenLastCalledWith(true)
        expect(campo().getAttribute("aria-checked")).toBe("true")
        fireEvent.click(campo())
        expect(onChange).toHaveBeenLastCalledWith(false)
    })

    it("Enter_y_espacio_alternan_con_preventDefault_y_otras_teclas_no", () => {
        const onChange = vi.fn()
        render(<ToggleField label="x" onChange={onChange} />)
        for (const key of ["Enter", " "]) {
            const permitido = fireEvent.keyDown(campo(), { key })
            expect(permitido).toBe(false)
        }
        expect(onChange).toHaveBeenCalledTimes(2)
        fireEvent.keyDown(campo(), { key: "a" })
        expect(onChange).toHaveBeenCalledTimes(2)
    })

    it("disabled_no_alterna_ni_es_enfocable", () => {
        const onChange = vi.fn()
        render(<ToggleField label="x" disabled onChange={onChange} />)
        fireEvent.click(campo())
        fireEvent.keyDown(campo(), { key: "Enter" })
        expect(onChange).not.toHaveBeenCalled()
        expect(campo().getAttribute("tabindex")).toBeNull()
        expect(campo().classList.contains("disabled")).toBe(true)
    })

    it("la_prop_checked_del_padre_manda_cuando_cambia", () => {
        const { rerender } = render(<ToggleField label="x" checked={false} />)
        fireEvent.click(campo())
        rerender(<ToggleField label="x" checked={false} />)
        expect(campo().getAttribute("aria-checked")).toBe("true")
        rerender(<ToggleField label="x" checked />)
        rerender(<ToggleField label="x" checked={false} />)
        expect(campo().getAttribute("aria-checked")).toBe("false")
    })

    it("defaultValue_marca_el_punto_de_cambiado_solo_si_difiere", () => {
        const { container, rerender } = render(<ToggleField label="x" checked defaultValue={false} />)
        expect(container.querySelector(`.${styles.changed}`)?.classList.contains(styles.hidden)).toBe(false)
        rerender(<ToggleField label="x" checked defaultValue />)
        expect(container.querySelector(`.${styles.changed}`)?.classList.contains(styles.hidden)).toBe(true)
        rerender(<ToggleField label="x" checked />)
        expect(container.querySelector(`.${styles.changed}`)).toBeNull()
    })

    it("variantes_center_disabled_y_small", () => {
        for (const center of [false, true]) {
            for (const disabled of [false, true]) {
                for (const small of [false, true]) {
                    const { unmount } = render(<ToggleField label="x" center={center} disabled={disabled} small={small} />)
                    expect(campo().classList.contains(styles.centered)).toBe(center)
                    expect(campo().classList.contains(styles.disabled)).toBe(disabled)
                    expect(campo().classList.contains(styles.small)).toBe(small)
                    unmount()
                }
            }
        }
    })
})
