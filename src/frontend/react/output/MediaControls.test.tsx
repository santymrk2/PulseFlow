// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { focusMode, outLocked, playerVideos } from "../../shared/core/stores"
import { clearBackground } from "../../components/output/clear"
import { VideoPlayer } from "../../features/media/logic/video/videoPlayer"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { MediaControls } from "./MediaControls"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/helpers/media", () => ({ getExtension: vi.fn(() => "mp4"), getMediaType: vi.fn(() => "video") }))
vi.mock("../../shared/utils/helpers/get", () => ({ splitPath: vi.fn(() => ({ name: "clip.mp4" })) }))
vi.mock("../../features/media/logic/video/videoSync", () => ({ videoSync: vi.fn(() => () => {}) }))
vi.mock("../../components/output/clear", () => ({ clearBackground: vi.fn() }))
vi.mock("../../features/media/logic/video/videoPlayer", () => ({
    VideoPlayer: { play: vi.fn(), pause: vi.fn(), toggleMute: vi.fn(), toggleLoop: vi.fn(), seekTo: vi.fn() }
}))
vi.mock("./VideoSlider", () => ({ VideoSlider: () => <div data-testid="video-slider" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function outputWithVideo() {
    return { out: { background: { path: "/tmp/clip.mp4" } } } as never
}

describe("MediaControls", () => {
    it("renderiza_controles_y_alterna_reproduccion", () => {
        restore = setStoresForTest([looseEntry(outLocked, false), looseEntry(playerVideos, {}), looseEntry(focusMode, false)])
        render(<MediaControls currentOutput={outputWithVideo()} outputId="o1" />)

        expect(screen.getByText("clip")).toBeTruthy()
        fireEvent.click(screen.getByTitle("media.play"))
        expect(VideoPlayer.play).toHaveBeenCalledWith("/tmp/clip.mp4", "o1")

        fireEvent.click(screen.getByTitle("actions.mute"))
        expect(VideoPlayer.toggleMute).toHaveBeenCalledWith("/tmp/clip.mp4", "o1")

        fireEvent.click(screen.getByTitle("media._loop"))
        expect(VideoPlayer.toggleLoop).toHaveBeenCalledWith("/tmp/clip.mp4", "o1")
    })

    it("modo_transporte_permite_detener", () => {
        restore = setStoresForTest([looseEntry(outLocked, false), looseEntry(playerVideos, {}), looseEntry(focusMode, false)])
        render(<MediaControls currentOutput={outputWithVideo()} outputId="o1" transport />)
        fireEvent.click(screen.getByTitle("media.stop"))
        expect(clearBackground).toHaveBeenCalled()
    })
})
