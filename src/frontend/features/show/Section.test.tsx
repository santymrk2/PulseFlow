// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { actions, activeProject, projects, special } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Section } from "./Section"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/actions/actions", () => ({ getActionIcon: vi.fn(() => "play"), runAction: vi.fn() }))
vi.mock("../../react/main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Tip") }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: () => <span data-icon /> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick, title }: { children: unknown; onClick?: () => void; title?: string }) => (
        <button title={title} onClick={onClick}>
            {children as never}
        </button>
    )
}))
vi.mock("../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: unknown }) => <div data-bar>{children as never}</div> }))
vi.mock("../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children: unknown }) => <div data-row>{children as never}</div> }))
vi.mock("../../shared/ui/kit/title/Title", () => ({ Title: () => <h2 data-title /> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: ({ label }: { label: string }) => <label data-select={label} /> }))
vi.mock("../../shared/ui/kit/time-field/TimeField", () => ({ TimeField: () => <input data-time /> }))
vi.mock("../../shared/ui/kit/input/Input", () => ({ Input: ({ value }: { value: string }) => <input data-name value={value} readOnly /> }))
vi.mock("./tools/Notes", () => ({ Notes: ({ value }: { value: string }) => <textarea data-note value={value} readOnly /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Section", () => {
    it("muestra el nombre, la nota y el botón de ajustes", () => {
        restore = setStoresForTest([looseEntry(actions, {}), looseEntry(activeProject, "project1"), looseEntry(projects, { project1: { shows: [{ id: "sec1", name: "Sección", notes: "Nota" }] } }), looseEntry(special, { sectionTriggerAction: "" })])
        const { container, getByTitle } = render(<Section section={{ id: "sec1", index: 0, name: "Sección", notes: "Nota" }} />)
        expect((container.querySelector("[data-name]") as HTMLInputElement).value).toBe("Sección")
        expect((container.querySelector("[data-note]") as HTMLTextAreaElement).value).toBe("Nota")
        expect(getByTitle("menu.settings")).toBeTruthy()
    })

    it("abre el panel de ajustes al hacer click", () => {
        restore = setStoresForTest([looseEntry(actions, {}), looseEntry(activeProject, "project1"), looseEntry(projects, { project1: { shows: [{ id: "sec1" }] } }), looseEntry(special, { sectionTriggerAction: "" })])
        const { container, getByTitle } = render(<Section section={{ id: "sec1", index: 0 }} />)
        fireEvent.click(getByTitle("menu.settings"))
        expect(container.querySelector("[data-isla='Tip']")).toBeTruthy()
        expect(container.querySelectorAll("[data-select]")).toHaveLength(2)
    })
})
