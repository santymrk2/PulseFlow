// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { activePopup, dictionary, selected, shows } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../shared/utils/popup"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { DeleteShow } from "./DeleteShow"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))

let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([looseEntry(shows, { a: { name: "Uno" }, b: { name: "Dos", locked: true }, c: { name: "Tres" } }), looseEntry(selected, { id: "show", data: [{ id: "a" }, { id: "b" }, { id: "c" }] }), storeEntry(activePopup, "delete_show"), storeEntry(dictionary, { popup: { delete_show_confirmation: "Borrar estos shows" }, actions: { delete: "Eliminar" } })] as never)
    return render(<DeleteShow />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("DeleteShow", () => {
    it("lista_sólo_los_shows_no_bloqueados_con_su_cantidad", () => {
        montar()
        expect(screen.getByText("Borrar estos shows:")).toBeTruthy()
        expect([...document.querySelectorAll("li")].map((a) => a.textContent)).toEqual(["Uno", "Tres"])
        expect(document.querySelector("button")?.textContent).toContain("2")
    })

    it("el_botón_borra_con_history_SHOWS_limpia_la_selección_y_cierra", () => {
        montar()
        fireEvent.click(screen.getByText("Eliminar"))
        expect(history).toHaveBeenCalledTimes(1)
        expect(history).toHaveBeenCalledWith({ id: "SHOWS", oldData: { data: [{ id: "a" }, { id: "c" }] }, location: { page: "drawer" } })
        expect(get(selected)).toEqual({ id: null, data: [] })
        expect(get(activePopup)).toBeNull()
    })

    it("Enter_borra_igual_que_el_botón", () => {
        montar()
        expect(triggerPopupSubmit()).toBe(true)
        expect(history).toHaveBeenCalledWith({ id: "SHOWS", oldData: { data: [{ id: "a" }, { id: "c" }] }, location: { page: "drawer" } })
    })

    it("cerrar_sin_confirmar_no_borra_nada", () => {
        const { unmount } = montar()
        unmount()
        expect(history).not.toHaveBeenCalled()
        expect(triggerPopupSubmit()).toBe(false)
    })
})
