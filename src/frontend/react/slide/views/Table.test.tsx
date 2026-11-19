// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { activeEdit, showsCache } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Table } from "./Table"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([storeEntry(activeEdit, { slide: 0 } as never), looseEntry(showsCache, { s1: { slides: { sl1: { items: [{}, {}, {}] } } } })])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const item = {
    table: {
        borderColor: "red",
        borderWidth: 2,
        rows: [{ cells: [{ text: "A", style: "font-weight: bold;" }, { text: "B" }] }, { cells: [{ text: "C" }, { text: "D" }] }]
    }
} as unknown as Item
const ref = { showId: "s1", id: "sl1" }

describe("Table", () => {
    it("renderiza_las_filas_y_celdas_con_sus_estilos", () => {
        const { container } = render(<Table item={item} ref={ref} />)
        expect(container.querySelectorAll("tr").length).toBe(2)
        expect(container.querySelectorAll("td").length).toBe(4)
        expect(container.textContent).toContain("A")
        expect((container.querySelector("table") as HTMLElement).style.border).toBe("2px solid red")
        expect((container.querySelector("td") as HTMLElement).style.fontWeight).toBe("bold")
    })

    it("sin_item_table_usa_la_tabla_por_defecto_de_tres_filas", () => {
        const { container } = render(<Table item={{ align: "" } as Item} />)
        expect(container.querySelectorAll("tr").length).toBe(3)
        expect(container.querySelectorAll("td").length).toBe(9)
    })

    it("en_modo_edicion_las_celdas_son_editables_y_guardan_en_showsCache", () => {
        const { container } = render(<Table item={item} ref={ref} edit index={0} />)
        const cell = container.querySelector("[contenteditable]") as HTMLElement
        expect(cell).toBeTruthy()
        expect(cell.textContent).toBe("A")
        fireEvent.input(cell, { target: { textContent: "A2" } })
        expect((get(showsCache).s1.slides.sl1.items[0] as { table: { rows: { cells: { text: string }[] }[] } }).table.rows[0].cells[0].text).toBe("A2")
    })

    it("agrega_fila_y_columna_con_los_botones_cuando_una_celda_tiene_foco", () => {
        const { container } = render(<Table item={item} ref={ref} edit index={0} />)
        const cell = container.querySelector("[contenteditable]") as HTMLElement
        fireEvent.focus(cell)
        const buttons = container.querySelectorAll("button")
        expect(buttons.length).toBe(2)
        fireEvent.click(buttons[1])
        expect(container.querySelectorAll("tr").length).toBe(3)
        fireEvent.click(container.querySelectorAll("button")[0])
        expect(container.querySelectorAll("td").length).toBe(9)
    })

    it("el_evento_delete-row_borra_la_ultima_celda_clickeada_con_boton_derecho", () => {
        const { container } = render(<Table item={item} ref={ref} edit index={0} />)
        const cells = container.querySelectorAll("td")
        fireEvent.contextMenu(cells[0])
        act(() => window.dispatchEvent(new Event("delete-row")))
        expect(container.querySelectorAll("tr").length).toBe(1)
    })

    it("el_evento_delete-col_borra_la_columna_clickeada_con_boton_derecho", () => {
        const { container } = render(<Table item={item} ref={ref} edit index={0} />)
        const cells = container.querySelectorAll("td")
        fireEvent.contextMenu(cells[1])
        act(() => window.dispatchEvent(new Event("delete-col")))
        expect(container.querySelectorAll("td").length).toBe(2)
    })

    it("no_borra_la_unica_fila_ni_la_unica_columna", () => {
        const single = { table: { rows: [{ cells: [{ text: "x" }] }] } } as unknown as Item
        const { container } = render(<Table item={single} ref={ref} edit index={0} />)
        fireEvent.contextMenu(container.querySelector("td")!)
        act(() => window.dispatchEvent(new Event("delete-row")))
        act(() => window.dispatchEvent(new Event("delete-col")))
        expect(container.querySelectorAll("td").length).toBe(1)
    })

    it("tab_en_la_ultima_celda_agrega_una_fila_nueva", () => {
        vi.useFakeTimers()
        const { container } = render(<Table item={item} ref={ref} edit index={0} />)
        const cells = container.querySelectorAll("[contenteditable]")
        fireEvent.keyDown(cells[cells.length - 1], { key: "Tab" })
        expect(container.querySelectorAll("tr").length).toBe(3)
        vi.useRealTimers()
    })
})
