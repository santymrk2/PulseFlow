// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { actionMoreOptionsUsed, actions, activePopup, activeShow, dictionary, overlays, popupData } from "../../shared/core/stores"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Action } from "./Action"

const layout = vi.hoisted(() => ({ ref: [] as { data?: { actions?: { slideActions?: { id: string; triggers?: string[] }[] } } }[] }))

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener-1"), destroyMain: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../actions/CreateAction", async () => ({ CreateAction: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("CreateAction") }))
vi.mock("../actions/MidiValues", async () => ({ MidiValues: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("MidiValues") }))
vi.mock("../../components/actions/actionData", () => ({ actionData: { next_slide: { name: "actions.next_slide" }, start_show: {}, id_select_show: {}, multi: { canAddMultiple: true } } }))
vi.mock("../../components/actions/customActivation", () => ({
    customActionActivations: [
        { id: "startup", name: "actions.activate_on_startup", icon: "startup" },
        { id: "output_changed", common: true, name: "actions.activate_output_changed", icon: "display_settings" }
    ]
}))
vi.mock("../../components/actions/midi", () => ({ convertOldMidiToNewAction: (a: unknown) => a, defaultMidiActionChannels: {}, midiInListen: vi.fn() }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => layout.ref, updateCachedShows: vi.fn() }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => ({}), set: vi.fn() }) }))
vi.mock("../../shared/utils/helpers/media", () => ({ convertImagePathToIcon: vi.fn(async (path: string) => `icono:${path}`), getFileName: (p: string) => p }))

const dict = { midi: { name: "Nombre", activate_keypress: "Atajo", ...{ midi: "MIDI" } }, actions: { custom_activation: "Activación", back: "Volver", activate_on_startup: "Al iniciar", activate_output_changed: "Salida cambiada", next_slide: "Siguiente slide" }, settings: { add: "Agregar" }, items: { icon: "Icono" } }

let restaurar: () => void = () => {}
function montar(data: object, extra: object = {}, usados = false) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(actions, { existente: { name: "Mi acción", triggers: ["next_slide"] }, ...extra }), storeEntry(overlays, { o1: { name: "Ov", color: null, category: null, items: [], actions: [{ id: "oa", name: "oa", triggers: ["next_slide"] }] } }), storeEntry(activePopup, "action"), storeEntry(activeShow, { id: "show1" }), storeEntry(actionMoreOptionsUsed, usados), storeEntry(dictionary, dict)] as never)
    return render(<Action />)
}
const nombre = (c: HTMLElement) => c.querySelector("input") as HTMLInputElement
const campo = (texto: string) => screen.getByText(texto).closest(".textfield") as HTMLElement
const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const cambiar = (nombre: string, detail: unknown) =>
    act(() => {
        void (islands[nombre].props.onChange as ((value: unknown) => void) | undefined)?.(detail)
    })
const elegir = (nombre: string) =>
    act(() => {
        void (islands[nombre].props.onChoose as (() => void) | undefined)?.()
    })

beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    clearIslands()
    layout.ref = []
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("Action", () => {
    it("sin_id_crea_uno_en_popupData_y_la_isla_de_triggers_arranca_vacia", () => {
        const { container } = montar({})
        expect(get(popupData).id).toMatch(/\w+/)
        expect(nombre(container)).toBeTruthy()
        expect(islands.CreateAction.props).toMatchObject({ actionId: "", choosePopup: true })
    })

    it("sin_nombre_no_se_guarda_y_con_nombre_se_guarda_a_los_50ms", () => {
        const { container } = montar({})
        const id = get(popupData).id as string
        avanzar(100)
        expect(get(actions)[id]).toBeUndefined()
        fireEvent.change(nombre(container), { target: { value: "Nueva" } })
        avanzar(49)
        expect(get(actions)[id]).toBeUndefined()
        avanzar(2)
        expect(get(actions)[id]).toMatchObject({ name: "Nueva", triggers: [] })
    })

    it("abre_una_accion_existente_con_su_nombre_y_un_CreateAction_por_trigger", () => {
        const { container } = montar({ id: "existente" })
        expect(nombre(container).value).toBe("Mi acción")
        expect(islands.CreateAction.props).toMatchObject({ actionId: "next_slide", mainId: "existente", actionNameIndex: 1, choosePopup: true })
    })

    it("elegir_un_trigger_le_pone_nombre_automatico_si_estaba_vacio_y_guarda", () => {
        const { container } = montar({})
        const id = get(popupData).id as string
        cambiar("CreateAction", { id: "next_slide" })
        expect(nombre(container).value).toBe("Siguiente slide")
        avanzar(60)
        expect(get(actions)[id]).toMatchObject({ name: "Siguiente slide", triggers: ["next_slide"] })
    })

    it("un_trigger_repetido_se_ignora_y_remove_lo_saca", () => {
        montar({ id: "existente" })
        cambiar("CreateAction", { id: "next_slide" })
        avanzar(200)
        expect(get(actions).existente.triggers).toEqual(["next_slide"])
        cambiar("CreateAction", { id: "remove" })
        avanzar(60)
        expect(get(actions).existente.triggers).toEqual([])
    })

    it("choose_abre_el_selector_con_boton_volver", () => {
        montar({ id: "existente" })
        elegir("CreateAction")
        expect(islands.CreateAction.props).toMatchObject({ actionId: "next_slide", full: true, list: true })
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)
        expect(document.querySelector("button.popup-back")).toBeNull()
    })

    it("el_boton_opciones_alterna_actionMoreOptionsUsed_y_muestra_el_atajo", () => {
        montar({ id: "existente" })
        expect(screen.queryByText("Atajo")).toBeNull()
        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        expect(get(actionMoreOptionsUsed)).toBe(true)
        expect(screen.getByText("Atajo")).toBeTruthy()
    })

    it("asignar_atajo_abre_assign_shortcut_y_el_trigger_lo_guarda_en_la_accion", () => {
        montar({ id: "existente" }, {}, true)
        fireEvent.click(campo("Atajo").querySelector("[role=button]") as HTMLElement)
        expect(get(activePopup)).toBe("assign_shortcut")
        expect(get(popupData)).toMatchObject({ id: "existente", mode: "action", revert: "action", existingShortcuts: [] })
        act(() => get(popupData).trigger("K"))
        avanzar(60)
        expect(get(actions).existente.keypressActivate).toBe("K")
    })

    it("activacion_personalizada_elige_de_la_lista_y_vuelve", () => {
        montar({ id: "existente" }, {}, true)
        fireEvent.click(campo("Activación").querySelector("[role=button]") as HTMLElement)
        expect(screen.getByText("Salida cambiada")).toBeTruthy()
        expect(screen.queryByText("Al iniciar")).toBeNull()
        fireEvent.click(screen.getByText("Salida cambiada"))
        avanzar(60)
        expect(get(actions).existente.customActivation).toBe("output_changed")
        expect(document.querySelector("button.popup-back")).toBeNull()
    })

    it("midiEnabled_muestra_MidiValues_y_su_change_actualiza_el_midi", () => {
        montar({ id: "m" }, { m: { name: "M", triggers: ["next_slide"], midiEnabled: true, customActivation: "startup", midi: { type: "noteon", values: { note: 1, velocity: 2, channel: 1 } } } })
        expect(islands.MidiValues.props).toMatchObject({ firstActionId: "next_slide" })
        cambiar("MidiValues", { type: "noteoff", values: { note: 5, velocity: 0, channel: 2 } })
        avanzar(60)
        expect(get(actions).m.midi).toMatchObject({ type: "noteoff" })
    })

    it("modo_slide_guarda_con_history_SHOW_LAYOUT_y_al_cerrar_quita_la_accion_vacia", () => {
        layout.ref = [{ data: { actions: { slideActions: [{ id: "s1" }] } } }]
        const { unmount } = montar({ id: "s1", mode: "slide", index: 0 })
        expect(islands.CreateAction.props).toMatchObject({ mode: "slide", list: true, mainId: "s1" })
        cambiar("CreateAction", { id: "next_slide" })
        avanzar(60)
        expect(history).toHaveBeenCalledWith({ id: "SHOW_LAYOUT", newData: { key: "actions", data: [{ slideActions: [{ id: "s1", name: "Siguiente slide", triggers: ["next_slide"] }] }], indexes: [0] } })
        vi.mocked(history).mockClear()
        layout.ref = [{ data: { actions: { slideActions: [{ id: "s1" }] } } }]
        unmount()
        expect(history).toHaveBeenCalledWith({ id: "SHOW_LAYOUT", newData: { key: "actions", data: [{ slideActions: [] }], indexes: [0] } })
    })

    it("al_cerrar_no_quita_la_accion_de_slide_que_ya_tiene_trigger", () => {
        layout.ref = [{ data: { actions: { slideActions: [{ id: "s1", triggers: ["next_slide"] }] } } }]
        const { unmount } = montar({ id: "s1", mode: "slide", index: 0 })
        vi.mocked(history).mockClear()
        unmount()
        expect(history).not.toHaveBeenCalled()
    })

    it("modo_overlay_guarda_en_el_overlay_con_history_UPDATE", () => {
        montar({ id: "oa", mode: "overlay", overlayId: "o1" })
        cambiar("CreateAction", { id: "multi" })
        avanzar(60)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", oldData: { id: "o1" }, location: { page: "drawer", id: "overlay_key", override: "actions_o1" } }))
    })

    it("showId_en_popupData_con_start_show_fija_el_actionValue", () => {
        montar({ id: "x", showId: "sh9", actionIndex: 0 }, { x: { name: "X", triggers: ["start_show"] } })
        avanzar(60)
        expect(get(actions).x.actionValues).toEqual({ start_show: { id: "sh9" } })
    })
})
