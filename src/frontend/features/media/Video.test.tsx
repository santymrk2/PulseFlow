// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/utils/helpers/media", () => ({
    enableSubtitle: vi.fn(),
    encodeFilePath: (p: string) => p,
    isVideoSupported: vi.fn()
}))
vi.mock("./logic/video/softLoop", () => ({
    SoftLoopSync: class {
        update() { return 0 }
        destroy() {}
    }
}))
vi.mock("./logic/video/videoSync", () => ({
    clampPlaybackRate: (n: number) => n,
    syncVideoToAudio: vi.fn(),
    videoSync: () => () => {}
}))

import { Video } from "./Video"

describe("Video", () => {
    afterEach(() => cleanup())

    it("renderiza un elemento video con el src codificado", () => {
        const { container } = render(<Video outputId="o1" path="media/test.mp4" />)
        const video = container.querySelector("video")
        expect(video).toBeTruthy()
        expect(video?.getAttribute("src")).toBe("media/test.mp4")
    })

    it("dispara onLoaded al cargar metadata", () => {
        const onLoaded = vi.fn()
        const { container } = render(<Video outputId="o1" path="media/test.mp4" onLoaded={onLoaded} />)
        const video = container.querySelector("video") as HTMLVideoElement
        video.dispatchEvent(new Event("loadedmetadata"))
        expect(onLoaded).toHaveBeenCalledWith(true)
    })
})
