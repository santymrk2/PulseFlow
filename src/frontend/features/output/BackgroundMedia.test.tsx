// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BackgroundMedia from "./BackgroundMedia"

vi.mock("../../shared/core/stores", () => ({ media: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, playerVideos: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) }, special: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/utils/helpers/media", () => ({
    getMediaStyle: () => ({}),
    getExtension: (path: string) => path.split(".").pop() || "",
    getMediaType: (extension: string) => (["mp4", "mov"].includes(extension) ? "video" : "image"),
    downloadOnlineMedia: async (path: string) => path,
    encodeFilePath: (path: string) => path,
    cropImageToBase64: async (path: string) => path
}))
vi.mock("../media/Video", () => ({ Video: () => <video data-testid="video" /> }))
vi.mock("./Window", async () => ({ Window: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Window") }))
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

    it("renderiza una imagen de fondo (type media) con su path", () => {
        const { container } = render(<BackgroundMedia data={{ path: "/img/logo.png", type: "image" } as unknown as never} transition={{ type: "none", duration: 0 } as unknown as never} />)
        const img = container.querySelector("img") as HTMLImageElement
        expect(img).toBeTruthy()
        expect(img.getAttribute("src")).toContain("/img/logo.png")
    })
})
