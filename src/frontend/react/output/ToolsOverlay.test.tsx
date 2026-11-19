// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ToolsOverlay from "./ToolsOverlay"

const mocks = vi.hoisted(() => {
    const sub = (value: unknown) => ({ subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) })
    return {
        toggleOverlayOutput: vi.fn(),
        toggleEffectOutput: vi.fn(),
        stores: {
            overlays: sub({ o1: { id: "o1", name: "Overlay 1", category: "c1" } }),
            effects: sub({ e1: { id: "e1", name: "Effect 1" } }),
            overlayCategories: sub({ c1: { name: "Cat" } }),
            outLocked: sub(false)
        },
        values: {
            overlays: { o1: { id: "o1", name: "Overlay 1", category: "c1" } },
            effects: { e1: { id: "e1", name: "Effect 1" } },
            overlayCategories: { c1: { name: "Cat" } },
            outLocked: false
        }
    }
})

vi.mock("../../shared/core/stores", () => ({
    overlays: mocks.stores.overlays,
    effects: mocks.stores.effects,
    overlayCategories: mocks.stores.overlayCategories,
    outLocked: mocks.stores.outLocked
}))

vi.mock("../hooks/useStore", () => ({
    useStore: (store: unknown) => {
        if (store === mocks.stores.effects) return mocks.values.effects
        if (store === mocks.stores.overlayCategories) return mocks.values.overlayCategories
        if (store === mocks.stores.outLocked) return mocks.values.outLocked
        return mocks.values.overlays
    }
}))
vi.mock("../../shared/utils/language", () => ({ translateText: (t: string) => t }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../shared/utils/helpers/array", () => ({
    keysToID: (o: unknown) => Object.entries((o as Record<string, unknown>) || {}).map(([id, v]) => ({ id, ...(v as Record<string, unknown>) })),
    sortByName: (a: unknown[]) => a
}))
vi.mock("../../shared/utils/helpers/overlayOutput", () => ({ toggleOverlayOutput: mocks.toggleOverlayOutput, toggleEffectOutput: mocks.toggleEffectOutput }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("ToolsOverlay", () => {
    it("renderiza y dispara toggles", () => {
        render(<ToolsOverlay currentOutput={{ out: { overlays: ["o1"], effects: [] } } as unknown as never} />)
        fireEvent.click(screen.getByText("Overlay 1"))
        expect(mocks.toggleOverlayOutput).toHaveBeenCalled()
    })
})
