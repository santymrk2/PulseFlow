// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { activeDrawerTab, activeTimers, drawer, timers } from "../../../shared/core/stores"
import { getCurrentTimerValue } from "../../../components/drawer/timers/timers"
import { setDrawerTabData } from "../../../shared/utils/helpers/historyHelpers"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Timer } from "./Timer"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/drawer/timers/timers", () => ({ getCurrentTimerValue: vi.fn(() => 90) }))
vi.mock("../../../shared/utils/helpers/historyHelpers", () => ({ setDrawerTabData: vi.fn() }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(timers, { t1: { type: "counter", start: 0, end: 100 } }), looseEntry(activeTimers, []), looseEntry(drawer, { height: 20, stored: 300 }), looseEntry(activeDrawerTab, "slide")])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const today = new globalThis.Date("2026-11-17T10:00:00")
const item = { timer: { showHours: false, padding: true }, style: "" } as unknown as Item

describe("Timer", () => {
    it("muestra_el_valor_formateado", () => {
        const { container } = render(<Timer item={item} id="t1" today={today} />)
        expect(container.textContent).toContain("01:30")
        expect(container.querySelector(".autoFontSize")).toBeTruthy()
    })

    it("viewType_line_calcula_el_porcentaje", () => {
        const { container } = render(<Timer item={{ ...item, timer: { viewType: "line" } } as unknown as Item} id="t1" today={today} />)
        expect((container.firstElementChild as HTMLElement).style.width).toBe("90%")
    })

    it("viewType_circle_aplica_las_variables_css", () => {
        const { container } = render(<Timer item={{ ...item, timer: { viewType: "circle", circleMask: true } } as unknown as Item} id="t1" today={today} />)
        expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--percentage")).toBe("90")
    })

    it("con_edit_el_doble_click_abre_el_cajon_de_timers", () => {
        const { container } = render(<Timer item={item} id="t1" today={today} edit />)
        fireEvent.doubleClick(container.querySelector(".autoFontSize")!)
        expect(setDrawerTabData).toHaveBeenCalledWith("functions", "timer")
        expect(get(activeDrawerTab)).toBe("functions")
    })

    it("sin_tipo_no_llama_getCurrentTimerValue", () => {
        restore = setStoresForTest([looseEntry(timers, { t1: {} })])
        render(<Timer item={item} id="t1" today={today} />)
        expect(getCurrentTimerValue).not.toHaveBeenCalled()
    })
})
