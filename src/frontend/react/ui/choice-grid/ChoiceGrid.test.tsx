// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../test/mockCommon"
import buttonStyles from "../button/Button.module.css"
import { ChoiceGrid, type ChoiceOption } from "./ChoiceGrid"
import styles from "./ChoiceGrid.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())

afterEach(cleanup)

const opciones: ChoiceOption[] = [
    { id: "a", name: "Alfa", icon: "add", tip: "primero" },
    { id: "b", name: "Beta", icon: "logo.webp", title: "Titulo B" },
    { id: "c", name: "Gamma", icon: "remove", disabled: true, colored: true }
]

describe("ChoiceGrid", () => {
    it("renderiza_lo_principal", () => {
        render(<ChoiceGrid options={opciones} />)
        expect(screen.getAllByRole("button")).toHaveLength(3)
        expect(screen.getByText("Alfa")).toBeTruthy()
        expect(screen.getByText("primero").classList.contains(styles.tip)).toBe(true)
        expect(screen.getByAltText("b-logo").getAttribute("src")).toBe("logo.webp")
        expect(screen.getByAltText("b-logo").getAttribute("draggable")).toBe("false")
    })

    it("sin_opciones_no_hay_botones", () => {
        render(<ChoiceGrid />)
        expect(screen.queryAllByRole("button")).toHaveLength(0)
    })

    it("title_es_el_de_la_opcion_o_su_nombre_y_disabled_se_pasa", () => {
        render(<ChoiceGrid options={opciones} />)
        const botones = screen.getAllByRole("button") as HTMLButtonElement[]
        expect(botones[0].getAttribute("data-title")).toBe("Alfa")
        expect(botones[1].getAttribute("data-title")).toBe("Titulo B")
        expect(botones[2].disabled).toBe(true)
    })

    it("click_despacha_el_id", () => {
        const onClick = vi.fn()
        render(<ChoiceGrid options={opciones} value="a" onClick={onClick} />)
        fireEvent.click(screen.getAllByRole("button")[1])
        expect(onClick).toHaveBeenCalledWith("b")
    })

    it("elegir_el_activo_sin_canDeselect_despacha_su_id_y_con_canDeselect_despacha_vacio", () => {
        const onClick = vi.fn()
        const { rerender } = render(<ChoiceGrid options={opciones} value="a" onClick={onClick} />)
        fireEvent.click(screen.getAllByRole("button")[0])
        expect(onClick).toHaveBeenLastCalledWith("a")
        rerender(<ChoiceGrid options={opciones} value="a" canDeselect onClick={onClick} />)
        fireEvent.click(screen.getAllByRole("button")[0])
        expect(onClick).toHaveBeenLastCalledWith("")
        fireEvent.click(screen.getAllByRole("button")[1])
        expect(onClick).toHaveBeenLastCalledWith("b")
    })

    it("marca_activo_y_las_clases_first_y_last", () => {
        render(<ChoiceGrid options={opciones} value="b" />)
        const botones = screen.getAllByRole("button")
        expect(botones.map((b) => b.classList.contains(buttonStyles.isActive))).toEqual([false, true, false])
        expect(botones.map((b) => b.classList.contains("first"))).toEqual([true, false, false])
        expect(botones.map((b) => b.classList.contains("last"))).toEqual([false, false, true])
        // variant="outline"
        for (const b of botones) expect(b.classList.contains(buttonStyles.outlined)).toBe(true)
    })

    it("highlightFirst_aplica_la_clase_del_contenedor", () => {
        for (const highlightFirst of [false, true]) {
            const { container, unmount } = render(<ChoiceGrid options={opciones} highlightFirst={highlightFirst} />)
            expect((container.firstChild as HTMLElement).classList.contains(styles.highlightFirst)).toBe(highlightFirst)
            unmount()
        }
    })

    it("icono_blanco_salvo_colored", () => {
        const { container } = render(<ChoiceGrid options={[opciones[0], opciones[2]]} />)
        const [blanco, coloreado] = Array.from(container.querySelectorAll("svg"))
        expect(blanco.getAttribute("class")).not.toBe(coloreado.getAttribute("class"))
    })
})
