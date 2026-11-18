// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, effects } from "../../stores"
import { EffectTools } from "./EffectTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: () => <div data-testid="island" />
}))

afterEach(() => {
    cleanup()
})

describe("EffectTools", () => {
    it("renderiza las herramientas de efecto", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "e1" }), looseEntry(effects, { e1: { items: [{ type: "shape", shape: "circle" }] } })])

        try {
            const { container } = render(<EffectTools />)
            expect(container.querySelector(".main.border.editTools")).not.toBeNull()
        } finally {
            restore()
        }
    })
})
