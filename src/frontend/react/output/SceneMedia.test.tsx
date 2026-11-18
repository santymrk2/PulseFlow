// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SceneMedia from "./SceneMedia"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="island" /> }))
vi.mock("../drawer/live/BMDStream", () => ({ BMDStream: () => <div data-testid="bmd" /> }))
vi.mock("../drawer/live/NDIStream", () => ({ NDIStream: () => <div data-testid="ndi" /> }))
vi.mock("../drawer/live/OMTStream", () => ({ OMTStream: () => <div data-testid="omt" /> }))
vi.mock("./Camera", () => ({ Camera: () => <div data-testid="camera" /> }))

afterEach(cleanup)

describe("SceneMedia", () => {
    it("no renderiza sin media", () => {
        const { container } = render(<SceneMedia />)
        expect(container.firstChild).toBeNull()
    })
})
