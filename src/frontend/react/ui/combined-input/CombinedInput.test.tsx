// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CombinedInput } from "./CombinedInput"
import styles from "./CombinedInput.module.css"

afterEach(cleanup)

describe("CombinedInput", () => {
    it("renderiza_los_hijos_con_la_clase_input", () => {
        const { container } = render(<CombinedInput>hijo</CombinedInput>)
        const el = container.firstChild as HTMLElement
        expect(screen.getByText("hijo")).toBeTruthy()
        expect(el.classList.contains("input")).toBe(true)
        expect(el.classList.contains(styles.input)).toBe(true)
    })

    it("textWidth_define_la_variable_--text-width_y_conserva_style", () => {
        const { container } = render(<CombinedInput textWidth={30} style={{ gap: "2px" }} />)
        const el = container.firstChild as HTMLElement
        expect(el.style.getPropertyValue("--text-width")).toBe("30%")
        expect(el.style.gap).toBe("2px")
    })

    it("por_defecto_textWidth_es_50_y_title_va_en_data_title", () => {
        const { container } = render(<CombinedInput title="ayuda" />)
        const el = container.firstChild as HTMLElement
        expect(el.style.getPropertyValue("--text-width")).toBe("50%")
        expect(el.getAttribute("data-title")).toBe("ayuda")
    })
})
