// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../shared/test/mockCommon"
import { Image } from "./Image"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

afterEach(() => cleanup())

describe("Image", () => {
    it("no_renderiza_si_no_hay_src", () => {
        const { container } = render(<Image src="" alt="x" />)
        expect(container.querySelector("img")).toBeNull()
    })

    it("renderiza_img_con_src", () => {
        const { container } = render(<Image src="http://example.com/a.png" alt="alt" />)
        expect(container.querySelector("img")).toBeTruthy()
    })
})
