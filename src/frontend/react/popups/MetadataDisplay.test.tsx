// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activePopup, categories, currentMetadataPopupData, dictionary, popupData, styles, templates } from "../../stores"
import { clearIslands, islands } from "../test/islandMock"
import { clearFields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { MetadataDisplay } from "./MetadataDisplay"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))
vi.mock("../ui/popup-field/PopupField", async () => ({ PopupField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { show_at: { never: "Nunca", first: "Primero", last: "Último", first_last: "Primero y último", always: "Siempre" }, example: { default: "Predeterminado" } }
let restaurar: () => void = () => {}
function montar(tipo: "show_category" | "style" = "show_category") {
    restaurar = setStoresForTest([
        storeEntry(popupData, { type: tipo, id: tipo === "style" ? "s1" : "c1" }),
        storeEntry(currentMetadataPopupData, null),
        storeEntry(categories, { c1: { name: "Cat", metadata: { display: "never" } } }),
        storeEntry(styles, { s1: { name: "Estilo" } }),
        storeEntry(templates, { metadata: { name: "Meta" } as never, all: { name: "Todas" } as never }),
        storeEntry(activePopup, "metadata_display"),
        storeEntry(activeEdit, { type: undefined, id: "", items: [] } as never),
        storeEntry(activePage, "show"),
        storeEntry(dictionary, dict)
    ] as never)
    return render(<MetadataDisplay />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("MetadataDisplay", () => {
    it("renderiza_las_opciones_de_visualizacion_y_no_muestra_tip_en_never", () => {
        const { container } = montar()
        expect(screen.getByText("Nunca")).toBeTruthy()
        expect(screen.getByText("Primero")).toBeTruthy()
        expect(screen.getByText("Último")).toBeTruthy()
        expect(screen.getByText("Primero y último")).toBeTruthy()
        expect(screen.getByText("Siempre")).toBeTruthy()
        expect(screen.getByText("Nunca").closest("button")?.classList.contains("isActive")).toBe(true)
        expect(container.querySelector("button.popup-options")).toBeNull()
        expect(islands.Tip).toBeUndefined()
    })

    it("cambiar_el_display_actualiza_la_categoria_y_muestra_las_opciones", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Primero"))
        expect(get(categories).c1.metadata?.display).toBe("first")
        expect(container.querySelector("button.popup-options")).toBeTruthy()
        expect(islands.Tip).toBeTruthy()
    })

    it("elegir_el_display_ya_activo_cierra_el_popup", () => {
        montar()
        fireEvent.click(screen.getByText("Nunca"))
        expect(get(activePopup)).toBeNull()
    })

    it("en_estilo_el_display_default_muestra_el_tip_y_agrega_la_opcion_default", () => {
        montar("style")
        expect(screen.getByText("Predeterminado")).toBeTruthy()
        expect(islands.Tip).toBeTruthy()
    })

    it("editar_una_plantilla_navega_a_edit_y_cierra_el_popup", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Primero"))
        const editButtons = [...container.querySelectorAll('button[data-title="titlebar.edit"]')]
        expect(editButtons.length).toBeGreaterThan(0)
        fireEvent.click(editButtons[0])
        expect(get(activeEdit)).toMatchObject({ type: "template" })
        expect(get(activePage)).toBe("edit")
        expect(get(activePopup)).toBeNull()
    })

    it("el_toggle_de_ignore_empty_escribe_en_la_categoria", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Primero"))
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        fire("meta.ignore_empty", "onChange", true)
        expect(get(categories).c1.metadata?.ignoreEmpty).toBe(true)
    })
})
