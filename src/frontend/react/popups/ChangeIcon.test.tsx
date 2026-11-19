// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addItem } from "../../components/edit/scripts/itemHelpers"
import { activePopup, categories, customizedIcons, dictionary, popupData, selected } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChangeIcon } from "./ChangeIcon"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ addItem: vi.fn() }))
vi.mock("../../shared/core/values/customIcons", () => ({ customIcons: { empty: "<path/>", star: "<path/>", heart_icon: "<path/>" }, customIconsColors: { star: "#ffcc00" } }))

let restaurar: () => void = () => {}
function montar(sel: { id: string | null; data: unknown[] }, icons = { disabled: [] as string[], svg: [] as { id: string; path: string }[] }) {
    restaurar = setStoresForTest([storeEntry(selected, sel), storeEntry(categories, { c1: { name: "A", icon: "star" }, c2: { name: "B", icon: "star" } }), storeEntry(customizedIcons, icons), storeEntry(activePopup, "icon"), storeEntry(popupData, {}), storeEntry(dictionary, {})] as never)
    return render(<ChangeIcon />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChangeIcon", () => {
    it("renderiza_un_boton_por_icono_y_oculta_empty_en_modo_boxed", () => {
        const { container } = montar({ id: "category_shows", data: ["c1"] })
        expect(container.querySelectorAll("button:not(.popup-options)").length).toBe(2)
    })

    it("los_iconos_deshabilitados_no_aparecen", () => {
        const { container } = montar({ id: "category_shows", data: ["c1"] }, { disabled: ["star"], svg: [] })
        expect(container.querySelectorAll("button:not(.popup-options)").length).toBe(1)
    })

    it("elegir_en_categorias_cambia_el_icono_de_las_seleccionadas_menos_all_y_unlabeled_y_cierra", () => {
        const { container } = montar({ id: "category_shows", data: ["c1", "all", "unlabeled"] })
        fireEvent.click(container.querySelector("[data-title='Heart icon']") as HTMLElement)
        expect(get(categories).c1.icon).toBe("heart_icon")
        expect(get(categories).c2.icon).toBe("star")
        expect(get(activePopup)).toBeNull()
    })

    it("slide_icon_agrega_un_item_icon_con_el_color_y_muestra_tambien_empty", () => {
        const { container } = montar({ id: "slide_icon", data: [] })
        expect(container.querySelectorAll("button:not(.popup-options)").length).toBe(3)
        fireEvent.click(container.querySelector("[data-title='Star']") as HTMLElement)
        expect(addItem).toHaveBeenCalledWith("icon", "star", { color: "#ffcc00" })
        expect(get(activePopup)).toBeNull()
    })

    it("los_iconos_svg_propios_de_slide_icon_pasan_el_path", () => {
        const { container } = montar({ id: "slide_icon", data: [] }, { disabled: [], svg: [{ id: "mio", path: "<svg><circle/></svg>" }] })
        const custom = container.querySelector("circle")?.closest("button") as HTMLElement
        expect(custom).toBeTruthy()
        fireEvent.click(custom)
        expect(addItem).toHaveBeenCalledWith("icon", "mio", { path: "<svg><circle/></svg>" })
    })

    it("sin_svg_propios_o_fuera_de_slide_icon_no_hay_seccion_custom", () => {
        const { container } = montar({ id: "category_shows", data: ["c1"] }, { disabled: [], svg: [{ id: "mio", path: "<svg><circle/></svg>" }] })
        expect(container.querySelector("circle")).toBeNull()
    })

    it("editar_abre_manage_icons_con_back_icon", () => {
        const { container } = montar({ id: "category_shows", data: ["c1"] })
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(get(popupData)).toEqual({ back: "icon" })
        expect(get(activePopup)).toBe("manage_icons")
    })
})
