// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Player from "./Player"

const stores = vi.hoisted(() => {
    const sub = (value: unknown) => ({ subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) })
    return {
        activeProject: sub(null),
        activeShow: sub(null),
        playerVideos: sub({ y1: { type: "youtube", id: "abc12345678" } }),
        projects: sub({})
    }
})

vi.mock("../../stores", () => stores)
vi.mock("../hooks/useStore", () => ({
    useStore: (store: unknown) => {
        if (store === stores.activeProject) return null
        if (store === stores.activeShow) return null
        if (store === stores.playerVideos) return { y1: { type: "youtube", id: "abc12345678" } }
        if (store === stores.projects) return {}
        return null
    }
}))
vi.mock("../drawer/player/YouTube", () => ({ YouTube: () => <div data-testid="youtube" />, default: () => <div data-testid="youtube" /> }))
vi.mock("../drawer/player/Vimeo", () => ({ Vimeo: () => <div data-testid="vimeo" />, default: () => <div data-testid="vimeo" /> }))
vi.mock("../../components/helpers/shows", () => ({ _show: () => ({ get: () => ({}) }) }))
vi.mock("../../components/media/video/videoSync", () => ({ videoSync: () => () => {} }))

afterEach(cleanup)

describe("Player", () => {
    it("renderiza reproductor youtube", () => {
        const { getByTestId } = render(<Player id="y1" outputId="out" />)
        expect(getByTestId("youtube")).toBeTruthy()
    })
})
