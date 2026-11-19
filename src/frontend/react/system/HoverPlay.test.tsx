// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { HoverPlay } from "./HoverPlay"
import styles from "./HoverPlay.module.css"

vi.mock("../../shared/utils/common", () => commonMock())

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

describe("HoverPlay", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { media: { play: "Reproducir" } })])
        const { container } = render(
            <HoverPlay icon="play">
                <span>hijo</span>
            </HoverPlay>
        )
        expect(screen.getByText("hijo")).toBeTruthy()
        const root = container.firstElementChild as HTMLElement
        expect(root.getAttribute("data-title")).toBe("Reproducir")
        expect(root.getAttribute("role")).toBe("none")
        expect(container.querySelector(`.${styles.overlay} svg`)).toBeTruthy()
    })

    it("hide_vacia_el_titulo_y_oculta_el_overlay", () => {
        const { container } = render(<HoverPlay icon="play" hide />)
        expect((container.firstElementChild as HTMLElement).getAttribute("data-title")).toBe("")
        expect(container.querySelector(`.${styles.overlay}`)?.classList.contains(styles.hidden)).toBe(true)
    })

    it("el_overlay_nace_revelado_y_a_los_800ms_se_apaga", () => {
        vi.useFakeTimers()
        const { container } = render(<HoverPlay icon="play" />)
        const overlay = () => container.querySelector(`.${styles.overlay}`) as HTMLElement
        expect(overlay().classList.contains(styles.reveal)).toBe(true)
        act(() => {
            vi.advanceTimersByTime(800)
        })
        expect(overlay().classList.contains(styles.reveal)).toBe(false)
    })

    it("reenvia_click_dblclick_mousedown_y_contextmenu_y_los_atributos_restantes", () => {
        const handlers = { onClick: vi.fn(), onDoubleClick: vi.fn(), onMouseDown: vi.fn(), onContextMenu: vi.fn() }
        const { container } = render(<HoverPlay icon="play" className="context #x" style={{ color: "red" }} {...handlers} />)
        const root = container.firstElementChild as HTMLElement
        fireEvent.click(root)
        fireEvent.doubleClick(root)
        fireEvent.mouseDown(root)
        fireEvent.contextMenu(root)
        for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1)
        expect(root.classList.contains("context")).toBe(true)
        expect(root.style.color).toBe("red")
    })
})
