// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actionHistory, dictionary } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ActionHistory } from "./ActionHistory"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))

let restaurar: () => void = () => {}
function montar(items: { action: string; data: unknown; time: number; count: number; source?: string }[]) {
    restaurar = setStoresForTest([storeEntry(actionHistory, items), storeEntry(dictionary, { empty: { general: "Vacío" } })] as never)
    return render(<ActionHistory />)
}
afterEach(() => {
    cleanup()
    restaurar()
})
beforeEach(() => vi.clearAllMocks())

describe("ActionHistory", () => {
    it("renderiza_cada_accion_con_nombre_legible_cantidad_y_origen", () => {
        montar([
            { action: "next_slide", data: {}, time: Date.now(), count: 3, source: "midi" },
            { action: "stop", data: {}, time: Date.now(), count: 1 }
        ])
        expect(screen.getByText(/Next slide/)).toBeTruthy()
        expect(screen.getByText("(3)")).toBeTruthy()
        expect(screen.getByText("midi")).toBeTruthy()
        expect(screen.queryByText("(1)")).toBeNull()
    })

    it("sin_historial_muestra_el_vacio_y_el_boton_de_borrar_esta_deshabilitado", () => {
        const { container } = montar([])
        expect(screen.getByText("Vacío")).toBeTruthy()
        expect((container.querySelector("button.popup-options") as HTMLButtonElement).disabled).toBe(true)
    })

    it("borrar_historial_deja_el_store_vacio", () => {
        const { container } = montar([{ action: "stop", data: {}, time: 1, count: 1 }])
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(get(actionHistory)).toEqual([])
    })
})
