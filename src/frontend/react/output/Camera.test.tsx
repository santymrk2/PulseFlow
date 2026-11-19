// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Camera from "./Camera"

vi.mock("../../media/cameraManager", () => ({ cameraManager: { attachCamera: vi.fn(async () => "ok"), detachCamera: vi.fn() } }))
vi.mock("../../shared/core/stores", () => ({ media: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../../shared/utils/helpers/cropping", () => ({ getCropState: () => ({ mediaCropGeometry: "", cropHasValues: false, mediaContainerStyle: "" }) }))
vi.mock("../../shared/utils/helpers/media", () => ({ getMediaStyle: () => ({ style: "", filter: "", fit: "contain", flipped: false, flippedY: false, cropping: {} }) }))
vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Camera", () => {
    it("renderiza video", () => {
        const { container } = render(<Camera id="cam1" groupId="g1" preview />)
        expect(container.querySelector("video")).toBeTruthy()
    })
})
