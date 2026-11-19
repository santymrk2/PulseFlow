// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AnalogClock } from "./AnalogClock"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))

afterEach(() => {
    cleanup()
})

describe("AnalogClock", () => {
    it("dibuja_la_cara_los_marcadores_y_las_agujas", () => {
        const { container } = render(<AnalogClock date={new globalThis.Date("2026-11-17T10:30:15")} h={10} m={30} s={15} />)
        expect(container.querySelector("circle")).toBeTruthy()
        expect(container.querySelectorAll("line").length).toBe(12 * 5 + 3)
        expect(container.querySelector('line[transform="rotate(315)"]')).toBeTruthy()
    })

    it("con_seconds_false_no_dibuja_la_aguja_de_segundos", () => {
        const { container } = render(<AnalogClock date={new globalThis.Date("2026-11-17T10:30:15")} h={10} m={30} s={15} seconds={false} />)
        expect(container.querySelectorAll("line").length).toBe(12 * 5 + 2)
    })
})
