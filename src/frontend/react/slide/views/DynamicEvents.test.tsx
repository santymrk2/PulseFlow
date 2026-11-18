// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setDrawerTabData } from "../../../components/helpers/historyHelpers"
import { visibleEvents } from "../../../components/helpers/dynamicItemText"
import { activeDrawerTab, drawer, events } from "../../../stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { DynamicEvents } from "./DynamicEvents"

vi.mock("../../../components/helpers/dynamicItemText", () => ({ visibleEvents: vi.fn(() => [{ name: "Culto", from: "2026-11-17T10:00:00", time: true, location: "Sala" }]) }))
vi.mock("../../../components/helpers/array", () => ({ keysToID: vi.fn(() => []), clone: (v: unknown) => (v === undefined ? v : structuredClone(v)) }))
vi.mock("../../../components/helpers/historyHelpers", () => ({ setDrawerTabData: vi.fn() }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(events, {}), looseEntry(drawer, { height: 20, stored: 300 }), looseEntry(activeDrawerTab, "slide")])
})
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe("DynamicEvents", () => {
    it("renderiza_los_eventos_visibles_como_html", () => {
        const { container } = render(<DynamicEvents />)
        expect(container.textContent).toContain("Culto")
        expect(container.textContent).toContain("Sala")
    })

    it("pasa_las_opciones_a_visibleEvents_con_los_eventos_del_store", () => {
        render(<DynamicEvents maxEvents={2} justOneDay />)
        expect(visibleEvents).toHaveBeenCalledWith(expect.objectContaining({ maxEvents: 2, justOneDay: true }), [], expect.any(Date))
    })

    it("con_edit_el_doble_click_abre_la_pestana_de_calendario_y_el_cajon", () => {
        const { container } = render(<DynamicEvents edit />)
        fireEvent.doubleClick(container.firstElementChild as HTMLElement)
        expect(setDrawerTabData).toHaveBeenCalledWith("calendar", "event")
        expect(get(activeDrawerTab)).toBe("calendar")
        expect(get(drawer).height).toBe(300)
    })

    it("sin_edit_el_doble_click_no_hace_nada", () => {
        const { container } = render(<DynamicEvents />)
        fireEvent.doubleClick(container.firstElementChild as HTMLElement)
        expect(setDrawerTabData).not.toHaveBeenCalled()
    })

    it("refresca_los_eventos_cada_10_segundos", () => {
        vi.useFakeTimers()
        render(<DynamicEvents />)
        const before = vi.mocked(visibleEvents).mock.calls.length
        act(() => vi.advanceTimersByTime(10_000))
        expect(vi.mocked(visibleEvents).mock.calls.length).toBeGreaterThan(before)
    })
})
