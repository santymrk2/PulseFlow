// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxLines } from "./EditboxLines"

vi.mock("../../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ items: [0], slide: 0 })
            return () => {}
        },
        set: vi.fn()
    },
    activeShow: {
        subscribe: (r: any) => {
            r({ id: "s1" })
            return () => {}
        }
    },
    activeStage: {
        subscribe: (r: any) => {
            r({ id: "st1" })
            return () => {}
        }
    },
    overlays: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        },
        update: vi.fn()
    },
    redoHistory: {
        subscribe: (r: any) => {
            r([])
            return () => {}
        }
    },
    refreshListBoxes: { set: vi.fn() },
    showsCache: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        },
        update: vi.fn()
    },
    special: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    stageShows: {
        subscribe: (r: (v: unknown) => void) => {
            r({})
            return () => {}
        },
        update: vi.fn()
    },
    templates: {
        subscribe: (r: (v: unknown) => void) => {
            r({})
            return () => {}
        },
        update: vi.fn()
    }
}))
vi.mock("../../../shared/utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../app/wiring/shortcuts", () => ({ getNormalizedKey: () => "", isComposing: () => false, isFormattingKey: () => false }))
vi.mock("../../../show/slides", () => ({ splitCustomDynamicValues: () => null }))
vi.mock("../../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v))) }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/mover", () => ({ addToPos: (a: unknown[]) => a }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => ({}), slides: () => ({ get: () => [{}], set: vi.fn(), add: vi.fn() }) }) }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/edit/scripts/shapeOutside", () => ({ getShapeFloatSide: () => "left", calculateShapeVerticalOffset: () => 0 }))
vi.mock("../../../components/edit/scripts/autosize", () => ({ default: () => 100 }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "hola", getLineText: () => "hola", getSelectionRange: () => [], setCaret: vi.fn() }))
vi.mock("../../../components/edit/editbox/EditboxHelper", () => ({
    EditboxHelper: {
        getStyleHtml: () => ({ html: '<div class="break"><span data-freeshow-text="true">hola</span></div>', currentStyle: "" }),
        getTextStyle: () => "",
        determineCaretLine: () => -1,
        splitAllCrlf: (x: unknown) => x,
        cutLinesInTwo: () => ({ firstLines: [], secondLines: [] })
    }
}))
vi.mock("../../../components/edit/editbox/EditboxPaste", () => ({ EditboxPaste: { handlePaste: vi.fn(), handleCopy: vi.fn(), handleCut: vi.fn(), paste: vi.fn() } }))
vi.mock("./EditboxChords", () => ({ EditboxChords: () => null }))

afterEach(cleanup)

describe("EditboxLines", () => {
    it("renderiza el área editable para ítems con líneas", () => {
        const item: Item = { lines: [{ align: "", text: [{ value: "hola", style: "" }] }] } as any
        const { container } = render(<EditboxLines item={item} ref={{ id: "s1" }} index={0} />)
        expect(container.querySelector(".edit")).toBeTruthy()
        expect(container.querySelector("[contenteditable]")).toBeTruthy()
    })

    it("no renderiza nada sin líneas", () => {
        const item: Item = { type: "text" } as any
        const { container } = render(<EditboxLines item={item} ref={{ id: "s1" }} index={0} />)
        expect(container.firstChild).toBeNull()
    })
})
