// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SceneMedia from "./SceneMedia"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("./Window", async () => ({ Window: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Window") }))
vi.mock("../../react/drawer/live/BMDStream", () => ({ BMDStream: () => <div data-testid="bmd" /> }))
vi.mock("../../react/drawer/live/NDIStream", () => ({ NDIStream: () => <div data-testid="ndi" /> }))
vi.mock("../../react/drawer/live/OMTStream", () => ({ OMTStream: () => <div data-testid="omt" /> }))
vi.mock("./Camera", () => ({ Camera: () => <div data-testid="camera" /> }))

afterEach(cleanup)

describe("SceneMedia", () => {
    it("no renderiza sin media", () => {
        const { container } = render(<SceneMedia />)
        expect(container.firstChild).toBeNull()
    })

    it("usa el port Window para media de pantalla", () => {
        const { container } = render(<SceneMedia media={{ type: "screen", id: "screen1" }} />)
        expect(container.querySelector('[data-isla="Window"]')).toBeTruthy()
    })
})
