// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Media from "./Media"

vi.mock("../../components/helpers/media", () => ({ downloadOnlineMedia: async (p: string) => p, getExtension: () => "jpg", getMediaType: () => "image" }))

afterEach(cleanup)

describe("Media", () => {
    it("renderiza imagen", () => {
        const { container } = render(<Media path="a.jpg" />)
        expect(container).toBeTruthy()
    })
})
