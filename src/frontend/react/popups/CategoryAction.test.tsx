// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actions, activePopup, categories, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { CategoryAction } from "./CategoryAction"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: ({ component, props }: { component: { isla: string }; props?: object }) => <div data-isla={component.isla} data-props={JSON.stringify(props ?? {})} /> }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

let restaurar: () => void = () => {}
function montar(accion: string) {
    restaurar = setStoresForTest([storeEntry(popupData, { id: "cat1" }), storeEntry(categories, { cat1: { name: "Cat", icon: "x", action: accion } }), storeEntry(actions, { z: { name: "Zeta", triggers: [] }, a: { name: "Alfa", triggers: [] } }), storeEntry(activePopup, "category_action"), storeEntry(dictionary, { midi: { start_action: "Acción de inicio" }, titlebar: { edit: "Editar" } })] as never)
    return render(<CategoryAction />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CategoryAction", () => {
    it("renderiza_el_tip_y_la_accion_actual", () => {
        const { container } = montar("a")
        const tip = container.querySelector("[data-isla='Tip']") as HTMLElement
        expect(JSON.parse(tip.dataset.props ?? "{}")).toEqual({ type: "info", value: "category.action_tip", bottom: 20 })
        expect(screen.getByText("Alfa")).toBeTruthy()
    })

    it("al_montar_vacia_popupData", () => {
        montar("a")
        expect(get(popupData)).toEqual({})
    })

    it("elegir_una_accion_la_guarda_en_la_categoria", () => {
        const { container } = montar("")
        fireEvent.click(container.querySelector(".dropdown-trigger") as HTMLElement)
        fireEvent.click(screen.getByText("Zeta"))
        expect(get(categories).cat1.action).toBe("z")
    })

    it("sin_accion_no_hay_boton_editar", () => {
        const { container } = montar("")
        expect(container.querySelector("[data-title='Editar']")).toBeNull()
    })

    it("editar_abre_el_popup_action_con_el_id_de_la_accion", () => {
        const { container } = montar("a")
        fireEvent.click(container.querySelector("[data-title='Editar']") as HTMLElement)
        expect(get(popupData)).toEqual({ id: "a" })
        expect(get(activePopup)).toBe("action")
    })
})
