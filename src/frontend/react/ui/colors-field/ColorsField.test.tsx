// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { hslToHex } from "../../../shared/utils/helpers/color"
import { commonMock } from "../../test/mockCommon"
import { ColorsField } from "./ColorsField"
import styles from "./ColorsField.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())
// ColorField tiene su propio test: acá es el borde. El stub despacha input y change como el original.
vi.mock("../color-field/ColorField", () => ({
    ColorField: (p: { label: string; value: string; allowOpacity?: boolean; onInput?: (v: string) => void; onChange?: (v: string) => void }) => (
        <button
            type="button"
            data-testid="color"
            data-opacity={String(!!p.allowOpacity)}
            onClick={() => {
                p.onInput?.("#aaaaaa")
                p.onChange?.("#bbbbbb")
            }}
        >
            {p.label}|{p.value}
        </button>
    )
}))

afterEach(cleanup)

const abrir = () => fireEvent.click(document.querySelector('[role="button"]') as HTMLElement)
const colores = () => screen.queryAllByTestId("color")

describe("ColorsField", () => {
    it("renderiza_la_barra_con_la_etiqueta_y_el_degradado", () => {
        render(<ColorsField label="Mis colores" value={["#111111", "#222222"]} />)
        expect(screen.getByText("Mis colores")).toBeTruthy()
        expect((document.querySelector(`.${styles.gradientPreview}`) as HTMLElement).style.background).toContain("linear-gradient(90deg, #111111, #222222)")
        expect(colores().length).toBe(0)
    })

    it("sin_etiqueta_usa_settings_colors_y_con_un_color_la_vista_previa_es_ese_color", () => {
        render(<ColorsField value={["#111111"]} />)
        expect(screen.getByText("settings.colors")).toBeTruthy()
        expect((document.querySelector(`.${styles.gradientPreview}`) as HTMLElement).style.background).toBe("#111111")
    })

    it("sin_value_usa_los_cuatro_colores_por_defecto", () => {
        render(<ColorsField label="x" />)
        abrir()
        expect(colores().length).toBe(4)
        expect(colores()[0].textContent).toBe("edit.color 1|#1a1b33")
    })

    it("click_y_Enter_en_la_barra_abren_y_cierran_la_lista", () => {
        render(<ColorsField label="x" value={["#111111", "#222222"]} />)
        abrir()
        expect(colores().length).toBe(2)
        fireEvent.keyDown(document.querySelector('[role="button"]') as HTMLElement, { key: "Enter" })
        expect(colores().length).toBe(0)
        fireEvent.keyDown(document.querySelector('[role="button"]') as HTMLElement, { key: "a" })
        expect(colores().length).toBe(0)
    })

    it("editar_un_color_despacha_input_y_luego_change_con_la_misma_lista_nueva", () => {
        const recibidos: string[][] = []
        const onInput = vi.fn((v: string[]) => recibidos.push(v))
        const onChange = vi.fn((v: string[]) => recibidos.push(v))
        render(<ColorsField label="x" value={["#111111", "#222222"]} onInput={onInput} onChange={onChange} />)
        abrir()
        fireEvent.click(colores()[1])
        expect(onInput).toHaveBeenCalledWith(["#111111", "#aaaaaa"])
        expect(onChange).toHaveBeenCalledWith(["#111111", "#bbbbbb"])
        expect(onInput.mock.invocationCallOrder[0]).toBeLessThan(onChange.mock.invocationCallOrder[0])
        expect(colores()[1].textContent).toBe("edit.color 2|#bbbbbb")
    })

    it("los_ColorField_hijos_permiten_opacidad", () => {
        render(<ColorsField label="x" value={["#111111"]} />)
        abrir()
        expect(colores()[0].getAttribute("data-opacity")).toBe("true")
    })

    it("agregar_suma_el_siguiente_color_del_degradado_hasta_maxColors", () => {
        const onChange = vi.fn()
        render(<ColorsField label="x" value={["#000000"]} maxColors={2} onChange={onChange} />)
        abrir()
        fireEvent.click(document.querySelector('[data-title="actions.add"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith(["#000000", hslToHex(30, 60, 15)])
        expect(document.querySelector('[data-title="actions.add"]')).toBeNull()
    })

    it("borrar_quita_el_color_y_se_oculta_en_minColors", () => {
        const onChange = vi.fn()
        render(<ColorsField label="x" value={["#111111", "#222222"]} minColors={1} onChange={onChange} />)
        abrir()
        const borrar = () => Array.from(document.querySelectorAll('[data-title="actions.delete"]')) as HTMLElement[]
        expect(borrar().length).toBe(2)
        fireEvent.click(borrar()[0])
        expect(onChange).toHaveBeenCalledWith(["#222222"])
        expect(borrar().length).toBe(0)
    })

    it("disabled_aplica_la_clase_y_no_modifica_nada", () => {
        const onChange = vi.fn()
        const { container } = render(<ColorsField label="x" value={["#111111", "#222222"]} disabled onChange={onChange} />)
        expect((container.firstChild as HTMLElement).classList.contains(styles.disabled)).toBe(true)
        abrir()
        fireEvent.click(colores()[0])
        fireEvent.click(document.querySelector('[data-title="actions.add"]') as HTMLElement)
        fireEvent.click(document.querySelector('[data-title="actions.delete"]') as HTMLElement)
        expect(onChange).not.toHaveBeenCalled()
    })

    it("un_value_nuevo_del_padre_reemplaza_la_lista_local", () => {
        const { rerender } = render(<ColorsField label="x" value={["#111111"]} />)
        abrir()
        fireEvent.click(document.querySelector('[data-title="actions.add"]') as HTMLElement)
        expect(colores().length).toBe(2)
        rerender(<ColorsField label="x" value={["#333333"]} />)
        expect(colores().length).toBe(1)
        expect(colores()[0].textContent).toBe("edit.color 1|#333333")
    })
})
