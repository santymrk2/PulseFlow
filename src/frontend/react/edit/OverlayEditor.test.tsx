// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, outputs, overlays, previewOutputId, styles } from "../../stores"
import { OverlayEditor } from "./OverlayEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))

afterEach(() => {
    cleanup()
})

describe("OverlayEditor", () => {
    it("renderiza el estado vacío cuando no hay overlay", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "missing", items: [] }), looseEntry(overlays, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { container } = render(<OverlayEditor newStyles={{}} />)
            expect(container.textContent).toContain("[empty.slide]")
        } finally {
            restore()
        }
    })
})
