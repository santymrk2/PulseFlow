// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, customizedIcons, popupData } from "../../shared/core/stores"
import { customIcons, customIconsColors } from "../../shared/core/values/customIcons"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ManageIcons } from "./ManageIcons"
import css from "./ManageIcons.module.css"

vi.mock("../../utils/common", () => commonMock())
vi.mock("uid", () => ({ uid: () => "id-nuevo" }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

const ids = Object.keys(customIcons)
const coloreado = ids.find((id) => customIconsColors[id]) as string
let restaurar: () => void = () => {}
function montar(iconos: object = { disabled: [], svg: [] }, popup: object = {}, portapapeles: string | Error = "") {
    const readText = vi.fn(() => (portapapeles instanceof Error ? Promise.reject(portapapeles) : Promise.resolve(portapapeles)))
    Object.defineProperty(navigator, "clipboard", { value: { readText }, configurable: true })
    restaurar = setStoresForTest([looseEntry(customizedIcons, iconos), looseEntry(popupData, popup), storeEntry(activePopup, "manage_icons")] as never)
    return render(<ManageIcons />)
}
const botonesDeIconos = (container: HTMLElement) => [...container.querySelectorAll(`.${css.grid} > button`)].slice(0, ids.length) as HTMLElement[]
const importar = () => act(async () => fireEvent.click(screen.getByText("[actions.svg_clipboard]").closest("button") as HTMLElement))
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageIcons", () => {
    it("renderiza_el_tip_y_un_boton_por_icono_propio", () => {
        const { container } = montar()
        expect(islands.Tip.props).toEqual({ value: "actions.click_disable", bottom: 20 })
        expect(botonesDeIconos(container).length).toBe(ids.length)
        expect(botonesDeIconos(container)[0].getAttribute("data-title")).toBe("actions.disable")
    })

    it("pinta_el_color_del_icono_y_atenua_los_desactivados", () => {
        const { container } = montar({ disabled: [coloreado], svg: [] })
        const botones = botonesDeIconos(container)
        expect(botones[ids.indexOf(coloreado)].getAttribute("data-title")).toBe("actions.enable")
        expect((botones[ids.indexOf(coloreado)].querySelector("svg") as SVGElement).style.opacity).toBe("0.2")
        cleanup()
        restaurar()
        const otra = montar({ disabled: [], svg: [] })
        expect((botonesDeIconos(otra.container)[ids.indexOf(coloreado)].querySelector("svg") as SVGElement).style.color).toBe(customIconsColors[coloreado as keyof typeof customIconsColors])
    })

    it("clic_alterna_el_icono_en_disabled", () => {
        const { container } = montar()
        fireEvent.click(botonesDeIconos(container)[0])
        expect(get(customizedIcons).disabled).toEqual([ids[0]])
        fireEvent.click(botonesDeIconos(container)[0])
        expect(get(customizedIcons).disabled).toEqual([])
    })

    it("importar_svg_del_portapapeles_lo_agrega_y_clic_lo_borra", async () => {
        const { container } = montar({ disabled: [], svg: [] }, {}, '<svg id="x"></svg>')
        await importar()
        expect(get(customizedIcons).svg).toEqual([{ id: "id-nuevo", path: '<svg id="x"></svg>' }])
        const guardado = container.querySelector(`.${css.custom} button`) as HTMLElement
        expect(guardado.getAttribute("data-title")).toBe("actions.delete")
        expect(guardado.querySelector("svg#x")).toBeTruthy()
        fireEvent.click(guardado)
        expect(get(customizedIcons).svg).toEqual([])
        expect(container.querySelector(`.${css.custom}`)).toBeNull()
    })

    it("un_portapapeles_sin_svg_o_vacio_no_agrega_nada", async () => {
        montar({ disabled: [], svg: [] }, {}, "hola")
        await importar()
        expect(get(customizedIcons).svg).toEqual([])
    })

    it("si_el_portapapeles_falla_avisa_en_consola_y_no_agrega", async () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        montar({ disabled: [], svg: [] }, {}, new Error("denegado"))
        await importar()
        expect(aviso).toHaveBeenCalledWith("Could not read clipboard:", expect.any(Error))
        expect(get(customizedIcons).svg).toEqual([])
        aviso.mockRestore()
    })

    it("al_montar_vacia_popupData_y_sin_back_no_hay_boton_volver", () => {
        const { container } = montar({ disabled: [], svg: [] }, { otro: 1 })
        expect(get(popupData)).toEqual({})
        expect(container.querySelector("button.popup-back")).toBeNull()
    })

    it("con_back_el_boton_volver_abre_ese_popup", () => {
        const { container } = montar({ disabled: [], svg: [] }, { back: "settings" })
        expect(get(popupData)).toEqual({})
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(get(activePopup)).toBe("settings")
    })
})
