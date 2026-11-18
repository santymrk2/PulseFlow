// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BackgroundMedia from "./BackgroundMedia"

vi.mock("../../stores", () => ({ media: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, playerVideos: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, special: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../components/helpers/media", () => ({ getMediaStyle: () => ({}) }))
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="island" /> }))
vi.mock("./Camera", () => ({ Camera: () => <div data-testid="camera" /> }))
vi.mock("./OutputTransition", () => ({ OutputTransition: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))
vi.mock("../drawer/live/BMDStream", () => ({ BMDStream: () => null }))
vi.mock("../drawer/live/NDIStream", () => ({ NDIStream: () => null }))
vi.mock("../drawer/live/OMTStream", () => ({ OMTStream: () => null }))

afterEach(cleanup)

describe("BackgroundMedia", () => {
    it("renderiza", () => {
        const { container } = render(<BackgroundMedia data={{ path: "a.jpg", type: "image" } as unknown as never} transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(container).toBeTruthy()
    })
})
