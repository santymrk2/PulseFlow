// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeDays, activePopup, calendars, dictionary, eventEdit, events, special } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Day } from "./Day"
import styles from "./Day.module.css"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const dict = { main: { unnamed: "Sin nombre" }, month: { 1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre" }, empty: { events: "Sin eventos" } }
const today = new Date()
const at = (hour: number, addDays = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + addDays, hour)
const event = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "event", name: id, color: null, from: at(10).toISOString(), to: at(11).toISOString(), time: true, repeat: false, ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(activeDays, [at(0).getTime()]), storeEntry(events, {} as never), storeEntry(calendars, {}), storeEntry(special, {}), storeEntry(activePopup, null), storeEntry(eventEdit, null)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Day", () => {
    it("sin días activos no renderiza nada", () => {
        act(() => activeDays.set([]))
        const { container } = render(<Day />)
        expect(container.innerHTML).toBe("")
    })

    it("muestra la fecha y el vacío", () => {
        render(<Day />)
        expect(screen.getByText(new Date(at(0)).getDate() + ".", { exact: false })).toBeTruthy()
        expect(screen.getByText("Sin eventos")).toBeTruthy()
    })

    it("muestra los eventos del día y abre el editor al hacer click", () => {
        act(() => events.set({ e1: event("Reunión") } as never))
        render(<Day />)
        expect(screen.getByText("Reunión")).toBeTruthy()
        fireEvent.click(document.querySelector(`.${styles.event}`) as HTMLElement)
        expect(get(eventEdit)).toBe("e1")
        expect(get(activePopup)).toBe("edit_event")
    })

    it("filtra por tipo y oculta calendarios ocultos", () => {
        act(() => events.set({ e1: event("Evento"), a1: event("Acción", { type: "action", origin: "c1" }) } as never))
        act(() => calendars.set({ c1: { hidden: true } }))
        render(<Day type="action" />)
        expect(screen.queryByText("Acción")).toBeNull()
        expect(screen.queryByText("Evento")).toBeNull()
    })

    it("muestra el horario y el nombre sin nombre", () => {
        act(() => events.set({ e1: event("", { name: "" }) } as never))
        render(<Day />)
        expect(screen.getByText(/10:00/)).toBeTruthy()
        expect(screen.getByText("Sin nombre")).toBeTruthy()
    })

    it("Enter abre el editor", () => {
        act(() => events.set({ e1: event("Reunión") } as never))
        render(<Day />)
        fireEvent.keyDown(document.querySelector(`.${styles.event}`) as HTMLElement, { key: "Enter" })
        expect(get(eventEdit)).toBe("e1")
    })
})
