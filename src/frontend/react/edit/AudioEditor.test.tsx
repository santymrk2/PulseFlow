// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, activeShow, media } from "../../stores"
import { AudioEditor } from "./AudioEditor"

vi.mock("../../audio/audioPlayer", () => ({
    AudioPlayer: {
        getDuration: () => Promise.resolve(0),
        getStartTime: () => 0,
        getEndTime: () => 0
    }
}))

vi.mock("../../audio/audioWaveform", () => ({
    WAVEFORM_SAMPLES: 8,
    createWaveform: () => Promise.resolve()
}))

afterEach(() => {
    cleanup()
})

describe("AudioEditor", () => {
    it("renderiza barras y recortes", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "a.mp3" }), looseEntry(activeShow, null), looseEntry(media, {})])

        try {
            const { container } = render(<AudioEditor />)
            expect(container.querySelectorAll(".wave-bar").length).toBe(8)
            expect(container.querySelectorAll("[class*='trim']").length).toBe(2)
        } finally {
            restore()
        }
    })
})
