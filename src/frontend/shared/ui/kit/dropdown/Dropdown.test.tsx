// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Option } from "../../../../../types/Main"
import { dictionary } from "../../../core/stores"
import { fireWheel } from "../../../test/fireWheel"
import { commonMock } from "../../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../test/storeTestKit"
import { Dropdown } from "./Dropdown"
import styles from "./Dropdown.module.css"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const opciones: Option[] = [
    { name: "uno", id: "1" },
    { name: "dos", id: "2", extra: "x" },
    { name: "tres", id: "3", extraInfo: "info", style: "font-weight: bold; --mi-var: 3" }
]

describe("Dropdown", () => {
    it("renderiza_lo_principal", () => {
        render(<Dropdown options={opciones} value="dos" />)
        expect(screen.getByRole("button").textContent).toBe("dos")
        expect(screen.queryAllByRole("option")).toHaveLength(0)
    })

    it("sin_value_muestra_la_primera_opcion", () => {
        render(<Dropdown options={opciones} value="" />)
        expect(screen.getByRole("button").textContent).toBe("uno")
    })

    it("traduce_el_valor_y_las_opciones", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { menu: { uno: "Uno!" } })])
        render(<Dropdown options={[{ name: "menu.uno" }]} value="menu.uno" />)
        expect(screen.getByRole("button").textContent).toBe("Uno!")
        fireEvent.click(screen.getByRole("button"))
        expect(screen.getByRole("option").textContent).toBe("Uno!")
    })

    it("abre_y_cierra_con_el_boton_y_marca_la_activa", () => {
        render(<Dropdown options={opciones} value="dos" title="tip" />)
        const boton = screen.getByRole("button")
        expect(boton.getAttribute("data-title")).toBe("tip")
        fireEvent.click(boton)
        const items = screen.getAllByRole("option")
        expect(items).toHaveLength(3)
        expect(items[1].getAttribute("aria-selected")).toBe("true")
        expect(items[1].classList.contains(styles.active)).toBe(true)
        expect(items[0].getAttribute("aria-selected")).toBe("false")
        expect(items[1].textContent).toBe("dos (x)")
        expect(items[2].querySelector(`.${styles.extra}`)?.textContent).toBe("info")
        expect(items[2].style.fontWeight).toBe("bold")
        fireEvent.click(boton)
        expect(screen.queryAllByRole("option")).toHaveLength(0)
    })

    it("activeId_manda_sobre_el_nombre", () => {
        render(<Dropdown options={opciones} value="dos" activeId="3" />)
        fireEvent.click(screen.getByRole("button"))
        const items = screen.getAllByRole("option")
        expect(items.map((i) => i.getAttribute("aria-selected"))).toEqual(["false", "false", "true"])
    })

    it("elegir_cierra_y_despacha_onClick_con_la_opcion_a_los_50ms", () => {
        vi.useFakeTimers()
        const onClick = vi.fn()
        render(<Dropdown options={opciones} value="uno" onClick={onClick} />)
        fireEvent.click(screen.getByRole("button"))
        fireEvent.click(screen.getAllByRole("option")[2])
        expect(screen.queryAllByRole("option")).toHaveLength(0)
        expect(onClick).not.toHaveBeenCalled()
        act(() => {
            vi.advanceTimersByTime(50)
        })
        expect(onClick).toHaveBeenCalledWith(opciones[2])
    })

    it("elegir_con_enter_del_teclado", () => {
        vi.useFakeTimers()
        const onClick = vi.fn()
        render(<Dropdown options={opciones} value="uno" onClick={onClick} />)
        fireEvent.click(screen.getByRole("button"))
        fireEvent.keyDown(screen.getAllByRole("option")[1], { key: "Enter" })
        act(() => {
            vi.advanceTimersByTime(50)
        })
        expect(onClick).toHaveBeenCalledWith(opciones[1])
    })

    it("deshabilitado_no_abre", () => {
        const { container } = render(<Dropdown options={opciones} value="uno" disabled />)
        fireEvent.click(screen.getByRole("button"))
        expect(screen.queryAllByRole("option")).toHaveLength(0)
        expect((container.firstChild as HTMLElement).classList.contains(styles.disabled)).toBe(true)
    })

    it("mousedown_afuera_cierra_y_adentro_no", () => {
        render(
            <div>
                <Dropdown options={opciones} value="uno" />
                <p>afuera</p>
            </div>
        )
        fireEvent.click(screen.getByRole("button"))
        fireEvent.mouseDown(screen.getAllByRole("option")[0])
        expect(screen.getAllByRole("option")).toHaveLength(3)
        fireEvent.mouseDown(screen.getByText("afuera"))
        expect(screen.queryAllByRole("option")).toHaveLength(0)
    })

    it("ctrl_wheel_cambia_de_opcion_y_respeta_el_enfriamiento", () => {
        vi.useFakeTimers()
        const onClick = vi.fn()
        render(<Dropdown options={opciones} value="dos" onClick={onClick} />)
        const boton = screen.getByRole("button")
        fireWheel(boton, { deltaY: 10 })
        expect(onClick).not.toHaveBeenCalled()
        expect(fireWheel(boton, { deltaY: 10, ctrlKey: true }).defaultPrevented).toBe(true)
        expect(onClick).toHaveBeenLastCalledWith(opciones[2])
        fireWheel(boton, { deltaY: 10, ctrlKey: true })
        expect(onClick).toHaveBeenCalledTimes(1)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        fireWheel(boton, { deltaY: -10, metaKey: true })
        expect(onClick).toHaveBeenLastCalledWith(opciones[0])
    })

    it("wheel_con_arrow_o_deshabilitado_no_hace_nada", () => {
        const onClick = vi.fn()
        const { unmount } = render(<Dropdown options={opciones} value="dos" onClick={onClick} arrow />)
        fireWheel(screen.getByRole("button"), { deltaY: 10, ctrlKey: true })
        unmount()
        render(<Dropdown options={opciones} value="dos" onClick={onClick} disabled />)
        fireWheel(screen.getByRole("button"), { deltaY: 10, ctrlKey: true })
        expect(onClick).not.toHaveBeenCalled()
    })

    it("banderas_de_forma", () => {
        for (const center of [false, true]) {
            for (const flags of [false, true]) {
                const { container, unmount } = render(<Dropdown options={opciones} value="uno" center={center} flags={flags} className="extra" />)
                const raiz = container.firstChild as HTMLElement
                expect(raiz.classList.contains("dropdownElem")).toBe(true)
                expect(raiz.classList.contains("extra")).toBe(true)
                expect(raiz.classList.contains(styles.center)).toBe(center)
                expect(raiz.classList.contains(styles.flags)).toBe(flags)
                unmount()
            }
        }
        for (const up of [false, true]) {
            for (const arrow of [false, true]) {
                const { unmount } = render(<Dropdown options={opciones} value="uno" up={up} arrow={arrow} />)
                fireEvent.click(screen.getByRole("button"))
                const lista = screen.getAllByRole("option")[0].parentElement as HTMLElement
                expect(lista.classList.contains(styles.up)).toBe(up)
                expect(lista.classList.contains(styles.arrow)).toBe(arrow)
                unmount()
            }
        }
    })

    it("arrow_muestra_el_icono_en_vez_del_texto", () => {
        render(<Dropdown options={opciones} value="uno" arrow />)
        const boton = screen.getByRole("button")
        expect(boton.querySelector("svg")).toBeTruthy()
        expect(boton.textContent).toBe("")
    })

    it("al_desmontar_se_quita_el_mousedown_de_window", () => {
        const quitar = vi.spyOn(window, "removeEventListener")
        const { unmount } = render(<Dropdown options={opciones} value="uno" />)
        unmount()
        expect(quitar.mock.calls.some(([tipo]) => tipo === "mousedown")).toBe(true)
        quitar.mockRestore()
    })
})

describe("Dropdown con transición slide", () => {
    afterEach(() => {
        delete (Element.prototype as { animate?: unknown }).animate
    })

    it("anima_200ms_al_abrir_y_el_panel_sigue_hasta_que_termina_el_cierre", async () => {
        let terminar: () => void = () => {}
        const finished = new Promise<Animation>((resolve) => {
            terminar = () => resolve({} as Animation)
        })
        const animate = vi.fn(() => ({ finished, cancel: vi.fn() }))
        Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate })
        render(<Dropdown options={opciones} value="uno" />)
        fireEvent.click(screen.getByRole("button"))
        expect(screen.getAllByRole("option")).toHaveLength(3)
        expect(animate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 200 }))
        fireEvent.click(screen.getByRole("button"))
        expect(screen.getAllByRole("option")).toHaveLength(3)
        await act(async () => {
            terminar()
        })
        expect(screen.queryAllByRole("option")).toHaveLength(0)
    })
})
