// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../test/mockCommon"
import { SegmentedField } from "./SegmentedField"
import styles from "./SegmentedField.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(cleanup)

const opciones = [
    { value: "a", label: "Alfa" },
    { value: "b", label: "Beta", icon: "check" },
    { value: "c", label: "Gamma", disabled: true }
]
const activos = () => [...document.querySelectorAll(`.${styles.highlight}`)].map((el) => el.classList.contains(styles.active))

describe("SegmentedField", () => {
    it("renderiza_lo_principal", () => {
        const { container } = render(<SegmentedField label="Etiqueta" value="a" options={opciones} />)
        expect(screen.getByText("Etiqueta").classList.contains("selected")).toBe(true)
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Alfa", "Beta", "Gamma"])
        expect(container.querySelector(".row")).toBeTruthy()
        expect(activos()).toEqual([true, false, false])
    })

    it("click_despacha_el_value_de_la_opcion", () => {
        const onClick = vi.fn()
        render(<SegmentedField label="x" value="a" options={opciones} onClick={onClick} />)
        fireEvent.click(screen.getByText("Beta"))
        expect(onClick).toHaveBeenCalledWith("b")
    })

    it("la_opcion_disabled_no_despacha", () => {
        const onClick = vi.fn()
        render(<SegmentedField label="x" value="a" options={opciones} onClick={onClick} />)
        expect((screen.getByText("Gamma").closest("button") as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(screen.getByText("Gamma"))
        expect(onClick).not.toHaveBeenCalled()
    })

    it("el_activo_sigue_value_con_includes", () => {
        render(<SegmentedField label="x" value="bc" options={opciones} />)
        expect(activos()).toEqual([false, true, true])
    })

    it("noLabels_oculta_los_textos_y_deja_el_titulo", () => {
        render(<SegmentedField label="x" value="a" options={opciones} noLabels />)
        expect(screen.queryByText("Alfa")).toBeNull()
        expect(screen.getAllByRole("button").every((b) => b.textContent === "")).toBe(true)
        expect(screen.getAllByRole("button")[0].getAttribute("data-title")).toBe("Alfa")
    })

    it("icon_del_campo_se_dibuja_con_iconColor_boxed", () => {
        const { container, rerender } = render(<SegmentedField label="x" value="a" options={opciones} icon="check" iconColor="red" />)
        const icono = container.querySelector("label svg") as SVGElement
        expect(icono.style.color).toBe("red")
        rerender(<SegmentedField label="x" value="a" options={opciones} />)
        expect(container.querySelector("label svg")).toBeNull()
    })

    it("value_vacio_no_marca_la_etiqueta", () => {
        render(<SegmentedField label="Etiqueta" value="" options={opciones} />)
        expect(screen.getByText("Etiqueta").classList.contains("selected")).toBe(false)
    })
})
