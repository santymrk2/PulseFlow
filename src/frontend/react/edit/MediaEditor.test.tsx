// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, activeShow, media, outputs, playingVideoState, previewOutputId, styles } from "../../stores"
import { MediaEditor } from "./MediaEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/media/video/videoPlayer", () => ({
    VideoPlayer: { getDuration: () => Promise.resolve(0) }
}))

vi.mock("../../components/helpers/media", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../components/helpers/media")>()
    return {
        ...actual,
        getMedia: () => Promise.resolve(null),
        getMediaType: () => "image"
    }
})

afterEach(() => {
    cleanup()
})

describe("MediaEditor", () => {
    it("renderiza el contenedor del editor de medios", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "img.png", type: "media" }), looseEntry(activeShow, null), looseEntry(media, {}), looseEntry(outputs, {}), looseEntry(playingVideoState, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { container } = render(<MediaEditor videoData={{ paused: false, muted: true, duration: 0, loop: true }} videoTime={0} />)
            expect(container.firstElementChild).not.toBeNull()
        } finally {
            restore()
        }
    })
})
