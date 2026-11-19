// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, overlays, outputs, previewOutputId, styles } from "../../shared/core/stores"
import { OverlayEditor } from "./OverlayEditor"

const mocks = vi.hoisted(() => ({
    emitNewStyles: null as null | ((styles: { [key: string]: string | number }) => void),
    history: vi.fn(),
    send: vi.fn()
}))

vi.mock("../../shared/ui/system/Snaplines", () => ({
    Snaplines: ({ onNewStylesChange }: { onNewStylesChange?: (styles: { [key: string]: string | number }) => void }) => {
        mocks.emitNewStyles = onNewStylesChange ?? null
        return <div data-testid="snaplines" />
    }
}))
vi.mock("./editbox/Editbox", () => ({ Editbox: () => <div data-testid="editbox" /> }))
vi.mock("../../shared/ui/system/DropArea", () => ({ DropArea: ({ children }: { children?: ReactNode }) => <div data-testid="droparea">{children}</div> }))
vi.mock("../slide/Zoomed", () => ({ Zoomed: ({ children }: { children?: ReactNode }) => <div data-testid="zoomed">{children}</div> }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: mocks.history }))
vi.mock("../../shared/utils/request", () => ({ send: mocks.send }))

vi.mock("../../shared/audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))

afterEach(cleanup)
beforeEach(() => {
    mocks.history.mockClear()
    mocks.send.mockClear()
    mocks.emitNewStyles = null
})

describe("OverlayEditor", () => {
    it("renderiza el lienzo con sus hosts React y el estado vacío cuando no hay overlay", () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "missing", items: [] }), looseEntry(overlays, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { container } = render(<OverlayEditor />)
            expect(container.textContent).toContain("[empty.slide]")
        } finally {
            restore()
        }
    })

    it("renderiza Snaplines y Editbox y persiste los estilos que emite el arrastre", async () => {
        const restore = setStoresForTest([looseEntry(activeEdit, { id: "o1", items: [0] }), looseEntry(overlays, { o1: { name: "o", color: null, category: null, items: [{ type: "text", style: "left:0px;top:0px;" }] } }), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(previewOutputId, "out1")])

        try {
            const { getByTestId } = render(<OverlayEditor />)
            expect(getByTestId("droparea")).toBeTruthy()
            expect(getByTestId("zoomed")).toBeTruthy()
            expect(getByTestId("snaplines")).toBeTruthy()
            expect(getByTestId("editbox")).toBeTruthy()

            await act(async () => {
                mocks.emitNewStyles?.({ left: "10px" })
            })

            expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", oldData: { id: "o1" } }))
            expect(mocks.send).toHaveBeenCalled()
        } finally {
            restore()
        }
    })
})
