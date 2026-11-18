// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { categories, contentProviderData, dictionary, shows } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ChurchAppsSyncCategories } from "./ChurchAppsSyncCategories"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

let restaurar: () => void = () => {}
function montar(provider: object = {}) {
    restaurar = setStoresForTest([looseEntry(categories, { c1: { name: "Zeta", icon: "x" }, c2: { name: "alfa", icon: "x" }, c3: { name: "Vieja", icon: "x", isArchive: true }, c4: { name: "", icon: "x" }, c5: { name: "category.scripture", icon: "x", default: true } }), looseEntry(shows, { s1: { category: "c1" }, s2: { category: "c1" }, s3: { category: "c2" } }), looseEntry(contentProviderData, provider), looseEntry(dictionary, { category: { scripture: "Escritura" } })] as never)
    return render(<ChurchAppsSyncCategories />)
}
const filas = (c: HTMLElement) => [...c.querySelectorAll(".checkboxfield")] as HTMLElement[]
beforeEach(() => clearIslands())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChurchAppsSyncCategories", () => {
    it("renderiza_el_tip_y_las_categorias_ordenadas_con_su_cantidad_sin_archivadas_ni_sin_nombre", () => {
        const { container } = montar()
        expect(islands.Tip.props).toEqual({ type: "info", value: "settings.sync_categories_tip", bottom: 20 })
        const textos = filas(container).map((f) => f.textContent)
        expect(textos).toEqual(["alfa (1)", "Escritura (0)", "Zeta (2)"])
    })

    it("marca_las_categorias_ya_elegidas", () => {
        const { container } = montar({ churchApps: { syncCategories: ["c1"] } })
        expect(filas(container).map((f) => f.getAttribute("aria-checked"))).toEqual(["false", "false", "true"])
    })

    it("elegir_agrega_la_categoria_y_volver_a_elegir_la_quita", () => {
        const { container } = montar({ churchApps: { token: "t" } })
        fireEvent.click(filas(container)[0])
        expect(get(contentProviderData).churchApps).toEqual({ token: "t", syncCategories: ["c2"] })
        fireEvent.click(filas(container)[2])
        expect(get(contentProviderData).churchApps.syncCategories).toEqual(["c2", "c1"])
        fireEvent.click(filas(container)[0])
        expect(get(contentProviderData).churchApps.syncCategories).toEqual(["c1"])
    })
})
