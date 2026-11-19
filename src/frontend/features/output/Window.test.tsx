// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Window } from "./Window"

const stop = vi.fn()
const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
const getUserMedia = vi.fn(async () => stream)

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Window", () => {
    it("renderiza_lo_principal", () => {
        Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true })
        const { container } = render(<Window id="screen-1" />)
        const video = container.querySelector("video")
        expect(video).toBeTruthy()
        expect(video?.querySelector("track")).toBeTruthy()
    })
})
