// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { fireWheel } from "../../test/fireWheel"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { NumberField } from "./NumberField"
import styles from "./NumberField.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const input = () => screen.getByRole("textbox") as HTMLInputElement
const inc = () => document.querySelector("button.inc") as HTMLButtonElement
const dec = () => document.querySelector("button.dec") as HTMLButtonElement
const raiz = () => document.querySelector(".numberfield") as HTMLElement

// Escribe y confirma con el change nativo (Enter/blur)
function confirmar(texto: string) {
    fireEvent.input(input(), { target: { value: texto } })
    fireEvent.change(input(), { target: { value: texto } })
}

describe("NumberField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { name: "Nombre" } })])
        render(<NumberField label="inputs.name" value={5} id="n" />)
        expect(input().value).toBe("5")
        expect(input().getAttribute("inputmode")).toBe("decimal")
        expect(screen.getByText("Nombre").getAttribute("for")).toBe("n")
        expect(raiz().classList.contains("textfield")).toBe(true)
        expect(inc()).toBeTruthy()
        expect(dec()).toBeTruthy()
    })

    it("formatea_con_maxDecimals_y_padLength", () => {
        const { unmount } = render(<NumberField label="x" value={1.23456} maxDecimals={2} />)
        expect(input().value).toBe("1.23")
        unmount()
        render(<NumberField label="x" value={7} padLength={3} />)
        expect(input().value).toBe("007")
    })

    it("escribir_no_despacha_nada_hasta_el_change_nativo", () => {
        const onInput = vi.fn()
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} onInput={onInput} onChange={onChange} />)
        fireEvent.input(input(), { target: { value: "12" } })
        expect(onInput).not.toHaveBeenCalled()
        expect(onChange).not.toHaveBeenCalled()
        expect(input().value).toBe("12")
    })

    it("change_nativo_despacha_input_y_change_con_el_numero", () => {
        const onInput = vi.fn()
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} onInput={onInput} onChange={onChange} />)
        confirmar("12")
        expect(onInput).toHaveBeenCalledWith(12)
        expect(onChange).toHaveBeenCalledWith(12)
        expect(onInput.mock.invocationCallOrder[0]).toBeLessThan(onChange.mock.invocationCallOrder[0])
    })

    it("evalua_aritmetica_y_acepta_coma_decimal", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} min={null} onChange={onChange} />)
        confirmar("2+3*4")
        expect(onChange).toHaveBeenLastCalledWith(14)
        confirmar("1,5")
        expect(onChange).toHaveBeenLastCalledWith(1.5)
    })

    it("expresion_invalida_no_despacha_ni_cambia_el_valor", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} onChange={onChange} />)
        confirmar("alert(1)")
        confirmar("1/0")
        expect(onChange).not.toHaveBeenCalled()
    })

    it("no_usa_eval_ni_Function", () => {
        const evalSpy = vi.spyOn(globalThis, "eval")
        render(<NumberField label="x" value={1} onChange={vi.fn()} />)
        confirmar("2*3")
        expect(evalSpy).not.toHaveBeenCalled()
    })

    it("recorta_a_min_y_max_y_redondea_a_maxDecimals", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={5} min={2} max={10} maxDecimals={1} onChange={onChange} />)
        confirmar("100")
        expect(onChange).toHaveBeenLastCalledWith(10)
        confirmar("-4")
        expect(onChange).toHaveBeenLastCalledWith(2)
        confirmar("3.14159")
        expect(onChange).toHaveBeenLastCalledWith(3.1)
    })

    it("con_padLength_no_evalua_expresiones_y_rellena_con_ceros", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} padLength={3} onChange={onChange} />)
        confirmar("2+3")
        expect(onChange).not.toHaveBeenCalled()
        confirmar("9")
        expect(onChange).toHaveBeenLastCalledWith(9)
        expect(input().value).toBe("009")
    })

    it("disabled_no_despacha", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={1} disabled onChange={onChange} />)
        confirmar("5")
        expect(onChange).not.toHaveBeenCalled()
        expect(input().disabled).toBe(true)
        expect(raiz().classList.contains(styles.disabled)).toBe(true)
    })

    it("flechas_incrementan_y_decrementan_con_preventDefault", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={5} step={2} onChange={onChange} />)
        expect(fireEvent.keyDown(input(), { key: "ArrowUp" })).toBe(false)
        expect(onChange).toHaveBeenLastCalledWith(7)
        fireEvent.keyDown(input(), { key: "ArrowDown" })
        expect(onChange).toHaveBeenLastCalledWith(5) // 7 - 2: el valor local quedó en 7
    })

    it("Enter_confirma_el_texto_escrito_y_reenvia_onKeyDown", () => {
        const onChange = vi.fn()
        const onKeyDown = vi.fn()
        render(<NumberField label="x" value={1} onChange={onChange} onKeyDown={onKeyDown} />)
        fireEvent.input(input(), { target: { value: "8" } })
        fireEvent.keyDown(input(), { key: "Enter" })
        expect(onChange).toHaveBeenLastCalledWith(8)
        expect(onKeyDown.mock.calls[0][0].key).toBe("Enter")
    })

    it("botones_incrementan_con_shift_x10_y_se_deshabilitan_en_los_limites", () => {
        const onChange = vi.fn()
        const { rerender } = render(<NumberField label="x" value={5} min={0} max={100} onChange={onChange} />)
        fireEvent.click(inc())
        expect(onChange).toHaveBeenLastCalledWith(6)
        fireEvent.click(dec(), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith(0) // 6 - 10 se recorta a min
        rerender(<NumberField label="x" value={100} min={0} max={100} onChange={onChange} />)
        expect(inc().disabled).toBe(true)
        rerender(<NumberField label="x" value={0} min={0} max={100} onChange={onChange} />)
        expect(dec().disabled).toBe(true)
    })

    it("rueda_con_ctrl_cambia_el_valor_y_sin_ctrl_no", () => {
        const onChange = vi.fn()
        render(<NumberField label="x" value={5} onChange={onChange} />)
        const sin = fireWheel(input(), { deltaY: -100 })
        expect(onChange).not.toHaveBeenCalled()
        expect(sin.defaultPrevented).toBe(false)

        const evento = fireWheel(input(), { deltaY: -100, ctrlKey: true })
        expect(evento.defaultPrevented).toBe(true)
        expect(onChange).toHaveBeenLastCalledWith(6)
        fireWheel(input(), { deltaY: 100, ctrlKey: true, shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith(0)
    })

    it("la_rueda_suave_espera_500_ms_para_la_siguiente", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        render(<NumberField label="x" value={5} onChange={onChange} />)
        fireWheel(input(), { deltaY: -10, ctrlKey: true })
        fireWheel(input(), { deltaY: -10, ctrlKey: true })
        expect(onChange).toHaveBeenCalledTimes(1)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        fireWheel(input(), { deltaY: -10, ctrlKey: true })
        expect(onChange).toHaveBeenCalledTimes(2)
    })

    it("al_desmontar_se_quitan_los_listeners_nativos", () => {
        const onChange = vi.fn()
        const { unmount } = render(<NumberField label="x" value={5} onChange={onChange} />)
        const el = input()
        unmount()
        fireEvent.change(el, { target: { value: "9" } })
        fireWheel(el, { deltaY: -100, ctrlKey: true })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("el_texto_escrito_se_invalida_al_cambiar_padLength_o_maxDecimals", () => {
        const { rerender } = render(<NumberField label="x" value={7} />)
        fireEvent.input(input(), { target: { value: "garabato" } })
        expect(input().value).toBe("garabato")
        rerender(<NumberField label="x" value={7} padLength={3} />)
        expect(input().value).toBe("007")

        fireEvent.input(input(), { target: { value: "otro" } })
        rerender(<NumberField label="x" value={1.2345} padLength={0} maxDecimals={3} />)
        expect(input().value).toBe("1.234")
    })

    it("hideWhenZero_oculta_el_cero_y_marca_la_etiqueta", () => {
        const { rerender } = render(<NumberField label="etiqueta" value={0} hideWhenZero />)
        expect(input().classList.contains(styles.noValue)).toBe(true)
        expect(screen.getByText("etiqueta").classList.contains(styles.valueFilled)).toBe(false)
        rerender(<NumberField label="etiqueta" value={3} hideWhenZero />)
        expect(input().classList.contains(styles.noValue)).toBe(false)
        expect(screen.getByText("etiqueta").classList.contains(styles.valueFilled)).toBe(true)
    })

    it("center_y_disabled_aplican_las_clases", () => {
        for (const { center, disabled } of [
            { center: false, disabled: false },
            { center: true, disabled: false },
            { center: false, disabled: true },
            { center: true, disabled: true }
        ]) {
            const { unmount } = render(<NumberField label="x" center={center} disabled={disabled} />)
            expect(raiz().classList.contains(styles.centered)).toBe(center)
            expect(raiz().classList.contains(styles.disabled)).toBe(disabled)
            unmount()
        }
    })

    it("slider_despacha_input_y_change_y_usa_sliderValues", () => {
        const onInput = vi.fn()
        const onChange = vi.fn()
        render(<NumberField label="x" value={20} showSlider sliderValues={{ min: 10, max: 50, step: 5 }} min={null} onInput={onInput} onChange={onChange} />)
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        expect(slider.min).toBe("10")
        expect(slider.max).toBe("50")
        expect(slider.step).toBe("5")
        expect(slider.value).toBe("20")
        expect(slider.style.getPropertyValue("--slider-fill")).toBe("25%")

        fireEvent.change(slider, { target: { value: "35" } })
        expect(onInput).toHaveBeenCalledWith(35)
        expect(onChange).toHaveBeenCalledWith(35)
    })

    it("sin_showSlider_no_hay_slider", () => {
        render(<NumberField label="x" />)
        expect(document.querySelector('input[type="range"]')).toBeNull()
    })

    it("currentProgress_ensancha_el_subrayado", () => {
        render(<NumberField label="x" currentProgress={40} />)
        const subrayado = document.querySelector(`.${styles.underline}`) as HTMLElement
        expect(subrayado.style.width).toBe("40%")
    })

    it("reset_despacha_change_con_defaultValue_y_deshacer_con_el_valor_previo", () => {
        const onChange = vi.fn()
        const { rerender } = render(<NumberField label="x" value={9} defaultValue={1} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith(1)

        rerender(<NumberField label="x" value={1} defaultValue={1} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith(9)
    })

    it("sin_defaultValue_no_hay_reset", () => {
        render(<NumberField label="x" value={9} />)
        expect(document.querySelector('[data-title="actions.reset"]')).toBeNull()
    })

    it("keyframe_alterna_el_rombo_y_despacha_el_valor", () => {
        const onKeyframe = vi.fn()
        render(<NumberField label="x" value={4} enableKeyframe onKeyframe={onKeyframe} />)
        const rombo = () => document.querySelector('[data-title="timeline.add_keyframe"] path') as Element
        expect(rombo().getAttribute("fill")).toBe("currentColor")
        fireEvent.click(document.querySelector('[data-title="timeline.add_keyframe"]') as HTMLElement)
        expect(onKeyframe).toHaveBeenCalledWith(4)
        expect(rombo().getAttribute("fill")).toBe("var(--secondary)")
    })

    it("hasTimelineAction_pinta_el_rombo_activo", () => {
        render(<NumberField label="x" enableKeyframe hasTimelineAction />)
        expect((document.querySelector('[data-title="timeline.add_keyframe"] path') as Element).getAttribute("fill")).toBe("var(--secondary)")
    })

    it("cambiar_value_desde_el_padre_actualiza_el_texto", () => {
        const { rerender } = render(<NumberField label="x" value={1} />)
        rerender(<NumberField label="x" value={7} />)
        expect(input().value).toBe("7")
    })
})
