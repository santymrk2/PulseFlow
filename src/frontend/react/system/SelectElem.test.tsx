// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { activeDropId, os, selected } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SelectElem } from "./SelectElem"
import styles from "./SelectElem.module.css"

vi.mock("../../utils/common", () => commonMock())
// SelectElem arrastra (vía helpers) el módulo de audio, que necesita AudioContext/AudioWorkletNode (no existen en happy-dom)
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}
const vacio = storeEntry(selected, { id: null, data: [] })
const darwin = storeEntry(os, { platform: "linux", name: "", arch: "" })
const preparar = (...extra: ReturnType<typeof storeEntry>[]) => (restaurar = setStoresForTest([vacio, darwin, storeEntry(activeDropId, ""), ...extra]))

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const actual = () => get(selected)
const elemento = () => document.querySelector(".selectElem") as HTMLElement

describe("SelectElem", () => {
    it("renderiza_lo_principal", () => {
        preparar()
        render(
            <SelectElem id="show" data={{ id: "a" }} draggable fill className="mia" style={{ color: "red" }}>
                <span>hijo</span>
            </SelectElem>
        )
        expect(screen.getByText("hijo")).toBeTruthy()
        const el = elemento()
        expect(el.id).toBe("show")
        expect(el.getAttribute("data-item")).toBe('{"id":"a"}')
        expect(el.getAttribute("draggable")).toBe("true")
        expect(el.classList.contains("mia")).toBe(true)
        expect(el.classList.contains(styles.fill)).toBe(true)
        expect(el.style.color).toBe("red")
    })

    it("conserva_la_clase_de_menu_contextual", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} className="context #show_tab" />)
        expect(elemento().classList.contains("context")).toBe(true)
        expect(elemento().classList.contains("#show_tab")).toBe(true)
        expect(elemento().classList.contains("selectElem")).toBe(true)
    })

    it("clic_derecho_selecciona_el_dato", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} />)
        fireEvent.mouseDown(elemento(), { button: 2 })
        expect(actual()).toEqual({ id: "show", data: [{ id: "a" }] })
        expect(elemento().classList.contains(styles.isSelected)).toBe(true)
    })

    it("clic_izquierdo_simple_deja_la_seleccion_vacia", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} />)
        fireEvent.mouseDown(elemento(), { button: 0 })
        expect(actual()).toEqual({ id: null, data: [] })
    })

    it("ctrl_clic_agrega_y_ctrl_clic_sobre_seleccionado_quita", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ id: "a" }] }))
        render(<SelectElem id="show" data={{ id: "b" }} />)
        fireEvent.mouseDown(elemento(), { button: 0, ctrlKey: true })
        expect(actual()).toEqual({ id: "show", data: [{ id: "a" }, { id: "b" }] })
        fireEvent.mouseDown(elemento(), { button: 0, ctrlKey: true })
        expect(actual()).toEqual({ id: "show", data: [{ id: "a" }] })
    })

    it("shift_clic_selecciona_el_rango_por_indice", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ index: 0 }] }))
        render(<SelectElem id="show" data={{ index: 3 }} />)
        fireEvent.mouseDown(elemento(), { button: 0, shiftKey: true })
        expect(actual().data).toEqual([{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }])
    })

    it("onlyRightClickSelect_ignora_el_clic_izquierdo", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} onlyRightClickSelect />)
        fireEvent.mouseDown(elemento(), { button: 0 })
        expect(actual().data).toEqual([])
        fireEvent.mouseDown(elemento(), { button: 2 })
        expect(actual()).toEqual({ id: "show", data: [{ id: "a" }] })
    })

    it("selectable_false_no_hace_nada", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} selectable={false} />)
        fireEvent.mouseDown(elemento(), { button: 2 })
        expect(actual().id).toBeNull()
        expect(elemento().classList.contains(styles.isSelected)).toBe(false)
    })

    it("arrastrar_un_elemento_no_seleccionado_lo_selecciona", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} draggable />)
        fireEvent.dragStart(elemento(), { dataTransfer: { effectAllowed: "" } })
        expect(actual()).toEqual({ id: "show", data: [{ id: "a" }] })
    })

    it("mouseenter_con_el_boton_izquierdo_apretado_agrega_a_la_seleccion", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ id: "a" }] }))
        render(<SelectElem id="show" data={{ id: "b" }} />)
        fireEvent.mouseEnter(elemento(), { buttons: 1 })
        expect(actual().data).toEqual([{ id: "a" }, { id: "b" }])
        fireEvent.mouseEnter(elemento(), { buttons: 0 })
        expect(actual().data).toHaveLength(2)
    })

    it("mousedown_fuera_con_el_mismo_id_deselecciona", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ id: "a" }] }))
        render(
            <>
                <SelectElem id="show" data={{ id: "a" }} />
                <p>afuera</p>
            </>
        )
        fireEvent.mouseDown(screen.getByText("afuera"))
        expect(actual()).toEqual({ id: null, data: [] })
    })

    it("mousedown_dentro_de_un_selectElem_no_deselecciona", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ id: "a" }] }))
        render(<SelectElem id="show" data={{ id: "a" }} />)
        fireEvent.mouseDown(elemento(), { button: 0, ctrlKey: false })
        // el clic simple sobre el ya seleccionado no lo quita
        expect(actual().data).toEqual([{ id: "a" }])
    })

    it("al_arrastrar_aparecen_las_zonas_de_soltar_y_dragover_marca_la_zona", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} trigger="column" borders="edges" dropAbove />)
        expect(document.querySelector(".TriggerBlock")).toBeNull()
        act(() => {
            window.dispatchEvent(new Event("dragstart"))
        })
        // over + start + end + between
        expect(document.querySelectorAll(".TriggerBlock")).toHaveLength(4)
        const zona = document.querySelector(`.${styles.trigger}`) as HTMLElement
        expect(zona.classList.contains(styles.column)).toBe(true)
        fireEvent.dragOver(document.querySelectorAll("#end")[0])
        expect(zona.classList.contains(styles.end)).toBe(true)
        expect(get(activeDropId)).toBe(zona.id)
    })

    it("borders_center_dibuja_las_dos_mitades_del_centro", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} trigger="row" borders="center" fileOver />)
        expect(document.querySelector("#start_center")).toBeTruthy()
        expect(document.querySelector("#end_center")).toBeTruthy()
        expect(document.querySelector(`.${styles.row}`)).toBeTruthy()
    })

    it("un_clic_en_la_ventana_oculta_las_zonas_y_limpia_activeDropId", () => {
        preparar()
        render(<SelectElem id="show" data={{ id: "a" }} trigger="column" fileOver />)
        expect(document.querySelector(`.${styles.trigger}`)).toBeTruthy()
        activeDropId.set("otro")
        act(() => {
            window.dispatchEvent(new Event("click"))
        })
        expect(document.querySelector(`.${styles.trigger}`)).toBeNull()
        expect(get(activeDropId)).toBe("")
    })

    it("dragend_en_la_ventana_deja_seleccionado_el_id_vacio_si_era_otro", () => {
        preparar(storeEntry(selected, { id: "slide", data: [{ index: 1 }] }))
        render(<SelectElem id="show" data={{ id: "a" }} />)
        act(() => {
            window.dispatchEvent(new Event("dragend"))
        })
        expect(actual()).toEqual({ id: "show", data: [] })
    })

    it("limpia_los_listeners_de_window_al_desmontar", () => {
        preparar(storeEntry(selected, { id: "show", data: [{ id: "a" }] }))
        const { unmount } = render(<SelectElem id="show" data={{ id: "a" }} />)
        unmount()
        fireEvent.mouseDown(document.body)
        expect(actual().data).toEqual([{ id: "a" }])
    })
})
