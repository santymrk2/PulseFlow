// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, media } from "../../shared/core/stores"
import { clearIslands } from "../../shared/test/islandMock"
import { CameraEditor } from "./CameraEditor"

vi.mock("../../shared/audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../features/drawer/live/Cam", async () => ({ Cam: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Cam") }))

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
