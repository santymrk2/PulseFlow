// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, globalRegexes, popupData } from "../../shared/core/stores"
import { clearFields, fire } from "../../shared/test/kitMocks"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { RegexManager } from "./RegexManager"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(data: object = {}, regexes: object = {}) {
    restaurar = setStoresForTest([storeEntry(popupData, { id: "r1", ...data }), storeEntry(globalRegexes, regexes), storeEntry(activePopup, "regex_manager"), storeEntry(dictionary, { actions: { back: "Volver" }, midi: { description: "Descripción" }, timer: { preview: "Vista previa" } })] as never)
    return render(<RegexManager />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("RegexManager", () => {
    it("muestra_la_etiqueta_y_el_patón_guardados", () => {
        const { container } = montar({}, { r1: { label: "Correos", value: "/\\S+@\\S+/g" } })
        expect(container.querySelector('[data-field="midi.description"]')?.getAttribute("data-value")).toBe("Correos")
        expect(container.querySelector('[data-field="/regex/"]')?.getAttribute("data-value")).toBe("/\\S+@\\S+/g")
    })

    it("editar_la_etiqueta_escribe_en_globalRegexes", () => {
        montar({}, { r1: { label: "Viejo", value: "" } })
        fire("midi.description", "onChange", "Nuevo")
        expect(get(globalRegexes).r1.label).toBe("Nuevo")
    })

    it("normaliza_un_patón_sin_barras_y_flags", () => {
        montar()
        fire("/regex/", "onChange", "  hola  ")
        expect(get(globalRegexes).r1.value).toBe("/hola/")
    })

    it("normaliza_barras_invertidas_dobles_y_conserva_flags", () => {
        montar()
        fire("/regex/", "onChange", "/\\\\d+/gi")
        expect(get(globalRegexes).r1.value).toBe("/\\d+/gi")
    })

    it("marca_como_válido_y_resalta_las_coincidencias", () => {
        const { container } = montar({ testInput: undefined }, { r1: { label: "", value: "/\\d+/g" } })
        expect(container.textContent).toContain("✓")
        const preview = container.querySelector("[class*='previewText']") as HTMLElement
        expect(preview.innerHTML).toContain("<mark>123</mark>")
        expect(preview.innerHTML).toContain("<mark>47</mark>")
    })

    it("marca_como_inválido_un_patón_roto_y_no_resalta_nada", () => {
        const { container } = montar({}, { r1: { label: "", value: "/[/" } })
        expect(container.textContent).toContain("✗")
        const preview = container.querySelector("[class*='previewText']") as HTMLElement
        expect(preview.innerHTML).not.toContain("<mark>")
    })

    it("el_cambio_del_texto_de_prueba_recarga_la_vista_previa", () => {
        const { container } = montar({}, { r1: { label: "", value: "/abc/g" } })
        fire("timer.preview", "onChange", "abc abc")
        const preview = container.querySelector("[class*='previewText']") as HTMLElement
        expect(preview.innerHTML).toBe("<mark>abc</mark> <mark>abc</mark>")
    })

    it("volver_restaura_el_popup_anterior_y_su_dato", () => {
        montar({ previousPopup: "find_replace", previousData: { id: "otro" } })
        const back = document.querySelector("button.popup-back") as HTMLElement
        expect(back).toBeTruthy()
        fireEvent.click(back)
        expect(get(activePopup)).toBe("find_replace")
        expect(get(popupData)).toEqual({ id: "otro" })
    })
})
