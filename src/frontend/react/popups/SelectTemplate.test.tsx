// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeStyle, dictionary, drawerTabsData, outputs, popupData, previewOutputId, scriptures, styles, templates } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../shared/utils/popup"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SelectTemplate } from "./SelectTemplate"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/output", () => ({ getResolution: vi.fn(() => ({ width: 1920, height: 1080 })) }))
vi.mock("../drawer/Card", async () => {
    const { islands } = await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")
    return {
        Card: (props: Record<string, unknown>) => {
            islands.Card = { props }
            return <div data-isla="Card" data-props={JSON.stringify(props)} onClick={props.onClick as () => void} />
        }
    }
})
vi.mock("../drawer/pages/TemplateSlide", async () => ({ TemplateSlide: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("TemplateSlide") }))
vi.mock("../ui/text-field/TextField", () => ({
    TextField: ({ label, onInput }: { label: string; onInput?: (v: string) => void }) => <input data-label={label} onChange={(e) => onInput?.(e.currentTarget.value)} />
}))
vi.mock("../ui/select-field/SelectField", () => ({
    SelectField: ({ label, value, options, onChange }: { label: string; value: string; options: { label: string; value: string }[]; onChange?: (v: string) => void }) => (
        <select data-label={label} value={value} onChange={(e) => onChange?.(e.currentTarget.value)}>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}))

const catalogo = {
    t2: { id: "t2", name: "Plantilla dos", category: "scripture" },
    t1: { id: "t1", name: "Plantilla uno" },
    tx: { id: "tx", name: "Modo texto", settings: { mode: "text" } }
}
const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = {}, catalog: object = catalogo, scriptureData: object = {}, styleData: object = {}, drawer: object = {}) {
    restaurar = setStoresForTest([
        storeEntry(popupData, data),
        storeEntry(activePopup, "select_template"),
        looseEntry(templates, catalog),
        looseEntry(scriptures, scriptureData),
        looseEntry(styles, styleData),
        storeEntry(activeStyle, "s1"),
        looseEntry(drawerTabsData, drawer),
        looseEntry(outputs, {}),
        looseEntry(previewOutputId, ""),
        storeEntry(dictionary, {
            main: { search: "Buscar", none: "Ninguno" },
            scripture: { translations: "Traducciones" },
            example: { default: "Por defecto" },
            empty: { search: "Sin resultados", general: "Vacío" },
            actions: { back: "Volver" }
        })
    ] as never)
    return render(<SelectTemplate />)
}
const buscar = (texto: string) => fireEvent.change(document.querySelector("input[data-label='main.search']") as HTMLInputElement, { target: { value: texto } })

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    clearPopupSubmit()
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
    vi.useRealTimers()
})

describe("SelectTemplate", () => {
    it("lista las plantillas ordenadas, descarta las de modo texto y pasa la resolución a Card", () => {
        const { container } = montar()
        expect(container.querySelectorAll('[data-isla="Card"]')).toHaveLength(2)
        expect(islands.Card.props).toMatchObject({ label: "Plantilla dos", active: false })
        expect(islands.Card.props.resolution).toEqual({ width: 1920, height: 1080 })
        expect(islands.TemplateSlide).toBeUndefined()
        act(() => vi.advanceTimersByTime(60))
        expect(islands.TemplateSlide.props).toMatchObject({ templateId: "t2", preview: true })
    })

    it("la búsqueda filtra por nombre y muestra el aviso cuando no hay resultados", () => {
        montar()
        buscar("uno")
        expect(islands.Card.props.label).toBe("Plantilla uno")
        buscar("zzz")
        expect(screen.getByText("Sin resultados")).toBeTruthy()
    })

    it("elegir una plantilla llama al trigger, cierra y limpia popupData a los 500 ms", () => {
        const { container } = montar({ trigger })
        fireEvent.click(container.querySelectorAll('[data-isla="Card"]')[1] as HTMLElement)
        expect(trigger).toHaveBeenCalledWith("t2")
        act(() => vi.advanceTimersByTime(0))
        expect(get(activePopup)).toBeNull()
        act(() => vi.advanceTimersByTime(500))
        expect(get(popupData)).toEqual({})
    })

    it("Enter elige la primera plantilla encontrada y respeta keyboard aunque haya doubleClick", () => {
        montar({ trigger, doubleClick: true })
        expect(triggerPopupSubmit()).toBe(true)
        expect(trigger).not.toHaveBeenCalled() // sin búsqueda no hay candidato
        buscar("dos")
        triggerPopupSubmit()
        expect(trigger).toHaveBeenCalledWith("t2")
    })

    it("con revert el botón back vuelve al popup anterior y no se limpia popupData", () => {
        const { container } = montar({ revert: "select_show", trigger })
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(get(activePopup)).toBe("select_show")
        fireEvent.click(container.querySelectorAll('[data-isla="Card"]')[1] as HTMLElement)
        act(() => vi.advanceTimersByTime(500))
        expect(get(activePopup)).toBe("select_show")
        expect(get(popupData).revert).toBe("select_show")
    })

    it("en scripture ofrece tipos y el trigger envía { value, type }", () => {
        montar({ id: "scripture", trigger }, { sc: { id: "scripture", name: "Escritura" }, sc2: { id: "scripture_2", name: "Escritura 2" } }, { bib: { collection: { versions: ["a", "b"] } } }, { s1: { templateScripture: "sc", templateScripture_2: "sc2" } })
        const selector = document.querySelector("select[data-label='scripture.translations']") as HTMLSelectElement
        expect(selector).toBeTruthy()
        fireEvent.change(selector, { target: { value: "_2" } })
        expect((selector as HTMLSelectElement).value).toBe("_2")
        const card = document.querySelector('[data-isla="Card"][data-props*="Escritura 2"]') as HTMLElement
        fireEvent.click(card)
        expect(trigger).toHaveBeenCalledWith({ value: "sc2", type: "_2" })
    })

    it("en scripture_drawer recorta las plantillas de conteo incorrecto", () => {
        // Tres versiones → sufijo _3 → se conserva la plantilla "Tres" (dos versiones conservarían _2)
        montar({ id: "scripture_drawer" }, { sc: { id: "scripture", name: "Uno", category: "scripture" }, sc3: { id: "scripture_3", name: "Tres", category: "scripture" } }, { bib: { collection: { versions: ["a", "b", "c"] } } }, {}, { scripture: { activeSubTab: "bib" } })
        expect(islands.Card.props.label).toBe("Tres")
        expect(document.querySelectorAll('[data-isla="Card"]')).toHaveLength(1)
    })
})
