// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, media } from "../../stores"
import { clearIslands } from "../test/islandMock"
import { CameraEditor } from "./CameraEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../drawer/live/Cam", async () => ({ Cam: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Cam") }))

afterEach(() => {
    cleanup()
    clearIslands()
})

describe("CameraEditor", () => {
    it("renderiza la cámara cuando hay datos", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "cam1", data: { id: "cam1" } }), looseEntry(media, {})])

        try {
            const { container } = render(<CameraEditor />)
            expect(container.querySelector("[data-isla='Cam']")).toBeTruthy()
        } finally {
            restore()
        }
    })
})
