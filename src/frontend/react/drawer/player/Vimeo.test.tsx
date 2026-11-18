// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Vimeo from "./Vimeo"

vi.mock("@vimeo/player", () => ({
    default: class {
        on() {}
        off() {}
        setColor() {
            return Promise.resolve()
        }
        setMuted() {
            return Promise.resolve()
        }
        pause() {
            return Promise.resolve()
        }
        play() {
            return Promise.resolve()
        }
        unload() {
            return Promise.resolve()
        }
        setCurrentTime() {
            return Promise.resolve()
        }
        getCurrentTime() {
            return Promise.resolve(0)
        }
    }
}))
vi.mock("../../../stores", () => ({
    focusMode: { subscribe: (fn: (value: unknown) => void) => (fn(false), () => {}) },
    theme: { subscribe: (fn: (value: unknown) => void) => (fn("default"), () => {}) },
    themes: { subscribe: (fn: (value: unknown) => void) => (fn({ default: { colors: { secondary: "white" } } }), () => {}) }
}))
vi.mock("../../hooks/useStore", () => ({ useStore: () => ({ default: { colors: { secondary: "white" } } }) }))

afterEach(cleanup)

describe("Vimeo", () => {
    it("renderiza iframe", () => {
        const { container } = render(<Vimeo id="123" />)
        expect(container.querySelector("iframe")).toBeTruthy()
    })
})
