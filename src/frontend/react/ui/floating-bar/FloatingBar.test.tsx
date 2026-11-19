// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { FloatingBar } from "./FloatingBar"
import styles from "./FloatingBar.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const bar = (container: HTMLElement) => container.firstChild as HTMLElement

describe("FloatingBar", () => {
    it("renderiza_los_hijos_con_las_clases_y_el_bottom_por_defecto", () => {
        const { container } = render(<FloatingBar>hijo</FloatingBar>)
        expect(screen.getByText("hijo")).toBeTruthy()
        expect(bar(container).classList.contains("row")).toBe(true)
        expect(bar(container).classList.contains("right")).toBe(true)
        expect(bar(container).classList.contains(styles.row)).toBe(true)
        expect(bar(container).classList.contains(styles.right)).toBe(true)
        expect(bar(container).style.bottom).toBe("10px")
    })

    it("variantes_y_tamanos: side, onlyOne y round aplican sus clases", () => {
        for (const side of ["right", "left", "center"] as const) {
            const { container } = render(<FloatingBar side={side} />)
            expect(bar(container).classList.contains(styles[side])).toBe(true)
            cleanup()
        }
        const { container } = render(<FloatingBar onlyOne round />)
        for (const name of ["onlyOne", "round"] as const) {
            expect(bar(container).classList.contains(name)).toBe(true)
            expect(bar(container).classList.contains(styles[name])).toBe(true)
        }
    })

    it("bottom_y_style_se_combinan", () => {
        const { container } = render(<FloatingBar bottom={30} style={{ left: "5px" }} />)
        expect(bar(container).style.bottom).toBe("30px")
        expect(bar(container).style.left).toBe("5px")
    })

    it("optimizedMode_agrega_isOptimized", () => {
        restaurar = setStoresForTest([storeEntry(special, { optimizedMode: true })])
        const { container } = render(<FloatingBar />)
        expect(bar(container).classList.contains("isOptimized")).toBe(true)
    })

    it("reenvia_mousedown", () => {
        const onMouseDown = vi.fn()
        const { container } = render(<FloatingBar onMouseDown={onMouseDown} />)
        fireEvent.mouseDown(bar(container))
        expect(onMouseDown).toHaveBeenCalledTimes(1)
    })

    it("con_arrow_el_boton_expand_abre_el_menu_y_children_recibe_open", () => {
        render(
            <FloatingBar arrow menu={<span>menu</span>}>
                {(open: boolean) => <span>{open ? "abierto" : "cerrado"}</span>}
            </FloatingBar>
        )
        expect(screen.queryByText("menu")).toBeNull()
        expect(screen.getByText("cerrado")).toBeTruthy()

        const expand = screen.getByRole("button")
        expect(expand.classList.contains("expand")).toBe(true)
        expect(expand.style.opacity).toBe("0.6")

        fireEvent.click(expand)
        expect(screen.getByText("menu")).toBeTruthy()
        expect(screen.getByText("abierto")).toBeTruthy()
        // el CSS global de la barra apunta a button.isActive / button.expand: la clase tiene que existir sin hash
        expect(expand.classList.contains("isActive")).toBe(true)
        expect(expand.style.opacity).toBe("")

        fireEvent.click(expand)
        expect(screen.queryByText("menu")).toBeNull()
    })

    it("sin_arrow_no_hay_boton_ni_divisor", () => {
        const { container } = render(<FloatingBar>x</FloatingBar>)
        expect(screen.queryByRole("button")).toBeNull()
        expect(container.querySelector(".divider")).toBeNull()
    })
})
