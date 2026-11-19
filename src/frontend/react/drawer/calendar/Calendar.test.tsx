// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeDays, activePopup, calendars, dictionary, eventEdit, events, labelsDisabled, popupData, special } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Calendar } from "./Calendar"
import styles from "./Calendar.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const dict = {
    weekday: { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" },
    month: { 1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre" },
    media: { previous: "Anterior", next: "Siguiente" },
    calendar: { today: "Hoy" },
    new: { event: "Nuevo evento", event_action: "Nueva acción" },
    empty: { events: "Sin eventos" }
}

const today = () => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
}
const monthName = (offset = 0) => {
    const { year, month } = today()
    return new Intl.DateTimeFormat("es", { month: "long" }).format(new Date(year, month + offset, 1))
}
const event = (id: string, extra: Record<string, unknown> = {}) => {
    const now = new Date()
    return { id, type: "event", name: id, color: null, from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10).toISOString(), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11).toISOString(), time: true, repeat: false, ...extra }
}
const dayCells = () => Array.from(document.querySelectorAll(`.${styles.day}`)) as HTMLElement[]

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(activeDays, []), storeEntry(events, {} as never), storeEntry(calendars, {}), storeEntry(special, { firstDayOfWeek: "1" }), storeEntry(activePopup, null), storeEntry(eventEdit, null), storeEntry(popupData, {}), storeEntry(labelsDisabled, false)])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

describe("Calendar", () => {
    it("muestra los días de la semana y el mes actual", () => {
        render(<Calendar active={null} />)
        expect(screen.getByText("Lunes")).toBeTruthy()
        expect(screen.getByText("Domingo")).toBeTruthy()
        expect(screen.getByText(monthName(), { exact: false })).toBeTruthy()
        expect(dayCells()).toHaveLength(42)
    })

    it("selecciona el día de hoy al montar", () => {
        render(<Calendar active={null} />)
        const today = new Date()
        expect(get(activeDays)).toEqual([new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()])
    })

    it("el click selecciona un día y ctrl agrega otro", () => {
        render(<Calendar active={null} />)
        const first = dayCells()[7]
        const second = dayCells()[8]
        fireEvent.mouseDown(first)
        expect(get(activeDays)).toHaveLength(1)

        fireEvent.mouseDown(second, { ctrlKey: true })
        expect(get(activeDays)).toHaveLength(2)
        fireEvent.mouseDown(second, { ctrlKey: true })
        expect(get(activeDays)).toHaveLength(1)
    })

    it("shift selecciona el rango", () => {
        render(<Calendar active={null} />)
        fireEvent.mouseDown(dayCells()[7])
        fireEvent.mouseDown(dayCells()[9], { shiftKey: true })
        expect(get(activeDays)).toHaveLength(3)
    })

    it("muestra los eventos del día y oculta los calendarios ocultos", () => {
        act(() => events.set({ e1: event("Reunión"), e2: event("Oculto", { origin: "c1" }) } as never))
        act(() => calendars.set({ c1: { hidden: true } }))
        render(<Calendar active="event" />)
        expect(screen.getByText("Reunión")).toBeTruthy()
        expect(screen.queryByText("Oculto")).toBeNull()
    })

    it("con más de tres eventos muestra puntos en vez de nombres", () => {
        const now = new Date()
        const at = (hour: number) => ({ from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).toISOString(), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour + 1).toISOString() })
        act(() => events.set({ e1: event("A"), e2: event("B", at(11)), e3: event("C", at(12)), e4: event("D", at(13)) } as never))
        render(<Calendar active="event" />)
        expect(document.querySelectorAll(`.${styles.dot}`)).toHaveLength(2)
    })

    it("navega al mes siguiente y al anterior", () => {
        render(<Calendar active={null} />)
        fireEvent.click(document.querySelector('[data-title="Siguiente"]') as HTMLElement)
        expect(screen.getByText(monthName(1), { exact: false })).toBeTruthy()
        fireEvent.click(document.querySelector('[data-title="Anterior"]') as HTMLElement)
        expect(screen.getByText(monthName(), { exact: false })).toBeTruthy()
    })

    it("la rueda cambia de mes", () => {
        render(<Calendar active={null} />)
        const grid = document.querySelector(`.${styles.grid}`) as HTMLElement
        fireEvent.wheel(grid, { deltaY: 200 })
        expect(screen.getByText(monthName(1), { exact: false })).toBeTruthy()
    })

    it("el botón de hoy vuelve al mes actual y selecciona hoy", () => {
        render(<Calendar active={null} />)
        fireEvent.click(document.querySelector('[data-title="Siguiente"]') as HTMLElement)
        fireEvent.click(document.querySelector('[data-title="Hoy"]') as HTMLElement)
        expect(screen.getByText(monthName(), { exact: false })).toBeTruthy()
        expect(get(activeDays)).toHaveLength(1)
    })

    it("el botón nuevo abre el popup de evento", () => {
        render(<Calendar active="action" />)
        fireEvent.click(screen.getByText("Nueva acción").closest("button") as HTMLElement)
        expect(get(activePopup)).toBe("edit_event")
        expect(get(eventEdit)).toBeNull()
    })

    it("al seleccionar un show abre el editor de evento", () => {
        vi.useFakeTimers()
        render(<Calendar active={null} />)
        act(() => popupData.set({ action: "select_show", location: "event", showId: "s1" } as never))
        act(() => vi.advanceTimersByTime(300))
        expect(get(activePopup)).toBe("edit_event")
    })
})
