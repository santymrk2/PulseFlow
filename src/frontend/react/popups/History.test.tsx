// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { redo, undo } from "../../components/helpers/history"
import { redoHistory, undoHistory } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { History } from "./History"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../components/helpers/history", () => ({ undo: vi.fn(), redo: vi.fn() }))

let restaurar: () => void = () => {}
function montar(undoList: object[], redoList: object[]) {
    restaurar = setStoresForTest([looseEntry(undoHistory, undoList), looseEntry(redoHistory, redoList)])
    return render(<History />)
}
const botones = () => [...document.querySelectorAll("button:not(.popup-options)")] as HTMLElement[]
beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("History", () => {
    it("lista_rehacer_primero_y_luego_deshacer_del_más_nuevo_al_estado_inicial", () => {
        montar(
            [
                { id: "SHOWS", time: 1 },
                { id: "UPDATE", location: { id: "event" }, time: 2 }
            ],
            [{ id: "SLIDES", time: 3 }]
        )
        expect(botones().map((b) => b.querySelector("p > span")?.textContent)).toEqual(["Updated slides", "Updated event", "Updated shows", "Initial state"])
    })

    it("un_id_desconocido_se_muestra_crudo_y_atenuado_salvo_los_de_version", () => {
        montar(
            [
                { version: 1, type: "store_update", value: { id: "x", key: "k" }, time: 1 },
                { id: "raro", time: 2 }
            ],
            []
        )
        const spans = botones().map((b) => b.querySelector("p > span") as HTMLElement)
        expect(spans.map((s) => s.textContent)).toEqual(["raro", "Updated key k in x", "Initial state"])
        expect(spans[0].getAttribute("style")).toContain("opacity: 0.3")
        expect(spans[1].getAttribute("style") || "").not.toContain("opacity")
    })

    it("vacío_muestra_el_estado_inicial_y_el_botón_de_borrar_deshabilitado", () => {
        montar([], [])
        expect(botones().length).toBe(1)
        expect((document.querySelector("button.popup-options") as HTMLButtonElement).disabled).toBe(true)
    })

    it("borrar_historia_vacía_los_dos_stores", () => {
        montar([{ id: "SHOWS", time: 1 }], [{ id: "SLIDES", time: 2 }])
        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        expect(get(undoHistory)).toEqual([])
        expect(get(redoHistory)).toEqual([])
    })

    it("clic_en_una_entrada_de_deshacer_deshace_hasta_ella_cada_300ms", () => {
        montar(
            [
                { id: "SHOWS", time: 1 },
                { id: "SLIDES", time: 2 }
            ],
            []
        )
        // lista: SLIDES(0), SHOWS(1), Initial(2): clic en SHOWS (i=1) -> callUndo(0) -> 1 undo
        fireEvent.click(botones()[1])
        act(() => vi.advanceTimersByTime(0))
        expect(undo).toHaveBeenCalledTimes(1)
        fireEvent.click(botones()[2])
        act(() => vi.advanceTimersByTime(300))
        expect(undo).toHaveBeenCalledTimes(3)
    })

    it("clic_en_una_entrada_de_rehacer_rehace_desde_el_final_hasta_ella", () => {
        montar(
            [],
            [
                { id: "SHOWS", time: 1 },
                { id: "SLIDES", time: 2 },
                { id: "TEMPLATE", time: 3 }
            ]
        )
        fireEvent.click(botones()[1])
        act(() => vi.advanceTimersByTime(1000))
        // callRedo(1): i = 2 y 1
        expect(redo).toHaveBeenCalledTimes(2)
        expect(screen.queryByText("Updated shows")).toBeTruthy()
    })
})
