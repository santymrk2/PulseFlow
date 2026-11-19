// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { slideTimers } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { NextTimer } from "./NextTimer"

vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/helpers/output", () => ({ getAllActiveOutputIds: vi.fn(() => ["out1"]) }))
vi.mock("../ui/slider/Slider", () => ({
    Slider: ({ onInput, onMouseDown, value, max, step }: { onInput?: (e: { currentTarget: { value: string } }) => void; onMouseDown?: (e: { currentTarget: { value: string } }) => void; value: number; max?: number; step?: number }) => (
        <input data-testid="slider" value={String(value)} max={max} step={step} onChange={(e) => onInput?.({ currentTarget: { value: e.currentTarget.value } })} onMouseDown={(e) => onMouseDown?.({ currentTarget: { value: e.currentTarget.value } })} />
    )
}))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("NextTimer", () => {
    it("no_renderiza_sin_timer_valido", () => {
        restore = setStoresForTest([looseEntry(slideTimers, {})])
        const { container } = render(<NextTimer currentOutput={{} as never} timer={{ time: 5, max: 0, timer: { pause: vi.fn(), resume: vi.fn() } }} />)
        expect(container.firstChild).toBeNull()
    })

    it("renderiza_y_pausa_reanuda_todas_las_salidas", () => {
        const pause = vi.fn()
        const resume = vi.fn()
        const timer = { time: 3, paused: false, max: 10, timer: { pause, resume } }
        restore = setStoresForTest([looseEntry(slideTimers, { out1: timer })])
        const { rerender } = render(<NextTimer currentOutput={{ out: { transition: { duration: 10 } } } as never} timer={timer} />)

        expect(screen.getByText("3")).toBeTruthy()
        expect(screen.getByText("10")).toBeTruthy()
        fireEvent.click(screen.getByTitle("media.pause"))
        expect(pause).toHaveBeenCalled()

        timer.paused = true
        rerender(<NextTimer currentOutput={{ out: { transition: { duration: 10 } } } as never} timer={timer} />)
        fireEvent.click(screen.getByTitle("media.play"))
        expect(resume).toHaveBeenCalled()
    })
})
