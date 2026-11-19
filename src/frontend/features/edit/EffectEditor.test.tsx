// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, effects, outputs, previewOutputId, styles } from "../../shared/core/stores"
import { EffectEditor } from "./EffectEditor"

vi.mock("../../shared/audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../output/Effect", async () => ({ Effect: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Effect") }))

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
