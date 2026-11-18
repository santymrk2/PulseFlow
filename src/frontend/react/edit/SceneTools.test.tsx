// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { activeEdit, overlays, scenes, selected, styles } from "../../stores"
import { SceneTools } from "./SceneTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
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

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setStores(selectedValue: unknown = { id: null, data: [] }) {
    restore = setStoresForTest([looseEntry(activeEdit, { id: "sc1" }), looseEntry(scenes, { sc1: { content: { overlays: ["o1"] } } }), looseEntry(styles, {}), looseEntry(overlays, { o1: { name: "Overlay 1" } }), looseEntry(selected, selectedValue)])
}

describe("SceneTools", () => {
    it("muestra el campo de media, los overlays de la escena y la pestaña scene activa", () => {
        setStores()
        const { container } = render(<SceneTools />)
        expect(container.querySelector(".main.border.editTools")).not.toBeNull()
        expect(container.textContent).toContain("Overlay 1")
        expect(screen.getByText("scene").dataset.active).toBe("true")
    })

    it("el clic en la pestaña sigue deseleccionando el overlay del entry principal", () => {
        setStores({ id: "scene_overlay", data: [{ id: "o1", index: 0 }] })
        render(<SceneTools />)
        fireEvent.click(screen.getByText("scene"))
        expect(get(selected).id).toBeNull()
    })
})
