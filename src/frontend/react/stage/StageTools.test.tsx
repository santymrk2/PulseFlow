// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePage, activeStage, dictionary, labelsDisabled, openToolsTab, outputs, stageShows } from "../../stores"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { addStyleString } from "../../components/edit/scripts/textStyle"
import { history } from "../../components/helpers/history"
import { StageTools } from "./StageTools"

vi.mock("../../stores", () => {
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
        activePage: makeStore("show"),
        activeStage: makeStore({ id: "st1", items: ["i1"] }),
        dictionary: makeStore({ tooltip: { text: "Tooltip texto" } }),
        labelsDisabled: makeStore(false),
        openToolsTab: makeStore(""),
        outputs: makeStore({}),
        stageShows: makeStore({})
    }
})
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../components/edit/scripts/itemClipboard", () => ({ getItemKeys: vi.fn(() => ["left", "top", "width", "height"]) }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ addStyleString: vi.fn((style: string, [key, value]) => `${style}${key}:${value};`) }))
vi.mock("../../components/edit/values/boxes", () => ({ itemBoxes: { text: { icon: "text_icon" } } }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/output", () => ({
    getStageOutputId: vi.fn(() => "out1"),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))
vi.mock("../../components/helpers/style", () => ({
    getStyles: vi.fn((style: string, removeTxt = false) => {
        const result: Record<string, string> = {}
        for (const declaration of (style || "").split(";")) {
            const [key, value] = declaration.split(":")
            if (!key?.trim() || !value) continue
            const text = value.trim()
            result[key.trim()] = removeTxt ? text.replace(/[^0-9.-]/g, "") : text
        }
        return result
    })
}))
vi.mock("./tools/BoxStyle", () => ({ BoxStyle: () => <span data-testid="box-style" /> }))
vi.mock("./tools/ItemStyle", () => ({ ItemStyle: () => <span data-testid="item-style" /> }))
vi.mock("./tools/SlideStyle", () => ({ SlideStyle: () => <span data-testid="slide-style" /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: ReactNode }) => <div data-testid="floating-bar">{children}</div> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, title, icon, disabled, isActive, onClick }: { children?: ReactNode; title?: string; icon?: string; disabled?: boolean; isActive?: boolean; onClick?: () => void }) => (
        <button data-testid="tab-button" data-title={title} data-icon={icon} data-active={isActive} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    )
}))

const stageShowsData = { st1: { id: "st1", items: { i1: { id: "i1", type: "text", style: "left: 10px;top: 20px;font-size: 30px;" } } } }

beforeEach(() => {
    vi.useFakeTimers()
    activeStage.set({ id: "st1", items: ["i1"] } as never)
    stageShows.set(stageShowsData as never)
    outputs.set({} as never)
    dictionary.set({ tooltip: { text: "Tooltip texto" } } as never)
    labelsDisabled.set(false)
    openToolsTab.set("")
    activePage.set("show")
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.spyOn(activeStage, "set")
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("StageTools", () => {
    it("muestra las pestañas y el BoxStyle del item seleccionado", () => {
        const { container } = render(<StageTools />)
        const tabs = [...container.querySelectorAll("[data-testid='tab-button']")].map((button) => button.getAttribute("data-title"))
        expect(tabs).toEqual(["Tooltip texto", "tools.item", "tooltipoptions", "actions.reset"])
        expect(container.querySelector("[data-testid='box-style']")).toBeTruthy()
        expect(translateText).toHaveBeenCalledWith("items.text")
    })

    it("cambia de pestaña y muestra la herramienta correspondiente", () => {
        const { container } = render(<StageTools />)
        fireEvent.click(container.querySelectorAll("[data-testid='tab-button']")[1])
        expect(container.querySelector("[data-testid='item-style']")).toBeTruthy()
        fireEvent.click(container.querySelectorAll("[data-testid='tab-button']")[2])
        expect(container.querySelector("[data-testid='slide-style']")).toBeTruthy()
    })

    it("muestra el mensaje vacío sin items y deshabilita las pestañas", () => {
        activeStage.set({ id: "st1", items: [] } as never)
        stageShows.set({ st1: { id: "st1", items: {} } } as never)
        const { container } = render(<StageTools />)
        expect(container.querySelector("[data-testid='center'] [data-t='empty.items']")).toBeTruthy()
        expect(container.querySelectorAll("[data-testid='tab-button']")[0]?.hasAttribute("disabled")).toBe(true)
    })

    it("no renderiza nada con permisos de lectura", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<StageTools />)
        expect(container.querySelector(".stageTools")?.children).toHaveLength(0)
    })

    it("mueve los items con las flechas y respeta ctrl", () => {
        render(<StageTools />)
        act(() => fireEvent.keyDown(window, { key: "ArrowRight" }))
        expect(addStyleString).toHaveBeenCalledWith("left: 10px;top: 20px;font-size: 30px;", ["left", "11px"])
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ location: expect.objectContaining({ id: "stage_item_style", override: "st1_reset_item" }) }))
        vi.mocked(addStyleString).mockClear()
        act(() => fireEvent.keyDown(window, { key: "ArrowLeft", ctrlKey: true }))
        expect(addStyleString).toHaveBeenCalledWith(expect.anything(), ["left", "0px"])
    })

    it("limpia la selección con Escape y abre la pestaña pedida desde el store", () => {
        const { container } = render(<StageTools />)
        act(() => fireEvent.keyDown(window, { key: "Escape" }))
        act(() => vi.advanceTimersByTime(0))
        expect(activeStage.set).toHaveBeenCalledWith({ id: "st1", items: [] })

        act(() => openToolsTab.set("slide"))
        expect(container.querySelector("[data-testid='slide-style']")).toBeTruthy()
    })

    it("resetea el estilo del texto desde el botón de la barra", () => {
        const { container } = render(<StageTools />)
        const reset = [...container.querySelectorAll("[data-testid='tab-button']")].find((button) => button.getAttribute("data-title") === "actions.reset")
        expect(reset).toBeTruthy()
        fireEvent.click(reset!)
        expect(history).toHaveBeenCalledTimes(8)
        expect(history).toHaveBeenCalledWith(
            expect.objectContaining({
                newData: {
                    data: { i1: "left: 10px;top: 20px;" },
                    key: "items",
                    subkey: "style",
                    keys: ["i1"]
                },
                location: { page: "stage", id: "stage_item_style", override: "st1_reset_item_text" }
            })
        )
    })
})
