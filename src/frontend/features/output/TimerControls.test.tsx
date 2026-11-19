// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TimerControls } from "./TimerControls"

const timersMock = vi.fn((_props?: { onlyPlaying?: boolean }) => <div data-testid="timers" />)

vi.mock("../../react/drawer/timers/Timers", () => ({
    Timers: (props: { onlyPlaying?: boolean }) => timersMock(props)
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("TimerControls", () => {
    it("renderiza_lo_principal", () => {
        render(<TimerControls />)
        expect(screen.getByTestId("timers")).toBeTruthy()
        expect(timersMock).toHaveBeenCalledWith(expect.objectContaining({ onlyPlaying: true }))
    })
})
