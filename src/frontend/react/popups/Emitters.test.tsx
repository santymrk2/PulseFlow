// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../shared/core/ipc/main"
import { activePopup, dictionary, emitters, popupData } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Emitters } from "./Emitters"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("uid", () => ({ uid: vi.fn(() => "uid1") }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))
vi.mock("../form/FormInputs", async () => ({ FormInputs: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("FormInputs") }))
vi.mock("../actions/MidiValues", async () => ({ MidiValues: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("MidiValues") }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getDynamicValue: (v: string) => `dyn(${v})` }))
vi.mock("../../components/form/inputs", () => ({ getValues: (inputs: { id: string; value?: unknown }[], data: Record<string, unknown> | undefined) => inputs.map((i) => ({ ...i, value: data?.[i.id] ?? i.value })) }))
vi.mock("../../components/actions/emitters", () => ({
    emitterData: {
        osc: { signal: [{ id: "host", type: "string", value: "0.0.0.0" }] },
        http: { signal: [] },
        midi: {
            signal: [
                { id: "output", type: "dropdown", value: "", options: [{ value: "", label: "—" }] },
                { id: "type", type: "dropdown", value: "noteon", options: [] }
            ]
        }
    },
    formatData: { osc: (values: { name: string; value: string }[], data = "") => `${data}|${values.map((v) => `${v.name}=${v.value}`).join(",")}`, http: () => "", midi: () => "" }
}))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(data: object = {}, store: object = {}) {
    restaurar = setStoresForTest([looseEntry(emitters, store), looseEntry(popupData, data), storeEntry(activePopup, "manage_emitters"), storeEntry(dictionary, { titlebar: { edit: "Editar" }, actions: { delete: "Borrar", back: "Volver" }, settings: { add: "Agregar" } })] as never)
    return render(<Emitters />)
}
const btn = (title: string) => document.querySelector(`[data-title='${title}']`) as HTMLElement
const cambiarMidi = (value: unknown) =>
    act(() => {
        void (islands.MidiValues.props.onChange as ((next: unknown) => void) | undefined)?.(value)
    })
const cambiarSignal = (value: unknown) =>
    act(() => {
        void (islands.FormInputs.props.onChange as ((next: unknown) => void) | undefined)?.(value)
    })
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Emitters", () => {
    it("sin_emisores_muestra_el_tip_y_agregar_crea_uno_osc_y_lo_abre", () => {
        montar()
        expect(islands.Tip.props).toEqual({ type: "info", value: "emitters.tip", bottom: 20 })
        fireEvent.click(screen.getByText("Agregar"))
        expect(get(emitters)).toEqual({ uid1: { name: "", type: "osc" } })
        expect(fields["midi.name"].autofocus).toBe(true)
    })

    it("lista_ordenada_por_tipo_y_nombre_abrir_y_borrar", () => {
        montar({}, { a: { name: "Zeta", type: "osc" }, b: { name: "Alfa", type: "osc", description: "desc" }, c: { name: "Beta", type: "http" } })
        const filas = [...document.querySelectorAll("p")].map((p) => p.textContent)
        expect(filas).toEqual(["httpBeta", "oscAlfadesc", "oscZeta"])
        fireEvent.click(document.querySelectorAll("[data-title='Borrar']")[0])
        expect(Object.keys(get(emitters)).sort()).toEqual(["a", "b"])
        fireEvent.click(screen.getByText("Alfa"))
        expect(fields["midi.name"].value).toBe("Alfa")
    })

    it("editar_nombre_descripcion_y_tipo_escribe_en_el_store", () => {
        montar({ id: "e1" }, { e1: { name: "Uno", type: "osc" } })
        fire("midi.name", "onChange", "Nuevo")
        fire("midi.description", "onChange", "Algo")
        fire("midi.type", "onChange", "http")
        expect(get(emitters)).toEqual({ e1: { name: "Nuevo", description: "Algo", type: "http" } })
    })

    it("con_plantillas_el_tipo_no_se_puede_cambiar", () => {
        montar({ id: "e1" }, { e1: { name: "Uno", type: "osc", templates: { t: { name: "T", inputs: [] } } } })
        expect(fields["midi.type"].disabled).toBe(true)
    })

    it("la_señal_se_arma_con_los_valores_guardados_y_un_cambio_del_port_se_fusiona", () => {
        montar({ id: "e1" }, { e1: { name: "Uno", type: "osc", signal: { host: "1.1.1.1", port: 5 } } })
        expect(islands.FormInputs.props).toMatchObject({ inputs: [{ id: "host", type: "string", value: "1.1.1.1" }], title: "emitters.signal" })
        expect(typeof islands.FormInputs.props.onChange).toBe("function")
        cambiarSignal({ id: "host", type: "string", value: "9.9.9.9" })
        expect(get(emitters).e1.signal).toEqual({ host: "9.9.9.9", port: 5 })
    })

    it("plantillas_crear_renombrar_agregar_editar_y_quitar_valores_y_ver_la_vista_previa", () => {
        montar({ id: "e1" }, { e1: { name: "Uno", type: "osc", data: "/x" } })
        fireEvent.click(screen.getByText("Agregar"))
        expect(get(emitters).e1.templates).toEqual({ uid1: { name: "", inputs: [] } })

        fire("midi.name", "onChange", "Plantilla")
        fire("midi.description", "onChange", "Desc")
        fireEvent.click(screen.getByText("Agregar"))
        expect(get(emitters).e1.templates?.uid1).toEqual({ name: "Plantilla", description: "Desc", inputs: [{ name: "", value: "" }] })

        fire("inputs.name", "onChange", "Volumen")
        expect(get(emitters).e1.templates?.uid1.inputs).toEqual([{ name: "Volumen", value: "" }])
        expect(document.body.textContent).toContain("dyn(/x|Volumen={volumen})")

        fire("variables.value", "onChange", "5")
        expect(get(emitters).e1.templates?.uid1.inputs).toEqual([{ name: "Volumen", value: "5" }])
        expect(document.body.textContent).toContain("/x|Volumen=5")

        fireEvent.click(btn("Borrar"))
        expect(get(emitters).e1.templates?.uid1.inputs).toEqual([])
    })

    it("borrar_una_plantilla_y_volver_desde_la_plantilla", () => {
        const { container } = montar({ id: "e1" }, { e1: { name: "Uno", type: "osc", templates: { t: { name: "T", inputs: [] } } } })
        fireEvent.click(btn("Borrar"))
        expect(get(emitters).e1.templates).toEqual({})
        fireEvent.click(screen.getByText("Agregar"))
        expect(fields["midi.description"]).toBeTruthy()
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(container.querySelector("[data-isla='FormInputs']")).toBeTruthy()
    })

    it("plantilla_midi_usa_MidiValues_y_guarda_los_valores_en_la_primera_entrada", () => {
        montar({ id: "m1" }, { m1: { name: "Midi", type: "midi", signal: { output: "A" }, templates: { t: { name: "T", inputs: [] } } } })
        fireEvent.click(screen.getByText("T"))
        expect(islands.MidiValues.props).toMatchObject({ value: { output: "A", values: {} }, type: "emitter" })
        cambiarMidi({ values: { note: 60, velocity: 1, channel: 2 } })
        expect(get(emitters).m1.templates?.t.inputs).toEqual([{ name: "", value: { note: 60, velocity: 1, channel: 2 } }])
    })

    it("midi_pide_las_salidas_una_vez_las_ofrece_y_pone_la_primera_si_no_hay_salida", () => {
        montar({ id: "m1" }, { m1: { name: "Midi", type: "midi" } })
        expect(requestMain).toHaveBeenCalledTimes(1)
        expect(vi.mocked(requestMain).mock.calls[0].slice(0, 2)).toEqual([Main.GET_MIDI_OUTPUTS, undefined])
        const callback = vi.mocked(requestMain).mock.calls[0][2] as (data: { name: string }[]) => void
        act(() => callback([{ name: "A" }, { name: "B" }]))
        expect((islands.FormInputs.props.inputs as { options: unknown }[])[0].options).toEqual([
            { value: "A", label: "A", name: "A" },
            { value: "B", label: "B", name: "B" }
        ])
        expect(get(emitters).m1.signal).toEqual({ output: "A" })
        expect(requestMain).toHaveBeenCalledTimes(1)
    })

    it("midi_con_salida_ya_elegida_no_la_pisa_y_sin_dispositivos_no_hace_nada", () => {
        montar({ id: "m1" }, { m1: { name: "Midi", type: "midi", signal: { output: "Z" } } })
        const callback = vi.mocked(requestMain).mock.calls[0][2] as (data: { name: string }[]) => void
        act(() => callback([]))
        expect(get(emitters).m1.signal).toEqual({ output: "Z" })
        act(() => callback([{ name: "A" }]))
        expect(get(emitters).m1.signal).toEqual({ output: "Z" })
    })

    it("crear_desde_el_desplegable_de_acciones_crea_el_emisor_con_el_nombre_y_volver_restaura_la_acción", () => {
        const actionData = { id: "a1" }
        const { container } = montar({ name: "Mi emisor", actionData })
        expect(get(emitters)).toEqual({ uid1: { name: "Mi emisor", type: "osc" } })
        expect(fields["midi.name"].value).toBe("Mi emisor")
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(get(popupData)).toBe(actionData)
        expect(get(activePopup)).toBe("action")
    })

    it("con_actionData_el_editor_no_tiene_volver_a_la_lista", () => {
        const { container } = montar({ id: "e1", actionData: { id: "a1" } }, { e1: { name: "Uno", type: "osc" } })
        expect(container.querySelectorAll("button.popup-back").length).toBe(1)
    })

    it("volver_del_editor_regresa_a_la_lista", () => {
        const { container } = montar({ id: "e1" }, { e1: { name: "Uno", type: "osc" } })
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("Uno")).toBeTruthy()
    })
})
