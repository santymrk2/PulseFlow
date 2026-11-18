// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SlideContent from "./SlideContent"

vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="slide-impl" /> }))
vi.mock("../../components/output/layers/SlideContentImpl.svelte", () => ({ default: {} }))

afterEach(cleanup)

describe("SlideContent", () => {
    it("renderiza", () => {
        const { getByTestId } = render(<SlideContent outputId="o1" outSlide={{ id: "s1", index: 0 } as unknown as never} slideData={null} currentSlide={{}} currentStyle={{}} animationData={{}} lines={{}} ratio={1} />)
        expect(getByTestId("slide-impl")).toBeTruthy()
    })
})
