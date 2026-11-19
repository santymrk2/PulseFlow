// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Show } from "../../../types/Show"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activeDrawerTab, drawer, openedInteractionId, openScripture } from "../../shared/core/stores"
import { setDrawerTabData } from "../../shared/utils/helpers/historyHelpers"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Reference } from "./Reference"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../shared/utils/helpers/historyHelpers", () => ({ setDrawerTabData: vi.fn() }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../converters/canvaPresentation", () => ({ syncCanvaShow: vi.fn() }))
vi.mock("../../components/drawer/calendar/calendar", () => ({
    getSelectedEvents: vi.fn(() => []),
    createSlides: vi.fn(async () => ({ show: {} })),
    sortDays: vi.fn(() => ({ sortedDays: [1, 2], from: "2026-11-17", to: "2026-11-18" })),
    getDateString: vi.fn((d) => d)
}))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(drawer, { height: 20, stored: 300 }), looseEntry(openScripture, null), looseEntry(openedInteractionId, null), looseEntry(activeDrawerTab, "slide")])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const baseShow = (type: string, data: Record<string, unknown> = {}) => ({ name: "Show", reference: { type, data } }) as Show

describe("Reference", () => {
    it("calendar_muestra_los_dias_y_el_boton_de_actualizar", () => {
        const { container } = render(<Reference showId="s1" show={baseShow("calendar", { days: [] })} />)
        expect(container.textContent).toContain("2026-11-17")
        expect(container.querySelectorAll("button").length).toBe(1)
    })

    it("interaction_abre_el_cajon_de_funciones", () => {
        const { container } = render(<Reference showId="s1" show={baseShow("interaction", { id: "int1", name: "Juego" })} />)
        expect(container.textContent).toContain("Juego")
        fireEvent.click(container.querySelector("button")!)
        expect(setDrawerTabData).toHaveBeenCalledWith("functions", "interactions")
        expect(get(openedInteractionId)).toBe("int1")
        expect(get(activeDrawerTab)).toBe("functions")
    })

    it("lessons_limpia_los_enlaces_markdown_y_abre_la_url", () => {
        const { container } = render(<Reference showId="s1" show={baseShow("lessons", { studyName: "Estudio", about: "Ver [sitio](https://x.com)" })} />)
        expect(container.textContent).toContain("sitio")
        expect(container.textContent).not.toContain("https://x.com")
        fireEvent.click(container.querySelector("button")!)
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://lessons.church")
    })

    it("canva_muestra_el_nombre_de_la_presentacion", () => {
        const { container } = render(<Reference showId="s1" show={baseShow("canva", { presentationName: "Charla" })} />)
        expect(container.textContent).toContain("Canva: Charla")
    })

    it("tipo_desconocido_no_muestra_nada", () => {
        const { container } = render(<Reference showId="s1" show={baseShow("otro")} />)
        expect(container.firstElementChild?.children.length).toBe(0)
    })
})
