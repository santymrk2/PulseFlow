// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { List } from "./List"
import styles from "./List.module.css"

afterEach(cleanup)

describe("List", () => {
    it("renderiza_los_hijos_en_la_columna", () => {
        const { container } = render(<List>hijo</List>)
        expect(screen.getByText("hijo")).toBeTruthy()
        expect((container.firstChild as HTMLElement).classList.contains(styles.list)).toBe(true)
    })

    it("aplica_margenes_y_style", () => {
        const { container } = render(<List bottom={5} top={7} style={{ gap: "3px" }} />)
        const el = container.firstChild as HTMLElement
        expect(el.style.marginBottom).toBe("5px")
        expect(el.style.marginTop).toBe("7px")
        expect(el.style.gap).toBe("3px")
    })

    it("por_defecto_los_margenes_son_0", () => {
        const { container } = render(<List />)
        expect((container.firstChild as HTMLElement).style.marginTop).toBe("0px")
    })
})
