// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actionTags, activeActionTagFilter, activeMediaTagFilter, activePlayerTagFilter, activeTagFilter, activeTimerTagFilter, globalTags, mediaTags, playerTags, popupData, timerTags, variableTags } from "../../stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ManageTags } from "./ManageTags"

vi.mock("../../utils/common", () => commonMock())
vi.mock("uid", () => ({ uid: () => "nuevo" }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/color-field/ColorField", async () => ({ ColorField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(etiquetas: object, popup: object = {}) {
    restaurar = setStoresForTest([looseEntry(globalTags, etiquetas), looseEntry(popupData, popup), looseEntry(activeTagFilter, ["f"]), looseEntry(activeMediaTagFilter, ["f"]), looseEntry(activePlayerTagFilter, ["f"]), looseEntry(activeActionTagFilter, ["f"]), looseEntry(activeTimerTagFilter, ["f"])])
    return render(<ManageTags />)
}
const filas = () => [...document.querySelectorAll("[data-field='inputs.name']")]
const nombres = () => filas().map((el) => el.getAttribute("data-value"))
const nueva = () => screen.getByText("[meta.new_tag]").closest("button") as HTMLButtonElement
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageTags", () => {
    it("lista_las_etiquetas_de_show_ordenadas_por_nombre_con_su_color", () => {
        montar({ b: { name: "Beta", color: "#222222" }, a: { name: "Alfa", color: "#111111" } })
        expect(nombres()).toEqual(["Alfa", "Beta"])
        expect(fields["edit.color"]).toMatchObject({ noLabel: true, value: "#222222" })
    })

    it("sin_etiquetas_muestra_vacio", () => {
        montar({})
        expect(screen.getByText("[empty.general]")).toBeTruthy()
        expect(nueva().disabled).toBe(false)
    })

    it("el_tipo_viene_de_popupData_y_usa_el_store_de_ese_tipo", () => {
        montar({}, { type: "media" })
        mediaTags.set({ m: { name: "Media uno", color: "#333333" } })
        cleanup()
        render(<ManageTags />)
        expect(nombres()).toEqual(["Media uno"])
        mediaTags.set({})
    })

    it("un_tipo_desconocido_no_lista_nada_y_no_escribe", () => {
        montar({ a: { name: "Alfa", color: "#111111" } }, { type: "otro" })
        expect(nombres()).toEqual([])
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })

    it("crear_agrega_una_etiqueta_vacia_blanca_con_foco_y_bloquea_crear_otra", () => {
        montar({ a: { name: "Alfa", color: "#111111" } })
        fireEvent.click(nueva())
        expect(get(globalTags).nuevo).toEqual({ name: "", color: "#ffffff" })
        expect(nombres()).toEqual(["Alfa", ""])
        expect(fields["inputs.name"].autofocus).toBe(true)
        expect(nueva().disabled).toBe(true)
    })

    it("editar_nombre_y_color_escribe_el_store_y_re_crea_las_filas_como_key", () => {
        montar({ a: { name: "Alfa", color: "#111111" } })
        const antes = filas()[0]
        fire("inputs.name", "onChange", "Alfa 2")
        expect(get(globalTags).a).toEqual({ name: "Alfa 2", color: "#111111" })
        expect(filas()[0]).not.toBe(antes)
        expect(nombres()).toEqual(["Alfa 2"])
        fire("edit.color", "onChange", "#999999")
        expect(get(globalTags).a).toEqual({ name: "Alfa 2", color: "#999999" })
    })

    it("borrar_saca_la_etiqueta_y_limpia_el_filtro_activo_del_tipo", () => {
        montar({ a: { name: "Alfa", color: "#111111" } })
        fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
        expect(get(globalTags)).toEqual({})
        expect(get(activeTagFilter)).toEqual([])
        expect(get(activeMediaTagFilter)).toEqual(["f"])
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })

    it.each([
        ["media", mediaTags, activeMediaTagFilter],
        ["player", playerTags, activePlayerTagFilter],
        ["action", actionTags, activeActionTagFilter],
        ["timer", timerTags, activeTimerTagFilter]
    ] as const)("borrar_en_%s_limpia_solo_su_filtro", (type, store, filtro) => {
        montar({}, { type })
        store.set({ x: { name: "X", color: "#000000" } })
        cleanup()
        render(<ManageTags />)
        fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
        expect(get(store)).toEqual({})
        expect(get(filtro)).toEqual([])
        expect(get(activeTagFilter)).toEqual(["f"])
    })

    it("borrar_una_variable_no_limpia_ningun_filtro", () => {
        montar({}, { type: "variable" })
        variableTags.set({ x: { name: "X", color: "#000000" } })
        cleanup()
        render(<ManageTags />)
        fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
        expect(get(variableTags)).toEqual({})
        expect(get(activeTagFilter)).toEqual(["f"])
        expect(get(activeMediaTagFilter)).toEqual(["f"])
        variableTags.set({})
    })
})
