// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxLines } from "./EditboxLines"

vi.mock("../../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

vi.mock("../../../stores", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../stores")>()
    return {
        ...actual,
        activeEdit: {
            subscribe: (run: (v: unknown) => void) => {
                run({ items: [0], slide: 0, type: "show" })
                return () => {}
            },
            set: vi.fn(),
            update: vi.fn()
        },
        activeShow: {
            subscribe: (run: (v: unknown) => void) => {
                run({ id: "show1" })
                return () => {}
            }
        },
        activeStage: {
            subscribe: (run: (v: unknown) => void) => {
                run({ id: "st1", items: [] })
                return () => {}
            }
        },
        overlays: {
            ...(actual.overlays as object),
            update: vi.fn(),
            subscribe: (run: (v: unknown) => void) => {
                run({})
                return () => {}
            }
        },
        redoHistory: {
            subscribe: (run: (v: unknown) => void) => {
                run([])
                return () => {}
            }
        },
        refreshListBoxes: { set: vi.fn() },
        alertUpdates: {
            subscribe: (run: (v: unknown) => void) => {
                run(true)
                return () => {}
            },
            set: vi.fn()
        },
        showsCache: {
            subscribe: (run: (v: unknown) => void) => {
                run({})
                return () => {}
            },
            update: vi.fn()
        },
        special: {
            subscribe: (run: (v: unknown) => void) => {
                run({})
                return () => {}
            }
        },
        stageShows: {
            ...(actual.stageShows as object),
            update: vi.fn(),
            subscribe: (run: (v: unknown) => void) => {
                run({})
                return () => {}
            }
        },
        templates: {
            ...(actual.templates as object),
            update: vi.fn(),
            subscribe: (run: (v: unknown) => void) => {
                run({})
                return () => {}
            }
        }
    }
})
vi.mock("../../../show/slides", () => ({ splitCustomDynamicValues: () => null }))
vi.mock("../../../utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../utils/shortcuts", () => ({ getNormalizedKey: () => "v", isComposing: () => false, isFormattingKey: () => false }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/mover", () => ({ addToPos: (a: unknown[]) => a }))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../components/helpers/shows", () => ({ _show: () => ({ get: () => ({}), slides: () => ({ get: () => [{}], set: vi.fn(), add: vi.fn(), items: () => ({ set: vi.fn() }) }) }) }))
vi.mock("../../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/edit/scripts/shapeOutside", () => ({ calculateShapeVerticalOffset: () => 0, getShapeFloatSide: () => "left" }))
vi.mock("../../../components/edit/scripts/autosize", () => ({ default: () => 100 }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "", getLineText: () => "", getSelectionRange: () => [], setCaret: vi.fn() }))
vi.mock("../../../components/edit/editbox/EditboxHelper", () => ({
    EditboxHelper: {
        getStyleHtml: () => ({ html: '<div class="break"><span data-freeshow-text="true"></span></div>', currentStyle: "" }),
        getTextStyle: () => "",
        determineCaretLine: () => -1,
        splitAllCrlf: (x: unknown) => x,
        cutLinesInTwo: () => ({ firstLines: [], secondLines: [] })
    }
}))
vi.mock("../../../components/edit/editbox/EditboxPaste", () => ({ EditboxPaste: { handlePaste: vi.fn(), handleCopy: vi.fn(), handleCut: vi.fn(), paste: vi.fn() } }))

afterEach(cleanup)

describe("EditboxLines", () => {
    it("renderiza placeholder cuando el texto está vacío", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "", style: "" }] }] }
        const { container } = render(<EditboxLines item={item} ref={{ id: "s1" }} index={0} />)
        expect(container.querySelector(".placeholder")).toBeTruthy()
    })

    it("renderiza div editable cuando no está bloqueado", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "hola", style: "" }] }] }
        const { container } = render(<EditboxLines item={item} ref={{ id: "s1" }} index={0} />)
        expect(container.querySelector("[contenteditable]")).toBeTruthy()
    })
})
