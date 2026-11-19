// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Overlays from "./Overlays"

vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("./OutputOverlay", () => ({ Overlay: () => <div data-testid="overlay" /> }))

afterEach(cleanup)

describe("Overlays", () => {
    it("renderiza", () => {
        const { container } = render(<Overlays outputId="o" overlays={null} activeOverlays={[]} transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(container).toBeTruthy()
    })
})
