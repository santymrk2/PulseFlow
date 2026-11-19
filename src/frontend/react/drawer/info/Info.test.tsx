// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeShow, focusMode, forceClock } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Info } from "./Info"

vi.mock("../../system/Clock", () => ({ Clock: () => <div data-isla="Clock" /> }))
vi.mock("../../system/Date", () => ({ Date: () => <div data-isla="Date" /> }))

// Declaración de función (no const): las fábricas de vi.mock se evalúan antes que las inicializaciones de módulo.
function child(name: string) {
    return ({ optionsOpen }: { optionsOpen: boolean }) => <div data-testid={name} data-open={String(optionsOpen)} />
}
vi.mock("./ShowInfo", () => ({ ShowInfo: child("shows") }))
vi.mock("./MediaInfo", () => ({ MediaInfo: child("media") }))
vi.mock("./AudioInfo", () => ({ AudioInfo: () => <div data-testid="audio" /> }))
vi.mock("./TemplateInfo", () => ({ TemplateInfo: child("templates") }))
vi.mock("./ScriptureInfo", () => ({ ScriptureInfo: child("scripture") }))
vi.mock("./CalendarInfo", () => ({ CalendarInfo: child("calendar") }))
vi.mock("./FunctionsInfo", () => ({ FunctionsInfo: () => <div data-testid="functions" /> }))

vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(activeShow, { id: "sh1" }), looseEntry(focusMode, false), looseEntry(forceClock, false)])
})
afterEach(() => {
    cleanup()
    restaurar()
})

const TABS = ["shows", "media", "audio", "templates", "scripture", "calendar", "functions"]

describe("Info", () => {
    it.each(TABS)("monta el panel React de la pestaña %s", (id) => {
        render(<Info id={id} />)
        expect(screen.getByTestId(id)).toBeTruthy()
        if (id !== "audio" && id !== "functions") expect(screen.getByTestId(id).getAttribute("data-open")).toBe("false")
    })

    it("muestra reloj y fecha con forceClock, sin panel ni opciones", () => {
        forceClock.set(true)
        render(<Info id="media" />)
        expect(document.querySelector('[data-isla="Clock"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="Date"]')).toBeTruthy()
        expect(screen.queryByTestId("media")).toBeNull()
        expect(document.querySelector('[data-title="edit.options"]')).toBeNull()
    })

    it("muestra reloj y fecha para una pestaña sin panel", () => {
        render(<Info id="other" />)
        expect(document.querySelector('[data-isla="Clock"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="Date"]')).toBeTruthy()
    })

    it("abre y cierra las opciones del panel desde la barra flotante", () => {
        render(<Info id="media" />)
        const options = document.querySelector('[data-title="edit.options"]') as HTMLElement
        expect(options).toBeTruthy()
        expect(screen.getByTestId("media").getAttribute("data-open")).toBe("false")
        fireEvent.click(options)
        expect(screen.getByTestId("media").getAttribute("data-open")).toBe("true")
        fireEvent.click(options)
        expect(screen.getByTestId("media").getAttribute("data-open")).toBe("false")
    })

    it("cierra las opciones al cambiar de pestaña", () => {
        const { rerender } = render(<Info id="media" />)
        fireEvent.click(document.querySelector('[data-title="edit.options"]') as HTMLElement)
        expect(screen.getByTestId("media").getAttribute("data-open")).toBe("true")
        rerender(<Info id="templates" />)
        expect(screen.getByTestId("templates").getAttribute("data-open")).toBe("false")
    })

    it("oculta la barra de opciones en modo enfoque", () => {
        focusMode.set(true)
        render(<Info id="media" />)
        expect(document.querySelector('[data-title="edit.options"]')).toBeNull()
    })

    it("no marca el contexto del drawer en shows sin show activo", () => {
        activeShow.set(null)
        const { container } = render(<Info id="shows" />)
        expect(container.querySelector(".main")?.classList.contains("context")).toBe(false)
    })
})
