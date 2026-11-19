// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computeDisplayLayout, type LayoutDisplay } from "../../components/screens/displayLayout"
import { DisplayLayout } from "./DisplayLayout"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))

class FakeResizeObserver {
    static instances: FakeResizeObserver[] = []
    observe = vi.fn()
    disconnect = vi.fn()
    constructor(public callback: () => void) {
        FakeResizeObserver.instances.push(this)
    }
}

const pantalla = (id: string, x: number, extra: Partial<LayoutDisplay> = {}): LayoutDisplay => ({ id, label: `Monitor ${id}`, bounds: { x, y: 0, width: 1920, height: 1080 }, ...extra })
const monitores = () => [...document.querySelectorAll('[role="button"]')] as HTMLElement[]

beforeEach(() => {
    FakeResizeObserver.instances = []
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe("DisplayLayout", () => {
    it("renderiza_lo_principal_un_monitor_por_pantalla_con_numero_y_posicion_calculada", () => {
        const displays = [pantalla("a", 0), pantalla("b", 1920)]
        const { container } = render(<DisplayLayout displays={displays} width={400} height={200} />)
        const esperado = computeDisplayLayout(displays, { width: 400, height: 200 })
        expect(monitores()).toHaveLength(2)
        monitores().forEach((m, i) => {
            expect(m.style.left).toBe(`${esperado.displays[i].x}px`)
            expect(m.style.top).toBe(`${esperado.displays[i].y}px`)
            expect(m.style.width).toBe(`${esperado.displays[i].width}px`)
            expect(m.style.height).toBe(`${esperado.displays[i].height}px`)
            expect(m.querySelector("span")?.textContent).toBe(String(esperado.displays[i].number))
        })
        const raiz = container.firstElementChild as HTMLElement
        expect(raiz.style.width).toBe("400px")
        expect(raiz.style.height).toBe("200px")
    })

    it("muestra_nombre_y_resolucion_solo_si_el_monitor_dibujado_es_ancho", () => {
        const { unmount } = render(<DisplayLayout displays={[pantalla("a", 0)]} width={600} height={300} />)
        expect(document.body.textContent).toContain("Monitor a")
        expect(document.body.textContent).toContain("1920×1080")
        unmount()
        render(<DisplayLayout displays={[pantalla("a", 0)]} width={60} height={40} />)
        expect(document.body.textContent).not.toContain("1920×1080")
    })

    it("sin_label_usa_Display_N", () => {
        render(<DisplayLayout displays={[{ id: "a", bounds: { x: 0, y: 0, width: 800, height: 600 } }]} width={600} height={300} />)
        expect(monitores()[0].getAttribute("data-title")).toBe("Display 1")
    })

    it("marca_el_principal_y_el_asignado_con_su_insignia", () => {
        render(<DisplayLayout displays={[pantalla("a", 0, { primary: true }), pantalla("b", 1920)]} assignedId="b" />)
        expect(document.querySelectorAll('[data-title="primary"]')).toHaveLength(1)
        expect(document.querySelectorAll('[data-title="assigned"]')).toHaveLength(1)
        expect(monitores()[0].querySelector('[data-title="primary"]')).toBeTruthy()
        expect(monitores()[1].querySelector('[data-title="assigned"]')).toBeTruthy()
    })

    it("clic_en_un_monitor_llama_a_onSelect_con_ese_monitor", () => {
        const displays = [pantalla("a", 0), pantalla("b", 1920)]
        const onSelect = vi.fn()
        render(<DisplayLayout displays={displays} onSelect={onSelect} />)
        fireEvent.click(monitores()[1])
        expect(onSelect).toHaveBeenCalledWith(displays[1])
    })

    it("enter_y_espacio_seleccionan_y_otras_teclas_no", () => {
        const displays = [pantalla("a", 0)]
        const onSelect = vi.fn()
        render(<DisplayLayout displays={displays} onSelect={onSelect} />)
        fireEvent.keyDown(monitores()[0], { key: "Enter" })
        fireEvent.keyDown(monitores()[0], { key: " " })
        fireEvent.keyDown(monitores()[0], { key: "a" })
        expect(onSelect).toHaveBeenCalledTimes(2)
        expect(onSelect).toHaveBeenCalledWith(displays[0])
    })

    it("con_fill_mide_el_ancho_real_y_guarda_la_proporcion_y_se_desconecta_al_desmontar", () => {
        const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(310)
        const { container, unmount } = render(<DisplayLayout displays={[pantalla("a", 0)]} width={620} height={240} fill />)
        const raiz = container.firstElementChild as HTMLElement
        // alto = round(310 * 240 / 620) = 120; el ancho lo manda el CSS (100%)
        expect(raiz.style.height).toBe("120px")
        expect(raiz.style.width).toBe("")
        expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledTimes(1)

        clientWidth.mockReturnValue(620)
        act(() => FakeResizeObserver.instances[0].callback())
        expect(raiz.style.height).toBe("240px")

        unmount()
        expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)
        clientWidth.mockRestore()
    })

    it("con_fill_y_ancho_medido_cero_usa_el_alto_pedido", () => {
        const { container } = render(<DisplayLayout displays={[pantalla("a", 0)]} width={620} height={240} fill />)
        expect((container.firstElementChild as HTMLElement).style.height).toBe("240px")
    })
})
