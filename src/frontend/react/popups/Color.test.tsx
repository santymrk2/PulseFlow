// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setCalendarColor } from "../../components/drawer/calendar/calendars"
import { history } from "../../components/helpers/history"
import { activePopup, activeProject, activeShow, audioRouting, calendars, dictionary, editingProjectTemplate, effects, globalTags, outputs, overlays, profiles, projects, projectTemplates, selected, showsCache, templates } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Color } from "./Color"

const campo = vi.hoisted(() => ({ props: {} as Record<string, unknown> }))
vi.mock("../../utils/common", () => commonMock())
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => [{ id: "s1" }, { id: "child", type: "child", parent: { id: "s1" } }]) }))
vi.mock("../../components/helpers/shows", () => ({ _show: () => ({ slides: (ids: string[]) => ({ get: () => [ids[0] === "s1" ? "#aabbcc" : ""] }) }) }))
vi.mock("../../components/drawer/calendar/calendars", () => ({ setCalendarColor: vi.fn() }))
vi.mock("../ui/color-field/ColorField", () => ({
    ColorField: (props: { value: string; onInput: (v: string) => void }) => {
        campo.props = props
        return (
            <button data-testid="campo" onClick={() => props.onInput("#123456")}>
                {props.value}
            </button>
        )
    }
}))

let restaurar: () => void = () => {}
function montar(sel: { id: string; data: unknown[] }, extra: ReturnType<typeof looseEntry>[] = []) {
    restaurar = setStoresForTest([looseEntry(selected, sel), looseEntry(activePopup, "color"), looseEntry(dictionary, { menu: { edit: "Editar" } }), ...extra] as never)
    return render(<Color />)
}
const elegir = () => fireEvent.click(screen.getByTestId("campo"))
const UPDATE = (newData: object, id: string, location: object) => ({ id: "UPDATE", newData, oldData: { id }, location })
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Color", () => {
    it("renderiza_el_campo_siempre_visible_y_el_boton_editar_abre_manage_colors", () => {
        montar({ id: "overlay", data: ["o1"] }, [looseEntry(overlays, { o1: { color: "#ff0000" } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#ff0000")
        expect(campo.props).toMatchObject({ label: "", alwaysVisible: true, allowEmpty: false })
        fireEvent.click(document.querySelector("[data-title='Editar']") as HTMLElement)
        expect(get(activePopup)).toBe("manage_colors")
    })

    it("allowEmpty_solo_para_show_y_canal_de_audio", () => {
        montar({ id: "show", data: [{ index: 0 }] })
        expect(campo.props.allowEmpty).toBe(true)
        cleanup()
        restaurar()
        montar({ id: "audio_channel", data: [{ id: "c1" }] })
        expect(campo.props.allowEmpty).toBe(true)
    })

    it("overlay_plantilla_y_efecto_guardan_con_history", () => {
        montar({ id: "overlay", data: ["o1", "o2"] }, [looseEntry(overlays, { o1: {}, o2: {} })] as never)
        elegir()
        expect(history).toHaveBeenCalledWith(UPDATE({ key: "color", data: "#123456" }, "o1", { page: "drawer", id: "overlay_color", override: "color" }))
        expect(history).toHaveBeenCalledWith(UPDATE({ key: "color", data: "#123456" }, "o2", { page: "drawer", id: "overlay_color", override: "color" }))
        cleanup()
        restaurar()
        vi.clearAllMocks()
        montar({ id: "template", data: ["t1"] }, [looseEntry(templates, { t1: { color: "#111111" } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#111111")
        elegir()
        expect(history).toHaveBeenCalledWith(UPDATE({ key: "color", data: "#123456" }, "t1", { page: "drawer", id: "template_color", override: "color" }))
        cleanup()
        restaurar()
        vi.clearAllMocks()
        montar({ id: "effect", data: ["e1"] }, [looseEntry(effects, { e1: { color: "#222222" } })] as never)
        elegir()
        expect(history).toHaveBeenCalledWith(UPDATE({ key: "color", data: "#123456" }, "e1", { page: "drawer", id: "effect_key", override: "color" }))
    })

    it("slide_y_grupo_quitan_el_grupo_global_y_guardan_el_color", () => {
        montar({ id: "slide", data: [{ index: 1 }] }, [looseEntry(activeShow, { id: "sh" }), looseEntry(showsCache, { sh: { slides: { s1: { globalGroup: "g" } } } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#aabbcc")
        elegir()
        expect(history).toHaveBeenNthCalledWith(1, { id: "UPDATE", newData: { data: null, key: "slides", keys: ["s1"], subkey: "globalGroup" }, oldData: { id: "sh" }, location: { page: "show", id: "show_key" } })
        expect(history).toHaveBeenNthCalledWith(2, { id: "UPDATE", newData: { data: "#123456", key: "slides", keys: ["s1"], subkey: "color" }, oldData: { id: "sh" }, location: { page: "show", id: "show_key", override: "color" } })
        cleanup()
        restaurar()
        vi.clearAllMocks()
        montar({ id: "group", data: [{ id: "s1" }] }, [looseEntry(activeShow, { id: "sh" }), looseEntry(showsCache, { sh: { slides: { s1: {} } } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#aabbcc")
        elegir()
        expect(history).toHaveBeenCalledTimes(1)
    })

    it("salida_perfil_y_etiqueta_escriben_el_color_en_su_store", () => {
        montar({ id: "output", data: [{ id: "out1" }] }, [looseEntry(outputs, { out1: { color: "#333333" } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#333333")
        elegir()
        expect(get(outputs).out1.color).toBe("#123456")
        cleanup()
        restaurar()
        montar({ id: "profile", data: [{ id: "p1" }, { id: "nope" }] }, [looseEntry(profiles, { p1: {} })] as never)
        elegir()
        expect(get(profiles)).toEqual({ p1: { color: "#123456" } })
        cleanup()
        restaurar()
        montar({ id: "tag", data: [{ id: "g1" }] }, [looseEntry(globalTags, { g1: { name: "T", color: "#444444" } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#444444")
        elegir()
        expect(get(globalTags).g1.color).toBe("#123456")
    })

    it("show_actualiza_el_proyecto_activo_o_la_plantilla_y_su_modified", () => {
        vi.spyOn(Date, "now").mockReturnValue(1234)
        montar({ id: "show", data: [{ index: 1 }] }, [looseEntry(activeProject, "p1"), looseEntry(editingProjectTemplate, ""), looseEntry(projects, { p1: { shows: [{ id: "a" }, { id: "b", color: "#555555" }] } })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#555555")
        elegir()
        expect(get(projects).p1.shows[1].color).toBe("#123456")
        expect(get(projects).p1.modified).toBe(1234)
        cleanup()
        restaurar()
        montar({ id: "show", data: [{ index: 0 }] }, [looseEntry(editingProjectTemplate, "pt"), looseEntry(projectTemplates, { pt: { shows: [{ id: "a" }] } })] as never)
        elegir()
        expect(get(projectTemplates).pt.shows[0].color).toBe("#123456")
        vi.restoreAllMocks()
    })

    it("canal_de_audio_cambia_el_color_y_borra_outputLink", () => {
        montar({ id: "audio_channel", data: [{ id: "c1" }] }, [looseEntry(audioRouting, { channels: [{ id: "c1", color: "#666666", outputLink: "x" }] })] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#666666")
        elegir()
        expect(get(audioRouting)?.channels[0]).toEqual({ id: "c1", color: "#123456" })
    })

    it("calendario_usa_setCalendarColor_con_el_origen", () => {
        montar({ id: "calendar", data: [{ id: "origen", color: "#777777" }] }, [looseEntry(calendars, {})] as never)
        expect(screen.getByTestId("campo").textContent).toBe("#777777")
        elegir()
        expect(setCalendarColor).toHaveBeenCalledWith("origen", "#123456")
    })

    it("sin_seleccion_conocida_el_valor_inicial_es_blanco_y_elegir_no_escribe", () => {
        montar({ id: "nada", data: [] })
        expect(screen.getByTestId("campo").textContent).toBe("#FFFFFF")
        elegir()
        expect(history).not.toHaveBeenCalled()
    })
})
