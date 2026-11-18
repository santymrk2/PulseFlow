// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { requestMain, sendMain } from "../../IPC/main"
import { activeProject, focusMode, media, outLocked, outputs, playingVideos, projects, videoMarkers } from "../../stores"
import { encodeFilePath, getMediaLayerType } from "../../components/helpers/media"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { clearSlide } from "../../components/output/clear"
import { SoftLoopSync } from "../../components/media/video/softLoop"
import { syncVideoToAudio, videoSync } from "../../components/media/video/videoSync"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { VideoShow } from "./VideoShow"

vi.mock("../../IPC/main", () => ({ requestMain: vi.fn(async () => ({})), sendMain: vi.fn(), Main: { MEDIA_TRACKS: "tracks", GET_WINDOWS: "windows" } }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/helpers/media", () => ({
    addVideoMarker: vi.fn(),
    enableSubtitle: vi.fn(),
    encodeFilePath: vi.fn((path: string) => path),
    getExtension: vi.fn(() => "mp4"),
    getFileName: vi.fn((path: string) => path),
    getMediaLayerType: vi.fn(() => "background"),
    removeExtension: vi.fn((path: string) => path)
}))
vi.mock("../../components/helpers/output", () => ({ getFirstActiveOutput: vi.fn(() => null), setOutput: vi.fn() }))
vi.mock("../../components/helpers/time", () => ({ joinTime: vi.fn((value: string) => value), secondsToTime: vi.fn((value: number) => String(value)) }))
vi.mock("../../components/output/clear", () => ({ clearSlide: vi.fn() }))
vi.mock("../../components/media/video/softLoop", () => ({ SoftLoopSync: vi.fn(() => ({ update: vi.fn(() => 0), destroy: vi.fn() })) }))
vi.mock("../../components/media/video/videoSync", () => ({ syncVideoToAudio: vi.fn(), videoSync: vi.fn(() => () => {}) }))
vi.mock("../../components/show/media/subtitles", () => ({ formatVTT: vi.fn((v: string) => v), SRTtoVTT: vi.fn((v: string) => v) }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../system/HoverPlay", () => ({ HoverPlay: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, title }: { children?: ReactNode; title?: string }) => (
        <button type="button" data-title={title}>
            {children}
        </button>
    )
}))
vi.mock("../ui/hidden-input/HiddenInput", () => ({ HiddenInput: ({ value }: { value: string }) => <span data-name={value} /> }))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children?: ReactNode }) => <div data-testid="bar">{children}</div> }))
vi.mock("./MediaPicker", () => ({ MediaPicker: () => <div data-testid="media-picker" /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeProject, null), looseEntry(focusMode, false), looseEntry(media, {}), looseEntry(outLocked, false), looseEntry(outputs, {}), looseEntry(playingVideos, []), looseEntry(projects, {}), looseEntry(videoMarkers, {})])
    vi.mocked(getFirstActiveOutput).mockReturnValue(undefined)
    vi.mocked(encodeFilePath).mockImplementation((path: string) => path)
    vi.mocked(getMediaLayerType).mockReturnValue("background")
    vi.mocked(videoSync).mockReturnValue(() => {})
}

describe("VideoShow", () => {
    it("renderiza el video con la ruta indicada", () => {
        setStores()
        const { container } = render(<VideoShow mediaPath="/tmp/clip.mp4" />)
        const video = container.querySelector("video")
        expect(video).toBeTruthy()
        expect(video?.getAttribute("src")).toBe("/tmp/clip.mp4")
    })

    it("no renderiza video cuando la ruta está vacía", () => {
        setStores()
        const { container } = render(<VideoShow mediaPath="" />)
        expect(container.querySelector("video")).toBeNull()
    })

    it("monta el host del reproductor cuando es un player", () => {
        setStores()
        const host = document.createElement("div")
        host.setAttribute("data-testid", "player-host")
        const { container } = render(<VideoShow mediaPath="/tmp/clip.mp4" show={{ id: "p1", type: "player" }} playerHost={host} />)
        expect(container.querySelector("[data-testid='player-host']")).toBeTruthy()
        expect(sendMain).not.toHaveBeenCalledWith("tracks", expect.anything())
        expect(requestMain).not.toHaveBeenCalled()
        expect(clearSlide).not.toHaveBeenCalled()
        expect(syncVideoToAudio).not.toHaveBeenCalled()
        expect(SoftLoopSync).toHaveBeenCalled()
    })
})
