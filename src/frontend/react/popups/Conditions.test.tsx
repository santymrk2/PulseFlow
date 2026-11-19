// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkConditionValue, isConditionMet } from "../../components/edit/scripts/itemHelpers"
import { activeEdit, activeShow, activeStage, dictionary, overlays, popupData, showsCache, stageShows, templates } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { clearIslands, emit, islands } from "../../shared/test/islandMock"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Conditions } from "./Conditions"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../slide/Textbox", async () => ({ Textbox: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Textbox") }))
vi.mock("../stage/Stagebox", async () => ({ Stagebox: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Stagebox") }))
// ConditionsBox ya es React: el doble lo registra como las islas, para seguir usando islands/emit
vi.mock("./ConditionsBox", async () => {
    const { islands } = await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")
    return {
        ConditionsBox: ({ input, onChange }: { input: object; onChange: (c: unknown) => void }) => {
            islands.ConditionsBox = { props: { input }, events: { change: (e) => onChange(e.detail) } }
            return <div data-isla="ConditionsBox" />
        }
    }
})
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: vi.fn(() => true), checkConditionValue: vi.fn(() => true) }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getItemText: (item: { text?: string } | null) => item?.text ?? "" }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: vi.fn(() => [{ id: "sl1" }]) }))
vi.mock("../../components/stage/stage", () => ({ getSlideTextItems: vi.fn(() => [{ text: "de-stage" }]) }))
vi.mock("../../shared/ui/kit/zoom-control/ZoomControl", () => ({ ZoomControl: (p: { onChange: (v: number) => void; hidden: boolean }) => <button data-zoom={String(p.hidden)} onClick={() => p.onChange(0.8)} /> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: (p: { options: { value: string; label: string; data: string }[]; value: string; onChange: (v: string) => void }) => <button data-select={p.value} data-options={JSON.stringify(p.options)} onClick={() => p.onChange("1")} /> }))

const SHOW = (items: object[]) => ({ sh: { slides: { sl1: { items } }, timestamps: { modified: 0 } } })
const C1 = { element: "text", value: "a" }
const C2 = { element: "text", value: "b" }
let restaurar: () => void = () => {}
function elem(clase = "editItem") {
    const div = document.createElement("div")
    div.className = clase
    return div
}
function montar(items: object[], extra: ReturnType<typeof looseEntry>[] = [], contextElem: HTMLElement | null = elem(), edit: object = { type: "show", items: [0], slide: 0 }) {
    restaurar = setStoresForTest([looseEntry(popupData, { obj: { contextElem } }), looseEntry(activeEdit, edit), looseEntry(activeShow, { id: "sh" }), looseEntry(showsCache, SHOW(items)), looseEntry(dictionary, { actions: { delete: "Borrar", copy: "Copiar", paste: "Pegar" }, settings: { add: "Agregar" }, conditions: { show_item: "Mostrar item" } }), ...extra] as never)
    return render(<Conditions />)
}
const cajas = (c: HTMLElement) => c.querySelectorAll("[data-isla='ConditionsBox']").length
const boton = (c: HTMLElement, titulo: string) => [...c.querySelectorAll(`[data-title='${titulo}']`)] as HTMLElement[]
const guardado = (i = 0) => (get(showsCache).sh.slides.sl1.items[i] as { conditions?: unknown }).conditions
beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isConditionMet).mockReturnValue(true)
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("Conditions", () => {
    it("renderiza_la_raiz_una_caja_vacia_y_vacia_popupData", () => {
        const { container, getByText } = montar([{ text: "hola" }])
        expect(getByText("Mostrar item")).toBeTruthy()
        expect(cajas(container)).toBe(1)
        expect(islands.ConditionsBox.props).toEqual({ input: {} })
        expect(container.querySelector("[data-select]")).toBeNull()
        expect(get(popupData)).toEqual({})
        expect(boton(container, "Borrar").length).toBe(0)
    })

    it("un_cambio_de_la_caja_guarda_las_condiciones_en_el_item_del_show", () => {
        vi.spyOn(Date, "now").mockReturnValue(99)
        montar([{ text: "hola" }])
        emit("ConditionsBox", "change", { key: "element", value: "text" })
        emit("ConditionsBox", "change", { key: "value", value: "x" })
        expect(guardado()).toEqual({ showItem: [[[[{ element: "text", value: "x" }]]]] })
        expect(get(showsCache).sh.timestamps.modified).toBe(99)
        vi.restoreAllMocks()
    })

    it("cambiar_el_elemento_reinicia_el_contenido", () => {
        montar([{ text: "hola", conditions: { showItem: [[[[{ element: "text", value: "a" }]]]] } }])
        emit("ConditionsBox", "change", { key: "element", value: "variable" })
        expect(guardado()).toEqual({ showItem: [[[[{ element: "variable" }]]]] })
    })

    it("fuera_de_un_editItem_no_escribe", () => {
        montar([{ text: "hola" }], [], elem("otra"))
        emit("ConditionsBox", "change", { key: "element", value: "text" })
        expect(guardado()).toBeUndefined()
    })

    it("overlay_y_plantilla_guardan_en_su_store", () => {
        vi.spyOn(Date, "now").mockReturnValue(7)
        montar([], [looseEntry(overlays, { o1: { items: [{ text: "x" }] } }), looseEntry(activeEdit, { type: "overlay", id: "o1", items: [0] })] as never)
        emit("ConditionsBox", "change", { key: "element", value: "text" })
        expect(get(overlays).o1).toMatchObject({ modified: 7, items: [{ conditions: { showItem: [[[[{ element: "text" }]]]] } }] })
        cleanup()
        restaurar()
        montar([], [looseEntry(templates, { t1: { items: [{ text: "x" }] } }), looseEntry(activeEdit, { type: "template", id: "t1", items: [0] })] as never)
        emit("ConditionsBox", "change", { key: "element", value: "text" })
        expect(get(templates).t1).toMatchObject({ modified: 7, items: [{ conditions: { showItem: [[[[{ element: "text" }]]]] } }] })
        vi.restoreAllMocks()
    })

    it("en_el_escenario_usa_el_item_del_stage_activo_y_no_exige_editItem", () => {
        vi.spyOn(Date, "now").mockReturnValue(5)
        const stageItem = elem("stage_item")
        stageItem.id = "i1"
        const { container } = montar([], [looseEntry(activeStage, { id: "st1", items: ["i1"] }), looseEntry(stageShows, { st1: { items: { i1: { type: "text" }, i2: { type: "text" } } } })] as never, stageItem)
        expect(islands.Stagebox.props).toMatchObject({ id: "sh", ratio: 1 })
        expect(JSON.parse((container.querySelector("[data-select]") as HTMLElement).dataset.options ?? "[]")).toEqual([
            { value: "i1", label: "text", data: "" },
            { value: "i2", label: "text", data: "" }
        ])
        emit("ConditionsBox", "change", { key: "element", value: "text" })
        expect(get(stageShows).st1).toMatchObject({ modified: 5, items: { i1: { conditions: { showItem: [[[[{ element: "text" }]]]] } } } })
        vi.restoreAllMocks()
    })

    it("adivina_la_condicion_de_un_temporizador", () => {
        montar([{ type: "timer", timer: { id: "tm1" } }])
        expect(guardado()).toEqual({ showItem: [[[[{ element: "timer", elementId: "tm1", operator: "isRunning" }]]]] })
    })

    it("adivina_variable_o_valor_dinamico_desde_el_texto", () => {
        montar([{ text: "{video_time}" }])
        expect(guardado()).toEqual({ showItem: [[[[{ element: "dynamicValue", elementId: "video_time", operator: "isNot", value: "00:00" }]]]] })
        cleanup()
        restaurar()
        montar([{ text: "{$mi}" }])
        expect(guardado()).toEqual({ showItem: [[[[{ element: "variable", elementId: "$mi", operator: "isNot", value: "" }]]]] })
    })

    it("no_adivina_si_ya_hay_condiciones_ni_con_escritura", () => {
        montar([{ text: "{video_time}", conditions: { showItem: [] } }])
        expect(guardado()).toEqual({ showItem: [] })
        cleanup()
        restaurar()
        montar([{ text: "{scripture_x}" }])
        expect(guardado()).toBeUndefined()
    })

    it("con_varios_items_muestra_el_selector_y_cambiar_carga_las_condiciones_del_otro", () => {
        const { container } = montar([{ text: "uno" }, { text: "dos", conditions: { showItem: [[[[C1]]]] } }])
        const select = container.querySelector("[data-select]") as HTMLElement
        expect(JSON.parse(select.dataset.options ?? "[]")).toEqual([
            { value: "0", label: "uno", data: "1" },
            { value: "1", label: "dos", data: "2" }
        ])
        expect(select.dataset.select).toBe("0")
        expect(islands.Textbox.props).toMatchObject({ item: { text: "uno" }, ref: { id: "sh" } })
        fireEvent.click(select)
        expect(islands.ConditionsBox.props).toEqual({ input: C1 })
        expect(islands.Textbox.props).toMatchObject({ item: { text: "dos" } })
        emit("ConditionsBox", "change", { key: "value", value: "z" })
        expect(guardado(1)).toEqual({ showItem: [[[[{ ...C1, value: "z" }]]]] })
        expect(guardado(0)).toBeUndefined()
    })

    it("la_vista_previa_se_atenua_si_la_condicion_no_se_cumple", () => {
        vi.mocked(isConditionMet).mockReturnValue(false)
        const { container } = montar([{ text: "uno" }, { text: "dos" }])
        expect((container.querySelector("[data-isla='Textbox']")?.closest("[style]") as HTMLElement).style.opacity).toBe("0.2")
    })

    it("borrar_quita_el_contenido_y_colapsa_las_listas_vacias", () => {
        const { container } = montar([{ text: "t", conditions: { showItem: [[[[C1, C2]]]] } }])
        expect(boton(container, "Borrar").length).toBe(2)
        fireEvent.click(boton(container, "Borrar")[0])
        expect(guardado()).toEqual({ showItem: [[[[C2]]]] })
        fireEvent.click(boton(container, "Borrar")[0].closest("button") as HTMLElement)
        expect(guardado()).toEqual({ showItem: [] })
    })

    it("agregar_suma_un_contenido_vacio_en_cada_nivel", () => {
        const { container } = montar([{ text: "t", conditions: { showItem: [[[[C1]]]] } }])
        const agregar = boton(container, "Agregar")
        expect(agregar.length).toBe(2)
        fireEvent.click(agregar[0])
        expect(guardado()).toEqual({ showItem: [[[[C1, {}]]]] })
        fireEvent.click(boton(container, "Agregar").at(-1) as HTMLElement)
        expect(guardado()).toEqual({ showItem: [[[[C1, {}], [{}]]]] })
    })

    it("copiar_y_pegar_clona_el_contenido", () => {
        const { container } = montar([{ text: "t", conditions: { showItem: [[[[C1, C2]]]] } }])
        expect(boton(container, "Pegar").length).toBe(0)
        fireEvent.click(boton(container, "Copiar")[0])
        expect(boton(container, "Pegar").length).toBeGreaterThan(0)
        fireEvent.click(boton(container, "Pegar").at(0) as HTMLElement)
        expect(guardado()).toEqual({ showItem: [[[[C1, C2, C1]]]] })
        expect((guardado() as { showItem: object[][][][] }).showItem[0][0][0][2]).not.toBe(C1)
    })

    it("acepta_el_formato_viejo_showItem_values", () => {
        const { container } = montar([{ text: "t", conditions: { showItem: { values: [C1] } } }])
        expect(islands.ConditionsBox.props).toEqual({ input: C1 })
        expect(boton(container, "Borrar").length).toBe(1)
    })

    it("el_intervalo_refresca_cada_2s_y_cada_100ms_con_volumen_y_se_limpia_al_desmontar", () => {
        vi.useFakeTimers()
        const { unmount } = montar([{ text: "t", conditions: { showItem: [[[[C1]]]] } }])
        const last = () => vi.mocked(isConditionMet).mock.calls.at(-1)?.[3]
        expect(last()).toBe(0)
        act(() => vi.advanceTimersByTime(2000))
        expect(last()).toBe(1)
        act(() => vi.advanceTimersByTime(4000))
        expect(last()).toBe(3)
        expect(checkConditionValue).toHaveBeenLastCalledWith(C1, "t", "default", 3)
        unmount()
        vi.mocked(isConditionMet).mockClear()
        act(() => vi.advanceTimersByTime(10000))
        expect(isConditionMet).not.toHaveBeenCalled()
        cleanup()
        restaurar()
        montar([{ text: "t", conditions: { showItem: [[[[{ element: "volume" }]]]] } }])
        const antes = vi.mocked(isConditionMet).mock.calls.at(-1)?.[3] as number
        act(() => vi.advanceTimersByTime(500))
        expect(vi.mocked(isConditionMet).mock.calls.at(-1)?.[3]).toBe(antes + 5)
    })

    it("el_zoom_se_aplica_al_arbol_de_nodos", () => {
        const { container } = montar([{ text: "t", conditions: { showItem: [[[[C1]]]] } }])
        fireEvent.click(container.querySelector("[data-zoom]") as HTMLElement)
        expect((container.querySelector(".checkered") as HTMLElement).style.zoom).toBe("0.8")
    })
})
