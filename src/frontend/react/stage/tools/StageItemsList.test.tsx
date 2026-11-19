// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, dictionary, selected, stageShows, timers } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getSortedStageItems, rearrangeStageItems } from "../../../components/edit/scripts/itemHelpers"
import { getCustomStageLabel } from "../../../components/stage/stage"
import { StageItemsList } from "./StageItemsList"

vi.mock("../../../shared/core/stores", () => {
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
        activeStage: makeStore({ id: "st1", items: [] }),
        dictionary: makeStore({}),
        selected: makeStore({ id: null, data: [] }),
        stageShows: makeStore({}),
        timers: makeStore({})
    }
})
vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ getSortedStageItems: vi.fn(() => []), rearrangeStageItems: vi.fn() }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: vi.fn(() => "texto del item") }))
vi.mock("../../../components/helpers/array", () => ({ clone: (value: unknown) => [...(value as unknown[])] }))
vi.mock("../../../components/helpers/media", () => ({ getFileName: vi.fn(() => "video.mp4") }))
vi.mock("../../../components/stage/stage", () => ({ getCustomStageLabel: vi.fn(() => "") }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id, custom }: { id: string; custom?: boolean }) => <span data-icon={id} data-custom={custom} /> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ id, children, icon, title, disabled, isActive, className, onClick }: { id?: string; children?: ReactNode; icon?: string; title?: string; disabled?: boolean; isActive?: boolean; className?: string; onClick?: (detail: { ctrl: boolean }) => void }) => (
        <button data-testid="item-button" id={id} data-icon={icon} data-title={title} data-active={isActive} className={className} disabled={disabled} onClick={(event) => onClick?.({ ctrl: event.ctrlKey })}>
            {children}
        </button>
    )
}))

const items = [
    { id: "i1", type: "text" },
    { id: "i2", type: "media" },
    { id: "i3", type: "timer", timer: { id: "t1" } }
]

beforeEach(() => {
    activeStage.set({ id: "st1", items: [] } as never)
    stageShows.set({ st1: { items: {} } } as never)
    timers.set({ t1: { name: "Cronómetro" } } as never)
    dictionary.set({} as never)
    selected.set({ id: null, data: [] } as never)
    vi.mocked(getSortedStageItems).mockReturnValue(items as never)
    vi.mocked(getCustomStageLabel).mockReturnValue("")
    vi.spyOn(activeStage, "set")
    vi.spyOn(activeStage, "update")
    vi.spyOn(selected, "set")
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("StageItemsList", () => {
    it("lista los items en orden inverso con número, icono y etiqueta", () => {
        const { container } = render(<StageItemsList />)
        const buttons = [...container.querySelectorAll('[id="#i3"], [id="#i2"], [id="#i1"]')]
        expect(buttons.map((button) => button.id)).toEqual(["#i3", "#i2", "#i1"])
        expect(buttons[0].textContent).toContain("1")
        expect(buttons[2].textContent).toContain("3")
        expect(buttons[1].textContent).toContain("video.mp4")
        expect(buttons[0].textContent).toContain("Cronómetro")
        expect(translateText).toHaveBeenCalledWith("edit.arrange_items")
    })

    it("selecciona un item con click y alterna la selección", () => {
        const { container } = render(<StageItemsList />)
        const button = container.querySelector('[id="#i1"]')!
        fireEvent.click(button)
        expect(get(activeStage)).toEqual({ id: "st1", items: ["i1"] })
        expect(selected.set).toHaveBeenCalledWith({ id: null, data: [] })

        fireEvent.click(button)
        expect(get(activeStage)).toEqual({ id: "st1", items: [] })

        fireEvent.click(button, { ctrlKey: true })
        expect(get(activeStage)).toEqual({ id: "st1", items: ["i1"] })
        fireEvent.click(button, { ctrlKey: true })
        expect(get(activeStage)).toEqual({ id: "st1", items: [] })
    })

    it("selecciona con click derecho sobre un item", () => {
        const { container } = render(<StageItemsList />)
        fireEvent.mouseDown(container.querySelector('[id="#i2"]')!, { button: 2 })
        expect(activeStage.set).toHaveBeenCalledWith({ id: "st1", items: ["i2"] })
        fireEvent.mouseDown(container.querySelector('[id="#i2"]')!, { button: 0 })
        expect(activeStage.set).toHaveBeenCalledTimes(1)
    })

    it("reordena con los botones y deshabilita los extremos", () => {
        const { container } = render(<StageItemsList />)
        const down = [...container.querySelectorAll("[data-title='actions.backward']")]
        const up = [...container.querySelectorAll("[data-title='actions.forward']")]
        expect(down[2].hasAttribute("disabled")).toBe(true)
        expect(up[0].hasAttribute("disabled")).toBe(true)
        fireEvent.click(down[0])
        expect(rearrangeStageItems).toHaveBeenCalledWith("backward", "i3")
        fireEvent.click(up[2])
        expect(rearrangeStageItems).toHaveBeenCalledWith("forward", "i1")
    })

    it("no renderiza nada sin items", () => {
        vi.mocked(getSortedStageItems).mockReturnValue([])
        const { container } = render(<StageItemsList />)
        expect(container.innerHTML).toBe("")
    })
})
