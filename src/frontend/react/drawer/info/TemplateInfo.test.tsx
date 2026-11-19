// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { special } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { TemplateInfo } from "./TemplateInfo"

vi.mock("../../system/Clock", () => ({ Clock: () => <div data-isla="Clock" /> }))
vi.mock("../../system/Date", () => ({ Date: () => <div data-isla="Date" /> }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(special, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("TemplateInfo", () => {
    it("muestra el reloj y la fecha cuando no hay opciones", () => {
        render(<TemplateInfo optionsOpen={false} />)
        expect(document.querySelector('[data-isla="Clock"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="Date"]')).toBeTruthy()
    })

    it("escribe las palabras a capitalizar", () => {
        render(<TemplateInfo optionsOpen={true} />)
        const input = screen.getByRole("textbox") as HTMLInputElement
        fireEvent.change(input, { target: { value: "Cristo, Dios" } })
        expect(get(special).capitalize_words).toBe("Cristo, Dios")
    })

    it("escribe la preferencia de vista previa de estilos", () => {
        render(<TemplateInfo optionsOpen={true} />)
        fireEvent.click(document.querySelector('[data-title="settings.style_template_preview"]') as HTMLElement)
        expect(get(special).styleTemplatePreview).toBe(false)
    })
})
