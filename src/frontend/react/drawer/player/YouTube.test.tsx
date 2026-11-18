// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import YouTube from "./YouTube"

vi.mock("../../../stores", () => ({ focusMode: { subscribe: (fn: (value: unknown) => void) => (fn(false), () => {}) }, special: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => <div data-testid="yt-player" /> }))

afterEach(cleanup)

describe("YouTube", () => {
    it("renderiza", () => {
        const { getByTestId } = render(<YouTube id="abcdefghijkl" />)
        expect(getByTestId("yt-player")).toBeTruthy()
    })
})
