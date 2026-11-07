// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Item, Menu, MenuItem, MenuSeparator, Root, Separator } from "./index"

afterEach(cleanup)

function Ejemplo({ open, onClose }: { open: boolean; onClose?: () => void }) {
    return (
        <div>
            <p>afuera</p>
            <div className="relative">
                <button>disparador</button>
                <Menu open={open} onClose={onClose}>
                    <MenuItem>Uno</MenuItem>
                    <MenuSeparator />
                    <MenuItem checked>Dos</MenuItem>
                </Menu>
            </div>
        </div>
    )
}

describe("Menu", () => {
    it("renderiza_lo_principal_abierto", () => {
        render(<Ejemplo open />)
        expect(screen.getByRole("menu")).toBeTruthy()
        expect(screen.getAllByRole("menuitem")).toHaveLength(2)
        expect(screen.getByRole("separator")).toBeTruthy()
    })

    it("cerrado_no_renderiza", () => {
        render(<Ejemplo open={false} />)
        expect(screen.queryByRole("menu")).toBeNull()
    })

    it("onClose_con_mousedown_afuera_y_no_adentro_del_padre", () => {
        const onClose = vi.fn()
        render(<Ejemplo open onClose={onClose} />)
        fireEvent.mouseDown(screen.getByText("disparador"))
        fireEvent.mouseDown(screen.getByText("Uno"))
        expect(onClose).not.toHaveBeenCalled()
        fireEvent.mouseDown(screen.getByText("afuera"))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("escape_cierra_y_no_llega_a_los_atajos_globales", () => {
        const onClose = vi.fn()
        const atajo = vi.fn()
        window.addEventListener("keydown", atajo)
        render(<Ejemplo open onClose={onClose} />)
        fireEvent.keyDown(document.body, { key: "Escape" })
        fireEvent.keyDown(document.body, { key: "a" })
        window.removeEventListener("keydown", atajo)
        expect(onClose).toHaveBeenCalledTimes(1)
        // Esc se frena en captura; la otra tecla sí llega al listener de burbuja
        expect(atajo).toHaveBeenCalledTimes(1)
    })

    it("cerrado_o_desmontado_no_escucha", () => {
        const onClose = vi.fn()
        const { rerender, unmount } = render(<Ejemplo open onClose={onClose} />)
        rerender(<Ejemplo open={false} onClose={onClose} />)
        fireEvent.keyDown(document.body, { key: "Escape" })
        fireEvent.mouseDown(screen.getByText("afuera"))
        expect(onClose).not.toHaveBeenCalled()
        rerender(<Ejemplo open onClose={onClose} />)
        unmount()
        fireEvent.keyDown(document.body, { key: "Escape" })
        expect(onClose).not.toHaveBeenCalled()
    })

    it("className_se_suma_a_las_del_menu", () => {
        render(
            <div>
                <Menu open className="extra">
                    x
                </Menu>
            </div>
        )
        expect(screen.getByRole("menu").classList.contains("extra")).toBe(true)
        expect(screen.getByRole("menu").classList.contains("absolute")).toBe(true)
    })

    it("index_exporta_los_alias", () => {
        expect(Root).toBe(Menu)
        expect(Item).toBe(MenuItem)
        expect(Separator).toBe(MenuSeparator)
    })
})

describe("MenuItem", () => {
    it("onClick_nativo_y_checked_muestra_la_marca", () => {
        const onClick = vi.fn()
        render(
            <MenuItem checked onClick={onClick}>
                Look
            </MenuItem>
        )
        const item = screen.getByRole("menuitem")
        expect(item.textContent).toBe("✓Look")
        fireEvent.click(item)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("sin_checked_no_hay_marca_y_disabled_se_pasa", () => {
        render(
            <MenuItem disabled className="mio">
                Look
            </MenuItem>
        )
        const item = screen.getByRole("menuitem") as HTMLButtonElement
        expect(item.textContent).toBe("Look")
        expect(item.disabled).toBe(true)
        expect(item.getAttribute("type")).toBe("button")
        expect(item.classList.contains("mio")).toBe(true)
    })
})
