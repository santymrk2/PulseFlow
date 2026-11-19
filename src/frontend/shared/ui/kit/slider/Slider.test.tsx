// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Slider } from "./Slider"
import styles from "./Slider.module.css"

afterEach(cleanup)

const rango = () => screen.getByRole("slider") as HTMLInputElement

describe("Slider", () => {
    it("renderiza_lo_principal", () => {
        render(<Slider value={30} title="Volumen" />)
        expect(rango().value).toBe("30")
        expect(rango().min).toBe("0")
        expect(rango().max).toBe("100")
        expect(rango().step).toBe("1")
        expect(rango().getAttribute("data-title")).toBe("Volumen")
    })

    it("min_max_y_step_propios_y_step_0_vale_1", () => {
        const { rerender } = render(<Slider value={5} min={2} max={9} step={0.5} />)
        expect(rango().min).toBe("2")
        expect(rango().max).toBe("9")
        expect(rango().step).toBe("0.5")
        rerender(<Slider value={5} step={0} />)
        expect(rango().step).toBe("1")
    })

    it("onInput_reenvia_el_evento_con_el_valor_nuevo", () => {
        const valores: string[] = []
        const onInput = vi.fn((e: { currentTarget: HTMLInputElement }) => valores.push(e.currentTarget.value))
        render(<Slider value={0} onInput={onInput} />)
        fireEvent.input(rango(), { target: { value: "42" } })
        expect(valores).toEqual(["42"])
    })

    it("onChange_es_el_change_nativo_y_tipear_no_lo_llama", () => {
        const valores: string[] = []
        const onChange = vi.fn((e: Event) => valores.push((e.target as HTMLInputElement).value))
        render(<Slider value={0} onChange={onChange} />)
        fireEvent.input(rango(), { target: { value: "10" } })
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.change(rango(), { target: { value: "11" } })
        expect(valores).toEqual(["11"])
    })

    it("al_desmontar_se_quita_el_listener_de_change", () => {
        const onChange = vi.fn()
        const { unmount } = render(<Slider value={0} onChange={onChange} />)
        const el = rango()
        unmount()
        fireEvent.change(el, { target: { value: "3" } })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("reenvia_los_eventos_del_mouse", () => {
        const eventos = { onMouseEnter: vi.fn(), onMouseLeave: vi.fn(), onMouseDown: vi.fn(), onMouseMove: vi.fn() }
        render(<Slider value={0} {...eventos} />)
        fireEvent.mouseEnter(rango())
        fireEvent.mouseLeave(rango())
        fireEvent.mouseDown(rango())
        fireEvent.mouseMove(rango())
        for (const fn of Object.values(eventos)) expect(fn).toHaveBeenCalledTimes(1)
    })

    it("cambiar_value_actualiza_y_no_pisa_lo_arrastrado_si_no_cambia", () => {
        const { rerender } = render(<Slider value={10} />)
        fireEvent.change(rango(), { target: { value: "60" } })
        rerender(<Slider value={10} />)
        expect(rango().value).toBe("60")
        rerender(<Slider value={20} />)
        expect(rango().value).toBe("20")
    })

    it("invert_y_disabled", () => {
        for (const invert of [false, true]) {
            for (const disabled of [false, true]) {
                const { unmount } = render(<Slider value={1} invert={invert} disabled={disabled} />)
                expect(rango().classList.contains(styles.invert)).toBe(invert)
                expect(rango().disabled).toBe(disabled)
                unmount()
            }
        }
    })
})
