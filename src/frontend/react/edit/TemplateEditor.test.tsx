// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, templates } from "../../stores"
import { TemplateEditor } from "./TemplateEditor"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))

afterEach(() => {
    cleanup()
})

describe("TemplateEditor", () => {
    it("renderiza el estado vacío cuando no hay plantilla", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "missing", items: [] }), looseEntry(templates, {})])

        try {
            const { container } = render(<TemplateEditor newStyles={{}} />)
            expect(container.textContent).toContain("[empty.slide]")
        } finally {
            restore()
        }
    })
})
