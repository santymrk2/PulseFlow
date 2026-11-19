// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { DynamicList } from "./DynamicList"

vi.mock("../../../shared/utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const items = [
    { id: "a", name: "Uno" },
    { id: "b", name: "Dos" }
]
const render_ = (props: Partial<Parameters<typeof DynamicList>[0]> = {}) =>
    render(
        <DynamicList items={items} {...props}>
            {(item) => <span>{String(item.name)}</span>}
        </DynamicList>
    )

describe("DynamicList", () => {
    it("renderiza_lo_principal: una fila por ítem, borrar y agregar", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { settings: { add: "Agregar" } })])
        render_()
        expect(screen.getByText("Uno")).toBeTruthy()
        expect(screen.getByText("Dos")).toBeTruthy()
        expect(screen.getByText("Agregar")).toBeTruthy()
        // por fila: botón de abrir + botón de borrar; más el de agregar
        expect(screen.getAllByRole("button")).toHaveLength(5)
    })

    it("click_en_el_ítem_emite_open_con_el_id", () => {
        const onOpen = vi.fn()
        render_({ onOpen })
        fireEvent.click(screen.getByText("Dos"))
        expect(onOpen).toHaveBeenCalledWith("b")
    })

    it("click_en_borrar_emite_delete_con_el_id", () => {
        const onDelete = vi.fn()
        render_({ onDelete })
        fireEvent.click(screen.getAllByRole("button")[3])
        expect(onDelete).toHaveBeenCalledWith("b")
    })

    it("click_en_agregar_emite_add_sin_argumentos", () => {
        const onAdd = vi.fn()
        render_({ onAdd })
        fireEvent.click(screen.getAllByRole("button")[4])
        expect(onAdd).toHaveBeenCalledWith()
    })

    it("allowOpen_false_no_envuelve_el_ítem_en_un_botón_ni_emite_open", () => {
        const onOpen = vi.fn()
        render_({ allowOpen: false, onOpen })
        expect(screen.getAllByRole("button")).toHaveLength(3)
        fireEvent.click(screen.getByText("Uno"))
        expect(onOpen).not.toHaveBeenCalled()
    })

    it("addDisabled_deshabilita_agregar", () => {
        const onAdd = vi.fn()
        render_({ addDisabled: true, onAdd })
        const add = screen.getAllByRole("button")[4] as HTMLButtonElement
        expect(add.disabled).toBe(true)
        fireEvent.click(add)
        expect(onAdd).not.toHaveBeenCalled()
    })

    it("sin_ítems_muestra_el_texto_vacío_y_nothingText_false_lo_oculta", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { empty: { general: "Nada por acá" } })])
        const { rerender } = render(<DynamicList items={[]} />)
        expect(screen.getByText("Nada por acá")).toBeTruthy()
        rerender(<DynamicList items={[]} nothingText={false} />)
        expect(screen.queryByText("Nada por acá")).toBeNull()
    })
})
