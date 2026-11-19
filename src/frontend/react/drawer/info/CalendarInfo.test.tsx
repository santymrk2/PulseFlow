// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeDays, calendarAddShow, drawerTabsData, special } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { CalendarInfo } from "./CalendarInfo"

vi.mock("../calendar/CalendarsManagement", () => ({ CalendarsManagement: () => <div data-isla="CalendarsManagement" /> }))
vi.mock("../calendar/CreateCalendarShow", () => ({ CreateCalendarShow: ({ currentEvents }: { currentEvents: unknown[] }) => <div data-isla="CreateCalendarShow" data-count={currentEvents.length} /> }))
vi.mock("../calendar/Day", () => ({ Day: ({ type }: { type: string }) => <div data-isla="Day" data-type={type} /> }))
vi.mock("../../../components/drawer/calendar/calendar", () => ({ getSelectedEvents: () => [{ id: "evt" }] }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(activeDays, []), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event" } }), looseEntry(calendarAddShow, "show1"), looseEntry(special, { firstDayOfWeek: "1" })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CalendarInfo", () => {
    it("muestra el día del calendario en la pestaña event", () => {
        render(<CalendarInfo optionsOpen={false} />)
        expect(document.querySelector('[data-isla="Day"]')?.getAttribute("data-type")).toBe("event")
    })

    it("muestra la creación de shows cuando hay varios días seleccionados", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeDays, [1, 2]), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event" } }), looseEntry(special, { firstDayOfWeek: "1" })])
        render(<CalendarInfo optionsOpen={false} />)
        expect(document.querySelector('[data-isla="CreateCalendarShow"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="CreateCalendarShow"]')?.getAttribute("data-count")).toBe("1")
    })

    it("muestra las opciones del calendario", () => {
        render(<CalendarInfo optionsOpen={true} />)
        expect(document.querySelector('[data-title^="calendar.first_day"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="CalendarsManagement"]')).toBeTruthy()
    })

    it("escribe el primer día de la semana en special al elegirlo", () => {
        render(<CalendarInfo optionsOpen={true} />)
        fireEvent.click(document.querySelector('[data-title^="calendar.first_day"]') as HTMLElement)
        fireEvent.click(screen.getByRole("option", { name: /weekday\.7/ }))
        expect(get(special).firstDayOfWeek).toBe("7")
    })
})
