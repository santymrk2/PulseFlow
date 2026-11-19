// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DropdownOptions } from "../../../../../types/Input"
import { newDropdown } from "../../../../components/edit/scripts/edit"
import { fireWheel } from "../../../test/fireWheel"
import { commonMock } from "../../../test/mockCommon"
import { SelectField } from "./SelectField"
import styles from "./SelectField.module.css"

vi.mock("../../../utils/common", () => commonMock())
// edit.ts arrastra medio frontend (libraryEditor, drawer…) y acá sólo se necesita el mapa newDropdown
// utils/search.ts importa converters/txt, que arrastra el audio; formatSearch no lo usa
vi.mock("../../../../features/import/txt", () => ({ similarity: () => 0 }))
vi.mock("../../../utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.clearAllMocks()
})

const opciones: DropdownOptions = [
    { value: "a", label: "Alfa" },
    { value: "b", label: "Beta", prefix: "#", data: "info", style: "font-weight: bold" },
    { value: "c", label: "Gamma", icon: "check" }
]
const trigger = () => document.querySelector(".dropdown-trigger") as HTMLElement
const menu = () => document.querySelector(".select-menu") as HTMLElement
const items = () => [...document.querySelectorAll(".select-menu li")] as HTMLElement[]
const raiz = () => document.querySelector(".textfield") as HTMLElement
const abrir = () => fireEvent.click(trigger())

describe("SelectField", () => {
    it("renderiza_lo_principal_con_el_texto_elegido", () => {
        render(<SelectField label="Etiqueta" value="b" options={opciones} id="s" />)
        expect(screen.getByText("Etiqueta").getAttribute("for")).toBe("s")
        expect(trigger().textContent).toContain("Beta")
        expect(trigger().textContent).toContain("#")
        expect(trigger().getAttribute("aria-haspopup")).toBe("listbox")
        expect(trigger().classList.contains("edit")).toBe(true)
        expect(trigger().getAttribute("data-title")).toBe("Etiqueta: <b>Beta</b>")
        expect(menu()).toBeNull()
    })

    it("muestra_el_value_crudo_si_la_opcion_todavia_no_cargo", () => {
        render(<SelectField label="x" value="Fuente" options={[]} />)
        expect(trigger().textContent).toContain("Fuente")
    })

    it("click_abre_el_menu_en_el_body_y_marca_la_elegida", () => {
        render(<SelectField label="x" value="b" options={opciones} />)
        abrir()
        expect(menu().parentElement).toBe(document.body)
        expect(raiz().contains(menu())).toBe(false)
        expect(trigger().getAttribute("aria-expanded")).toBe("true")
        expect(items().map((li) => li.textContent)).toEqual(["Alfa", "#Betainfo", "Gamma"])
        expect(items()[1].classList.contains(styles.selected)).toBe(true)
        expect(items()[1].classList.contains(styles.highlighted)).toBe(true)
    })

    it("elegir_una_opcion_despacha_change_y_cierra", () => {
        const onChange = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} onChange={onChange} />)
        abrir()
        fireEvent.click(items()[2])
        expect(onChange).toHaveBeenCalledWith("c")
        expect(menu()).toBeNull()
        expect(trigger().textContent).toContain("Gamma")
    })

    it("click_afuera_cierra_y_click_dentro_del_menu_no", () => {
        render(<SelectField label="x" value="a" options={opciones} />)
        abrir()
        fireEvent.click(menu())
        expect(menu()).toBeTruthy()
        fireEvent.click(document.body)
        expect(menu()).toBeNull()
    })

    it("disabled_no_abre", () => {
        render(<SelectField label="x" value="a" options={opciones} disabled />)
        abrir()
        expect(menu()).toBeNull()
        expect(trigger().getAttribute("tabindex")).toBeNull()
        expect(raiz().classList.contains(styles.disabled)).toBe(true)
    })

    it("teclado_abre_navega_y_elige", () => {
        const onChange = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} onChange={onChange} />)
        expect(fireEvent.keyDown(trigger(), { key: "ArrowDown" })).toBe(false)
        expect(menu()).toBeTruthy()
        fireEvent.keyDown(trigger(), { key: "ArrowDown" })
        expect(items()[1].classList.contains(styles.highlighted)).toBe(true)
        fireEvent.keyDown(trigger(), { key: "ArrowUp" })
        fireEvent.keyDown(trigger(), { key: "ArrowUp" })
        expect(items()[2].classList.contains(styles.highlighted)).toBe(true) // da la vuelta
        fireEvent.keyDown(trigger(), { key: "Enter" })
        expect(onChange).toHaveBeenCalledWith("c")
        expect(menu()).toBeNull()
    })

    it("Escape_cierra", () => {
        render(<SelectField label="x" value="a" options={opciones} />)
        abrir()
        fireEvent.keyDown(trigger(), { key: "Escape" })
        expect(menu()).toBeNull()
    })

    it("escribir_busca_por_prefijo_y_muestra_el_texto_buscado", () => {
        render(<SelectField label="x" value="a" options={opciones} />)
        abrir()
        fireEvent.keyDown(trigger(), { key: "g" })
        expect(items()[2].classList.contains(styles.highlighted)).toBe(true)
        expect(document.querySelector(`.${styles.search}`)?.textContent).toBe("g")
        fireEvent.keyDown(trigger(), { key: "Backspace" })
        expect(document.querySelector(`.${styles.search}`)).toBeNull()
    })

    it("rueda_con_ctrl_cambia_de_opcion_sin_abrir", () => {
        const onChange = vi.fn()
        render(<SelectField label="x" value="b" options={opciones} onChange={onChange} />)
        fireWheel(trigger(), { deltaY: 100 })
        expect(onChange).not.toHaveBeenCalled()
        const evento = fireWheel(trigger(), { deltaY: 100, ctrlKey: true })
        expect(evento.defaultPrevented).toBe(true)
        expect(onChange).toHaveBeenLastCalledWith("c")
        fireWheel(trigger(), { deltaY: -100, ctrlKey: true })
        expect(onChange).toHaveBeenLastCalledWith("a")
        expect(menu()).toBeNull()
    })

    it("rueda_hacia_arriba_en_la_primera_con_allowEmpty_vacia", () => {
        const onChange = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} allowEmpty onChange={onChange} />)
        fireWheel(trigger(), { deltaY: -100, ctrlKey: true })
        expect(onChange).toHaveBeenCalledWith("")
    })

    it("allowEmpty_agrega_ninguno_y_el_boton_de_borrar", () => {
        const onChange = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} allowEmpty onChange={onChange} />)
        expect(raiz().classList.contains(styles.hasRemove)).toBe(true)
        fireEvent.click(document.querySelector('[data-title="clear.general"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith("")
        expect(raiz().classList.contains(styles.hasRemove)).toBe(false)

        abrir()
        expect(items()).toHaveLength(4)
    })

    it("reset_despacha_change_con_defaultValue_y_deshacer_con_el_anterior", () => {
        const onChange = vi.fn()
        const { rerender } = render(<SelectField label="x" value="c" defaultValue="a" options={opciones} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith("a")
        rerender(<SelectField label="x" value="a" defaultValue="a" options={opciones} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith("c")
    })

    it("allowDeleting_despacha_delete_sin_elegir_la_opcion", () => {
        const onDelete = vi.fn()
        const onChange = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} allowDeleting onDelete={onDelete} onChange={onChange} />)
        abrir()
        // la elegida no tiene botón de borrar
        expect(items()[0].querySelector(".delete-button")).toBeNull()
        fireEvent.click(items()[1].querySelector(".delete-button") as HTMLElement)
        expect(onDelete).toHaveBeenCalledWith("b")
        expect(onChange).not.toHaveBeenCalled()
    })

    it("addNew_con_accion_registrada_la_ejecuta", () => {
        render(<SelectField label="x" value="a" options={opciones} addNew="new.timer" />)
        abrir()
        fireEvent.click(items()[3])
        expect(newDropdown["new.timer"]).toHaveBeenCalledTimes(1)
    })

    it("addNew_sin_accion_abre_el_cuadro_y_Enter_despacha_new", () => {
        const onNew = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} addNew="main.new" onNew={onNew} />)
        abrir()
        fireEvent.click(items()[3])
        expect(menu()).toBeNull()
        const campo = document.querySelector(`.${styles.inline} input`) as HTMLInputElement
        expect(campo).toBeTruthy()
        fireEvent.input(campo, { target: { value: "Nuevo" } })
        fireEvent.keyDown(campo, { key: "Enter" })
        expect(onNew).toHaveBeenCalledWith("Nuevo")
        expect(document.querySelector(`.${styles.inline}`)).toBeNull()
    })

    it("addNew_el_boton_check_despacha_new_con_el_texto", () => {
        const onNew = vi.fn()
        render(<SelectField label="x" value="a" options={opciones} addNew="main.new" onNew={onNew} />)
        abrir()
        fireEvent.click(items()[3])
        const boton = () => document.querySelector(`.${styles.inline} [data-title="main.new"]`) as HTMLButtonElement
        expect(boton().disabled).toBe(true)
        fireEvent.input(document.querySelector(`.${styles.inline} input`) as HTMLInputElement, { target: { value: "Otro" } })
        expect(boton().disabled).toBe(false)
        fireEvent.click(boton())
        expect(onNew).toHaveBeenCalledWith("Otro")
    })

    it("onlyArrow_oculta_el_texto_y_la_etiqueta", () => {
        render(<SelectField label="Etiqueta" value="a" options={opciones} onlyArrow />)
        expect(screen.queryByText("Etiqueta")).toBeNull()
        expect(trigger().textContent).toBe("")
        expect(raiz().classList.contains(styles.onlyArrow)).toBe(true)
    })

    it("flags_aplica_la_clase", () => {
        render(<SelectField label="x" value="a" options={opciones} flags />)
        expect(raiz().classList.contains(styles.flags)).toBe(true)
    })

    it("mas_de_100_opciones_usa_la_lista_virtual_con_ventana", () => {
        const muchas: DropdownOptions = Array.from({ length: 500 }, (_, i) => ({ value: `v${i}`, label: `Opción ${i}` }))
        // happy-dom no hace layout: el viewport mide lo que dice su style.height y cada fila 28 px
        vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
            return this.style.height ? parseInt(this.style.height) : 28
        })
        const onChange = vi.fn()
        render(<SelectField label="x" value="v250" options={muchas} onChange={onChange} />)
        abrir()
        expect(menu().classList.contains(styles.virtual)).toBe(true)
        expect(items().length).toBeLessThan(60)
        expect(items()[0].textContent).toBe("Opción 0")
        const viewport = menu().querySelector(`.${styles.viewport}`) as HTMLElement
        Object.defineProperty(viewport, "scrollTop", { value: 28 * 100, configurable: true })
        fireEvent.scroll(viewport)
        expect(items().map((li) => li.textContent)).toContain("Opción 100")
        fireEvent.click(items().find((li) => li.textContent === "Opción 100") as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("v100")
    })

    it("la_prop_value_del_padre_manda_cuando_cambia", () => {
        const { rerender } = render(<SelectField label="x" value="a" options={opciones} />)
        abrir()
        fireEvent.click(items()[2])
        rerender(<SelectField label="x" value="a" options={opciones} />)
        expect(trigger().textContent).toContain("Gamma")
        rerender(<SelectField label="x" value="b" options={opciones} />)
        expect(trigger().textContent).toContain("Beta")
    })

    it("al_desmontar_se_quitan_los_listeners_de_documento", () => {
        const remover = vi.spyOn(document, "removeEventListener")
        const { unmount } = render(<SelectField label="x" value="a" options={opciones} />)
        unmount()
        expect(remover).toHaveBeenCalledWith("click", expect.any(Function))
    })
})
