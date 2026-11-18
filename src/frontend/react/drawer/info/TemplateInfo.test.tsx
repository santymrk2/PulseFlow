// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { special } from "../../../stores"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { TemplateInfo } from "./TemplateInfo"

vi.mock("../../../components/system/Clock.svelte", () => ({ default: { isla: "Clock" } }))
vi.mock("../../../components/system/Date.svelte", () => ({ default: { isla: "Date" } }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
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
    clearIslands()
})

describe("TemplateInfo", () => {
    it("muestra el reloj y la fecha como islas cuando no hay opciones", () => {
        render(<TemplateInfo optionsOpen={false} />)
        expect(islands["Clock"]).toBeTruthy()
        expect(islands["Date"]).toBeTruthy()
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
