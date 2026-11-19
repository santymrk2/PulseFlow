// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, activeShow, media } from "../../shared/core/stores"
import { AudioTools } from "./AudioTools"

vi.mock("./tools/EditValues", () => ({
    EditValues: () => <div data-testid="edit-values" />
}))

vi.mock("../../audio/audioPlayer", () => ({
    AudioPlayer: {
        getDuration: () => Promise.resolve(0),
        updateVolume: () => {},
        setPitch: () => {},
        setTempo: () => {}
    }
}))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (id: string) => id }))

afterEach(() => {
    cleanup()
})

describe("AudioTools", () => {
    it("renderiza los valores de audio", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "a.mp3" }), looseEntry(activeShow, null), looseEntry(media, { "a.mp3": {} })])

        try {
            const { getByTestId } = render(<AudioTools />)
            expect(getByTestId("edit-values")).toBeTruthy()
        } finally {
            restore()
        }
    })
})
