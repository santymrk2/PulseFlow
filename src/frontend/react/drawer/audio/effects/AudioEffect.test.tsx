// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioPlayer } from "../../../../audio/audioPlayer"
import { playingAudio, selected } from "../../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../test/storeTestKit"
import { AudioEffect } from "./AudioEffect"

vi.mock("../../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../audio/audioPlayer", () => ({ AudioPlayer: { getAudio: vi.fn(), start: vi.fn() } }))
vi.mock("../../../../audio/audioProcessor", () => ({}))
vi.mock("../../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <div data-select-elem>{children}</div> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(playingAudio, {}), looseEntry(selected, [])])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioEffect (card de librería)", () => {
    it("muestra el nombre del efecto", () => {
        render(<AudioEffect path="/fx/a.wav" name="Aplausos" />)
        expect(screen.getByText("Aplausos")).toBeTruthy()
    })

    it("no inicia audio si no está sonando y el otro efecto está activo", () => {
        render(<AudioEffect path="/fx/a.wav" name="Aplausos" />)
        fireEvent.click(screen.getByText("Aplausos"))
        expect(AudioPlayer.start).toHaveBeenCalledWith("/fx/a.wav", { name: "Aplausos" }, { playMultiple: true, stopIfPlaying: true, clearTime: 0.3 })
    })

    it("muestra el progreso cuando el efecto está sonando", () => {
        vi.useFakeTimers()
        try {
            vi.mocked(AudioPlayer.getAudio).mockReturnValue({ currentTime: 30, duration: 100 } as never)
            playingAudio.set({ "/fx/a.wav": true } as never)
            const { container } = render(<AudioEffect path="/fx/a.wav" name="Aplausos" />)
            act(() => vi.advanceTimersByTime(100))
            const progress = container.querySelector("[class*='progress']") as HTMLElement
            expect(progress.style.width).toBe("30%")
        } finally {
            vi.useRealTimers()
        }
    })
})
