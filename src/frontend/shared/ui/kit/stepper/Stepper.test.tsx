// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../test/mockCommon"
import { fireWheel } from "../../../test/fireWheel"
import { Stepper } from "./Stepper"
import styles from "./Stepper.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

const botones = () => ({ menos: document.getElementById("decrement") as HTMLButtonElement, mas: document.getElementById("increment") as HTMLButtonElement })
const input = () => screen.getByRole("textbox") as HTMLInputElement

describe("Stepper", () => {
    it("renderiza_lo_principal", () => {
        const { container } = render(<Stepper value={5} title="Cantidad" visibleTitle />)
        expect(input().value).toBe("5")
        expect(botones().menos).toBeTruthy()
        expect(botones().mas).toBeTruthy()
        expect(screen.getByText("Cantidad").classList.contains(styles.title)).toBe(true)
        expect((container.firstChild as HTMLElement).classList.contains("numberInput")).toBe(true)
        expect(container.querySelector("span.input")?.getAttribute("data-title")).toBe("Cantidad")
    })

    it("sin_buttons_ni_titulo_visible", () => {
        render(<Stepper value={5} title="T" buttons={false} />)
        expect(botones().menos).toBeNull()
        expect(screen.queryByText("T")).toBeNull()
    })

    it("mostrar_aplica_inputMultiplier_y_fixed", () => {
        render(<Stepper value={0.5} inputMultiplier={100} fixed={1} />)
        expect(input().value).toBe("50.0")
    })

    it("mas_y_menos_despachan_onChange_con_el_string_toFixed", () => {
        const onChange = vi.fn()
        render(<Stepper value={5} step={2} decimals={1} onChange={onChange} />)
        fireEvent.click(botones().mas)
        expect(onChange).toHaveBeenLastCalledWith("7.0")
        fireEvent.click(botones().menos)
        expect(onChange).toHaveBeenLastCalledWith("3.0")
    })

    it("ctrl_o_meta_en_el_boton_multiplica_el_paso_por_10", () => {
        const onChange = vi.fn()
        render(<Stepper value={50} step={2} onChange={onChange} />)
        fireEvent.click(botones().mas, { ctrlKey: true })
        expect(onChange).toHaveBeenLastCalledWith("70")
        fireEvent.click(botones().menos, { metaKey: true })
        expect(onChange).toHaveBeenLastCalledWith("30")
    })

    it("respeta_min_y_max_y_deshabilita_los_botones_en_los_limites", () => {
        const onChange = vi.fn()
        const { rerender } = render(<Stepper value={9} max={10} min={0} step={5} onChange={onChange} />)
        fireEvent.click(botones().mas)
        expect(onChange).toHaveBeenLastCalledWith("10")
        rerender(<Stepper value={10} max={10} min={0} onChange={onChange} />)
        expect(botones().mas.disabled).toBe(true)
        expect(botones().menos.disabled).toBe(false)
        rerender(<Stepper value={0} max={10} min={0} onChange={onChange} />)
        expect(botones().menos.disabled).toBe(true)
    })

    it("change_nativo_del_input_evalua_la_cuenta_y_despacha", () => {
        const onChange = vi.fn()
        render(<Stepper value={5} onChange={onChange} />)
        fireEvent.change(input(), { target: { value: "2+3*4" } })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenLastCalledWith("14")
    })

    it("change_con_division_da_el_cociente_y_texto_invalido_vuelve_al_valor_anterior", () => {
        const onChange = vi.fn()
        render(<Stepper value={5} onChange={onChange} />)
        fireEvent.change(input(), { target: { value: "1920/2" } })
        expect(onChange).toHaveBeenLastCalledWith("960")
        fireEvent.change(input(), { target: { value: "abc" } })
        expect(onChange).toHaveBeenLastCalledWith("5")
    })

    it("tipear_no_despacha_hasta_confirmar", () => {
        const onChange = vi.fn()
        render(<Stepper value={5} onChange={onChange} />)
        fireEvent.input(input(), { target: { value: "9" } })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("input_acota_al_rango_divide_por_el_multiplicador_y_cae_al_value_si_no_es_cuenta_igual_que_el_svelte", () => {
        const onChange = vi.fn()
        render(<Stepper value={5} max={10} inputMultiplier={10} decimals={2} onChange={onChange} />)
        fireEvent.change(input(), { target: { value: "500" } })
        expect(onChange).toHaveBeenLastCalledWith("10.00")
        fireEvent.change(input(), { target: { value: "abc" } })
        // igual que el Svelte: el valor de respaldo (value) también se divide por inputMultiplier
        expect(onChange).toHaveBeenLastCalledWith("0.50")
        fireEvent.change(input(), { target: { value: "-30" } })
        expect(onChange).toHaveBeenLastCalledWith("0.00")
    })

    it("ctrl_wheel_sube_o_baja_con_shift_x10_y_previene_el_scroll", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const { container } = render(<Stepper value={50} step={2} onChange={onChange} />)
        const raiz = container.firstChild as HTMLElement
        expect(fireWheel(raiz, { deltaY: -5 }).defaultPrevented).toBe(false)
        expect(onChange).not.toHaveBeenCalled()
        expect(fireWheel(raiz, { deltaY: -5, ctrlKey: true }).defaultPrevented).toBe(true)
        expect(onChange).toHaveBeenLastCalledWith("52")
        fireWheel(raiz, { deltaY: -5, ctrlKey: true })
        expect(onChange).toHaveBeenCalledTimes(1)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        fireWheel(raiz, { deltaY: 5, metaKey: true, shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith("30")
    })

    it("wheel_deshabilitado_no_hace_nada", () => {
        const onChange = vi.fn()
        const { container } = render(<Stepper value={50} disabled onChange={onChange} />)
        fireWheel(container.firstChild as HTMLElement, { deltaY: -5, ctrlKey: true })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("mantener_apretado_repite_con_el_valor_actual_hasta_soltar", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const { rerender } = render(<Stepper value={5} onChange={onChange} />)
        fireEvent.mouseDown(botones().mas)
        act(() => {
            vi.advanceTimersByTime(500 + 100)
        })
        expect(onChange).toHaveBeenLastCalledWith("6")
        rerender(<Stepper value={6} onChange={onChange} />)
        act(() => {
            vi.advanceTimersByTime(100)
        })
        expect(onChange).toHaveBeenLastCalledWith("7")
        fireEvent.mouseUp(window)
        const llamadas = onChange.mock.calls.length
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(onChange).toHaveBeenCalledTimes(llamadas)
    })

    it("soltar_antes_de_los_500ms_cancela_y_disableHold_no_repite", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const { unmount } = render(<Stepper value={5} onChange={onChange} />)
        fireEvent.mouseDown(botones().mas)
        fireEvent.mouseUp(window)
        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(onChange).not.toHaveBeenCalled()
        unmount()
        render(<Stepper value={5} disableHold onChange={onChange} />)
        fireEvent.mouseDown(botones().mas)
        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("variantes_outline_y_disabled", () => {
        for (const outline of [false, true]) {
            for (const disabled of [false, true]) {
                const { container, unmount } = render(<Stepper value={1} outline={outline} disabled={disabled} />)
                const raiz = container.firstChild as HTMLElement
                expect(raiz.classList.contains(styles.outline)).toBe(outline)
                expect(raiz.classList.contains(styles.disabled)).toBe(disabled)
                expect(input().disabled).toBe(disabled)
                unmount()
            }
        }
    })
})
