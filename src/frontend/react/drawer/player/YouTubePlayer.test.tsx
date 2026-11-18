// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import YouTubePlayer from "./YouTubePlayer"

const on = vi.fn()
const destroy = vi.fn()
vi.mock("youtube-player", () => ({ default: vi.fn(() => ({ on, destroy, loadVideoById: vi.fn(), cueVideoById: vi.fn() })) }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("YouTubePlayer", () => {
    it("crea reproductor", () => {
        render(<YouTubePlayer videoId="abc12345678" />)
        expect(on).toHaveBeenCalled()
    })
})
