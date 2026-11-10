// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Look } from "../../../types/Settings"
import { templates } from "../../stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { LookGrid } from "./LookGrid"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const salida = (id: string, name: string) => ({ id, name, enabled: true, active: true, color: "", bounds: { x: 0, y: 0, width: 1, height: 1 }, screen: null })
const pantallas = [salida("a", "Sala"), salida("b", "")]
const draft: Look = { name: "L", screens: { a: { layers: { media: true, slide: false, overlays: true }, theme: "t1" } } }

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(templates, { t2: { name: "Zeta" }, t1: { name: "Alfa" } } as never)] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
})

const fila = (label: string) => screen.getAllByText(label)[0].parentElement as HTMLElement
const casillas = (label: string) => within(fila(label)).getAllByRole("checkbox")

describe("LookGrid", () => {
    it("renderiza_lo_principal_una_columna_por_pantalla_con_nombre_o_texto_por_defecto", () => {
        const { container } = render(<LookGrid screens={pantallas} draft={draft} />)
        expect(screen.getAllByText("Sala").length).toBeGreaterThan(0)
        expect(screen.getAllByText("settings.output_screen").length).toBeGreaterThan(0)
        for (const l of ["looks.presentation", "looks.slide", "looks.media", "looks.overlays"]) expect(screen.getAllByText(l).length).toBeGreaterThan(0)
        expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--columns")).toBe("2")
    })

    it("las_casillas_reflejan_las_capas_y_sin_celda_estan_todas_activas", () => {
        render(<LookGrid screens={pantallas} draft={draft} />)
        expect(casillas("looks.slide").map((c) => c.getAttribute("aria-checked"))).toEqual(["false", "true"])
        expect(casillas("looks.media").map((c) => c.getAttribute("aria-checked"))).toEqual(["true", "true"])
    })

    it("alternar_una_capa_emite_onCell_con_las_capas_completas", () => {
        const onCell = vi.fn()
        render(<LookGrid screens={pantallas} draft={draft} onCell={onCell} />)
        fireEvent.click(casillas("looks.slide")[0])
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { layers: { media: true, slide: true, overlays: true } } })
        fireEvent.click(casillas("looks.overlays")[1])
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "b", patch: { layers: { media: true, slide: true, overlays: false } } })
    })

    it("el_tema_ofrece_ninguno_mas_las_plantillas_ordenadas_y_emite_theme_o_undefined", () => {
        const onCell = vi.fn()
        render(<LookGrid screens={pantallas} draft={draft} onCell={onCell} />)
        const campo = screen.getAllByText("looks.theme")[0].closest(".textfield") as HTMLElement
        fireEvent.click(campo.querySelector(".dropdown-trigger") as HTMLElement)
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["main.none", "⊘ main.none", "Alfa", "Zeta"])
        fireEvent.click(screen.getByRole("option", { name: "Zeta" }))
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { theme: "t2" } })
        fireEvent.click(campo.querySelector(".dropdown-trigger") as HTMLElement)
        fireEvent.click(screen.getByRole("option", { name: "⊘ main.none" }))
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { theme: undefined } })
    })

    it("reenvia_los_campos_avanzados_por_el_mismo_onCell", () => {
        const onCell = vi.fn()
        render(<LookGrid screens={pantallas} draft={draft} onCell={onCell} />)
        fireEvent.click(screen.getAllByText("looks.show_as_faded")[0].closest('[role="switch"]')!)
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { showAsFaded: true } })
    })
})
