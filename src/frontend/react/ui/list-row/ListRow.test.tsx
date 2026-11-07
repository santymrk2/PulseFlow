// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ListRow } from "./ListRow"

afterEach(() => cleanup())

describe("ListRow", () => {
    it("renderiza_texto_icono_y_trailing", () => {
        render(
            <ListRow icon={<svg data-testid="ico" />} trailing={<span>3</span>}>
                Pantallas
            </ListRow>
        )
        expect(screen.getByText("Pantallas")).toBeTruthy()
        expect(screen.getByTestId("ico")).toBeTruthy()
        expect(screen.getByText("3")).toBeTruthy()
    })

    it("variantes_active_marca_aria_current_y_la_barra", () => {
        const { unmount } = render(<ListRow active>x</ListRow>)
        const activa = screen.getByRole("button")
        expect(activa.getAttribute("aria-current")).toBe("true")
        expect(activa.classList.contains("bg-accent")).toBe(true)
        unmount()
        render(<ListRow>x</ListRow>)
        const inactiva = screen.getByRole("button")
        expect(inactiva.getAttribute("aria-current")).toBeNull()
        expect(inactiva.classList.contains("bg-accent")).toBe(false)
    })

    it("click_llama_a_onClick_con_el_evento_nativo", () => {
        const onClick = vi.fn()
        render(<ListRow onClick={onClick}>x</ListRow>)
        fireEvent.click(screen.getByRole("button"))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: "click" }))
    })

    it("es_un_boton_de_tipo_button", () => {
        render(<ListRow>x</ListRow>)
        expect(screen.getByRole("button").getAttribute("type")).toBe("button")
    })
})
