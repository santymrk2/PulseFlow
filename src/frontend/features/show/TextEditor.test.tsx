// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { textEditZoom } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { TextEditor } from "./TextEditor"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../app/wiring/shortcuts", () => ({ getNormalizedKey: vi.fn(() => "f") }))
vi.mock("../../shared/utils/chordTranspose", () => ({ transposeText: vi.fn((text: string) => text) }))
vi.mock("./logic/formatTextEditor", () => ({ formatText: vi.fn() }))
vi.mock("./logic/getTextEditor", () => ({ getPlainEditorText: vi.fn(() => "Texto plano") }))
vi.mock("../../converters/txt", () => ({ getQuickExample: vi.fn(() => "Ejemplo") }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: () => <span data-icon /> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick, disabled }: { children: unknown; onClick?: () => void; disabled?: boolean }) => (
        <button onClick={onClick} disabled={disabled}>
            {children as never}
        </button>
    )
}))
vi.mock("../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children, side }: { children: unknown; side?: string }) => <div data-bar={side}>{children as never}</div> }))
vi.mock("../../shared/ui/kit/zoom-control/ZoomControl", () => ({ ZoomControl: ({ hidden }: { hidden?: boolean }) => <div data-zoom={String(hidden)} /> }))
vi.mock("./tools/HighlightedNotes", () => ({ HighlightedNotes: ({ value }: { value: string }) => <textarea data-notes value={value} readOnly /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("TextEditor", () => {
    it("muestra el texto del show y la barra de zoom", () => {
        restore = setStoresForTest([looseEntry(textEditZoom, 10)])
        const { container } = render(<TextEditor currentShow={{ id: "show1", slides: {} } as never} />)
        expect((container.querySelector("[data-notes]") as HTMLTextAreaElement).value).toBe("Texto plano")
        expect(container.querySelector("[data-bar='left']")).toBeTruthy()
        expect(container.querySelector("[data-zoom]")!.getAttribute("data-zoom")).toBe("false")
    })

    it("muestra los botones de transposición cuando hay acordes", () => {
        restore = setStoresForTest([looseEntry(textEditZoom, 10)])
        const show = { id: "show1", slides: { s1: { items: [{ lines: [{ chords: "C" }] }] } } }
        const { container } = render(<TextEditor currentShow={show as never} />)
        expect(container.querySelectorAll("button")).toHaveLength(2)
    })
})
