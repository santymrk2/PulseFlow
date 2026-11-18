// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, media } from "../../stores"
import { CameraEditor } from "./CameraEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: () => <div data-testid="cam" />
}))

afterEach(() => {
    cleanup()
})

describe("CameraEditor", () => {
    it("renderiza la cámara cuando hay datos", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "cam1", data: { id: "cam1" } }), looseEntry(media, {})])

        try {
            const { getByTestId } = render(<CameraEditor />)
            expect(getByTestId("cam")).toBeTruthy()
        } finally {
            restore()
        }
    })
})
