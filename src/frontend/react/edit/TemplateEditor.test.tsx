// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, templates } from "../../shared/core/stores"
import { TemplateEditor } from "./TemplateEditor"

const mocks = vi.hoisted(() => ({
    emitNewStyles: null as null | ((styles: { [key: string]: string | number }) => void),
    history: vi.fn()
}))

vi.mock("../drawer/pages/TemplateSlide", () => ({
    TemplateSlide: ({ onNewStylesChange }: { onNewStylesChange?: (styles: { [key: string]: string | number }) => void }) => {
        mocks.emitNewStyles = onNewStylesChange ?? null
        return <div data-testid="template-slide" />
    }
}))
vi.mock("../system/DropArea", () => ({ DropArea: ({ children }: { children?: ReactNode }) => <div data-testid="droparea">{children}</div> }))
vi.mock("../../components/helpers/history", () => ({ history: mocks.history }))

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))

afterEach(cleanup)
beforeEach(() => {
    mocks.history.mockClear()
    mocks.emitNewStyles = null
})

describe("TemplateEditor", () => {
    it("renderiza el estado vacío cuando no hay plantilla", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "missing", items: [] }), looseEntry(templates, {})])

        try {
            const { container } = render(<TemplateEditor />)
            expect(container.textContent).toContain("[empty.slide]")
        } finally {
            restore()
        }
    })

    it("monta TemplateSlide dentro del DropArea y persiste sus estilos", async () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "t1", items: [0] }), looseEntry(templates, { t1: { name: "t", color: null, category: null, items: [{ type: "text", style: "left:0px;" }] } })])

        try {
            const { getByTestId } = render(<TemplateEditor />)
            expect(getByTestId("droparea")).toBeTruthy()
            expect(getByTestId("template-slide")).toBeTruthy()

            await act(async () => {
                mocks.emitNewStyles?.({ left: "10px" })
            })

            expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", oldData: { id: "t1" } }))
        } finally {
            restore()
        }
    })
})
