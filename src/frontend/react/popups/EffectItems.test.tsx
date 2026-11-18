// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { effectItems } from "../../components/output/effects/effectItems"
import { activeEdit, activePopup, effects } from "../../stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { EffectItems } from "./EffectItems"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../drawer/Card", () => ({
    Card: ({ label, onClick, children }: { label: string; onClick?: () => void; children?: ReactNode }) => (
        <button type="button" onClick={onClick}>
            {label}
            {children}
        </button>
    )
}))
vi.mock("../output/Effect", () => ({
    Effect: ({ effect }: { effect: { items: { type: string }[] } }) => <span data-testid="preview">{effect.items[0]?.type}</span>
}))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(activeEdit, { id: "fx1", items: [] }), storeEntry(effects, { fx1: { name: "Efecto", style: "", background: "", color: null, items: [] } }), storeEntry(activePopup, "effect_items")] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("EffectItems", () => {
    it("muestra una tarjeta por efecto y monta los previews de a uno", async () => {
        const { container } = render(<EffectItems />)
        const tipos = Object.keys(effectItems)
        expect(screen.getAllByRole("button")).toHaveLength(tipos.length)

        await waitFor(() => expect(container.querySelectorAll('[data-testid="preview"]').length).toBeGreaterThan(0))
    })

    it("al elegir un efecto lo agrega al efecto activo y cierra el popup", () => {
        render(<EffectItems />)
        const primero = Object.keys(effectItems)[0]
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`effect.${primero}`) }))

        expect(get(effects).fx1.items).toHaveLength(1)
        expect(get(effects).fx1.items[0].type).toBe(primero)
        expect(get(activePopup)).toBeNull()
    })

    it("sin efecto activo no escribe en el store", () => {
        activeEdit.set({ items: [] })
        render(<EffectItems />)
        fireEvent.click(screen.getAllByRole("button")[0])
        expect(get(effects).fx1.items).toHaveLength(0)
    })
})
