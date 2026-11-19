// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import type { ChangeEvent, FormEvent, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { clearAudio } from "../../audio/audioFading"
import { AudioPlayer } from "../../audio/audioPlayer"
import { focusMode, media, outLocked, playingAudio } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { AudioPreview } from "./AudioPreview"

vi.mock("../../audio/audioPlayer", () => ({
    AudioPlayer: {
        start: vi.fn(),
        getDuration: vi.fn(async () => 120),
        getTime: vi.fn(() => 42),
        setTime: vi.fn(() => false)
    }
}))
vi.mock("../../audio/audioFading", () => ({ clearAudio: vi.fn() }))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: { getAnalysers: vi.fn(() => []), releaseAnalyser: vi.fn() } }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ title, disabled, onClick, children }: { title?: string; disabled?: boolean; onClick?: () => void; children?: ReactNode }) => (
        <button type="button" title={title} data-title={title} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../ui/slider/Slider", () => ({
    Slider: ({ value, max, disabled, onInput, onChange }: { value: number; max?: number; disabled?: boolean; onInput?: (event: FormEvent<HTMLInputElement>) => void; onChange?: (event: ChangeEvent<HTMLInputElement>) => void }) => <input data-testid="slider" type="range" value={value} max={max} disabled={disabled} onInput={onInput} onChange={onChange} />
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const active = { id: "audio1", name: "Canción" }

function setStores(options: { focus?: boolean; locked?: boolean; paused?: boolean; volume?: number; loop?: boolean } = {}) {
    restore = setStoresForTest([looseEntry(focusMode, options.focus ?? false), looseEntry(outLocked, options.locked ?? false), looseEntry(media, options.volume === undefined && options.loop === undefined ? {} : { audio1: { volume: options.volume, loop: options.loop } }), looseEntry(playingAudio, { audio1: { paused: options.paused ?? true, audio: options.paused === false ? { currentTime: 30 } : { currentTime: 0 } } })])
}

describe("AudioPreview", () => {
    it("muestra controles, canvas y la duración del audio", async () => {
        setStores()
        const { container } = render(<AudioPreview active={active} />)

        expect(container.querySelector("canvas")).toBeTruthy()
        expect(screen.getByTitle("media.play")).toBeTruthy()
        await waitFor(() => expect(screen.getByTestId("slider").getAttribute("max")).toBe("120"))
        expect(screen.getByText("02:00")).toBeTruthy()
    })

    it("oculta el canvas cuando está el modo foco", () => {
        setStores({ focus: true })
        const { container } = render(<AudioPreview active={active} />)
        expect(container.querySelector("canvas")).toBeNull()
    })

    it("no inicia el audio cuando las salidas están bloqueadas", () => {
        setStores({ locked: true })
        render(<AudioPreview active={active} />)
        fireEvent.click(screen.getByTitle("media.play"))
        expect(AudioPlayer.start).not.toHaveBeenCalled()
    })

    it("inicia el audio desde el tiempo actual", async () => {
        setStores({ paused: false })
        render(<AudioPreview active={active} />)
        await waitFor(() => expect(screen.getByTitle("media.pause")).toBeTruthy())
        fireEvent.click(screen.getByTitle("media.pause"))
        expect(AudioPlayer.start).toHaveBeenCalledWith("audio1", { name: "Canción" }, { pauseIfPlaying: true, startAt: 30 })
    })

    it("detiene el audio y reinicia el tiempo", async () => {
        setStores({ paused: false })
        render(<AudioPreview active={active} />)
        await waitFor(() => expect(screen.getByTitle("media.stop")).toBeTruthy())
        fireEvent.click(screen.getByTitle("media.stop"))
        expect(clearAudio).toHaveBeenCalledWith("audio1")
        await waitFor(() => expect(screen.getByText("00:00")).toBeTruthy())
    })

    it("retrocede diez segundos", async () => {
        setStores({ paused: false })
        render(<AudioPreview active={active} />)
        await waitFor(() => expect(screen.getByTitle("media.back10")).toBeTruthy())
        fireEvent.click(screen.getByTitle("media.back10"))
        expect(AudioPlayer.setTime).toHaveBeenCalledWith("audio1", 20)
    })

    it("actualiza el loop en el store", () => {
        setStores({ loop: false })
        render(<AudioPreview active={active} />)
        fireEvent.click(screen.getByTitle("media._loop"))
        expect(get(media).audio1?.loop).toBe(true)
    })

    it("libera el analizador al cambiar de audio", () => {
        setStores()
        const { rerender } = render(<AudioPreview active={active} />)
        rerender(<AudioPreview active={{ id: "audio2", name: "Otra" }} />)
        expect(AudioAnalyser.releaseAnalyser).toHaveBeenCalledWith("audio1")
    })
})
