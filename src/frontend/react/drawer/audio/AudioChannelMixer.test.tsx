// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { CSSProperties, FormEvent } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toggleChannelRecording } from "../../../audio/audioChannelRecorder"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { activeAudioEffects, audioChannelsData, recordingChannels } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { AudioChannelMixer } from "./AudioChannelMixer"

interface ClickDetail {
    ctrl: boolean
    shift: boolean
    alt: boolean
    doubleClick: boolean
    target: EventTarget
}

vi.mock("../../../audio/audioChannelRecorder", () => ({ toggleChannelRecording: vi.fn() }))
vi.mock("../../../audio/audioPlayer", () => ({ AudioPlayer: { updateVolume: vi.fn() } }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("./AudioMeter", () => ({ AudioMeter: () => <div data-testid="audio-meter" /> }))
vi.mock("../../ui/slider/Slider", () => ({
    Slider: ({ value, onInput }: { value: number; onInput?: (event: FormEvent<HTMLInputElement>) => void }) => <button type="button" data-testid="volume-slider" data-value={value} onClick={() => onInput?.({ currentTarget: { value: "0.8" } } as FormEvent<HTMLInputElement>)} />
}))
vi.mock("../../ui/stepper/Stepper", () => ({
    Stepper: ({ value, onChange }: { value: number; onChange?: (value: string) => void }) => <input data-testid="db-stepper" value={value} onChange={(e) => onChange?.(e.target.value)} />
}))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ title, icon, style, onClick }: { title?: string; icon?: string; style?: CSSProperties; onClick?: (detail: ClickDetail, event: unknown) => void }) => <button title={title} data-icon={icon} style={style} onClick={(e) => onClick?.({ ctrl: false, shift: false, alt: false, doubleClick: false, target: e.target }, e)} />
}))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(audioChannelsData, {}), looseEntry(recordingChannels, {}), looseEntry(activeAudioEffects, null)])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioChannelMixer", () => {
    it("muestra la etiqueta del canal", () => {
        render(<AudioChannelMixer channelId="main" label="Principal" />)
        expect(screen.getByText("Principal")).toBeTruthy()
    })

    it("alterna mute al hacer click", () => {
        render(<AudioChannelMixer channelId="main" label="Principal" />)
        fireEvent.click(screen.getByTitle("actions.mute"))
        expect((get(audioChannelsData) as Record<string, { isMuted?: boolean }>).main.isMuted).toBe(true)
        expect(AudioPlayer.updateVolume).toHaveBeenCalled()
    })

    it("arranca/para la grabación del canal", () => {
        render(<AudioChannelMixer channelId="main" label="Principal" />)
        fireEvent.click(screen.getByTitle("actions.start_recording"))
        expect(toggleChannelRecording).toHaveBeenCalledWith("main", "Principal")
    })

    it("actualiza el volumen al mover el slider", () => {
        render(<AudioChannelMixer channelId="main" label="Principal" />)
        fireEvent.click(screen.getByTestId("volume-slider"))
        const data = get(audioChannelsData) as Record<string, { volume?: number }>
        expect(typeof data.main.volume).toBe("number")
    })

    it("muestra el medidor salvo cuando el canal está inactivo", () => {
        const { rerender } = render(<AudioChannelMixer channelId="main" label="Principal" />)
        expect(screen.getByTestId("audio-meter")).toBeTruthy()
        rerender(<AudioChannelMixer channelId="main" label="Principal" inactive />)
        expect(screen.queryByTestId("audio-meter")).toBeNull()
    })
})
