// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../test/mockCommon"
import { InputRow } from "./InputRow"
import styles from "./InputRow.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(cleanup)

describe("InputRow", () => {
    it("renderiza_los_hijos_en_la_fila", () => {
        const { container } = render(
            <InputRow>
                <span>hijo</span>
            </InputRow>
        )
        const row = container.firstChild as HTMLElement
        expect(row.classList.contains("row")).toBe(true)
        expect(row.classList.contains(styles.row)).toBe(true)
        expect(screen.getByText("hijo")).toBeTruthy()
    })

    it("con_arrow_el_boton_abre_y_cierra_el_menu_y_avisa", () => {
        const onOpenChange = vi.fn()
        render(<InputRow arrow menu={<span>menu</span>} onOpenChange={onOpenChange} />)
        expect(screen.queryByText("menu")).toBeNull()

        fireEvent.click(screen.getByRole("button"))
        expect(screen.getByText("menu")).toBeTruthy()
        expect(onOpenChange).toHaveBeenLastCalledWith(true)

        fireEvent.click(screen.getByRole("button"))
        expect(screen.queryByText("menu")).toBeNull()
        expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it("open_inicial_muestra_el_menu", () => {
        render(<InputRow arrow open menu={<span>menu</span>} />)
        expect(screen.getByText("menu")).toBeTruthy()
    })
})
