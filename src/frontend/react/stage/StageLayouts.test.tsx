// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, labelsDisabled, outputs, stageShows } from "../../shared/core/stores"
import { history } from "../../components/helpers/history"
import { getAccess } from "../../utils/profile"
import { StageLayouts } from "./StageLayouts"

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
    return { activeStage: makeStore({ id: null, items: [] }), labelsDisabled: makeStore(false), outputs: makeStore({}), stageShows: makeStore({}) }
})
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../components/helpers/array", () => ({
    keysToID: (object: Record<string, unknown>) => Object.entries(object).map(([id, value]) => ({ ...(value as object), id })),
    sortByName: (array: { name: string }[]) => [...array].sort((a, b) => a.name.localeCompare(b.name))
}))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../system/Autoscroll", () => ({ Autoscroll: ({ children }: { children: ReactNode }) => <div data-testid="autoscroll">{children}</div> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: ReactNode }) => <div data-testid="floating-bar">{children}</div> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, disabled, icon, onClick }: { children: ReactNode; disabled?: boolean; icon?: string; onClick?: () => void }) => (
        <button data-testid="add-layout" disabled={disabled} data-icon={icon} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("./StageSlide", () => ({
    StageSlide: ({ id, active, onClick }: { id: string; active?: boolean; onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void }) => <div data-testid="stage-slide" data-id={id} data-active={active} onClick={onClick} />
}))
vi.mock("./SkeletonStageSlide", () => ({
    SkeletonStageSlide: ({ layout, onClick }: { layout: { id: string }; onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void }) => <div data-testid="skeleton" data-id={layout.id} onClick={onClick} />
}))

const shows = {
    st1: { id: "st1", name: "B", items: {} },
    st2: { id: "st2", name: "A", items: {} },
    st3: { id: "st3", name: "C", items: {} }
}

beforeEach(() => {
    vi.useFakeTimers()
    stageShows.set(shows as never)
    activeStage.set({ id: "st2", items: [] } as never)
    outputs.set({} as never)
    labelsDisabled.set(false)
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.spyOn(activeStage, "set")
    vi.spyOn(activeStage, "update")
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("StageLayouts", () => {
    it("ordena los layouts por nombre y arranca mostrando skeletons", () => {
        const { container } = render(<StageLayouts />)
        const ids = [...container.querySelectorAll("[data-testid='stage-slide'], [data-testid='skeleton']")].map((el) => el.getAttribute("data-id"))
        expect(ids).toEqual(["st2", "st1", "st3"])
        expect(container.querySelectorAll("[data-testid='stage-slide']")).toHaveLength(0)
        expect(container.querySelectorAll("[data-testid='skeleton']")).toHaveLength(3)
    })

    it("carga el resto de layouts en lotes con los timers", () => {
        const { container } = render(<StageLayouts />)
        act(() => vi.advanceTimersByTime(80))
        act(() => vi.advanceTimersByTime(40))
        expect(container.querySelectorAll("[data-testid='stage-slide']")).toHaveLength(3)
        expect(container.querySelectorAll("[data-testid='skeleton']")).toHaveLength(0)
    })

    it("selecciona un layout al hacer click, salvo con ctrl", () => {
        const { container } = render(<StageLayouts />)
        const first = container.querySelector("[data-testid='skeleton']") as HTMLElement
        fireEvent.click(first, { ctrlKey: true })
        expect(activeStage.update).not.toHaveBeenCalled()
        fireEvent.click(first)
        expect(activeStage.update).toHaveBeenCalled()
    })

    it("selecciona el primer layout cuando no hay ninguno activo", () => {
        act(() => activeStage.set({ id: null, items: [] } as never))
        render(<StageLayouts />)
        expect(activeStage.set).toHaveBeenLastCalledWith({ id: "st2", items: [] })
    })

    it("cambia de layout con las flechas arriba y abajo", () => {
        const { container } = render(<StageLayouts />)
        act(() => {
            vi.advanceTimersByTime(80)
            vi.advanceTimersByTime(40)
        })
        expect(container.querySelector("[data-testid='stage-slide'][data-id='st2']")?.getAttribute("data-active")).toBe("true")
        act(() => fireEvent.keyDown(window, { key: "ArrowDown" }))
        expect(activeStage.set).toHaveBeenLastCalledWith({ id: "st1", items: [] })
        act(() => fireEvent.keyDown(window, { key: "ArrowUp" }))
        expect(activeStage.set).toHaveBeenLastCalledWith({ id: "st2", items: [] })
    })

    it("muestra el mensaje vacío y deshabilita el botón en lectura", () => {
        cleanup()
        stageShows.set({} as never)
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<StageLayouts />)
        expect(container.querySelector("[data-testid='center'] [data-t='empty.layouts']")).toBeTruthy()
        expect(container.querySelector("[data-testid='add-layout']")?.hasAttribute("disabled")).toBe(true)
        fireEvent.click(container.querySelector("[data-testid='add-layout']")!)
        expect(history).not.toHaveBeenCalled()
    })
})
