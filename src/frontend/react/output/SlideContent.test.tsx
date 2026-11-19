// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SlideContent from "./SlideContent"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (value: unknown) => JSON.parse(JSON.stringify(value)) }))
vi.mock("../../shared/utils/helpers/fonts", () => ({ loadCustomFonts: () => {} }))
vi.mock("../../shared/utils/helpers/output", () => ({ getStyleTemplate: () => ({}), itemNeedsAutoSize: () => false, slideHasAutoSizeItem: () => false }))
vi.mock("../../features/slide/Textbox", () => ({ Textbox: () => null }))
vi.mock("./SlideItemTransition", () => ({ SlideItemTransition: () => null }))

afterEach(cleanup)

describe("SlideContent", () => {
    it("renderiza sin cascarón Svelte", () => {
        const { container } = render(<SlideContent outputId="o1" outSlide={{ id: "s1", index: 0 } as never} slideData={null} currentSlide={null} currentStyle={null} animationData={{}} lines={{}} ratio={1} transition={{ type: "none", duration: 0, easing: "" }} />)
        expect(container).toBeTruthy()
    })
})
