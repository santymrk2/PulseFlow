// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { activePopup, dictionary, groupNumbers, groups, groupsMoreOptionsEnabled, special, templates } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { clearFields, fields, fire } from "../test/kitMocks"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ManageGroups } from "./ManageGroups"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/profile", () => ({ isGroupHidden: (id: string) => id === "oculto" }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/color-field/ColorField", async () => ({ ColorField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/popup-field/PopupField", async () => ({ PopupField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const GRUPOS = {
    verse: { name: "verse", default: true, color: "#111111", shortcut: "V" },
    coro: { name: "Coro", color: "#222222", template: "t1" },
    oculto: { name: "Zeta", color: "#333333" }
}
let restaurar: () => void = () => {}
function montar(grupos: object = GRUPOS, extra: ReturnType<typeof looseEntry>[] = []) {
    restaurar = setStoresForTest([looseEntry(groups, grupos), looseEntry(special, {}), looseEntry(templates, { t1: { name: "Plantilla uno" } }), storeEntry(groupNumbers, true), storeEntry(groupsMoreOptionsEnabled, false), storeEntry(activePopup, "manage_groups"), storeEntry(dictionary, { groups: { verse: "Verso" } }), ...extra] as never)
    return render(<ManageGroups />)
}
const nombres = () => [...document.querySelectorAll("[data-field='inputs.name']")].map((el) => el.getAttribute("data-value"))
const opciones = () => fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
const llamadas = () => structuredClone(vi.mocked(history).mock.calls)
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageGroups", () => {
    it("lista_los_grupos_visibles_ordenados_por_nombre_con_el_nombre_traducido_de_los_por_defecto", () => {
        montar()
        expect(nombres()).toEqual(["Coro", "Verso"])
    })

    it("sin_grupos_visibles_muestra_vacio", () => {
        montar({ oculto: GRUPOS.oculto })
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })

    it("cambiar_el_nombre_registra_el_history_y_quita_la_marca_default_de_los_traducidos", () => {
        montar()
        fire("inputs.name", "onChange", "Estribillo")
        expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { key: "name", data: "Estribillo" }, oldData: { id: "verse" }, location: { page: "none", id: "global_group", override: "group_name" } }]])
        expect(get(groups).verse.default).toBeUndefined()
    })

    it("cambiar_el_nombre_de_uno_propio_no_toca_default", () => {
        montar({ coro: GRUPOS.coro })
        fire("inputs.name", "onChange", "Otro")
        expect(get(groups).coro).toEqual(GRUPOS.coro)
        expect(vi.mocked(history).mock.calls[0][0]).toMatchObject({ oldData: { id: "coro" } })
    })

    it("un_nombre_terminado_en_espacio_y_digito_avisa_solo_con_numeracion_automatica", () => {
        montar({ coro: GRUPOS.coro })
        fire("inputs.name", "onChange", "Coro 2")
        expect(vi.mocked(newToast).mock.calls).toEqual([["tips.group_numbers"]])
        fire("inputs.name", "onChange", "Coro2")
        expect(newToast).toHaveBeenCalledTimes(1)
        groupNumbers.set(false)
        fire("inputs.name", "onChange", "Coro 3")
        expect(newToast).toHaveBeenCalledTimes(1)
    })

    it("el_color_se_guarda_con_cada_input", () => {
        montar({ coro: GRUPOS.coro })
        expect(fields["edit.color"]).toMatchObject({ noLabel: true, value: "#222222" })
        fire("edit.color", "onInput", "#abcdef")
        expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { key: "color", data: "#abcdef" }, oldData: { id: "coro" }, location: { page: "none", id: "global_group", override: "group_color" } }]])
    })

    it("el_atajo_abre_assign_shortcut_con_los_atajos_de_los_otros_grupos", () => {
        montar()
        const atajo = fields["groups.group_shortcut"]
        expect(atajo).toMatchObject({ id: "verse", value: "V", name: "V", icon: "shortcut", popupId: "assign_shortcut", allowEmpty: true })
        expect(atajo.data).toEqual({ revert: "manage_groups", existingShortcuts: [], mode: "global_group" })
        fire("groups.group_shortcut", "onChange", "X")
        expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { key: "shortcut", data: "X" }, oldData: { id: "verse" }, location: { page: "none", id: "global_group", override: "group_shortcut" } }]])
    })

    it("existingShortcuts_son_los_de_los_demas_grupos_visibles", () => {
        montar({ a: { name: "A", color: "#1", shortcut: "a" }, b: { name: "B", color: "#2", shortcut: "b" } })
        // el último en renderizarse (B) ve el atajo de A
        expect((fields["groups.group_shortcut"].data as { existingShortcuts: string[] }).existingShortcuts).toEqual(["a"])
    })

    it("borrar_registra_el_history_con_el_id", () => {
        montar({ coro: GRUPOS.coro })
        fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
        expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { id: "coro" }, location: { page: "none", id: "global_group" } }]])
    })

    it("agregar_registra_un_grupo_vacio_blanco", () => {
        montar()
        fireEvent.click(screen.getByText("[settings.add]").closest("button") as HTMLElement)
        expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { data: { name: "", color: "#ffffff" } }, location: { page: "none", id: "global_group" } }]])
    })

    describe("mas_opciones", () => {
        it("el_boton_alterna_groupsMoreOptionsEnabled_y_muestra_reset_y_la_plantilla", () => {
            montar()
            expect(fields["groups.group_template"]).toBeUndefined()
            expect(document.querySelector("button.popup-reset")).toBeNull()
            expect(fields["settings.auto_group_numbers"]).toBeUndefined()
            opciones()
            expect(get(groupsMoreOptionsEnabled)).toBe(true)
            expect(document.querySelector("button.popup-options")?.classList.contains("active")).toBe(true)
            expect(document.querySelector("button.popup-reset")).toBeTruthy()
            expect(fields["groups.group_template"]).toMatchObject({ icon: "templates", popupId: "select_template", allowEmpty: true })
            expect(fields["groups.group_template"].data).toEqual({ action: "select_template", revert: "manage_groups" })
            opciones()
            expect(get(groupsMoreOptionsEnabled)).toBe(false)
        })

        it("la_plantilla_muestra_el_nombre_y_al_cambiar_guarda_la_clave_template", () => {
            montar({ coro: GRUPOS.coro }, [storeEntry(groupsMoreOptionsEnabled, true)] as never)
            expect(fields["groups.group_template"]).toMatchObject({ value: "t1", name: "Plantilla uno" })
            fire("groups.group_template", "onChange", "t2")
            expect(llamadas()).toEqual([[{ id: "UPDATE", newData: { key: "template", data: "t2" }, oldData: { id: "coro" }, location: { page: "none", id: "global_group", override: "group_template" } }]])
        })

        it("los_interruptores_escriben_groupNumbers_y_special_groupShortcutPreview", () => {
            montar({}, [storeEntry(groupsMoreOptionsEnabled, true)] as never)
            expect(fields["settings.auto_group_numbers"]).toMatchObject({ checked: true, defaultValue: true })
            expect(fields["settings.shortcuts_on_slides"]).toMatchObject({ defaultValue: false })
            fire("settings.auto_group_numbers", "onChange", false)
            expect(get(groupNumbers)).toBe(false)
            fire("settings.shortcuts_on_slides", "onChange", true)
            expect(get(special).groupShortcutPreview).toBe(true)
        })

        it("reset_restaura_los_ocho_grupos_por_defecto_y_la_numeracion", () => {
            montar({ coro: GRUPOS.coro }, [storeEntry(groupsMoreOptionsEnabled, true), storeEntry(groupNumbers, false)] as never)
            fireEvent.click(document.querySelector("button.popup-reset") as HTMLElement)
            const restaurados = get(groups)
            expect(Object.keys(restaurados)).toEqual(["break", "bridge", "chorus", "intro", "outro", "pre_chorus", "tag", "verse"])
            expect(restaurados.verse).toEqual({ name: "verse", default: true, color: "#5825f5", shortcut: "V" })
            expect(restaurados.intro).toEqual({ name: "intro", default: true, color: "#d525f5" })
            expect(get(groupNumbers)).toBe(true)
        })
    })
})
