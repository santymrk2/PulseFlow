// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getDynamicIds, replaceDynamicValues } from "../../components/helpers/showActions"
import { activeEdit, activePage, activePopup, activeShow, activeStage, dynamicValuesRevealUsed, overlays, popupData, refreshEditSlide, showsCache, special, stageShows, templates } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { DynamicValues } from "./DynamicValues"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../components/helpers/showActions", () => ({ getDynamicIds: vi.fn(), replaceDynamicValues: vi.fn(), dynamicValueText: (id: string) => `{${id}}` }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/shows", () => ({ _show: () => ({ get: () => "layout1" }) }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "slideA" }, { id: "slideB" }] }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const ids = ["slide_text", "time_hour", "time_minute", "timer_a", "$name", "interaction_x", "show_text_full", "plain"]
const items = () => [{ lines: [{ text: [{ value: "Hola mundo" }] }] }]
// <div class="editItem" data-index="0"><span/></div>
function contextElem(cls = "editItem") {
    const host = document.createElement("div")
    host.className = cls
    host.setAttribute("data-index", "0")
    const inner = document.createElement("span")
    host.append(inner)
    return inner
}

let restaurar: () => void = () => {}
function montar(entries: ReturnType<typeof storeEntry>[] = [], data: object = { obj: { contextElem: contextElem() }, caret: { line: 0, pos: 4 } }) {
    restaurar = setStoresForTest([
        looseEntry(popupData, data),
        storeEntry(activePopup, "dynamic_values"),
        looseEntry(activePage, "edit"),
        looseEntry(activeEdit, { items: [] }),
        looseEntry(activeShow, { id: "s1" }),
        looseEntry(activeStage, { id: null, items: [] }),
        looseEntry(dynamicValuesRevealUsed, false),
        looseEntry(refreshEditSlide, false),
        looseEntry(special, {}),
        looseEntry(templates, {}),
        looseEntry(overlays, {}),
        looseEntry(stageShows, {}),
        looseEntry(showsCache, { s1: { slides: { slideA: { items: items() }, slideB: { items: items() } } } }),
        ...entries
    ] as never)
    return render(<DynamicValues />)
}
const valor = (id: string) => document.querySelector(`[data-title="${id}"]`)?.closest("[role=button]") as HTMLElement
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.mocked(getDynamicIds).mockReturnValue(ids)
    vi.mocked(replaceDynamicValues).mockImplementation((text: string) => (text === "{plain}" ? "" : `<b>${text}</b>`))
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
    vi.useRealTimers()
})

describe("DynamicValues", () => {
    it("al_montar_vacía_popupData_y_pide_los_ids_sin_variables_con_showAll_del_store", () => {
        montar()
        expect(get(popupData)).toEqual({})
        expect(getDynamicIds).toHaveBeenCalledWith(false, null, false)
    })

    it("muestra_cada_valor_con_su_vista_previa_html_y_raya_si_no_hay_preview", () => {
        const { container } = montar()
        expect(container.querySelectorAll("[role=button]").length).toBe(5) // slide_text, show_text_full e interaction_ salen en modo no-stage
        expect(valor("time_hour").querySelector("b")?.textContent).toBe("{time_hour}")
        expect(valor("plain").querySelector("p")?.textContent).toBe("—")
        expect(replaceDynamicValues).toHaveBeenCalledWith("{time_hour}", { showId: "s1", layoutId: "layout1", slideIndex: undefined, type: "show", id: undefined, mode: null }, 0, true)
    })

    it("en_stage_oculta_interaction_pero_no_show_text_full", () => {
        const { container } = montar([looseEntry(activePage, "stage")])
        expect(container.querySelectorAll("[role=button]").length).toBe(6)
        expect(valor("interaction_x")).toBeFalsy()
    })

    it("elegir_un_valor_lo_inserta_en_la_posición_del_cursor_en_el_show_y_cierra", () => {
        montar([looseEntry(activeEdit, { items: [0], slide: 1 })])
        fireEvent.click(valor("time_hour"))
        expect(get(showsCache).s1.slides.slideB.items).toEqual([{ lines: [{ text: [{ value: "Hola{time_hour} mundo" }] }] }])
        expect(get(showsCache).s1.slides.slideA.items).toEqual(items())
        expect(get(refreshEditSlide)).toBe(true)
        expect(get(activePopup)).toBeNull()
    })

    it("en_un_overlay_o_plantilla_edita_el_item_y_marca_modified", () => {
        vi.spyOn(Date, "now").mockReturnValue(123)
        montar([looseEntry(activeEdit, { id: "o1", type: "overlay", items: [0] }), looseEntry(overlays, { o1: { items: items() } })])
        fireEvent.click(valor("time_hour"))
        expect(get(overlays).o1).toEqual({ items: [{ lines: [{ text: [{ value: "Hola{time_hour} mundo" }] }] }], modified: 123 })
        cleanup()
        restaurar()
        montar([looseEntry(activeEdit, { id: "t1", type: "template", items: [0] }), looseEntry(templates, { t1: { items: items() } })])
        fireEvent.click(valor("time_hour"))
        expect(get(templates).t1.modified).toBe(123)
        vi.restoreAllMocks()
    })

    it("en_stage_edita_el_primer_item_activo", () => {
        vi.spyOn(Date, "now").mockReturnValue(7)
        montar([looseEntry(activePage, "stage"), looseEntry(activeStage, { id: "st", items: ["i1"] }), looseEntry(stageShows, { st: { items: { i1: { lines: [{ text: [{ value: "abcdef" }] }] } } } })], { obj: { contextElem: contextElem("stage_item") }, caret: { line: 0, pos: 2 } })
        fireEvent.click(valor("time_hour"))
        expect(get(stageShows).st.items.i1).toEqual({ lines: [{ text: [{ value: "ab{time_hour}cdef" }] }] })
        expect(get(stageShows).st.modified).toBe(7)
        expect(get(activePopup)).toBeNull()
        vi.restoreAllMocks()
    })

    it("sin_elemento_de_edición_no_hace_nada", () => {
        montar([looseEntry(activeEdit, { items: [0], slide: 0 })], { obj: { contextElem: document.createElement("div") }, caret: {} })
        fireEvent.click(valor("time_hour"))
        expect(get(showsCache).s1.slides.slideA.items).toEqual(items())
        expect(get(activePopup)).toBe("dynamic_values")
    })

    it("con_ctrl_se_queda_abierto_y_sigue_insertando_después_del_anterior", () => {
        montar([looseEntry(activeEdit, { items: [0], slide: 0 })])
        fireEvent.click(valor("time_hour"), { ctrlKey: true })
        expect(get(activePopup)).toBe("dynamic_values")
        fireEvent.click(valor("time_minute"), { ctrlKey: true })
        expect(get(showsCache).s1.slides.slideA.items[0].lines?.[0].text?.[0].value).toBe("Hola{time_hour}{time_minute} mundo")
    })

    it("buscar_filtra_por_id_y_Enter_aplica_el_primero", () => {
        const { container } = montar([looseEntry(dynamicValuesRevealUsed, true), looseEntry(activeEdit, { items: [0], slide: 0 })])
        fire("main.search", "onInput", "minute")
        expect(container.querySelectorAll("[role=button]").length).toBe(1)
        expect(triggerPopupSubmit()).toBe(true)
        expect(get(showsCache).s1.slides.slideA.items[0].lines?.[0].text?.[0].value).toBe("Hola{time_minute} mundo")
        expect(get(activePopup)).toBeNull()
    })

    it("con_ver_todos_apagado_la_primera_letra_reinicia_la_lista_como_el_svelte_y_la_siguiente_filtra", () => {
        const { container } = montar()
        fire("main.search", "onInput", "mi")
        expect(container.querySelectorAll("[role=button]").length).toBe(5)
        fire("main.search", "onInput", "min")
        expect(container.querySelectorAll("[role=button]").length).toBe(1)
    })

    it("Enter_sin_búsqueda_de_2_letras_no_aplica_nada", () => {
        montar([looseEntry(dynamicValuesRevealUsed, true), looseEntry(activeEdit, { items: [0], slide: 0 })])
        fire("main.search", "onInput", "m")
        triggerPopupSubmit()
        expect(get(showsCache).s1.slides.slideA.items).toEqual(items())
        expect(get(activePopup)).toBe("dynamic_values")
    })

    it("buscar_con_showAll_apagado_lo_enciende_lo_guarda_y_pide_la_lista_completa", () => {
        montar()
        fire("main.search", "onInput", "ho")
        expect(get(dynamicValuesRevealUsed)).toBe(true)
        expect(getDynamicIds).toHaveBeenLastCalledWith(false, null, true)
    })

    it("el_botón_del_ojo_alterna_showAll", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(get(dynamicValuesRevealUsed)).toBe(true)
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(get(dynamicValuesRevealUsed)).toBe(false)
    })

    it("el_lápiz_abre_manage_dynamic_values", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-reset") as HTMLElement)
        expect(get(activePopup)).toBe("manage_dynamic_values")
    })

    it("las_vistas_previas_se_refrescan_cada_segundo_y_el_intervalo_se_limpia", () => {
        vi.useFakeTimers()
        const { unmount } = montar()
        vi.mocked(replaceDynamicValues).mockClear()
        act(() => vi.advanceTimersByTime(1000))
        expect(vi.mocked(replaceDynamicValues).mock.calls.at(-1)?.[2]).toBe(1)
        unmount()
        vi.mocked(replaceDynamicValues).mockClear()
        act(() => vi.advanceTimersByTime(3000))
        expect(replaceDynamicValues).not.toHaveBeenCalled()
    })

    it("cerrar_sin_elegir_no_escribe_nada_y_desregistra_Enter", () => {
        const { unmount } = montar()
        unmount()
        expect(get(refreshEditSlide)).toBe(false)
        expect(triggerPopupSubmit()).toBe(false)
        expect(fields["main.search"]).toBeTruthy()
    })
})
