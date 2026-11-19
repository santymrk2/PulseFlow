// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actionHistory, activeTimers, drawerTabsData } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { FunctionsInfo } from "./FunctionsInfo"

vi.mock("../pages/InteractionsInfo", () => ({ InteractionsInfo: () => <div data-testid="interactions" /> }))
vi.mock("../timers/TimerInfo", () => ({ TimerInfo: () => <div data-testid="timer-info" /> }))
vi.mock("./OBSInfo", () => ({ OBSInfo: () => <div data-testid="obs" /> }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(drawerTabsData, { functions: { activeSubTab: "actions" } }), looseEntry(actionHistory, [{ action: "open_show", count: 2 }]), looseEntry(activeTimers, [])])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("FunctionsInfo", () => {
    it("muestra la última acción del historial con su contador", () => {
        render(<FunctionsInfo />)
        expect(screen.getByText("Open show")).toBeTruthy()
        expect(screen.getByText("(2)")).toBeTruthy()
    })

    it("monta TimerInfo como isla cuando hay temporizadores", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { functions: { activeSubTab: "timer" } }), looseEntry(actionHistory, []), looseEntry(activeTimers, [{ id: "t1" }])])
        render(<FunctionsInfo />)
        expect(screen.getByTestId("timer-info")).toBeTruthy()
    })

    it("no muestra nada en la pestaña timer sin temporizadores", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { functions: { activeSubTab: "timer" } }), looseEntry(actionHistory, []), looseEntry(activeTimers, [])])
        const { container } = render(<FunctionsInfo />)
        expect(container.innerHTML).toBe("")
    })

    it("monta InteractionsInfo y OBSInfo en sus pestañas", () => {
        const { rerender } = render(<FunctionsInfo />)
        act(() => drawerTabsData.set({ functions: { activeSubTab: "interactions" } } as never))
        expect(screen.getByTestId("interactions")).toBeTruthy()
        act(() => drawerTabsData.set({ functions: { activeSubTab: "obs" } } as never))
        expect(screen.getByTestId("obs")).toBeTruthy()
        rerender(<FunctionsInfo />)
    })

    it("deja de mostrar el histórico pasado un segundo", async () => {
        vi.useFakeTimers()
        try {
            render(<FunctionsInfo />)
            expect(screen.getByText("Open show")).toBeTruthy()
            await act(async () => {
                vi.advanceTimersByTime(1000)
            })
            expect(screen.queryByText("Open show")).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })
})
