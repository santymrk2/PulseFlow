// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getFontStyleList, getSystemFontsList, mergeCustomFonts } from "../../../components/helpers/fonts"
import { customFonts } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { FontField } from "./FontField"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../../components/edit/scripts/edit", () => ({ newDropdown: {} }))
// fonts.ts pide la lista de fuentes al sistema (IPC): se mockea el borde
vi.mock("../../../components/helpers/fonts", () => ({
    getFontName: (value: string) => (value ? `'${value}'` : ""),
    getSystemFontsList: vi.fn(async () => [{ label: "Arial", value: "'Arial'" }]),
    mergeCustomFonts: vi.fn((system: { label: string; value: string }[], custom: { name: string }[]) => [...system, ...custom.map((c) => ({ label: c.name, value: `'${c.name}'` }))]),
    getFontStyleList: vi.fn(() => ({
        fontStyles: [
            { value: "regular", label: "Regular" },
            { value: "bold", label: "Bold" }
        ],
        defaultValue: "regular"
    }))
}))

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.clearAllMocks()
})

const triggers = () => Array.from(document.querySelectorAll(".dropdown-trigger")) as HTMLElement[]
// el selector de estilos es onlyArrow: no muestra texto, el elegido va en el data-title
const estilo = () => triggers()[1].getAttribute("data-title") ?? ""
const items = () => Array.from(document.querySelectorAll(".select-menu li")) as HTMLElement[]

describe("FontField", () => {
    it("renderiza_el_selector_con_la_fuente_entre_comillas", async () => {
        render(<FontField label="Fuente" value="Arial" />)
        await waitFor(() => expect(triggers()[0].textContent).toContain("Arial"))
        expect(screen.getByText("Fuente")).toBeTruthy()
        expect(triggers().length).toBe(1)
    })

    it("al_montar_junta_las_fuentes_del_sistema_con_las_del_store_y_las_locales", async () => {
        restaurar = setStoresForTest([storeEntry(customFonts, [{ name: "Global", path: "/g" } as never])])
        render(<FontField label="x" value="Arial" customLocalFonts={[{ name: "Local", path: "/l" } as never]} />)
        await waitFor(() => expect(mergeCustomFonts).toHaveBeenCalledTimes(1))
        expect(getSystemFontsList).toHaveBeenCalledTimes(1)
        expect(vi.mocked(mergeCustomFonts).mock.calls[0][1].map((f) => f.name)).toEqual(["Global", "Local"])
    })

    it("elegir_una_fuente_despacha_change_con_el_detalle", async () => {
        const onChange = vi.fn()
        render(<FontField label="x" value="Arial" onChange={onChange} />)
        await waitFor(() => expect(mergeCustomFonts).toHaveBeenCalled())
        fireEvent.click(triggers()[0])
        expect(items().map((li) => li.textContent)).toContain("Arial")
        fireEvent.click(items()[0])
        expect(onChange).toHaveBeenCalledWith("'Arial'")
    })

    it("elegir_una_fuente_vacia_el_estilo_elegido", async () => {
        render(<FontField label="x" value="Arial" fontStyleValue="bold" enableFontStyles />)
        await waitFor(() => expect(estilo()).toContain("Bold"))
        fireEvent.click(triggers()[0])
        fireEvent.click(items()[0])
        await waitFor(() => expect(estilo()).toContain("Regular"))
    })

    it("enableFontStyles_agrega_el_selector_de_estilos_y_despacha_fontStyle", async () => {
        const onFontStyle = vi.fn()
        render(<FontField label="x" value="Arial" enableFontStyles onFontStyle={onFontStyle} />)
        await waitFor(() => expect(triggers().length).toBe(2))
        expect(getFontStyleList).toHaveBeenCalledWith("Arial")
        expect(estilo()).toContain("Regular")
        expect(estilo()).toContain("settings.font_style")
        fireEvent.click(triggers()[1])
        fireEvent.click(items()[1])
        expect(onFontStyle).toHaveBeenCalledWith("bold")
    })

    it("CMGSans_o_sin_enableFontStyles_no_muestra_estilos", () => {
        const { rerender } = render(<FontField label="x" value="CMGSans" enableFontStyles />)
        expect(triggers().length).toBe(1)
        rerender(<FontField label="x" value="Arial" />)
        expect(triggers().length).toBe(1)
        expect(getFontStyleList).toHaveBeenCalledTimes(1) // sólo el primer render (el `$:` corre aunque sea CMGSans)
    })

    it("el_selector_de_estilos_se_deshabilita_con_menos_de_dos_estilos", async () => {
        vi.mocked(getFontStyleList).mockReturnValueOnce({ fontStyles: [{ value: "regular", label: "Regular", style: "" }], defaultValue: "regular" })
        render(<FontField label="x" value="Arial" enableFontStyles />)
        await waitFor(() => expect(triggers().length).toBe(2))
        fireEvent.click(triggers()[1])
        expect(items().length).toBe(0)
    })

    it("el_estilo_mostrado_es_fontStyleValue_si_existe", async () => {
        render(<FontField label="x" value="Arial" fontStyleValue="bold" enableFontStyles />)
        await waitFor(() => expect(estilo()).toContain("Bold"))
    })

    it("style_se_aplica_a_la_fila_y_max_width_al_primer_selector_cuando_hay_estilos", async () => {
        const { container } = render(<FontField label="x" value="Arial" enableFontStyles style={{ margin: "3px" }} />)
        expect((container.firstChild as HTMLElement).style.margin).toBe("3px")
        await waitFor(() => expect(triggers().length).toBe(2))
        expect((document.querySelector(".textfield") as HTMLElement).style.maxWidth).toBe("85%")
    })
})
