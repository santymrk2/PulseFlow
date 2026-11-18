// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { throttle } from "../../utils/common"
import { stopResizing } from "../../utils/cursor"
import { getOutputResolution } from "../../components/helpers/output"
import { shouldStartDrag } from "../../components/system/dragThreshold"
import { getRadius, moveBox, resizeBox, rotateBox } from "../../components/system/textbox"
import { Snaplines, type Snapline, type SnaplinesMouse } from "./Snaplines"

vi.mock("../../stores", () => ({
    outputs: {
        subscribe: (run: (value: Record<string, unknown>) => void) => {
            run({})
            return () => {}
        }
    }
}))
vi.mock("../../utils/common", () => ({ throttle: vi.fn((_id: string, value: unknown, callback: (v: unknown) => void) => callback(value)) }))
vi.mock("../../utils/cursor", () => ({ stopResizing: vi.fn(), startResizing: vi.fn() }))
vi.mock("../../components/helpers/output", () => ({
    DEFAULT_BOUNDS: { width: 1920, height: 1080 },
    getActiveOutputs: vi.fn(() => ["out1"]),
    getOutputResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))
vi.mock("../../components/system/dragThreshold", () => ({ shouldStartDrag: vi.fn(() => true) }))
vi.mock("../../components/system/textbox", () => ({
    moveBox: vi.fn(() => ({ styles: {}, lines: [] })),
    resizeBox: vi.fn(() => ({ left: 10, top: 20, width: 100, height: 50 })),
    rotateBox: vi.fn(() => 90),
    getRadius: vi.fn(() => 42)
}))

function createMouse(classes: string[] = []): SnaplinesMouse {
    const target = {
        closest: (selector: string) => {
            const names = selector
                .split(",")
                .map((part) => part.trim())
                .filter((part) => part.startsWith("."))
                .map((part) => part.slice(1))
            return names.some((name) => classes.includes(name)) ? ({ classList: ["square", "br"] } as unknown as Element) : null
        }
    }
    return {
        x: 10,
        y: 10,
        left: 100,
        top: 50,
        width: 200,
        height: 100,
        offset: { x: 0, y: 0, width: 0, height: 0 },
        item: { type: "text" },
        e: { target, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, buttons: 1 } as unknown as MouseEvent
    }
}

function renderSnaplines(props: Partial<Parameters<typeof Snaplines>[0]> = {}) {
    const onLinesChange = vi.fn()
    const onMouseChange = vi.fn()
    const onNewStylesChange = vi.fn()
    const lines: Snapline[] = props.lines ?? []
    const view = render(<Snaplines lines={lines} mouse={props.mouse ?? null} newStyles={props.newStyles ?? {}} ratio={props.ratio ?? 1} active={props.active ?? ["i1"]} isStage={props.isStage} onLinesChange={onLinesChange} onMouseChange={onMouseChange} onNewStylesChange={onNewStylesChange} />)
    return { ...view, onLinesChange, onMouseChange, onNewStylesChange }
}

beforeEach(() => {
    vi.mocked(shouldStartDrag).mockReturnValue(true)
    vi.mocked(moveBox).mockReturnValue({ styles: {}, lines: [] } as never)
    vi.mocked(getOutputResolution).mockReturnValue({ width: 1920, height: 1080 } as never)
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Snaplines", () => {
    it("renderiza las guías con posición, grosor y transform según orientación", () => {
        const { container } = renderSnaplines({
            lines: [
                ["x", 100],
                ["xc", 200],
                ["y", 300],
                ["yc", 400]
            ],
            ratio: 2
        })
        const rendered = container.querySelectorAll(".line")
        expect(rendered).toHaveLength(4)
        expect(rendered[0].className).toContain("x")
        expect(rendered[0].getAttribute("style")).toContain("left: 100px")
        expect(rendered[0].getAttribute("style")).toContain("width: 0.625px")
        expect(rendered[0].getAttribute("style")).toContain("height: 100%")
        expect(rendered[0].getAttribute("style")).toContain("translateX(-50%)")
        expect(rendered[1].getAttribute("style")).toContain("width: 1.25px")
        expect(rendered[2].getAttribute("style")).toContain("top: 300px")
        expect(rendered[2].getAttribute("style")).toContain("translateY(-50%)")
    })

    it("ignora el movimiento sin mouse o con click derecho", () => {
        const { onLinesChange } = renderSnaplines()
        fireEvent.mouseMove(window, { clientX: 20 })
        expect(moveBox).not.toHaveBeenCalled()
        expect(onLinesChange).not.toHaveBeenCalled()

        cleanup()
        const right = renderSnaplines({ mouse: { ...createMouse(), rightClick: true } })
        fireEvent.mouseMove(window, { clientX: 20 })
        expect(moveBox).not.toHaveBeenCalled()
        expect(right.onLinesChange).not.toHaveBeenCalled()
    })

    it("mueve el cuadro al superar el umbral de drag desde el texto", () => {
        const mouse = createMouse(["edit"])
        const { onMouseChange, onLinesChange, onNewStylesChange } = renderSnaplines({ mouse, ratio: 2 })
        fireEvent.mouseMove(window, { clientX: 30, clientY: 40 })

        expect(shouldStartDrag).toHaveBeenCalledWith(10, 10, 30, 40)
        expect(mouse.dragMove).toBe(true)
        expect(onMouseChange).toHaveBeenCalledWith(mouse)
        expect(moveBox).toHaveBeenCalledWith(expect.anything(), mouse, 2, ["i1"], [])
        expect(onLinesChange).toHaveBeenCalledWith([])
        expect(onNewStylesChange).toHaveBeenCalledWith({})
        expect(throttle).toHaveBeenCalledWith("EDIT_ITEM_MOVE", {}, expect.any(Function), 50)
    })

    it("no inicia el drag desde texto por debajo del umbral", () => {
        vi.mocked(shouldStartDrag).mockReturnValue(false)
        const { onMouseChange } = renderSnaplines({ mouse: createMouse(["edit"]) })
        fireEvent.mouseMove(window, { clientX: 11, clientY: 11 })
        expect(moveBox).not.toHaveBeenCalled()
        expect(onMouseChange).not.toHaveBeenCalled()
    })

    it("aplica rotación y radio desde los tiradores", () => {
        const rotated = renderSnaplines({ mouse: createMouse(["rotate"]) })
        fireEvent.mouseMove(window, { clientX: 50 })
        expect(rotateBox).toHaveBeenCalled()
        expect(rotated.onNewStylesChange).toHaveBeenCalledWith({ transform: "rotate(90.00deg);" })
        cleanup()

        const radius = renderSnaplines({ mouse: createMouse(["radius"]) })
        fireEvent.mouseMove(window, { clientX: 50 })
        expect(getRadius).toHaveBeenCalled()
        expect(radius.onNewStylesChange).toHaveBeenCalledWith({ "border-radius": "42.00px;" })
    })

    it("redimensiona desde un square y recalcula la posición", () => {
        const { onNewStylesChange } = renderSnaplines({ mouse: createMouse(["square", "edit"]) })
        fireEvent.mouseMove(window, { clientX: 50, altKey: false })
        expect(resizeBox).toHaveBeenCalledWith(expect.anything(), expect.anything(), false, 1, false, false)
        expect(moveBox).toHaveBeenCalledWith(expect.anything(), expect.anything(), 1, ["i1"], [], expect.objectContaining({ left: 10 }))
        expect(onNewStylesChange).toHaveBeenCalled()
    })

    it("escala porcentualmente posiciones y tamaños y aplica el tamaño mínimo", () => {
        vi.mocked(getOutputResolution).mockReturnValue({ width: 3840, height: 1080 } as never)
        vi.mocked(moveBox).mockReturnValue({ styles: { left: 960, top: 270, width: 960, height: 270, transform: "rotate(45deg);" }, lines: [] } as never)
        const { onNewStylesChange } = renderSnaplines({ mouse: createMouse(["line"]) })
        fireEvent.mouseMove(window, { clientX: 50 })
        expect(onNewStylesChange).toHaveBeenCalledWith({
            left: "960.00px",
            top: "540.00px",
            width: "960.00px",
            height: "540.00px",
            transform: "rotate(45deg);"
        })
        cleanup()

        vi.mocked(moveBox).mockReturnValue({ styles: { width: 0, left: 0 }, lines: [] } as never)
        const minimum = renderSnaplines({ mouse: createMouse(["line"]), ratio: 2 })
        fireEvent.mouseMove(window, { clientX: 50 })
        expect(minimum.onNewStylesChange).toHaveBeenCalledWith({ width: "8.00px", left: "0.00px" })
    })

    it("limpia mouse, líneas y estilos al soltar y al desmontar", () => {
        vi.mocked(moveBox).mockReturnValue({
            styles: { left: 10 },
            lines: [
                ["x", 10],
                ["x", 10.2]
            ]
        } as never)
        const { container, onLinesChange, onMouseChange, onNewStylesChange, unmount } = renderSnaplines({
            lines: [
                ["x", 10],
                ["y", 20]
            ],
            mouse: createMouse(["line"])
        })
        expect(container.querySelectorAll(".line")).toHaveLength(2)
        fireEvent.mouseUp(window)
        expect(stopResizing).toHaveBeenCalled()
        expect(onMouseChange).toHaveBeenCalledWith(null)
        expect(onLinesChange).toHaveBeenCalledWith([])
        expect(onNewStylesChange).toHaveBeenCalledWith({})

        unmount()
        expect(stopResizing).toHaveBeenCalledTimes(2)
    })
})
