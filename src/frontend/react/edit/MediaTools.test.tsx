// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, activeShow, media } from "../../stores"
import { MediaTools } from "./MediaTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: () => <div data-testid="island" />
}))

vi.mock("../../components/media/video/videoPlayer", () => ({
    VideoPlayer: {
        getDuration: () => Promise.resolve(0),
        updateProperties: () => {}
    }
}))

afterEach(() => {
    cleanup()
})

describe("MediaTools", () => {
    it("renderiza las herramientas de medios", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "img.png", type: "media" }), looseEntry(activeShow, null), looseEntry(media, {})])

        try {
            const { container } = render(<MediaTools />)
            expect(container.querySelector(".main.border.editTools")).not.toBeNull()
        } finally {
            restore()
        }
    })
})
