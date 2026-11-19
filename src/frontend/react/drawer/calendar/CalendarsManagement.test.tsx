// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { calendars, dictionary, events, special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { CalendarsManagement } from "./CalendarsManagement"

const { newToastMock, fetchMock } = vi.hoisted(() => ({ newToastMock: vi.fn(), fetchMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => ({ ...commonMock(), newToast: newToastMock }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/drawer/calendar/calendars", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../components/drawer/calendar/calendars")>()), fetchAndImportIcs: fetchMock }))

const dict = {
    calendar: { calendars: "Calendarios" },
    category: { events: "Eventos", unlabeled: "Sin etiqueta" },
    cloud: { sync: "Sincronizar" },
    profile: { show: "Mostrar", hide: "Ocultar" },
    error: { import: "Error al importar" }
}

const calendarEvent = (origin?: string) => ({ type: "event", name: "E", color: null, from: new Date().toISOString(), to: new Date().toISOString(), time: false, repeat: false, origin })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue(true)
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(calendars, { c1: { id: "c1", name: "Calendario", color: "#fff", url: "https://example.com/a.ics" } }), storeEntry(events, { e1: calendarEvent("c1"), e2: calendarEvent("c1") } as never), storeEntry(special, { hideUnlabeledCalendar: false })])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("CalendarsManagement", () => {
    it("sin calendarios no renderiza nada", () => {
        act(() => calendars.set({}))
        act(() => events.set({} as never))
        const { container } = render(<CalendarsManagement />)
        expect(container.innerHTML).toBe("")
    })

    it("lista los calendarios con su cantidad de eventos", () => {
        render(<CalendarsManagement />)
        expect(screen.getByText("Calendarios")).toBeTruthy()
        expect(screen.getByText("Calendario")).toBeTruthy()
        expect(screen.getByText("Eventos: 2")).toBeTruthy()
    })

    it("sincroniza el calendario y avisa si falla", async () => {
        fetchMock.mockResolvedValue("Error de red")
        render(<CalendarsManagement />)
        fireEvent.click(document.querySelector('[data-title="Sincronizar"]') as HTMLElement)
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("https://example.com/a.ics", "c1"))
        expect(newToastMock).toHaveBeenCalledWith("Error de red")
    })

    it("muestra el calendario sin etiqueta y lo oculta", () => {
        act(() => events.set({ e1: calendarEvent() } as never))
        render(<CalendarsManagement />)
        expect(screen.getByText("Sin etiqueta")).toBeTruthy()
        fireEvent.click(document.querySelector('#unlabeled [data-title="Ocultar"]') as HTMLElement)
        expect(get(special).hideUnlabeledCalendar).toBe(true)
    })

    it("oculta un calendario importado", () => {
        render(<CalendarsManagement />)
        fireEvent.click(document.querySelector('#c1 [data-title="Ocultar"]') as HTMLElement)
        expect(get(calendars).c1.hidden).toBe(true)
    })
})
