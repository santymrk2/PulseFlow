// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../shared/test/mockCommon"
import { KitDemoReact } from "./KitDemoReact"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

afterEach(cleanup)

describe("KitDemoReact", () => {
    it("renderiza_las_cinco_secciones_de_KitDemo_svelte", () => {
        render(<KitDemoReact />)
        for (const titulo of ["Botones", "Cápsula", "Lista", "Campos", "Menú"]) expect(screen.getByText(titulo)).toBeTruthy()
        expect(screen.getByText("Presentación activa")).toBeTruthy()
        expect(screen.getByText("Siempre arriba")).toBeTruthy()
    })

    it("Audiencia_alterna_aria_pressed", () => {
        render(<KitDemoReact />)
        const live = screen.getByRole("button", { name: "Audiencia" })
        expect(live.getAttribute("aria-pressed")).toBe("false")
        fireEvent.click(live)
        expect(live.getAttribute("aria-pressed")).toBe("true")
    })

    it("el_menu_de_looks_cambia_el_look_marcado_y_se_cierra", () => {
        render(<KitDemoReact />)
        fireEvent.click(screen.getByRole("button", { name: /Look: Default/ }))
        fireEvent.click(screen.getByRole("menuitem", { name: "Himnos" }))
        expect(screen.getByRole("button", { name: /Look: Himnos/ })).toBeTruthy()
        expect(screen.queryByRole("menuitem", { name: "Himnos" })).toBeNull()
    })
})
