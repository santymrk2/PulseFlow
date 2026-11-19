// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, activeShow, media, outputs, playingVideoState, previewOutputId, styles } from "../../shared/core/stores"
import { MediaEditor } from "./MediaEditor"

interface MediaMockProps {
    path: string
    videoData: { paused: boolean; muted: boolean; duration: number; loop: boolean }
    videoTime: number
    onVideoDataChange?: (patch: { paused?: boolean; duration?: number; loop?: boolean }) => void
    onVideoTimeChange?: (time: number) => void
}

type SliderMockProps = {
    videoData: MediaMockProps["videoData"]
    videoTime: number
    onVideoDataChange?: (patch: { paused?: boolean }) => void
    onVideoTimeChange?: (time: number) => void
}

const mocks = vi.hoisted(() => ({
    isVideo: false,
    mediaProps: null as MediaMockProps | null,
    sliderProps: null as SliderMockProps | null
}))

vi.mock("../output/Media", () => ({
    Media: (props: MediaMockProps) => {
        mocks.mediaProps = props
        return <div data-testid="media" />
    }
}))
vi.mock("../output/VideoSlider", () => ({
    VideoSlider: (props: SliderMockProps) => {
        mocks.sliderProps = props
        return <div data-testid="video-slider" />
    }
}))

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/media/video/videoPlayer", () => ({
    VideoPlayer: { getDuration: () => Promise.resolve(42) }
}))

vi.mock("../../shared/utils/helpers/media", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../shared/utils/helpers/media")>()
    return {
        ...actual,
        getMedia: () => Promise.resolve(null),
        getMediaType: () => (mocks.isVideo ? "video" : "image")
    }
})

function setStores() {
    return setStoresForTest([looseEntry(activeEdit, { id: "img.png", type: "media" }), looseEntry(activeShow, null), looseEntry(media, {}), looseEntry(outputs, {}), looseEntry(playingVideoState, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])
}

afterEach(cleanup)
beforeEach(() => {
    mocks.isVideo = false
    mocks.mediaProps = null
    mocks.sliderProps = null
})

describe("MediaEditor", () => {
    it("renderiza Media con el estado interno del reproductor, sin slider para imágenes", async () => {
        const restore = setStores()

        try {
            const { getByTestId, queryByTestId } = render(<MediaEditor />)
            expect(getByTestId("media")).toBeTruthy()
            expect(queryByTestId("video-slider")).toBeNull()
            await act(async () => {})
            expect(mocks.mediaProps?.path).toBe("img.png")
            expect(mocks.mediaProps?.videoData).toMatchObject({ paused: false, muted: true, loop: true, duration: 42 })
        } finally {
            restore()
        }
    })

    it("renderiza VideoSlider para videos y comparte el tiempo entre ambos hosts", async () => {
        mocks.isVideo = true
        const restore = setStores()

        try {
            const { getByTestId } = render(<MediaEditor />)
            expect(getByTestId("video-slider")).toBeTruthy()

            await act(async () => {
                mocks.sliderProps?.onVideoTimeChange?.(12)
            })

            expect(mocks.mediaProps?.videoTime).toBe(12)

            await act(async () => {
                mocks.mediaProps?.onVideoDataChange?.({ paused: true })
            })

            expect(mocks.sliderProps?.videoData.paused).toBe(true)
        } finally {
            restore()
        }
    })
})
