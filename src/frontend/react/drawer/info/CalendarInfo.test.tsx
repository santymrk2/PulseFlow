// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeDays, calendarAddShow, drawerTabsData, special } from "../../../stores"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { CalendarInfo } from "./CalendarInfo"

vi.mock("../../../components/drawer/calendar/CalendarsManagement.svelte", () => ({ default: { isla: "CalendarsManagement" } }))
vi.mock("../../../components/drawer/calendar/CreateCalendarShow.svelte", () => ({ default: { isla: "CreateCalendarShow" } }))
vi.mock("../../../components/drawer/calendar/Day.svelte", () => ({ default: { isla: "Day" } }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../../components/drawer/calendar/calendar", () => ({ getSelectedEvents: () => [{ id: "evt" }] }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(activeDays, []), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event" } }), looseEntry(calendarAddShow, "show1"), looseEntry(special, { firstDayOfWeek: "1" })])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearIslands()
})

describe("CalendarInfo", () => {
    it("muestra el día del calendario en la pestaña event", () => {
        render(<CalendarInfo optionsOpen={false} />)
        expect(islands["Day"]?.props).toEqual({ type: "event" })
    })

    it("muestra la creación de shows cuando hay varios días seleccionados", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeDays, [1, 2]), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event" } }), looseEntry(special, { firstDayOfWeek: "1" })])
        render(<CalendarInfo optionsOpen={false} />)
        expect(islands["CreateCalendarShow"]).toBeTruthy()
        expect((islands["CreateCalendarShow"]?.props.currentEvents as unknown[]).length).toBe(1)
    })

    it("muestra las opciones del calendario", () => {
        render(<CalendarInfo optionsOpen={true} />)
        expect(document.querySelector('[data-title^="calendar.first_day"]')).toBeTruthy()
        expect(islands["CalendarsManagement"]).toBeTruthy()
    })

    it("escribe el primer día de la semana en special al elegirlo", () => {
        render(<CalendarInfo optionsOpen={true} />)
        fireEvent.click(document.querySelector('[data-title^="calendar.first_day"]') as HTMLElement)
        fireEvent.click(screen.getByRole("option", { name: /weekday\.7/ }))
        expect(get(special).firstDayOfWeek).toBe("7")
    })
})
