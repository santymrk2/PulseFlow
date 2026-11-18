// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, overlays, scenes, selected, styles } from "../../stores"
import { SceneTools } from "./SceneTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: () => <div data-testid="tabs" />
}))

afterEach(() => {
    cleanup()
})

describe("SceneTools", () => {
    it("muestra el campo de media y los overlays de la escena", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "sc1" }), looseEntry(scenes, { sc1: { content: { overlays: ["o1"] } } }), looseEntry(styles, {}), looseEntry(overlays, { o1: { name: "Overlay 1" } }), looseEntry(selected, { id: null, data: [] })])

        try {
            const { container } = render(<SceneTools />)
            expect(container.querySelector(".main.border.editTools")).not.toBeNull()
            expect(container.textContent).toContain("Overlay 1")
        } finally {
            restore()
        }
    })
})
