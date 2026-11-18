// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Audio from "./Audio"

vi.mock("../../stores", () => ({
    activeFocus: { set: vi.fn() },
    activePlaylist: { subscribe: (fn: (value: unknown) => void) => (fn(null), () => {}) },
    activeShow: { set: vi.fn(), subscribe: (fn: (value: unknown) => void) => (fn(null), () => {}) },
    audioPlaylists: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) },
    focusMode: { subscribe: (fn: (value: unknown) => void) => (fn(false), () => {}) },
    metronome: { subscribe: (fn: (value: unknown) => void) => (fn({ tempo: 120, beats: 4 }), () => {}) },
    outLocked: { subscribe: (fn: (value: unknown) => void) => (fn(false), () => {}) },
    playingAudio: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}), update: vi.fn() },
    playingMetronome: { subscribe: (fn: (value: unknown) => void) => (fn(true), () => {}) }
}))
vi.mock("../hooks/useStore", () => ({ useStore: (s: unknown) => (String(s).includes("playingMetronome") ? true : String(s).includes("metronome") ? { tempo: 120, beats: 4 } : {}) }))
vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: { getPath: () => "a.mp3", getDuration: async () => 0, start: vi.fn() } }))
vi.mock("../../audio/audioPlaylist", () => ({ AudioPlaylist: { next: vi.fn() } }))
vi.mock("../../utils/clickable", () => ({ triggerClickOnEnterSpace: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: (t: string) => t }))
vi.mock("../../components/helpers/media", () => ({ getFileName: (p: string) => p, removeExtension: (p: string) => p }))
vi.mock("../../components/helpers/time", () => ({ joinTime: () => "0:00", secondsToTime: () => ({}) }))

afterEach(cleanup)

describe("Audio", () => {
    it("renderiza", () => {
        const { container } = render(<Audio />)
        expect(container).toBeTruthy()
    })
})
