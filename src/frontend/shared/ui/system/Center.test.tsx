// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Center } from "./Center"
import styles from "./Center.module.css"

afterEach(cleanup)

describe("Center", () => {
    it("renderiza_lo_principal", () => {
        render(<Center>contenido</Center>)
        const el = screen.getByText("contenido")
        expect(el.classList.contains("loader")).toBe(true)
        expect(el.classList.contains(styles.center)).toBe(true)
        expect(el.getAttribute("style")).toContain("font-size: 1em")
        expect(el.getAttribute("style")).toContain("padding: 0px")
    })

    it("faded_y_absolute_agregan_sus_clases", () => {
        render(
            <Center faded absolute>
                x
            </Center>
        )
        const el = screen.getByText("x")
        expect(el.classList.contains(styles.faded)).toBe(true)
        expect(el.classList.contains(styles.absolute)).toBe(true)
    })

    it("size_padding_style_y_className_llegan_al_div", () => {
        render(
            <Center size={2} padding={8} style={{ color: "red" }} className="extra" data-x="1">
                y
            </Center>
        )
        const el = screen.getByText("y")
        expect(el.style.fontSize).toBe("2em")
        expect(el.style.padding).toBe("8px")
        expect(el.style.color).toBe("red")
        expect(el.classList.contains("extra")).toBe(true)
        expect(el.getAttribute("data-x")).toBe("1")
    })
})
