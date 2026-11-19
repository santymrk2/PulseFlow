// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { VideoSlider } from "./VideoSlider"

vi.mock("../../shared/ui/kit/slider/Slider", () => ({
    Slider: ({ value, max, onInput, onChange, disabled }: { value: number; max?: number; onInput?: (e: { currentTarget: { value: string } }) => void; onChange?: (e: unknown) => void; disabled?: boolean }) => (
        <input data-testid="slider" value={String(value)} max={max} disabled={disabled} onChange={(e) => onInput?.({ currentTarget: { value: e.currentTarget.value } })} onBlur={(e) => onChange?.({ target: e.currentTarget })} />
    )
}))
vi.mock("../../shared/ui/helpers/triggerClickOnEnterSpace", () => ({ triggerClickOnEnterSpace: vi.fn() }))
vi.mock("../../shared/utils/helpers/time", () => ({
    joinTime: vi.fn((t: number[] | string) => (Array.isArray(t) ? t.join(":") : String(t))),
    secondsToTime: vi.fn((s: number) => [0, 0, Math.floor(s)])
}))
vi.mock("../../features/media/logic/video/videoPlayer", () => ({ VideoPlayer: { seekTo: vi.fn(), pause: vi.fn(), play: vi.fn() } }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("VideoSlider", () => {
    it("renderiza_y_alterna_formato_de_tiempo", () => {
        render(<VideoSlider videoData={{ duration: 120, paused: true, loop: false, muted: false }} videoTime={30} />)
        expect(screen.getByTestId("slider")).toBeTruthy()
        expect(screen.getByText("0:0:30")).toBeTruthy()

        const toggle = screen.getByLabelText("Toggle time display format")
        expect(toggle.textContent).toContain("0:0:90")
        fireEvent.click(toggle)
        expect(toggle.textContent).toContain("0:0:120")
    })
})
