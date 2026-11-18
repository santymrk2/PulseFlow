// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCustomCalendar } from "../../components/drawer/calendar/calendars"
import { history } from "../../components/helpers/history"
import { activeDays, activePopup, calendars, dictionary, drawerTabsData, eventEdit, events, popupData } from "../../stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { uid } from "uid"
import { EditEvent } from "./EditEvent"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/drawer/calendar/calendar", () => ({
    getTime: (date: Date) => ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2),
    isSameDay: (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}))
vi.mock("../../components/drawer/calendar/calendars", () => ({ createCustomCalendar: vi.fn(), isCalendarImported: (cal?: { url?: string; custom?: boolean } | null) => (cal ? !!cal.url || !cal.custom : false) }))
vi.mock("uid", () => ({ uid: vi.fn() }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/actions/actionData", () => ({ actionData: { start_show: { name: "Iniciar show" } } }))
vi.mock("../actions/CreateAction", async () => ({ CreateAction: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("CreateAction") }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/color-field/ColorField", async () => ({ ColorField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/date-field/DateField", async () => ({ DateField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/time-field/TimeField", async () => ({ TimeField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const DAY = new Date(2026, 0, 15).getTime()
let restaurar: () => void = () => {}
function montar(options: { edit?: string | null; events?: object; subTab?: string; popup?: object; extra?: ReturnType<typeof storeEntry>[] } = {}) {
    restaurar = setStoresForTest([
        looseEntry(eventEdit, options.edit ?? null),
        looseEntry(events, options.events ?? {}),
        looseEntry(calendars, { c1: { id: "c1", name: "Mi cal", color: "#111111", custom: true }, imp: { id: "imp", name: "Importado", color: "#222222", url: "http://x" } }),
        looseEntry(activeDays, [DAY]),
        looseEntry(drawerTabsData, { calendar: { activeSubTab: options.subTab ?? "event" } }),
        looseEntry(popupData, options.popup ?? {}),
        storeEntry(activePopup, "edit_event"),
        storeEntry(dictionary, { actions: { save: "Guardar" }, timer: { create: "Crear" }, calendar: { save_all: "Guardar todos", ending_the: "la fecha", ending_repeated: "veces", day: "día", week: "semana", month: "mes", year: "año" }, weekday: { 4: "jueves" } }),
        ...(options.extra || [])
    ] as never)
    return render(<EditEvent />)
}
const disparar = (evento: "change" | "choose", detail?: unknown) =>
    act(() => {
        const props = islands.CreateAction.props
        if (evento === "change") void (props.onChange as ((value: unknown) => void) | undefined)?.(detail)
        else void (props.onChoose as (() => void) | undefined)?.()
    })
const guardar = (texto = "Crear") => screen.getByText(texto).closest("button") as HTMLButtonElement
const stored = { id: "e1", type: "event", name: "Viejo", color: "#FF0000", time: true, from: new Date(2026, 0, 20, 9, 30).toString(), to: new Date(2026, 0, 20, 10, 30).toString(), repeat: false, repeatData: { type: "day", ending: "date", count: 1, endingDate: "", afterRepeats: 10 } }
// el evento nuevo se resetea dos veces al montar (como el Svelte): el id que queda es el segundo
const ID = "id2"
beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    vi.mocked(uid).mockImplementation(() => `id${++n}`)
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("EditEvent", () => {
    it("evento_nuevo_arranca_con_los_valores_por_defecto_y_el_día_activo", () => {
        montar()
        expect(fields["calendar.name"]).toMatchObject({ value: "", autofocus: true })
        expect(fields["calendar.color"].value).toBe("#FFFFFF")
        expect(fields["calendar.from_date"].value).toBe("2026-01-15")
        expect(fields["calendar.to_date"].value).toBe("2026-01-15")
        expect(fields["calendar.from_time"].value).toBe("11:00")
        expect(fields["calendar.to_time"].value).toBe("13:00")
        expect(guardar().disabled).toBe(true)
    })

    it("guardar_un_evento_nuevo_manda_history_UPDATE_con_los_datos_y_cierra", () => {
        montar()
        fire("calendar.name", "onInput", "Culto")
        fire("calendar.color", "onInput", "#00FF00")
        expect(guardar().disabled).toBe(false)
        fireEvent.click(guardar())
        expect(history).toHaveBeenCalledTimes(1)
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { data: { type: "event", name: "Culto", color: "#00FF00", time: true, from: new Date("2026-01-15 11:00"), to: new Date("2026-01-15 13:00"), location: "", repeat: false, repeatData: expect.objectContaining({ type: "day", ending: "date", count: 1, afterRepeats: 10, endingDate: "2026-02-15" }), notes: "", action: {} } },
            oldData: { id: ID },
            location: { page: "drawer", id: "event" }
        })
        expect(get(activePopup)).toBeNull()
        expect(get(eventEdit)).toBeNull()
    })

    it("con_repetición_sin_grupo_asigna_el_grupo_y_crea_los_repetidos_en_un_solo_history", () => {
        montar()
        fire("calendar.name", "onInput", "Culto")
        fire("calendar.repeat", "onChange", true)
        fireEvent.click(guardar())
        expect(history).toHaveBeenCalledTimes(1)
        const call = vi.mocked(history).mock.calls[0][0] as { id: string; newData: { data: Record<string, { name: string; group: string }>; keys: string[] }; location: object }
        expect(call).toMatchObject({ id: "UPDATE", location: { page: "drawer", id: "event" } })
        expect(call.newData.keys.length).toBeGreaterThan(1)
        expect(call.newData.data[ID]).toMatchObject({ name: "Culto", repeat: true, group: ID })
        expect(get(activePopup)).toBeNull()
    })

    it("editar_carga_el_evento_y_sólo_deja_guardar_si_cambió", () => {
        montar({ edit: "e1", events: { e1: stored } })
        expect(fields["calendar.name"]).toMatchObject({ value: "Viejo", autofocus: false })
        expect(fields["calendar.from_date"].value).toBe("2026-01-20")
        expect(fields["calendar.from_time"].value).toBe("09:30")
        expect(guardar("Guardar").disabled).toBe(true)
        fire("calendar.name", "onInput", "Nuevo")
        expect(guardar("Guardar").disabled).toBe(false)
        fireEvent.click(guardar("Guardar"))
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: expect.objectContaining({ name: "Nuevo", color: "#FF0000", from: new Date("2026-01-20 09:30"), to: new Date("2026-01-20 10:30") }) }, oldData: { id: "e1" }, location: { page: "drawer", id: "event" } })
        expect(get(eventEdit)).toBeNull()
    })

    it("al_cambiar_la_hora_desde_después_de_hasta_corre_la_hora_hasta_una_hora", () => {
        montar()
        fire("calendar.from_time", "onInput", "14:00")
        fire("calendar.from_time", "onChange", "14:00")
        expect(fields["calendar.to_time"].value).toBe("15:00")
    })

    it("al_cambiar_la_hora_hasta_antes_de_desde_corre_la_hora_desde_una_hora_antes", () => {
        montar()
        fire("calendar.from_time", "onInput", "15:00")
        fire("calendar.from_time", "onChange", "15:00")
        fire("calendar.to_time", "onInput", "12:00")
        fire("calendar.to_time", "onChange", "12:00")
        expect(fields["calendar.from_time"].value).toBe("11:00")
    })

    it("una_hora_hasta_que_empieza_con_cero_no_corre_la_hora_desde", () => {
        montar()
        fire("calendar.to_time", "onInput", "05:00")
        fire("calendar.to_time", "onChange", "05:00")
        expect(fields["calendar.from_time"].value).toBe("11:00")
    })

    it("con_grupo_aparece_guardar_todos_que_aplica_a_todos_los_del_grupo", () => {
        const g = (id: string, day: number) => ({ ...stored, id, group: "g1", from: new Date(2026, 0, day, 9, 30).toString(), to: new Date(2026, 0, day, 10, 30).toString() })
        montar({ edit: "e1", events: { e1: g("e1", 20), e2: g("e2", 27), otro: { ...g("otro", 3), group: "g2" } } })
        fire("calendar.name", "onInput", "Nuevo")
        fireEvent.click(guardar("Guardar todos"))
        expect(history).toHaveBeenCalledTimes(1)
        const call = vi.mocked(history).mock.calls[0][0] as { newData: { data: Record<string, { name: string; from: string; to: string }>; keys: string[] } }
        expect(call.newData.keys).toEqual(["e1", "e2"])
        expect(call.newData.data.e2).toMatchObject({ name: "Nuevo", from: new Date(2026, 0, 27, 9, 30).toString(), to: new Date(2026, 0, 27, 10, 30).toString() })
        expect(call).toMatchObject({ id: "UPDATE", location: { page: "drawer", id: "event" } })
        expect(get(activePopup)).toBeNull()
    })

    it("origen_importado_deshabilita_el_calendario_y_uno_propio_cambia_origin_y_color", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(fields["calendar.calendar"]).toMatchObject({ value: "", allowEmpty: true, addNew: "new.calendar", disabled: false })
        expect(fields["calendar.calendar"].options).toEqual([{ value: "c1", label: "Mi cal", icon: "calendar", iconColor: "#111111" }])
        fire("calendar.calendar", "onChange", "c1")
        expect(fields["calendar.color"].value).toBe("#111111")
        expect(fields["calendar.calendar"].value).toBe("c1")
        fire("calendar.calendar", "onChange", null)
        expect(fields["calendar.calendar"].value).toBe("")
    })

    it("crear_calendario_nuevo_lo_selecciona_con_su_color", () => {
        vi.mocked(createCustomCalendar).mockImplementation((name: string) => {
            calendars.update((a) => ({ ...a, cNew: { id: "cNew", name, color: "#333333", custom: true } }))
            return "cNew"
        })
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        fire("calendar.calendar", "onNew", "Otro")
        expect(createCustomCalendar).toHaveBeenCalledWith("Otro")
        expect(fields["calendar.calendar"].value).toBe("cNew")
        expect(fields["calendar.color"].value).toBe("#333333")
    })

    it("las_opciones_de_repetición_usan_el_día_de_la_semana_de_la_fecha", () => {
        montar()
        fire("calendar.repeat", "onChange", true)
        expect((fields["edit.interval"].options as { value: string; label: string }[]).map((o) => o.label)).toEqual(["día", "semana", "mes", "año", "1st jueves", "2nd jueves", "3rd jueves", "4th jueves", "last jueves"])
    })

    it("la_repetición_edita_cuenta_intervalo_y_final_por_veces", () => {
        montar()
        fire("calendar.repeat", "onChange", true)
        fire("edit.count", "onChange", 3)
        fire("edit.interval", "onChange", "week")
        fire("calendar.type", "onChange", "after")
        expect(fields["edit.count"].value).toBe(10)
        fire("edit.count", "onChange", 4)
        fire("calendar.name", "onInput", "R")
        fireEvent.click(guardar())
        const data = (vi.mocked(history).mock.calls[0][0] as { newData: { data: Record<string, { repeatData?: object }> } }).newData.data
        expect(data[ID].repeatData).toMatchObject({ count: 3, type: "week", ending: "after", afterRepeats: 4 })
        expect(Object.keys(data).length).toBe(4) // el original + 3 repeticiones
    })

    it("la_fecha_de_fin_de_la_repetición_se_edita", () => {
        montar({ subTab: "action" })
        fire("calendar.repeat", "onChange", true)
        fire("calendar.to_date", "onChange", "2026-05-01")
        expect(fields["calendar.to_date"].value).toBe("2026-05-01")
    })

    it("tipo_acción_muestra_CreateAction_y_necesita_un_id_para_guardar", () => {
        montar({ subTab: "action" })
        expect(islands.CreateAction.props).toMatchObject({ actionId: "", actionValue: {}, mode: "calendar", choosePopup: true })
        expect(guardar().disabled).toBe(true)
        disparar("change", { id: "start_show", actionValue: undefined })
        expect(islands.CreateAction.props).toMatchObject({ actionId: "start_show" })
        expect(guardar().disabled).toBe(false)
        fireEvent.click(guardar())
        expect(history).toHaveBeenCalledTimes(1)
        expect(vi.mocked(history).mock.calls[0][0]).toMatchObject({ id: "UPDATE", oldData: { id: ID }, newData: { data: { type: "action", name: "Iniciar show", color: null, action: { id: "start_show" } } } })
    })

    it("tipo_acción_con_valores_los_guarda_en_data", () => {
        montar({ subTab: "action" })
        disparar("change", { id: "x", actionValue: { id: "show9" } })
        expect(islands.CreateAction.props).toMatchObject({ actionValue: { id: "show9" } })
    })

    it("elegir_abre_el_selector_completo_y_al_cambiar_vuelve", () => {
        const { container } = montar({ subTab: "action" })
        disparar("choose")
        expect(islands.CreateAction.props).toMatchObject({ list: true, full: true, mode: "calendar", existingActions: [] })
        expect(container.querySelector("button.popup-back")).toBeTruthy()
        expect(container.querySelector("[data-field='sort.date']")).toBeNull()
        disparar("change", { id: "start_show" })
        expect(islands.CreateAction.props).toMatchObject({ choosePopup: true, actionId: "start_show" })
        expect(container.querySelector("button.popup-back")).toBeNull()
    })

    it("volver_del_selector_regresa_al_formulario", () => {
        const { container } = montar({ subTab: "action" })
        disparar("choose")
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(container.querySelector("[data-field='sort.date']")).toBeTruthy()
    })

    it("al_volver_de_elegir_un_show_aplica_el_evento_previo_y_la_acción_start_show", () => {
        vi.useFakeTimers()
        const previo = { ...stored, id: "ev1", name: "Previo", isoFrom: "2026-03-01", isoTo: "2026-03-01", fromTime: "08:00", toTime: "09:00" }
        montar({ subTab: "action", popup: { showId: "sh1", event: previo } })
        act(() => vi.advanceTimersByTime(100))
        expect(islands.CreateAction.props).toMatchObject({ actionId: "start_show", actionValue: { id: "sh1" } })
        expect(get(popupData).showId).toBeUndefined()
        expect(fields["sort.date"].value).toBe("2026-03-01")
    })

    it("popupData_event_refleja_el_evento_en_edición", () => {
        montar()
        fire("calendar.name", "onInput", "Visible")
        expect(get(popupData).event.name).toBe("Visible")
    })

    it("cerrar_sin_guardar_no_escribe_en_history", () => {
        const { unmount } = montar()
        fire("calendar.name", "onInput", "x")
        unmount()
        expect(history).not.toHaveBeenCalled()
    })
})
