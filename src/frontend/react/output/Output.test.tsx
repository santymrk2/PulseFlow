// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Output from "./Output"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/helpers/array", () => ({ clone: (value: unknown) => JSON.parse(JSON.stringify(value)) }))
vi.mock("../../components/helpers/output", () => ({
    defaultLayers: ["background", "slide", "overlays"],
    getCurrentStyle: () => ({ name: "" }),
    getMetadata: () => null,
    getOutputLines: () => ({ start: null, end: null }),
    getOutputTransitions: () => ({
        text: { type: "none", duration: 0, easing: "" },
        media: { type: "none", duration: 0, easing: "" },
        overlay: { type: "none", duration: 0, easing: "" }
    }),
    getResolution: () => ({ width: 1920, height: 1080 }),
    getSlideFilter: () => "",
    getStyleTemplate: () => ({}),
    setTemplateStyle: (_out: unknown, _style: unknown, items: unknown) => items
}))
vi.mock("../slide/Zoomed", () => ({ Zoomed: ({ children }: { children?: React.ReactNode }) => <div data-testid="zoomed">{children}</div> }))

afterEach(cleanup)

describe("Output", () => {
    it("compone directly el port Zoomed sin SvelteIsland", () => {
        const { getByTestId } = render(<Output outputId="o1" />)
        expect(getByTestId("zoomed")).toBeTruthy()
    })
})
