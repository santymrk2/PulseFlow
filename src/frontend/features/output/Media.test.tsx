// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Media from "./Media"

vi.mock("../../shared/utils/helpers/media", () => ({ downloadOnlineMedia: async (p: string) => p, getExtension: () => "jpg", getMediaType: () => "image" }))
vi.mock("../media/Video", () => ({ Video: () => <div data-testid="video" /> }))
vi.mock("../media/Image", () => ({ Image: () => <div data-testid="image" /> }))

afterEach(cleanup)

describe("Media", () => {
    it("renderiza imagen con su hijo React cuando no hay slotHost", () => {
        const { container, getByTestId, queryByTestId } = render(<Media path="a.jpg" />)
        expect(container).toBeTruthy()
        expect(getByTestId("image")).toBeTruthy()
        expect(queryByTestId("video")).toBeNull()
    })
})
