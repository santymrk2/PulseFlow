// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireWheel } from "../../test/fireWheel"
import { commonMock } from "../../test/mockCommon"
import { ZoomControl } from "./ZoomControl"
import styles from "./ZoomControl.module.css"

vi.mock("../../../utils/common", () => commonMock())

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

const abrir = () => fireEvent.click(screen.getAllByRole("button")[0])
const popup = () => document.querySelector(".zoom_popup")

describe("ZoomControl", () => {
    it("renderiza_lo_principal_cerrado_y_con_ids_globales", () => {
        const { container } = render(<ZoomControl columns={4} />)
        const raiz = container.firstChild as HTMLElement
        expect(raiz.id.startsWith("zoom_")).toBe(true)
        expect(raiz.classList.contains("zoom_container")).toBe(true)
        expect(popup()).toBeNull()
    })

    it("hidden_aplica_la_clase", () => {
        for (const hidden of [false, true]) {
            const { container, unmount } = render(<ZoomControl columns={4} hidden={hidden} />)
            expect((container.firstChild as HTMLElement).classList.contains(styles.hidden)).toBe(hidden)
            unmount()
        }
    })

    it("abre_el_popup_con_el_porcentaje_y_clases_globales", () => {
        render(<ZoomControl columns={4} />)
        abrir()
        expect(popup()?.classList.contains("overflow")).toBe(true)
        expect(screen.getByText("25%")).toBeTruthy()
        expect(screen.getAllByRole("button")).toHaveLength(4)
    })

    it("con_addValue_negativo_el_porcentaje_es_columns_x_100", () => {
        render(<ZoomControl columns={2} addValue={-1} min={1} max={5} />)
        abrir()
        expect(screen.getByText("200%")).toBeTruthy()
    })

    it("mousedown_afuera_cierra_y_adentro_o_en_un_boton_no", () => {
        render(
            <div>
                <ZoomControl columns={4} />
                <p>afuera</p>
            </div>
        )
        abrir()
        fireEvent.mouseDown(screen.getByText("25%"))
        expect(popup()).toBeTruthy()
        fireEvent.mouseDown(screen.getAllByRole("button")[0])
        expect(popup()).toBeTruthy()
        fireEvent.mouseDown(screen.getByText("afuera"))
        expect(popup()).toBeNull()
    })

    it("mas_y_menos_despachan_onChange_acotado", () => {
        const onChange = vi.fn()
        render(<ZoomControl columns={4} min={2} max={5} onChange={onChange} />)
        abrir()
        const [, , , menosZoom] = screen.getAllByRole("button")
        const [, , masZoom] = screen.getAllByRole("button")
        // el botón "+" (add) es zoomIn: decrementa columnas; "-" (remove) las aumenta
        fireEvent.click(masZoom)
        expect(onChange).toHaveBeenLastCalledWith(3)
        fireEvent.click(menosZoom)
        expect(onChange).toHaveBeenLastCalledWith(5)
    })

    it("deshabilita_los_botones_en_los_limites", () => {
        const { rerender } = render(<ZoomControl columns={2} min={2} max={10} />)
        abrir()
        expect((screen.getAllByRole("button")[2] as HTMLButtonElement).disabled).toBe(true)
        expect((screen.getAllByRole("button")[3] as HTMLButtonElement).disabled).toBe(false)
        rerender(<ZoomControl columns={10} min={2} max={10} />)
        expect((screen.getAllByRole("button")[2] as HTMLButtonElement).disabled).toBe(false)
        expect((screen.getAllByRole("button")[3] as HTMLButtonElement).disabled).toBe(true)
    })

    it("reset_despacha_el_default_y_valores_cercanos_a_1_se_fijan_en_1", () => {
        const onChange = vi.fn()
        const { rerender } = render(<ZoomControl columns={6} defaultValue={4} onChange={onChange} />)
        abrir()
        fireEvent.click(screen.getAllByRole("button")[1])
        expect(onChange).toHaveBeenLastCalledWith(4)
        rerender(<ZoomControl columns={6} defaultValue={1.005} min={0} onChange={onChange} />)
        fireEvent.click(screen.getAllByRole("button")[1])
        expect(onChange).toHaveBeenLastCalledWith(1)
    })

    it("ctrl_wheel_sobre_el_contenedor_despacha_origin_y_change_una_vez_por_enfriamiento", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const onOrigin = vi.fn()
        const { container } = render(<ZoomControl columns={4} onChange={onChange} onOrigin={onOrigin} />)
        // el wheel llega con el target en un ancestro que contiene al zoom (querySelector del target)
        const raiz = container
        fireWheel(raiz, { deltaY: 10 })
        expect(onChange).not.toHaveBeenCalled()
        fireWheel(raiz, { deltaY: 10, ctrlKey: true, clientX: 7, clientY: 9 })
        expect(onOrigin).toHaveBeenCalledWith({ x: 7, y: 9 })
        expect(onChange).toHaveBeenLastCalledWith(5)
        fireWheel(raiz, { deltaY: 10, ctrlKey: true })
        expect(onChange).toHaveBeenCalledTimes(1)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        fireWheel(raiz, { deltaY: -10, metaKey: true })
        expect(onChange).toHaveBeenLastCalledWith(3)
    })

    it("wheel_sobre_algo_que_no_contiene_el_zoom_se_ignora", () => {
        const onChange = vi.fn()
        render(
            <div>
                <ZoomControl columns={4} onChange={onChange} />
                <p>otro</p>
            </div>
        )
        fireWheel(screen.getByText("otro"), { deltaY: 10, ctrlKey: true })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("wheel_dentro_de_un_ancestro_center_o_editArea_que_contiene_el_zoom_cuenta", () => {
        const onChange = vi.fn()
        render(
            <div className="editArea">
                <ZoomControl columns={4} onChange={onChange} />
                <p>otro</p>
            </div>
        )
        fireWheel(screen.getByText("otro"), { deltaY: 10, ctrlKey: true })
        expect(onChange).toHaveBeenCalledWith(5)
    })

    it("al_desmontar_se_quitan_los_listeners_de_window", () => {
        const onChange = vi.fn()
        const { container, unmount } = render(<ZoomControl columns={4} onChange={onChange} />)
        const raiz = container
        unmount()
        fireWheel(raiz, { deltaY: 10, ctrlKey: true })
        expect(onChange).not.toHaveBeenCalled()
    })
})
