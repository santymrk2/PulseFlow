// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, effects } from "../../shared/core/stores"
import { EffectTools } from "./EffectTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../main/Tabs", () => ({
    Tabs: (props: { tabs: Record<string, unknown>; active: string; onActiveChange?: (id: string) => void }) => (
        <div data-testid="tabs">
            {Object.keys(props.tabs).map((id) => (
                <button key={id} data-active={String(id === props.active)} onClick={() => props.onActiveChange?.(id)}>
                    {id}
                </button>
            ))}
        </div>
    )
}))
vi.mock("./tools/EditValues", () => ({
    EditValues: () => <div data-testid="edit-values" />
}))
vi.mock("../ui/color-field/ColorField", () => ({ ColorField: () => <div data-testid="color-field" /> }))
vi.mock("../ui/number-field/NumberField", () => ({ NumberField: () => <div data-testid="number-field" /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeEdit, { id: "e1" }), looseEntry(effects, { e1: { items: [{ type: "stars" }] } })])
}

describe("EffectTools", () => {
    it("renderiza las herramientas de efecto con la pestaña effect activa", () => {
        setStores()
        const { container } = render(<EffectTools />)
        expect(container.querySelector(".main.border.editTools")).not.toBeNull()
        expect(screen.getByText("effect").dataset.active).toBe("true")
        fireEvent.click(screen.getByTitle("main.open"))
        expect(screen.getByTestId("edit-values")).toBeTruthy()
    })

    it("onActiveChange de Tabs cambia a la pestaña options", () => {
        setStores()
        render(<EffectTools />)
        fireEvent.click(screen.getByText("options"))
        expect(screen.getByTestId("color-field")).toBeTruthy()
        expect(screen.getByTestId("number-field")).toBeTruthy()
    })
})
