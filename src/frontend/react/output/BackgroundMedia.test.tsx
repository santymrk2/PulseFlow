// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BackgroundMedia from "./BackgroundMedia"

vi.mock("../../shared/core/stores", () => ({ media: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, playerVideos: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, special: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/utils/helpers/media", () => ({ getMediaStyle: () => ({}) }))
vi.mock("./Window", async () => ({ Window: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Window") }))
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

    it("usa el port Window para fondos de pantalla", () => {
        const { container } = render(<BackgroundMedia data={{ path: "screen1", type: "screen" } as unknown as never} transition={{ type: "none", duration: 0 } as unknown as never} />)
        const windowView = container.querySelector('[data-isla="Window"]') as HTMLElement
        expect(windowView).toBeTruthy()
        expect(JSON.parse(windowView.dataset.props || "{}").id).toBe("screen1")
    })
})
