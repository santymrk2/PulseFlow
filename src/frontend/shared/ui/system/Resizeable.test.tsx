// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "../../core/lib/store"
import { editColumns, localeDirection, resized } from "../../core/stores"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Resizeable } from "./Resizeable"
import styles from "./Resizeable.module.css"

const { empezar, parar } = vi.hoisted(() => ({ empezar: vi.fn(), parar: vi.fn() }))
vi.mock("../../utils/cursor", () => ({ startResizing: empezar, stopResizing: parar }))
vi.mock("../../utils/common", () => ({ DEFAULT_WIDTH: 290 }))

let restaurar: () => void = () => {}
const preparar = (...extra: ReturnType<typeof storeEntry>[]) => (restaurar = setStoresForTest([storeEntry(resized, { panel: 0 }), storeEntry(editColumns, 1), storeEntry(localeDirection, "ltr"), ...extra]))

beforeEach(() => {
    vi.useFakeTimers()
    empezar.mockClear()
    parar.mockClear()
})
afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const panel = () => document.querySelector(".panel") as HTMLElement
const avanzar = (ms: number) =>
    act(() => {
        vi.advanceTimersByTime(ms)
    })
// happy-dom no calcula offsetX/offsetWidth: se fijan en el evento
function mouseDown(el: Element, init: { clientX?: number; offsetX?: number; clientY?: number; offsetY?: number }) {
    const event = new MouseEvent("mousedown", { bubbles: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0 })
    Object.defineProperty(event, "offsetX", { value: init.offsetX ?? 0 })
    Object.defineProperty(event, "offsetY", { value: init.offsetY ?? 0 })
    fireEvent(el, event)
}

describe("Resizeable", () => {
    it("renderiza_lo_principal_con_id_clases_ancho_y_children", () => {
        preparar()
        const { getByText } = render(
            <Resizeable id="panel" defaultWidth={200}>
                {(width) => <span>ancho-{width}</span>}
            </Resizeable>
        )
        expect(getByText("ancho-200")).toBeTruthy()
        expect(panel().id).toBe("panel")
        expect(panel().classList.contains("bar_left")).toBe(true)
        expect(panel().style.width).toBe("200px")
        expect(panel().style.getPropertyValue("--handle-width")).toBe("4px")
    })

    it("children_nodo_y_lado_vertical_usa_height_y_min_height", () => {
        preparar()
        render(
            <Resizeable id="panel" side="bottom" defaultWidth={120}>
                <i>nodo</i>
            </Resizeable>
        )
        expect(panel().classList.contains("bar_bottom")).toBe(true)
        expect(panel().style.height).toBe("120px")
        expect(panel().style.minHeight).toBe("120px")
    })

    it("en_rtl_invierte_izquierda_y_derecha", () => {
        preparar(storeEntry(localeDirection, "rtl"))
        render(<Resizeable id="panel" side="left" />)
        expect(panel().classList.contains("bar_right")).toBe(true)
    })

    it("a_los_2s_toma_el_ancho_guardado_en_resized", () => {
        preparar(storeEntry(resized, { panel: 333 }))
        render(<Resizeable id="panel" defaultWidth={200} maxWidth={500} />)
        avanzar(2000)
        expect(panel().style.width).toBe("333px")
    })

    it("un_panel_lateral_cerrado_al_arrancar_vuelve_al_ancho_por_defecto", () => {
        preparar(storeEntry(resized, { leftPanel: 2 }))
        render(<Resizeable id="leftPanel" defaultWidth={200} />)
        avanzar(2000)
        expect(panel().style.width).toBe("200px")
    })

    it("arrastrar_el_borde_cambia_el_ancho_lo_guarda_en_resized_y_al_soltar_corta_el_cursor", () => {
        preparar()
        render(<Resizeable id="panel" defaultWidth={200} />)
        avanzar(2000)
        mouseDown(panel(), { offsetX: 0, clientX: 200 })
        expect(empezar).toHaveBeenCalledWith("ew-resize")
        fireEvent.mouseMove(window, { clientX: 350 })
        expect(panel().style.width).toBe("350px")
        expect(get(resized).panel).toBe(350)
        fireEvent.mouseUp(window)
        expect(parar).toHaveBeenCalledTimes(1)
        // sin arrastre activo, mover la mano no cambia nada
        fireEvent.mouseMove(window, { clientX: 100 })
        expect(panel().style.width).toBe("350px")
    })

    it("mousedown_lejos_del_borde_no_empieza_a_redimensionar", () => {
        preparar()
        render(<Resizeable id="panel" defaultWidth={200} />)
        // offsetWidth es 0 en happy-dom: 0 - offsetX <= handleWidth sólo falla con offsetX negativo
        mouseDown(panel(), { offsetX: -50 })
        expect(empezar).not.toHaveBeenCalled()
    })

    it("el_ancho_se_ajusta_al_defecto_cerca_de_el_y_al_maximo", () => {
        preparar()
        render(<Resizeable id="panel" defaultWidth={200} maxWidth={440} />)
        avanzar(2000)
        mouseDown(panel(), { offsetX: 0, clientX: 200 })
        fireEvent.mouseMove(window, { clientX: 210 })
        expect(panel().style.width).toBe("200px")
        fireEvent.mouseMove(window, { clientX: 900 })
        expect(panel().style.width).toBe("440px")
        fireEvent.mouseMove(window, { clientX: 10 })
        expect(panel().style.width).toBe("4px")
        fireEvent.mouseUp(window)
    })

    it("al_ancho_minimo_muestra_el_icono_y_la_clase_zero_y_un_clic_lo_reabre", () => {
        preparar(storeEntry(resized, { panel: 4 }))
        render(<Resizeable id="panel" defaultWidth={200} />)
        expect(panel().querySelector("svg")).toBeTruthy()
        expect(panel().classList.contains(styles.zero)).toBe(true)
        expect(panel().style.getPropertyValue("--handle-width")).toBe("6px")
        const clic = new MouseEvent("click", { bubbles: true })
        Object.defineProperty(clic, "offsetX", { value: 0 })
        fireEvent(panel(), clic)
        expect(panel().style.width).toBe("200px")
    })

    it("un_panel_izquierdo_ancho_sube_editColumns_a_3", () => {
        preparar()
        render(<Resizeable id="panel" defaultWidth={200} maxWidth={440} />)
        avanzar(2000) // a 200 de ancho el efecto deja editColumns en 1: se fija en 2 después
        editColumns.set(2)
        mouseDown(panel(), { offsetX: 0, clientX: 200 })
        fireEvent.mouseMove(window, { clientX: 420 })
        expect(get(editColumns)).toBe(3)
        fireEvent.mouseUp(window)
    })

    it("al_desmontar_en_pleno_arrastre_corta_el_cursor_y_quita_los_listeners", () => {
        preparar()
        const { unmount } = render(<Resizeable id="panel" defaultWidth={200} />)
        mouseDown(panel(), { offsetX: 0, clientX: 200 })
        unmount()
        expect(parar).toHaveBeenCalledTimes(1)
        fireEvent.mouseUp(window)
        expect(parar).toHaveBeenCalledTimes(1)
    })
})
