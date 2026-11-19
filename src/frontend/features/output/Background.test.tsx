// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Background from "./Background"

vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("./BackgroundMedia", async () => ({ BackgroundMedia: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("BackgroundMedia") }))

afterEach(cleanup)

describe("Background", () => {
    it("renderiza sin datos", () => {
        const { container } = render(<Background data={{} as unknown as never} outputId="o1" transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(container).toBeTruthy()
    })
})
