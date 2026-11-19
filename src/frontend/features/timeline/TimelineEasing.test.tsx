// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TimelineAction } from "../../../types/Show"
import type { TimelineActions } from "./logic/TimelineActions"
import { TimelineEasing, type TimelineEasingProps } from "./TimelineEasing"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))

const action = (id: string, time: number, value: number): TimelineAction => ({
    id,
    time,
    name: `name.${id}`,
    type: "style",
    data: { key: "opacity", value, indexes: [0] }
})

const actions = [action("a1", 0, 0), action("a2", 1000, 50), action("a3", 2000, 100)]
const groupedActions = [actions]

function makeTimeline() {
    return { updateAction: vi.fn() } as unknown as TimelineActions
}

function renderEasing(overrides: Partial<TimelineEasingProps> = {}) {
    const props: TimelineEasingProps = {
        groupedActions,
        actions,
        selectedActionIds: ["a1", "a2", "a3"],
        selectedItemIndexes: [0],
        activeGroupIndex: 0,
        zoomLevel: 100,
        sectionHeight: 60,
        sectionGap: 10,
        sectionTop: 20,
        onActionDrag: vi.fn(),
        timeline: makeTimeline(),
        ...overrides
    }
    return { ...render(<TimelineEasing {...props} />), props }
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("TimelineEasing", () => {
    it("dibuja la curva y los marcadores con las coordenadas calculadas", () => {
        const { container } = renderEasing()
        const path = container.querySelector("path")!
        expect(path.getAttribute("d")).toContain("M 0,88 C 42,88")
        expect(path.getAttribute("d")).toContain(",48 100,48")
        expect(path.getAttribute("stroke")).toBe("var(--secondary)")

        const markers = [...container.querySelectorAll(".action-marker")]
        expect(markers).toHaveLength(3)
        expect(markers[0].getAttribute("style")).toContain("left: 0px")
        expect(markers[0].getAttribute("style")).toContain("top: 100px")
        expect(markers[2].getAttribute("style")).toContain("top: 20px")
        expect(markers[1].textContent).toContain("50")
    })

    it("no dibuja nada sin grupo activo", () => {
        const { container } = renderEasing({ activeGroupIndex: null })
        expect(container.innerHTML).toBe("")
    })

    it("pide limpiar la selección al hacer click izquierdo en la pista", () => {
        const onClearSelection = vi.fn()
        const { container } = renderEasing({ onClearSelection })
        fireEvent.mouseDown(container.querySelector(".track-header")!, { button: 0 })
        expect(onClearSelection).toHaveBeenCalledTimes(1)
        fireEvent.mouseDown(container.querySelector(".track-header")!, { button: 2 })
        expect(onClearSelection).toHaveBeenCalledTimes(1)
    })

    it("reenvía el arrastre de marcadores con el evento nativo", () => {
        const onActionDrag = vi.fn()
        const { container } = renderEasing({ onActionDrag })
        fireEvent.mouseDown(container.querySelectorAll(".action-marker")[1], { button: 0 })
        expect(onActionDrag).toHaveBeenCalledTimes(1)
        expect(onActionDrag.mock.calls[0][0]).toBeInstanceOf(MouseEvent)
        expect(onActionDrag.mock.calls[0][1]).toBe("a2")
    })

    it("arrastra el pin de entrada y actualiza el easing de la acción siguiente", () => {
        const { container, props } = renderEasing()
        const handle = container.querySelectorAll<HTMLElement>(".easing-control-point")[1]
        fireEvent.mouseDown(handle, { button: 0, clientX: 100, clientY: 100 })
        fireEvent.mouseMove(window, { clientX: 110, clientY: 110 })
        expect(props.timeline.updateAction).toHaveBeenCalledWith("a2", { easing: expect.objectContaining({ y1: 0.75, x2: 0.42, y2: 0 }) })
        expect(vi.mocked(props.timeline.updateAction).mock.calls[0][1].easing?.x1).toBeCloseTo(0.68)

        fireEvent.mouseUp(window)
        vi.mocked(props.timeline.updateAction).mockClear()
        fireEvent.mouseMove(window, { clientX: 120, clientY: 120 })
        expect(props.timeline.updateAction).not.toHaveBeenCalled()
    })

    it("el click medio deja el pin en la posición lineal", () => {
        const { container, props } = renderEasing()
        const handle = container.querySelectorAll<HTMLElement>(".easing-control-point")[0]
        fireEvent.mouseDown(handle, { button: 1 })
        expect(props.timeline.updateAction).toHaveBeenCalledWith("a1", { easing: { x1: 0.58, y1: 1, x2: 0.5, y2: 0.5 } })
    })

    it("aplica el preset lineal a todos los puntos seleccionados visibles y cierra el menú", () => {
        const { container, props } = renderEasing()
        const handle = container.querySelectorAll<HTMLElement>(".easing-control-point")[1]
        fireEvent.mouseDown(handle, { button: 2, clientX: 300, clientY: 200 })
        const menu = container.querySelector(".easing-context-menu")!
        expect(menu).toBeTruthy()

        fireEvent.click([...menu.querySelectorAll("button")][0])
        expect(props.timeline.updateAction).toHaveBeenCalledWith("a2", { easing: { x1: 0.5, y1: 0.5, x2: 0.42, y2: 0 } })
        expect(props.timeline.updateAction).toHaveBeenCalledWith("a3", { easing: { x1: 0.5, y1: 0.5, x2: 0.42, y2: 0 } })
        expect(container.querySelector(".easing-context-menu")).toBeNull()
    })

    it("cierra el menú con Escape y con un click fuera", () => {
        const { container } = renderEasing()
        const handle = container.querySelectorAll<HTMLElement>(".easing-control-point")[0]
        fireEvent.mouseDown(handle, { button: 2, clientX: 300, clientY: 200 })
        expect(container.querySelector(".easing-context-menu")).toBeTruthy()

        fireEvent.keyDown(window, { key: "Escape" })
        expect(container.querySelector(".easing-context-menu")).toBeNull()

        fireEvent.mouseDown(handle, { button: 2, clientX: 300, clientY: 200 })
        fireEvent.click(document.body)
        expect(container.querySelector(".easing-context-menu")).toBeNull()
    })
})
