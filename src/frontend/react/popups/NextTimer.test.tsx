// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { activePopup, activeProject, activeShow, dictionary, popupData, projects, showsCache } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { commonMock } from "../test/mockCommon"
import { clearFields, fire } from "../test/kitMocks"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { NextTimer } from "./NextTimer"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn(() => ({ get: vi.fn(() => "l1") })) }))
vi.mock("../../components/helpers/time", () => ({ joinTime: vi.fn((t) => `${t}m`), secondsToTime: vi.fn((s) => [0, s]) }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { timer: { seconds: "Segundos" }, actions: { reset: "Resetear", to_all: "A todos" }, transition: { duration: "Duración" } }
let restaurar: () => void = () => {}
function montar(data: object = {}, refs: object[] = [], project: object = {}) {
    vi.mocked(getLayoutRef).mockReturnValue(refs as never)
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activePopup, "next_timer"), storeEntry(activeShow, { id: "sh1", index: 0 }), storeEntry(activeProject, "p1"), storeEntry(projects, { p1: { name: "P", shows: [{ id: "x", data: { timer: 5 } }] }, ...project } as never), storeEntry(showsCache, {}), storeEntry(dictionary, dict)] as never)
    return render(<NextTimer />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.mocked(getLayoutRef).mockReturnValue([])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("NextTimer", () => {
    it("una_sola_diapatositiva_llama_a_history_con_el_nuevo_tiempo_y_cierra", () => {
        montar({ indexes: [1] })
        fire("timer.seconds", "onChange", 12)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: 12, indexes: [1] } }))
        expect(get(activePopup)).toBeNull()
    })

    it("todas_las_diaposiciones_muestra_el_campo_y_el_boton_para_aplicar_a_todas", () => {
        const refs = [
            { id: "s1", data: { nextTimer: 5 } },
            { id: "s2", data: { nextTimer: 10 } }
        ]
        const { container } = montar({}, refs)
        expect(container.querySelector('[data-field="timer.seconds"]')).toBeTruthy()
        expect(container.textContent).toContain("A todos")
        expect(document.body.textContent).toContain("Duración")
    })

    it("aplicar_a_todas_escribe_nextTimer_y_el_flag_end_en_la_última", () => {
        const refs = [
            { id: "s1", data: { nextTimer: 5 } },
            { id: "s2", data: { nextTimer: 10 } }
        ]
        montar({}, refs)
        fire("timer.seconds", "onChange", 20)
        const toAll = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("A todos"))
        act(() => toAll?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { key: "nextTimer", data: 20, indexes: [0, 1] } }))
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { key: "end", data: true, indexes: [1] } }))
    })

    it("el_reset_cuando_ya_está_aplicado_llama_a_updateValue_con_undefined", () => {
        const refs = [
            { id: "s1", data: { nextTimer: 5 } },
            { id: "s2", data: { nextTimer: 5 } }
        ]
        montar({}, refs)
        fire("timer.seconds", "onChange", 5)
        const reset = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("Resetear"))
        expect(reset).toBeTruthy()
        act(() => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { key: "nextTimer", data: undefined, indexes: [0, 1] } }))
    })

    it("un_item_de_proyecto_escribe_timer_en_projects_y_cierra", () => {
        montar({ type: "folder", indexes: [], count: 1, totalTime: 0 })
        fire("timer.seconds", "onChange", 9)
        // La rama "todas las diapositivas" sólo guarda al confirmar (Enter/botón), igual que el Svelte original
        triggerPopupSubmit()
        expect(get(projects).p1.shows[0].data.timer).toBe(9)
        expect(get(activePopup)).toBeNull()
    })

    it("Enter_ejecuta_el_submit_actualizado", () => {
        montar({ indexes: [3] })
        fire("timer.seconds", "onChange", 7)
        act(() => {
            expect(triggerPopupSubmit()).toBe(true)
        })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { key: "nextTimer", data: 7, indexes: [3] } }))
    })
})
