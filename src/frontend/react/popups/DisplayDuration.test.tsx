// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { drawerTabsData, effects, overlays, selected } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { DisplayDuration } from "./DisplayDuration"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(subTab: string) {
    restaurar = setStoresForTest([looseEntry(drawerTabsData, { overlays: { activeSubTab: subTab } }), looseEntry(selected, { id: "overlay", data: ["a", "b", "zz"] }), looseEntry(overlays, { a: { displayDuration: 5 }, b: {} }), looseEntry(effects, { a: { displayDuration: 9 }, b: { displayDuration: 1 } })])
    return render(<DisplayDuration />)
}
beforeEach(() => clearFields())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("DisplayDuration", () => {
    it("muestra_los_segundos_del_primer_overlay_seleccionado", () => {
        montar("all")
        expect(fields["timer.seconds"]).toMatchObject({ value: 5, max: 3600 })
    })

    it("en_efectos_lee_del_store_de_efectos", () => {
        montar("effects")
        expect(fields["timer.seconds"].value).toBe(9)
    })

    it("cambiar_guarda_displayDuration_en_cada_overlay_seleccionado_que_exista", () => {
        montar("all")
        fire("timer.seconds", "onChange", 30)
        expect(get(overlays)).toEqual({ a: { displayDuration: 30 }, b: { displayDuration: 30 } })
        expect(fields["timer.seconds"].value).toBe(30)
    })

    it("cero_borra_displayDuration", () => {
        montar("all")
        fire("timer.seconds", "onChange", 0)
        expect(get(overlays)).toEqual({ a: {}, b: {} })
    })

    it("en_efectos_escribe_en_effects_y_no_toca_overlays", () => {
        montar("effects")
        fire("timer.seconds", "onChange", 12)
        expect(get(effects)).toEqual({ a: { displayDuration: 12 }, b: { displayDuration: 12 } })
        expect(get(overlays).a).toEqual({ displayDuration: 5 })
    })
})
