// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, outputs, previewOutputId, scenes, styles } from "../../shared/core/stores"
import { SceneEditor } from "./SceneEditor"

vi.mock("../../shared/audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../features/drawer/pages/ScenePreview", () => ({
    ScenePreview: () => <div data-testid="scene-preview" />
}))

afterEach(() => {
    cleanup()
})

describe("SceneEditor", () => {
    it("renderiza el estado vacío cuando no hay escena", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "missing" }), looseEntry(scenes, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { container } = render(<SceneEditor />)
            expect(container.textContent).toContain("[empty.general]")
        } finally {
            restore()
        }
    })
})
