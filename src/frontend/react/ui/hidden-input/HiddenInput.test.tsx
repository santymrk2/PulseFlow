// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeProject, activeRename, dictionary, projectView } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { HiddenInput } from "./HiddenInput"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.useFakeTimers()
    restaurar = setStoresForTest([storeEntry(activeRename, null), storeEntry(activeEdit, { items: [] }), storeEntry(activePage, "show"), storeEntry(projectView, true)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const input = () => document.querySelector("input") as HTMLInputElement
// `change` nativo: el valor se escribe y se dispara el evento como lo hace el navegador al confirmar
const confirmar = (texto: string) => {
    input().value = texto
    fireEvent.change(input())
}

describe("HiddenInput", () => {
    it("renderiza_lo_principal: el texto en un p con id", () => {
        render(<HiddenInput value="Nombre" id="show_1" />)
        const p = screen.getByText("Nombre")
        expect(p.tagName).toBe("P")
        expect(p.id).toBe("show_1")
        expect(p.classList.contains("_rename")).toBe(true)
        expect(input()).toBeNull()
    })

    it("sin_valor_muestra_el_texto_sin_nombre_traducido", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { main: { unnamed: "Sin nombre" } })])
        render(<HiddenInput value="" id="show_1" />)
        expect(screen.getByText("Sin nombre")).toBeTruthy()
    })

    it("recorta_el_valor_fuera_de_edicion", () => {
        render(<HiddenInput value="  hola " id="show_1" />)
        expect(screen.getByText("hola")).toBeTruthy()
    })

    it("mantener_el_click_700ms_sobre_el_texto_pasa_a_edicion_y_avisa", () => {
        const onEditChange = vi.fn()
        render(<HiddenInput value="Nombre" id="show_1" onEditChange={onEditChange} />)
        fireEvent.mouseDown(screen.getByText("Nombre"))
        act(() => void vi.advanceTimersByTime(699))
        expect(input()).toBeNull()
        act(() => void vi.advanceTimersByTime(1))
        expect(get(activeRename)).toBe("show_1")
        expect(input()).not.toBeNull()
        expect(input().value).toBe("Nombre")
        expect(onEditChange).toHaveBeenLastCalledWith("show_1")
    })

    it("soltar_antes_de_700ms_cancela_la_espera", () => {
        render(<HiddenInput value="Nombre" id="show_1" />)
        fireEvent.mouseDown(screen.getByText("Nombre"))
        fireEvent.mouseUp(window)
        act(() => void vi.advanceTimersByTime(1000))
        expect(input()).toBeNull()
    })

    it("allowEdit_false_no_entra_en_edicion", () => {
        render(<HiddenInput value="Nombre" id="show_1" allowEdit={false} />)
        fireEvent.mouseDown(screen.getByText("Nombre"))
        act(() => void vi.advanceTimersByTime(1000))
        expect(input()).toBeNull()
    })

    it("activeRename_con_el_mismo_id_abre_el_input_desde_el_primer_render", () => {
        activeRename.set("show_1")
        render(<HiddenInput value="Nombre" id="show_1" />)
        expect(input()).not.toBeNull()
        act(() => void vi.advanceTimersByTime(10))
        expect(document.activeElement).toBe(input())
    })

    it("change_nativo_emite_edit_con_value_recortado_y_el_id", () => {
        activeRename.set("show_1")
        const onEdit = vi.fn()
        render(<HiddenInput value="Nombre" id="show_1" onEdit={onEdit} />)
        confirmar("  Nuevo ")
        expect(onEdit).toHaveBeenCalledWith({ value: "Nuevo", id: "show_1" })
    })

    it("escribir_no_emite_edit_hasta_el_change", () => {
        activeRename.set("show_1")
        const onEdit = vi.fn()
        render(<HiddenInput value="Nombre" id="show_1" onEdit={onEdit} />)
        fireEvent.input(input(), { target: { value: "Otro" } })
        expect(onEdit).not.toHaveBeenCalled()
    })

    it("allowEmpty_false_no_emite_edit_con_texto_vacio", () => {
        activeRename.set("show_1")
        const onEdit = vi.fn()
        render(<HiddenInput value="Nombre" id="show_1" allowEmpty={false} onEdit={onEdit} />)
        confirmar("   ")
        expect(onEdit).not.toHaveBeenCalled()
    })

    it("Enter_cierra_la_edicion_y_limpia_activeRename", () => {
        activeRename.set("show_1")
        const onEditChange = vi.fn()
        render(<HiddenInput value="Nombre" id="show_1" onEditChange={onEditChange} />)
        fireEvent.keyDown(window, { key: "Enter" })
        expect(get(activeRename)).toBeNull()
        expect(input()).toBeNull()
        expect(onEditChange).toHaveBeenLastCalledWith(false)
    })

    it("Enter_sobre_el_proyecto_renombrado_cierra_projectView", () => {
        activeProject.set("p1")
        activeRename.set("project_p1")
        render(<HiddenInput value="Nombre" id="project_p1" />)
        fireEvent.keyDown(window, { key: "Enter" })
        act(() => void vi.advanceTimersByTime(20))
        expect(get(projectView)).toBe(false)
        activeProject.set(null)
    })

    it("mousedown_afuera_cancela_pero_sobre_el_input_no", () => {
        activeRename.set("show_1")
        render(<HiddenInput value="Nombre" id="show_1" />)
        fireEvent.mouseDown(input())
        expect(input()).not.toBeNull()
        fireEvent.mouseDown(document.body)
        expect(input()).toBeNull()
        expect(get(activeRename)).toBeNull()
    })

    it("la_barra_espaciadora_en_el_input_no_llega_a_window", () => {
        activeRename.set("show_1")
        render(<HiddenInput value="Nombre" id="show_1" />)
        const visto = vi.fn()
        window.addEventListener("keydown", visto)
        fireEvent.keyDown(input(), { key: " " })
        fireEvent.keyDown(input(), { key: "a" })
        window.removeEventListener("keydown", visto)
        expect(visto).toHaveBeenCalledTimes(1)
    })

    it("si_el_nombre_estaba_vacio_y_es_una_plantilla_abre_el_editor", () => {
        activeRename.set("template_t1")
        render(<HiddenInput value="" id="template_t1" />)
        confirmar("Mi plantilla")
        expect(get(activeEdit)).toEqual({ type: "template", id: "t1", items: [] })
        expect(get(activePage)).toBe("edit")
    })

    it("si_el_nombre_estaba_vacio_pero_es_category_no_abre_el_editor", () => {
        activeRename.set("category_template_x")
        render(<HiddenInput value="" id="category_template_x" />)
        confirmar("Cat")
        expect(get(activePage)).toBe("show")
    })

    it("si_ya_tenia_nombre_no_abre_el_editor", () => {
        activeRename.set("template_t1")
        render(<HiddenInput value="Con nombre" id="template_t1" />)
        confirmar("Otro")
        expect(get(activePage)).toBe("show")
    })

    it("dejar_vacio_restaura_el_valor_anterior", () => {
        const { rerender } = render(<HiddenInput value="Nombre" id="show_1" />)
        fireEvent.mouseDown(screen.getByText("Nombre"))
        act(() => void vi.advanceTimersByTime(700))
        fireEvent.keyDown(window, { key: "Enter" })
        rerender(<HiddenInput value="" id="show_1" />)
        expect(screen.getByText("Nombre")).toBeTruthy()
    })
})

describe("HiddenInput (espera de 700ms)", () => {
    it("al_cumplirse_la_espera_usa_el_valor_vigente_y_no_el_del_mousedown", () => {
        const { rerender } = render(<HiddenInput value="Viejo" id="show_1" />)
        fireEvent.mouseDown(screen.getByText("Viejo"))
        rerender(<HiddenInput value="Nuevo" id="show_1" />)
        act(() => void vi.advanceTimersByTime(700))
        expect(input().value).toBe("Nuevo")
    })
})
