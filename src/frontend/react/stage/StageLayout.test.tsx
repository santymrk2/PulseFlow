// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { useEffect, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, allOutputs, currentOutputSettings, outputs, stageShows, toggleOutputEnabled } from "../../shared/core/stores"
import { centerZoom } from "../../components/edit/scripts/zoom"
import { getSortedStageItems } from "../../components/edit/scripts/itemHelpers"
import { history } from "../../shared/utils/helpers/history"
import { enableStageOutput, getStageOutputId } from "../../shared/utils/helpers/output"
import { openSettings } from "../../components/settings/openSettings"
import { updateStageShow } from "../../components/stage/stage"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { getAccess } from "../../shared/utils/profile"
import { StageLayout } from "./StageLayout"

vi.mock("../../shared/core/stores", () => {
    function makeStore(initial: unknown) {
        let value = initial
        const listeners = new Set<(next: unknown) => void>()
        return {
            subscribe(run: (next: unknown) => void) {
                listeners.add(run)
                run(value)
                return () => listeners.delete(run)
            },
            set(next: unknown) {
                value = next
                listeners.forEach((run) => run(value))
            },
            update(fn: (current: never) => unknown) {
                value = fn(value as never)
                listeners.forEach((run) => run(value))
            }
        }
    }
    return {
        activeStage: makeStore({ id: null, items: [] }),
        allOutputs: makeStore({}),
        currentOutputSettings: makeStore(null),
        outputs: makeStore({}),
        stageShows: makeStore({}),
        toggleOutputEnabled: makeStore(false)
    }
})
vi.mock("../../components/edit/scripts/zoom", () => ({ centerZoom: vi.fn(async () => {}) }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getSortedStageItems: vi.fn(() => []), shouldItemBeShown: vi.fn(() => true) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({
    enableStageOutput: vi.fn(() => "newOut"),
    getStageOutputId: vi.fn(() => "out1"),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))
vi.mock("../../shared/utils/helpers/style", () => ({
    getStyles: vi.fn((style: string) => {
        const result: Record<string, string> = {}
        for (const declaration of (style || "").split(";")) {
            const [key, value] = declaration.split(":")
            if (key?.trim() && value) result[key.trim()] = value.trim()
        }
        return result
    })
}))
vi.mock("../../components/settings/openSettings", () => ({ openSettings: vi.fn() }))
vi.mock("../../components/stage/stage", () => ({ getSlideTextItems: vi.fn(() => []), stageItemToItem: vi.fn((item: unknown) => item), updateStageShow: vi.fn() }))
vi.mock("../../components/slide/getStyleResolution", () => ({ getStyleResolution: vi.fn(() => "width: 100%;") }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../edit/ItemAddMenu", () => ({ ItemAddMenu: () => null }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../slide/Zoomed", () => ({
    Zoomed: ({ background, children, onRatioChange }: { background: string; children: ReactNode; onRatioChange?: (ratio: number) => void }) => {
        useEffect(() => onRatioChange?.(2), [])
        return (
            <div data-testid="zoomed" data-background={background}>
                <div className="slide">{children}</div>
            </div>
        )
    }
}))
vi.mock("../slide/observeResize", () => ({
    observeResize: (_node: Element, cb: (rect: DOMRectReadOnly) => void) => {
        cb({ width: 800, height: 600 } as DOMRectReadOnly)
        return { destroy: () => {} }
    }
}))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../system/DropArea", () => ({ DropArea: ({ children }: { children: ReactNode }) => <div data-testid="droparea">{children}</div> }))
vi.mock("../system/Snaplines", () => ({
    Snaplines: ({ lines, newStyles, ratio, active, onNewStylesChange }: { lines: unknown[]; newStyles: unknown; ratio: number; active: unknown[]; onNewStylesChange?: (value: unknown) => void }) => (
        <span data-testid="snaplines" data-props={JSON.stringify({ lineCount: lines.length, newStyles, ratio, active })} data-lines={lines.length}>
            <button data-testid="apply-styles" onClick={() => onNewStylesChange?.({ left: "10px" })} />
        </span>
    )
}))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button data-testid="create-output" onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: ReactNode }) => <div data-testid="floating-bar">{children}</div> }))
vi.mock("../ui/zoom-control/ZoomControl", () => ({
    ZoomControl: ({ columns, onChange, onOrigin }: { columns: number; onChange?: (value: number) => void; onOrigin?: (origin: { x: number; y: number }) => void }) => (
        <div data-testid="zoom-control" data-columns={columns}>
            <button data-testid="zoom-change" onClick={() => onChange?.(2)} />
            <button data-testid="zoom-origin" onClick={() => onOrigin?.({ x: 10, y: 20 })} />
        </div>
    )
}))
vi.mock("./Stagebox", () => ({
    Stagebox: ({ id, ratio }: { id: string; ratio: number }) => <span data-testid="stagebox" data-id={id} data-ratio={ratio} />
}))

const layout = { id: "st1", name: "Stage", settings: { color: "#123456" }, items: { i1: { id: "i1", style: "left: 1px; top: 2px;" } }, itemOrder: ["i1"] } as never

function setStores({ id = "st1", items = ["i1"], shows = { st1: layout } }: { id?: string | null; items?: string[]; shows?: Record<string, unknown> } = {}) {
    activeStage.set({ id, items } as never)
    stageShows.set(shows as never)
    outputs.set({} as never)
    allOutputs.set({} as never)
}

beforeEach(() => {
    vi.useFakeTimers()
    setStores()
    vi.mocked(getSortedStageItems).mockReturnValue([{ id: "i1", style: "left: 1px; top: 2px;" } as never])
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.mocked(getStageOutputId).mockReturnValue("out1")
    vi.spyOn(toggleOutputEnabled, "set")
    vi.spyOn(currentOutputSettings, "set")
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("StageLayout", () => {
    it("renderiza el área, el DropArea y el Zoomed con el fondo y la resolución del layout", () => {
        const { container } = render(<StageLayout />)
        expect(container.querySelector(".stageArea")).toBeTruthy()
        expect(container.querySelector("[data-testid='droparea']")).toBeTruthy()
        expect(container.querySelector("[data-testid='zoomed']")?.getAttribute("data-background")).toBe("#123456")
        expect(getStyleResolution).toHaveBeenLastCalledWith({ width: 1920, height: 1080 }, 800, 600, "fit", { zoom: 1 })
        expect(container.querySelector("[data-testid='stagebox']")?.getAttribute("data-id")).toBe("i1")
    })

    it("propaga el ratio del Zoomed a Snaplines y a los Stagebox", () => {
        const { container } = render(<StageLayout />)
        expect(container.querySelector("[data-testid='snaplines']")?.getAttribute("data-props")).toContain('"ratio":2')
        expect(container.querySelector("[data-testid='stagebox']")?.getAttribute("data-ratio")).toBe("2")
    })

    it("oculta Snaplines y el DropArea con permisos de lectura", () => {
        vi.mocked(getAccess).mockReturnValue({ st1: "read" } as never)
        const { container } = render(<StageLayout />)
        expect(container.querySelector("[data-testid='snaplines']")).toBeNull()
        expect(container.querySelector("[data-testid='droparea']")).toBeNull()
        expect(container.querySelector("[data-testid='stagebox']")).toBeTruthy()
    })

    it("muestra el mensaje de layout vacío cuando no hay stage seleccionado", () => {
        setStores({ id: null, items: [], shows: {} })
        vi.mocked(getSortedStageItems).mockReturnValue([])
        const { container } = render(<StageLayout />)
        expect(container.querySelector("[data-testid='center'] [data-t='empty.layout']")).toBeTruthy()
        expect(container.querySelector("[data-testid='zoomed']")).toBeNull()
    })

    it("crea la salida de stage y aplica el zoom desde la barra flotante", () => {
        vi.mocked(getStageOutputId).mockReturnValue("")
        const { container } = render(<StageLayout />)
        expect(container.querySelector("[data-testid='floating-bar']")).toBeTruthy()
        fireEvent.click(container.querySelector("[data-testid='create-output']")!)
        expect(toggleOutputEnabled.set).toHaveBeenCalled()
        act(() => vi.advanceTimersByTime(100))
        expect(enableStageOutput).toHaveBeenCalledWith({ stageOutput: "st1", name: "Stage" })
        expect(currentOutputSettings.set).toHaveBeenCalledWith("newOut")
        expect(openSettings).toHaveBeenCalledWith("display_settings")

        fireEvent.click(container.querySelector("[data-testid='zoom-change']")!)
        expect(container.querySelector("[data-testid='zoom-control']")?.getAttribute("data-columns")).toBe("2")
        expect(centerZoom).toHaveBeenCalledWith(null, expect.anything(), "")
        fireEvent.click(container.querySelector("[data-testid='zoom-origin']")!)
        fireEvent.click(container.querySelector("[data-testid='zoom-change']")!)
        expect(centerZoom).toHaveBeenLastCalledWith({ x: 10, y: 20 }, expect.anything(), "")
    })

    it("guarda los estilos movidos con history y actualiza el stage", () => {
        const { container } = render(<StageLayout />)
        fireEvent.click(container.querySelector("[data-testid='apply-styles']")!)
        expect(history).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "UPDATE",
                newData: { data: { i1: "left:10px;top:2px;" }, key: "items", subkey: "style", keys: ["i1"] },
                oldData: { id: "st1" },
                location: { page: "stage", id: "stage_item_position", override: "st1i1" }
            })
        )
        expect(updateStageShow).toHaveBeenCalled()
    })
})
