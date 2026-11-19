// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { get } from "../../shared/core/lib/store"
import { activePopup, selected } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Icon } from "./Icon"

// Mismo path que values/icons.ts → export
const PATH_EXPORT = "M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"

let restaurar: () => void = () => {}

afterEach(() => restaurar())

describe("Icon", () => {
    it("renderiza_el_svg_con_el_viewBox_y_el_path_del_icono", () => {
        const { container } = render(<Icon id="export" />)
        const svg = container.querySelector("svg")
        expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24")
        const paths = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("d"))
        expect(paths).toContain(PATH_EXPORT)
    })

    it("sin_select_no_es_un_boton_y_no_abre_popups", () => {
        const { container } = render(<Icon id="export" />)
        const svg = container.querySelector("svg")
        expect(svg?.getAttribute("role")).toBeNull()
        fireEvent.click(svg as SVGSVGElement)
        expect(get(activePopup)).toBeNull()
    })

    it("con_select_click_abre_el_popup_de_iconos", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, null)])
        const { container } = render(<Icon id="export" select />)
        fireEvent.click(container.querySelector("svg") as SVGSVGElement)
        expect(get(activePopup)).toBe("icon")
    })

    it("con_select_enter_abre_el_popup_de_iconos", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, null)])
        const { container } = render(<Icon id="export" select />)
        fireEvent.keyDown(container.querySelector("svg") as SVGSVGElement, { key: "Enter" })
        expect(get(activePopup)).toBe("icon")
    })

    it("con_select_y_selectData_nuevo_lo_guarda_en_selected", () => {
        const dato = { id: null, data: ["a"] }
        restaurar = setStoresForTest([storeEntry(activePopup, null), storeEntry(selected, { id: null, data: [] })])
        const { container } = render(<Icon id="export" select selectData={dato} />)
        fireEvent.click(container.querySelector("svg") as SVGSVGElement)
        expect(get(selected)).toEqual(dato)
    })
})
