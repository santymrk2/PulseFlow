// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../components/helpers/history"
import { _show } from "../../components/helpers/shows"
import { activeEdit, activeShow, dictionary, overlays, popupData, showsCache, templates } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SetTime } from "./SetTime"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => [{ id: "sl1" }]) }))
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../ui/number-field/NumberField", () => ({
    NumberField: ({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number | null) => void }) => <input data-label={label} data-max={max} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
}))

let restaurar: () => void = () => {}
function montar(action = "showTime", edit: object = { type: "show", items: [0], slide: 0 }, extra: ReturnType<typeof looseEntry>[] = []) {
    vi.mocked(_show).mockReturnValue({ get: () => ({ sl1: { items: [{ actions: { showTime: 5 } }, { actions: { showTime: 7 } }] } }) } as never)
    restaurar = setStoresForTest([storeEntry(popupData, { action }), looseEntry(activeEdit, edit), storeEntry(activeShow, { id: "sh" }), looseEntry(showsCache, { sh: { slides: { sl1: { items: [{ actions: { showTime: 5 } }] } } } }), looseEntry(overlays, {}), looseEntry(templates, {}), storeEntry(dictionary, { timer: { seconds: "Segundos" } }), ...extra] as never)
    return render(<SetTime />)
}
const campo = () => document.querySelector("input") as HTMLInputElement

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("SetTime", () => {
    it("muestra el valor actual y vacía popupData al montar", () => {
        montar()
        expect(campo().dataset.label).toBe("timer.seconds")
        expect(campo().dataset.max).toBe("3600")
        expect(campo().value).toBe("5")
        expect(get(popupData)).toEqual({})
    })

    it("cambiar el valor escribe setItems con las acciones de los ítems seleccionados", () => {
        montar()
        fireEvent.change(campo(), { target: { value: "10" } })
        expect(history).toHaveBeenCalledWith({
            id: "setItems",
            newData: { style: { key: "actions", values: [{ showTime: 10 }, { showTime: 7 }] } },
            location: { page: "edit", show: { id: "sh" }, slide: "sl1", items: [0], override: "itemaction_sl1_items_0" }
        })
    })

    it("valor 0 borra la acción", () => {
        montar()
        fireEvent.change(campo(), { target: { value: "0" } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { style: { key: "actions", values: [{}] } } }))
    })

    it("en overlay escribe history UPDATE con la key items", () => {
        montar("showTime", { type: "overlay", id: "ov1", items: [0], slide: 0 }, [looseEntry(overlays, { ov1: { items: [{ actions: { showTime: 5 } }, {}] } })])
        fireEvent.change(campo(), { target: { value: "9" } })
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            oldData: { id: "ov1" },
            newData: { key: "items", subkey: "actions", data: [{ showTime: 9 }], indexes: [0] },
            location: { page: "edit", id: "overlay_items", override: "itemaction_0" }
        })
    })

    it("si el índice no existe no escribe history", () => {
        montar("showTime", { type: "show", items: [5], slide: 0 })
        fireEvent.change(campo(), { target: { value: "3" } })
        expect(history).not.toHaveBeenCalled()
    })
})
