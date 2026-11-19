// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SectionHeader } from "./SectionHeader"

afterEach(() => cleanup())

describe("SectionHeader", () => {
    it("renderiza_el_titulo_y_las_acciones", () => {
        render(<SectionHeader actions={<button>+</button>}>Pantallas</SectionHeader>)
        expect(screen.getByText("Pantallas")).toBeTruthy()
        expect(screen.getByRole("button", { name: "+" })).toBeTruthy()
    })

    it("sin_actions_no_renderiza_el_contenedor_de_acciones", () => {
        const { container } = render(<SectionHeader>Pantallas</SectionHeader>)
        expect(container.querySelector("[data-slot=section-header] > div")).toBeNull()
    })

    it("recibe_className_extra", () => {
        const { container } = render(<SectionHeader className="extra">Pantallas</SectionHeader>)
        expect(container.querySelector("[data-slot=section-header]")?.classList.contains("extra")).toBe(true)
    })
})
