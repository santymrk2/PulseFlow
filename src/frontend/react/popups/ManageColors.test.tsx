// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultColors, defaultGradients } from "../../components/helpers/color"
import { dictionary, special } from "../../stores"
import { clearIslands, islands } from "../test/islandMock"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ManageColors } from "./ManageColors"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))
vi.mock("../ui/color-field/ColorField", async () => ({ ColorField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(valor: object = {}, portapapeles: string | Error = "") {
    const readText = vi.fn(() => (portapapeles instanceof Error ? Promise.reject(portapapeles) : Promise.resolve(portapapeles)))
    Object.defineProperty(navigator, "clipboard", { value: { readText }, configurable: true })
    restaurar = setStoresForTest([looseEntry(special, valor), storeEntry(dictionary, { actions: { paste: "Pegar" } })] as never)
    return render(<ManageColors />)
}
const cambiar = (color: string) => fire("", "onChange", color)
const esperar = () => act(async () => {})
// happy-dom no trae `Option`: doble mínimo que valida colores como el navegador (hex y rgb sí; cualquier otra cosa se rechaza)
class OptionMock {
    style = (() => {
        let color = ""
        return {
            get color() {
                return color
            },
            set color(value: string) {
                color = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(.*\))$/i.test(value) ? value : ""
            }
        }
    })()
}
beforeEach(() => {
    vi.stubGlobal("Option", OptionMock)
    vi.clearAllMocks()
    clearFields()
    clearIslands()
})
afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
    restaurar()
})

describe("ManageColors", () => {
    it("renderiza_el_tip_y_el_campo_de_color_siempre_visible_en_modo_edicion", async () => {
        montar()
        await esperar()
        expect(islands.Tip.props).toEqual({ value: "actions.click_disable", bottom: 20 })
        expect(fields[""]).toMatchObject({ value: "", alwaysVisible: true, editMode: true })
    })

    it("un_color_propio_se_agrega_a_customColors_y_al_repetirlo_se_saca", async () => {
        montar({ customColors: ["#111111"] })
        await esperar()
        cambiar("#222222")
        expect(get(special).customColors).toEqual(["#111111", "#222222"])
        cambiar("#111111")
        expect(get(special).customColors).toEqual(["#222222"])
    })

    it("un_color_por_defecto_se_alterna_en_disabledColors", async () => {
        montar()
        await esperar()
        const color = defaultColors[0].value
        cambiar(color)
        expect(get(special).disabledColors).toEqual([color])
        cambiar(color)
        expect(get(special).disabledColors).toEqual([])
    })

    it("un_degradado_por_defecto_va_a_disabledColorsGradient_y_uno_propio_a_customColorsGradient", async () => {
        montar()
        await esperar()
        const defecto = defaultGradients[0].value
        cambiar(defecto)
        expect(get(special).disabledColorsGradient).toEqual([defecto])
        cambiar("linear-gradient(90deg, #000, #fff)")
        expect(get(special).customColorsGradient).toEqual(["linear-gradient(90deg, #000, #fff)"])
    })

    it("un_valor_vacio_se_trata_como_color_propio_vacio", async () => {
        montar()
        await esperar()
        cambiar("")
        expect(get(special).customColors).toEqual([""])
    })

    it("lee_el_portapapeles_y_ofrece_pegar_los_colores_validos_y_nuevos", async () => {
        montar({ customColors: ["#333333"] }, ' ["#ff0000", \'#00ff00\', "#333333", #ff0000, nada] ')
        expect(screen.queryByText("Pegar")).toBeNull()
        await esperar()
        fireEvent.click(screen.getByText("Pegar"))
        expect(get(special).customColors).toEqual(["#333333", "#ff0000", "#00ff00"])
        expect(screen.queryByText("Pegar")).toBeNull()
    })

    it("un_color_rgb_completo_es_un_solo_color", async () => {
        montar({}, "rgb(1, 2, 3)")
        await esperar()
        fireEvent.click(screen.getByText("Pegar"))
        expect(get(special).customColors).toEqual(["rgb(1, 2, 3)"])
    })

    it("si_el_portapapeles_falla_avisa_en_consola_y_no_ofrece_pegar", async () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        montar({}, new Error("denegado"))
        await esperar()
        expect(aviso).toHaveBeenCalledWith("Could not read clipboard:", expect.any(Error))
        expect(screen.queryByText("Pegar")).toBeNull()
        aviso.mockRestore()
    })
})
