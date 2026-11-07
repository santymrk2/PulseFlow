// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { TimeField } from "./TimeField"
import styles from "./TimeField.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const input = () => document.querySelector("input") as HTMLInputElement
const root = () => document.querySelector(".textfield") as HTMLElement
// El valor se lee dentro del handler: happy-dom limpia event.target al terminar el dispatch
const leer = () => {
    const valores: (string | null)[] = []
    const fn = vi.fn((valor: string | null) => valores.push(valor))
    return { fn, valores }
}

describe("TimeField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { hora: "Hora" } })])
        render(<TimeField label="inputs.hora" value="12:30" id="t" title="inputs.hora" />)
        expect(input().type).toBe("time")
        expect(input().value).toBe("12:30")
        expect(input().classList.contains("edit")).toBe(true)
        expect(screen.getByText("Hora").getAttribute("for")).toBe("t")
        expect(root().getAttribute("data-title")).toBe("Hora")
        expect(root().classList.contains("filled")).toBe(true)
        expect(root().classList.contains(styles.filled)).toBe(true)
    })

    it("isDate_usa_un_input_de_fecha", () => {
        render(<TimeField label="x" value="2026-11-07" isDate />)
        expect(input().type).toBe("date")
        expect(input().value).toBe("2026-11-07")
    })

    it("onInput_es_por_tecla_y_no_dispara_onChange", () => {
        const a = leer()
        const b = leer()
        render(<TimeField label="x" value="10:00" onInput={a.fn} onChange={b.fn} />)
        fireEvent.input(input(), { target: { value: "10:30" } })
        expect(a.valores).toEqual(["10:30"])
        expect(b.fn).not.toHaveBeenCalled()
    })

    it("onChange_es_el_change_nativo_con_el_valor", () => {
        const a = leer()
        const b = leer()
        render(<TimeField label="x" value="10:00" onInput={a.fn} onChange={b.fn} />)
        fireEvent.change(input(), { target: { value: "11:15" } })
        expect(b.valores).toEqual(["11:15"])
        expect(a.fn).not.toHaveBeenCalled()
    })

    it("onKeyDown_reenvia_la_tecla_y_Enter_desenfoca_en_el_acto", () => {
        const onKeyDown = vi.fn()
        render(<TimeField label="x" value="10:00" onKeyDown={onKeyDown} />)
        input().focus()
        fireEvent.keyDown(input(), { key: "Enter" })
        expect(onKeyDown.mock.calls[0][0].key).toBe("Enter")
        expect(document.activeElement).not.toBe(input())
    })

    it("lo_escrito_se_conserva_y_un_value_nuevo_del_padre_lo_reemplaza", () => {
        const { rerender } = render(<TimeField label="x" value="10:00" />)
        fireEvent.input(input(), { target: { value: "10:45" } })
        rerender(<TimeField label="x" value="10:00" />)
        expect(input().value).toBe("10:45")
        rerender(<TimeField label="x" value="09:00" />)
        expect(input().value).toBe("09:00")
    })

    it("reset_despacha_change_y_luego_input_con_defaultValue_y_ofrece_deshacer_3s", () => {
        vi.useFakeTimers()
        const onInput = vi.fn()
        const onChange = vi.fn()
        const { rerender } = render(<TimeField label="x" value="10:00" defaultValue="12:00" onInput={onInput} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("12:00")
        expect(onInput).toHaveBeenCalledWith("12:00")
        expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(onInput.mock.invocationCallOrder[0])

        rerender(<TimeField label="x" value="12:00" defaultValue="12:00" onInput={onInput} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith("10:00")
        expect(onInput).toHaveBeenLastCalledWith("10:00")
        expect(document.querySelector("button")).toBeNull()
    })

    it("el_deshacer_desaparece_a_los_3_segundos", () => {
        vi.useFakeTimers()
        const { rerender } = render(<TimeField label="x" value="10:00" defaultValue="12:00" />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        rerender(<TimeField label="x" value="12:00" defaultValue="12:00" />)
        expect(document.querySelector('[data-title="actions.undo"]')).toBeTruthy()
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(document.querySelector("button")).toBeNull()
    })

    it("sin_defaultValue_no_hay_contenedor_de_reset", () => {
        render(<TimeField label="x" value="10:00" />)
        expect(document.querySelector(".remove")).toBeNull()
    })

    it("disabled_aplica_la_clase_y_deshabilita_el_input", () => {
        for (const disabled of [false, true]) {
            const { unmount } = render(<TimeField label="x" value="10:00" disabled={disabled} />)
            expect(root().classList.contains(styles.disabled)).toBe(disabled)
            expect(input().disabled).toBe(disabled)
            unmount()
        }
    })
})
