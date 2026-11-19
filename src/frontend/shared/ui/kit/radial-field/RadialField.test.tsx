// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireWheel } from "../../../test/fireWheel"
import { commonMock } from "../../../test/mockCommon"
import { RadialField } from "./RadialField"
import styles from "./RadialField.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

const input = () => document.querySelector("input") as HTMLInputElement
const root = () => document.querySelector(".textfield") as HTMLElement
const picker = () => document.querySelector(`.${styles.picker}`) as HTMLElement | null
const flechas = () => ({ inc: document.querySelector("button.inc") as HTMLButtonElement, dec: document.querySelector("button.dec") as HTMLButtonElement })
// los valores se leen en el handler: happy-dom limpia event.target al terminar el dispatch
const leer = () => {
    const eventos: { tipo: string; valor: number }[] = []
    return { eventos, onInput: (v: number) => eventos.push({ tipo: "input", valor: v }), onChange: (v: number) => eventos.push({ tipo: "change", valor: v }) }
}
const abrirPicker = () => {
    fireEvent.focus(input())
    const svg = document.getElementById("degree-picker") as unknown as SVGElement
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    return svg
}

describe("RadialField", () => {
    it("renderiza_lo_principal", () => {
        render(<RadialField label="Ángulo" value={90} id="r" placeholder="0" />)
        expect(input().value).toBe("90")
        expect(input().type).toBe("number")
        expect(input().min).toBe("0")
        expect(input().max).toBe("360")
        expect(input().placeholder).toBe("0")
        expect(input().classList.contains("edit")).toBe(true)
        expect(root().querySelector("label")?.textContent).toBe("Ángulo")
        expect(root().querySelector("label")?.getAttribute("for")).toBe("r")
        expect(picker()).toBeNull()
    })

    it("el_value_se_normaliza_a_0_360", () => {
        for (const [value, esperado] of [
            [370, "10"],
            [-10, "350"],
            [360, "0"],
            [Number("x"), "0"]
        ] as const) {
            const { unmount } = render(<RadialField label="x" value={value} />)
            expect(input().value).toBe(esperado)
            unmount()
        }
    })

    it("escribir_despacha_input_y_luego_change_con_el_numero_normalizado", () => {
        const { eventos, onInput, onChange } = leer()
        render(<RadialField label="x" value={0} onInput={onInput} onChange={onChange} />)
        fireEvent.input(input(), { target: { value: "45" } })
        expect(eventos).toEqual([
            { tipo: "input", valor: 45 },
            { tipo: "change", valor: 45 }
        ])
        fireEvent.input(input(), { target: { value: "400" } })
        expect(eventos.at(-1)).toEqual({ tipo: "change", valor: 40 })
        expect(input().value).toBe("40")
    })

    it("un_texto_vacio_no_despacha", () => {
        const { eventos, onInput, onChange } = leer()
        render(<RadialField label="x" value={10} onInput={onInput} onChange={onChange} />)
        fireEvent.input(input(), { target: { value: "" } })
        expect(eventos).toEqual([])
    })

    it("flechas_arriba_y_abajo_suman_el_paso_con_preventDefault_y_dan_la_vuelta", () => {
        const { eventos, onChange } = leer()
        render(<RadialField label="x" value={359} step={2} onChange={onChange} />)
        expect(fireEvent.keyDown(input(), { key: "ArrowUp" })).toBe(false)
        expect(eventos.at(-1)?.valor).toBe(1)
        fireEvent.keyDown(input(), { key: "ArrowDown" })
        fireEvent.keyDown(input(), { key: "ArrowDown" })
        expect(eventos.at(-1)?.valor).toBe(357)
    })

    it("los_botones_suman_y_restan_y_shift_multiplica_por_10", () => {
        const { eventos, onChange } = leer()
        render(<RadialField label="x" value={5} step={1} onChange={onChange} />)
        fireEvent.click(flechas().inc)
        expect(eventos.at(-1)?.valor).toBe(6)
        fireEvent.click(flechas().inc, { shiftKey: true })
        expect(eventos.at(-1)?.valor).toBe(16)
        fireEvent.click(flechas().dec, { shiftKey: true })
        expect(eventos.at(-1)?.valor).toBe(6)
        fireEvent.click(flechas().dec)
        expect(eventos.at(-1)?.valor).toBe(5)
    })

    it("disabled_no_despacha_y_deshabilita_los_botones", () => {
        const { eventos, onInput, onChange } = leer()
        render(<RadialField label="x" value={5} disabled onInput={onInput} onChange={onChange} />)
        expect(root().classList.contains(styles.disabled)).toBe(true)
        expect(flechas().inc.disabled).toBe(true)
        fireEvent.keyDown(input(), { key: "ArrowUp" })
        fireEvent.focus(input())
        expect(picker()).toBeNull()
        expect(eventos).toEqual([])
    })

    it("la_rueda_con_ctrl_o_meta_cambia_el_valor_y_sin_ellas_no", () => {
        const { eventos, onChange } = leer()
        render(<RadialField label="x" value={10} step={1} onChange={onChange} />)
        const sinTecla = fireWheel(input(), { deltaY: -1 })
        expect(sinTecla.defaultPrevented).toBe(false)
        expect(eventos).toEqual([])
        const evento = fireWheel(input(), { deltaY: -1, ctrlKey: true })
        expect(evento.defaultPrevented).toBe(true)
        expect(eventos.at(-1)?.valor).toBe(11)
    })

    it("la_rueda_suave_se_espacia_500ms_y_la_de_mouse_no_y_shift_pasa_x10", () => {
        vi.useFakeTimers()
        const { eventos, onChange } = leer()
        render(<RadialField label="x" value={10} step={1} onChange={onChange} />)
        fireWheel(input(), { deltaY: -1, ctrlKey: true })
        fireWheel(input(), { deltaY: -1, ctrlKey: true })
        expect(eventos.length).toBe(1)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        fireWheel(input(), { deltaY: 1, ctrlKey: true, shiftKey: true })
        expect(eventos.at(-1)?.valor).toBe(1)
        // una rueda de mouse (|deltaY| >= 100) no abre la espera
        cleanup()
        const otro = leer()
        render(<RadialField label="x" value={10} step={1} onChange={otro.onChange} />)
        fireWheel(input(), { deltaY: -100, ctrlKey: true })
        fireWheel(input(), { deltaY: -100, ctrlKey: true })
        expect(otro.eventos.length).toBe(2)
    })

    it("el_foco_abre_el_selector_y_perder_el_foco_fuera_lo_cierra_pero_dentro_no", () => {
        render(<RadialField label="x" value={90} />)
        fireEvent.focus(input())
        expect(picker()).toBeTruthy()
        fireEvent.blur(input(), { relatedTarget: picker() })
        expect(picker()).toBeTruthy()
        fireEvent.blur(input(), { relatedTarget: document.body })
        expect(picker()).toBeNull()
        fireEvent.focus(input())
        fireEvent.blur(input(), { relatedTarget: null })
        expect(picker()).toBeNull()
    })

    it("el_selector_dibuja_el_manejador_en_el_angulo_y_click_no_burbujea", () => {
        const alClick = vi.fn()
        const { container } = render(
            <div onClick={alClick}>
                <RadialField label="x" value={90} />
            </div>
        )
        fireEvent.focus(input())
        const handle = container.querySelector("circle[class*='handle']") as SVGCircleElement
        expect(Number(handle.getAttribute("cx"))).toBeCloseTo(40)
        expect(Number(handle.getAttribute("cy"))).toBeCloseTo(0)
        expect(document.getElementById("degree-picker")?.getAttribute("viewBox")).toBe("-50 -50 100 100")
        fireEvent.click(picker() as HTMLElement)
        expect(alClick).not.toHaveBeenCalled()
    })

    it("el_indicador_chico_sigue_al_valor", () => {
        const { container } = render(<RadialField label="x" value={180} />)
        const punto = container.querySelectorAll("svg.miniIndicator circle, svg[class*='miniIndicator'] circle")[1]
        expect(Number(punto.getAttribute("cx"))).toBeCloseTo(0)
        expect(Number(punto.getAttribute("cy"))).toBeCloseTo(6)
    })

    it("arrastrar_en_el_selector_calcula_el_angulo_con_snap_y_sigue_en_window_hasta_soltar", () => {
        const { eventos, onInput, onChange } = leer()
        render(<RadialField label="x" value={0} onInput={onInput} onChange={onChange} />)
        const svg = abrirPicker()
        // a la derecha del centro: 90 grados
        fireEvent.mouseDown(svg, { clientX: 100, clientY: 50 })
        expect(eventos.slice(-2)).toEqual([
            { tipo: "input", valor: 90 },
            { tipo: "change", valor: 90 }
        ])
        // 45 grados sin snap
        fireEvent.mouseMove(window, { clientX: 100, clientY: 0 })
        expect(eventos.at(-1)?.valor).toBe(45)
        // cerca de 180 (menos de 5 grados): se pega a 180
        fireEvent.mouseMove(window, { clientX: 52, clientY: 100 })
        expect(eventos.at(-1)?.valor).toBe(180)
        fireEvent.mouseUp(window)
        const cantidad = eventos.length
        fireEvent.mouseMove(window, { clientX: 100, clientY: 50 })
        expect(eventos.length).toBe(cantidad)
    })

    it("mousedown_fuera_del_svg_no_inicia_el_arrastre", () => {
        const { eventos, onChange } = leer()
        render(<RadialField label="x" value={0} onChange={onChange} />)
        abrirPicker()
        fireEvent.mouseDown(picker() as HTMLElement, { clientX: 100, clientY: 50 })
        fireEvent.mouseMove(window, { clientX: 100, clientY: 50 })
        expect(eventos).toEqual([])
    })
})
