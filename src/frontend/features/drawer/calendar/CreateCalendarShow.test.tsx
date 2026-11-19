// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeProject, calendarAddShow, dictionary, popupData } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { CreateCalendarShow } from "./CreateCalendarShow"

const { createSlidesMock, historyMock } = vi.hoisted(() => ({ createSlidesMock: vi.fn(), historyMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../logic/calendar/calendar", () => ({ createSlides: createSlidesMock }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: historyMock }))

const dict = { main: { unnamed: "Sin nombre" }, new: { show_convert: "Convertir en show" }, empty: { events: "Sin eventos" }, month: { 11: "Noviembre" } }
const day = {
    date: new Date(2026, 10, 18).getTime(),
    events: [
        { name: "Reunión", color: null },
        { name: "", color: "#f00" }
    ]
}

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    createSlidesMock.mockResolvedValue({ show: { name: "Show" } })
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(activeProject, "p1"), storeEntry(calendarAddShow, ""), storeEntry(popupData, {})])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("CreateCalendarShow", () => {
    it("sin eventos muestra el vacío", () => {
        render(<CreateCalendarShow />)
        expect(screen.getByText("Sin eventos")).toBeTruthy()
    })

    it("lista los días y eventos", () => {
        render(<CreateCalendarShow currentEvents={[day]} />)
        expect(screen.getByText("18. Noviembre", { exact: false })).toBeTruthy()
        expect(screen.getByText("Reunión")).toBeTruthy()
        expect(screen.getByText("Sin nombre")).toBeTruthy()
    })

    it("convierte los eventos en un show", async () => {
        render(<CreateCalendarShow currentEvents={[day]} />)
        fireEvent.click(screen.getByText("Convertir en show").closest("button") as HTMLElement)
        await waitFor(() => expect(historyMock).toHaveBeenCalled())
        expect(createSlidesMock).toHaveBeenCalledWith([day])
        expect(historyMock).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: { name: "Show" }, remember: { project: "p1" } }, location: { page: "show", id: "show" } })
    })

    it("muestra la cantidad cuando hay varios días", () => {
        render(<CreateCalendarShow currentEvents={[day, { ...day, date: day.date + 86400000 }]} />)
        expect(screen.getByText("2")).toBeTruthy()
    })

    it("al elegir un show lo guarda y limpia el popup", () => {
        render(<CreateCalendarShow />)
        act(() => popupData.set({ action: "select_show", location: "calendar", showId: "s1", id: "show-id" } as never))
        expect(get(calendarAddShow)).toBe("show-id")
        expect(get(popupData)).toEqual({})
    })
})
