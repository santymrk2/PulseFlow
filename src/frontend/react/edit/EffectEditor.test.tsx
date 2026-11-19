// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, effects, outputs, previewOutputId, styles } from "../../shared/core/stores"
import { EffectEditor } from "./EffectEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../output/Effect", async () => ({ Effect: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Effect") }))

afterEach(() => {
    cleanup()
})

describe("EffectEditor", () => {
    it("renderiza el estado vacío cuando no hay items", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "e1" }), looseEntry(effects, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { container } = render(<EffectEditor />)
            expect(container.textContent).toContain("[empty.general]")
        } finally {
            restore()
        }
    })
})
