// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../test/mockCommon"
import { ToggleGroupField } from "./ToggleGroupField"
import styles from "./ToggleGroupField.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(cleanup)

const opciones = [
    { value: "a", label: "Alfa" },
    { value: "b", label: "Beta", icon: "check" }
]
const activos = () => [...document.querySelectorAll(`.${styles.highlight}`)].map((el) => el.classList.contains(styles.active))

describe("ToggleGroupField", () => {
    it("renderiza_lo_principal", () => {
        const { container } = render(<ToggleGroupField label="Etiqueta" value={["a"]} options={opciones} />)
        expect(screen.getByText("Etiqueta").classList.contains("selected")).toBe(true)
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Alfa", "Beta"])
        expect(container.querySelector(".row")).toBeTruthy()
        expect(activos()).toEqual([true, false])
    })

    it("agregar_despacha_el_array_con_la_opcion_nueva_sin_mutar_la_prop", () => {
        const onChange = vi.fn()
        const value = ["a"]
        render(<ToggleGroupField label="x" value={value} options={opciones} onChange={onChange} />)
        fireEvent.click(screen.getByText("Beta"))
        expect(onChange).toHaveBeenCalledWith(["a", "b"])
        expect(value).toEqual(["a"])
        expect(activos()).toEqual([true, true])
    })

    it("quitar_despacha_el_array_sin_la_opcion", () => {
        const onChange = vi.fn()
        render(<ToggleGroupField label="x" value={["a", "b"]} options={opciones} onChange={onChange} />)
        fireEvent.click(screen.getByText("Alfa"))
        expect(onChange).toHaveBeenCalledWith(["b"])
        expect(activos()).toEqual([false, true])
    })

    it("el_value_del_padre_manda_cuando_cambia", () => {
        const { rerender } = render(<ToggleGroupField label="x" value={["a"]} options={opciones} />)
        fireEvent.click(screen.getByText("Beta"))
        rerender(<ToggleGroupField label="x" value={[]} options={opciones} />)
        expect(activos()).toEqual([false, false])
    })
})
