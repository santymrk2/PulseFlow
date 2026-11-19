// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Image } from "./Image"

vi.mock("../../shared/utils/helpers/media", () => ({
    encodeFilePath: (path: string) => `encoded:${path}`,
    cropImageToBase64: vi.fn(async () => "data:image/png;base64,crop")
}))

describe("Image", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders image and dispatches loaded", () => {
        const onLoaded = vi.fn()
        const { container } = render(<Image path="/tmp/test.png" onLoaded={onLoaded} />)
        const img = container.querySelector("img") as HTMLImageElement
        expect(img.getAttribute("src")).toBe("encoded:/tmp/test.png")
        fireEvent.load(img)
        expect(onLoaded).toHaveBeenCalledWith(true)
    })

    it("renders blur layer when fit is blur", () => {
        const { container } = render(<Image path="/tmp/test.png" mediaStyle={{ fit: "blur" }} />)
        const imgs = container.querySelectorAll("img")
        expect(imgs.length).toBe(2)
    })
})
