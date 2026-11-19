// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _show } from "../../components/helpers/shows"
import { actions, activePopup, activeShow, dictionary, popupData, scenes, showsCache } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { CustomAction } from "./CustomAction"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

let restaurar: () => void = () => {}
function montar(data: object, customAction = "") {
    vi.mocked(_show).mockReturnValue({ get: () => customAction } as never)
    restaurar = setStoresForTest([looseEntry(popupData, data), looseEntry(actions, { z: { name: "Zeta" }, a: { name: "Alfa" } }), looseEntry(scenes, { s1: { action: "z" } }), looseEntry(activeShow, { id: "sh" }), looseEntry(showsCache, { sh: { settings: { customAction } } }), storeEntry(activePopup, "custom_action"), storeEntry(dictionary, {})] as never)
    return render(<CustomAction />)
}
beforeEach(() => {
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CustomAction", () => {
    it("show_muestra_el_tip_del_show_y_las_acciones_ordenadas_por_nombre", () => {
        montar({}, "z")
        expect(islands.Tip.props).toEqual({ type: "info", value: "show.custom_action_tip", bottom: 20 })
        expect(fields["midi.start_action"]).toMatchObject({ value: "z", allowEmpty: true })
        expect(fields["midi.start_action"].options).toEqual([
            { label: "Alfa", value: "a" },
            { label: "Zeta", value: "z" }
        ])
    })

    it("escena_lee_la_acción_de_la_escena_y_usa_el_tip_de_escenas", () => {
        montar({ mode: "scene", sceneId: "s1" })
        expect(islands.Tip.props.value).toBe("tips.custom_action")
        expect(fields["midi.start_action"].value).toBe("z")
    })

    it("elegir_en_un_show_guarda_settings_customAction_del_show_activo", () => {
        montar({})
        fire("midi.start_action", "onChange", "a")
        expect(get(showsCache).sh.settings.customAction).toBe("a")
        expect(fields["midi.start_action"].value).toBe("a")
    })

    it("elegir_en_una_escena_guarda_action_y_modified", () => {
        vi.spyOn(Date, "now").mockReturnValue(77)
        montar({ mode: "scene", sceneId: "s1" })
        fire("midi.start_action", "onChange", "a")
        expect(get(scenes).s1).toEqual({ action: "a", modified: 77 })
        vi.restoreAllMocks()
    })

    it("escena_inexistente_no_escribe", () => {
        montar({ mode: "scene", sceneId: "nada" })
        fire("midi.start_action", "onChange", "a")
        expect(get(scenes)).toEqual({ s1: { action: "z" } })
    })

    it("sin_acción_elegida_no_hay_botón_de_editar", () => {
        montar({})
        expect(document.querySelector("button")).toBeNull()
    })

    it("editar_abre_el_popup_action_con_el_id", () => {
        montar({}, "z")
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(get(popupData)).toEqual({ id: "z" })
        expect(get(activePopup)).toBe("action")
    })
})
