// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { outputs, previewOutputId, showsCache, styles as stylesStore } from "../../shared/core/stores"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { getStageTextLayoutOffset } from "./logic/stage"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { SlideText } from "./SlideText"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getItemText: vi.fn(() => "Hola") }))
vi.mock("../../shared/utils/helpers/output", () => ({ getResolution: vi.fn(() => ({ width: 1920, height: 1080 })) }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: vi.fn(() => [{ id: "s1" }]) }))
vi.mock("../../components/slide/getStyleResolution", () => ({ getStyleResolution: vi.fn(() => "width: 100%;") }))
vi.mock("./logic/stage", () => ({ getStageTextLayoutOffset: vi.fn(() => 0) }))
vi.mock("../../react/slide/observeResize", () => ({ observeResize: vi.fn(() => ({ destroy: vi.fn() })) }))
vi.mock("../../react/slide/Textbox", () => ({
    Textbox: (props: Record<string, unknown>) => <span data-view="Textbox" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}))
vi.mock("../../react/slide/Zoomed", () => ({
    Zoomed: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
        <div data-view="Zoomed" data-props={JSON.stringify(props)}>
            {children}
        </div>
    )
}))

const currentSlide = { id: "sh1", index: 0, revealCount: 2, itemClickReveal: true } as never
const stageItem = { id: "t1", type: "slide_text", auto: true, lineCount: 3 } as never
const ref = { type: "stage" as const, id: "st1" }

let restore: () => void = () => {}
beforeEach(() => {
    vi.useFakeTimers()
    restore = setStoresForTest([looseEntry(showsCache, { sh1: { slides: { s1: { id: "s1", items: [{ id: "i1", type: "text", lines: [{ text: [] }] }] } } } }), looseEntry(outputs, {}), looseEntry(stylesStore, {}), looseEntry(previewOutputId, "")])
    vi.mocked(getItemText).mockReturnValue("Hola")
})
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

function renderSlideText(props: Record<string, unknown> = {}) {
    return render(<SlideText currentSlide={currentSlide} stageItem={stageItem} ref={ref} {...props} />)
}

describe("SlideText", () => {
    it("renderiza los textos del slide con la configuración del stage", () => {
        const { container } = renderSlideText({ autoSize: true, fontSize: 42, chords: true, textStyle: "color: red;" })
        const textbox = JSON.parse(container.querySelector("[data-view='Textbox']")!.getAttribute("data-props") || "{}")
        expect(textbox).toMatchObject({
            chords: true,
            customStyle: "color: red;",
            fontSize: 42,
            isStage: true,
            maxLines: 0,
            revealed: 1,
            clickRevealed: true,
            stageAutoSize: true
        })
    })

    it("alterna los dos juegos de ítems para pre-calcular el auto size", () => {
        const { container } = renderSlideText()
        expect(container.querySelectorAll("[data-view='Textbox']")).toHaveLength(1)
        expect(container.querySelector(".loading")).toBeTruthy()
        act(() => vi.advanceTimersByTime(200))
        expect(container.querySelector(".loading")).toBeNull()
    })

    it("usa el offset slidelayout cuando el slide no es temporal", () => {
        vi.mocked(getStageTextLayoutOffset).mockReturnValue(0 as never)
        renderSlideText({ slideOffset: 1, style: true })
        expect(getStageTextLayoutOffset).toHaveBeenCalled()
        expect(getStyleResolution).toHaveBeenCalled()
    })

    it("combina los items de texto cuando no hay estilo", () => {
        const { container } = renderSlideText({ style: false })
        expect(container.querySelectorAll("[data-view='Textbox']")).toHaveLength(1)
    })

    it("no renderiza nada en modo estilo si no hay slide", () => {
        restore()
        restore = setStoresForTest([looseEntry(showsCache, { sh1: { slides: {} } }), looseEntry(outputs, {}), looseEntry(stylesStore, {}), looseEntry(previewOutputId, "")])
        const { container } = renderSlideText({ style: true })
        expect(container.firstChild).toBeNull()
    })
})
