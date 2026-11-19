// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { timeFormat } from "../../shared/core/stores"
import { Clock } from "./Clock"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.restoreAllMocks()
})

describe("Clock", () => {
    it("digital_con_estilo_muestra_horas_minutos_y_segundos", () => {
        restore = setStoresForTest([storeEntry(timeFormat, "24")])
        const RealDate = globalThis.Date
        vi.spyOn(globalThis, "Date").mockImplementation(() => new RealDate(2026, 10, 17, 10, 30, 15) as never)
        const { container } = render(<Clock seconds />)
        expect(container.textContent).toContain("10")
        expect(container.textContent).toContain("30")
        expect(container.textContent).toContain("15")
        expect(container.querySelector(".autoFontSize")).toBeTruthy()
    })

    it("analog_delega_en_AnalogClock", () => {
        restore = setStoresForTest([storeEntry(timeFormat, "24")])
        const { container } = render(<Clock type="analog" />)
        expect(container.querySelector("svg")).toBeTruthy()
    })

    it("custom_formatea_la_fecha_con_dayjs", () => {
        restore = setStoresForTest([storeEntry(timeFormat, "24")])
        const { container } = render(<Clock type="custom" customFormat="YYYY-MM-DD" />)
        expect(container.textContent).toMatch(/\d{4}-\d{2}-\d{2}/)
    })

    it("sin_estilo_muestra_la_fecha_y_la_hora", () => {
        restore = setStoresForTest([storeEntry(timeFormat, "24")])
        const { container } = render(<Clock style={false} dateFormat="YYYY-MM-DD" showTime />)
        expect(container.textContent).toMatch(/\d{4}-\d{2}-\d{2}/)
    })
})
