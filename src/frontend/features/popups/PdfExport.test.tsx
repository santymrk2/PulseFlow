// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Show } from "../../../types/Show"
import { dictionary } from "../../shared/core/stores"
import { clearFields, fire } from "../../shared/test/kitMocks"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { PdfExport, type PdfOptions } from "./PdfExport"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../react/export/Pdf", () => ({ Pdf: (props: Record<string, unknown>) => <div data-isla="Pdf" data-props={JSON.stringify(props)} /> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/checkbox-field/CheckboxField", async () => ({ CheckboxField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/color-field/ColorField", async () => ({ ColorField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

const dict = {
    example: { default: "Predeterminado" },
    export: { text: "Texto", slides: "Diapositivas", metadata: "Metadatos", page_numbers: "Números de página", groups: "Grupos", numbers: "Números", invert: "Invertir", original_text_size: "Tamaño original", rows: "Filas", columns: "Columnas", margin: "Margen (mm)" },
    items: { media: "Multimedia" },
    clock: { type: "Tipo" },
    settings: { font_size: "Tamaño de fuente" },
    tools: { notes: "Notas" },
    edit: { chords: "Acordes", font_size: "Tamaño de fuente", color: "Color", line_spacing: "Espaciado" }
}
const showWithChords = {
    name: "Show",
    category: null,
    settings: { activeLayout: "l1", template: null },
    slides: { s1: { group: null, color: null, settings: {}, notes: "", items: [{ lines: [{ chords: [{ key: "C" }] }] }] } }
} as unknown as Show

function pdfProps(): { shows?: unknown[]; options?: PdfOptions } {
    const marker = document.querySelector("[data-isla='Pdf']") as HTMLElement | null
    return JSON.parse(marker?.getAttribute("data-props") || "{}") as { shows?: unknown[]; options?: PdfOptions }
}

let restaurar: () => void = () => {}
function montar(props: { pdfOptions?: PdfOptions; previewShow?: Show | null; exportType?: string; onChange?: (o: PdfOptions) => void } = {}) {
    restaurar = setStoresForTest([storeEntry(dictionary, dict)] as never)
    return render(<PdfExport pdfOptions={props.pdfOptions ?? ({} as PdfOptions)} previewShow={props.previewShow ?? null} exportType={props.exportType} onChange={props.onChange} />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PdfExport", () => {
    it("con_opciones_vacías_arma_los_defaults_y_los_emite", () => {
        const onChange = vi.fn()
        montar({ onChange })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "default", grid: [3, 6], textSize: 80, oneFile: false }))
        expect(document.querySelector('[data-field="export.metadata"]')).toBeTruthy()
    })

    it("fuerza_oneFile_para_proyectos_y_emite_el_cambio", () => {
        const onChange = vi.fn()
        montar({ pdfOptions: { type: "slides", oneFile: false }, exportType: "project", onChange })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ oneFile: true, type: "slides" }))
    })

    it("cambiar_el_tipo_a_media_oculta_el_resto_de_opciones_y_actualiza_el_preview", () => {
        const onChange = vi.fn()
        montar({ pdfOptions: { type: "default" }, onChange })
        fire("clock.type", "onChange", "media")
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "media" }))
        expect(document.querySelector('[data-field="export.metadata"]')).toBeNull()
        expect(pdfProps().options).toMatchObject({ type: "media" })
    })

    it("muestra_la_opción_chord_sheet_sólo_si_el_show_tiene_acordes", () => {
        montar({ pdfOptions: { type: "chordSheet" }, previewShow: showWithChords })
        const field = document.querySelector('[data-field="clock.type"]') as HTMLElement
        expect(field.getAttribute("data-value")).toBe("chordSheet")
        expect(document.querySelector('[data-field="export.margin (mm)"]')).toBeTruthy()
        expect(document.querySelector('[data-field="edit.color"]')).toBeTruthy()
    })

    it("actualiza_filas_y_columnas_del_grid", () => {
        const onChange = vi.fn()
        montar({ pdfOptions: { type: "default", grid: [3, 6] }, onChange })
        fire("export.rows", "onChange", 4)
        fire("export.columns", "onChange", 2)
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ grid: [2, 4] }))
    })

    it("convierte_el_espaciado_de_línea_a_décimas", () => {
        const onChange = vi.fn()
        montar({ pdfOptions: { type: "chordSheet", spacing: 2 }, previewShow: showWithChords, onChange })
        fire("edit.line_spacing", "onChange", 25)
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ spacing: 2.5 }))
    })

    it("el_preview_recibe_el_show_y_los_botones_desplazan_el_papel", () => {
        montar({ pdfOptions: { type: "media" }, previewShow: showWithChords })
        expect(pdfProps().shows).toHaveLength(1)
        const scrollBy = vi.fn()
        const paper = document.querySelector("[class*='paper']") as HTMLElement
        Object.defineProperty(paper, "scrollBy", { value: scrollBy })
        Object.defineProperty(paper, "offsetHeight", { value: 100 })
        const buttons = [...document.querySelectorAll("button")]
        expect(buttons.length).toBeGreaterThanOrEqual(2)
        act(() => {
            buttons[0].click()
        })
        expect(scrollBy).toHaveBeenCalledWith(0, -100 + 9.6)
    })
})
