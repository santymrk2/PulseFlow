// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Movebox } from "./Movebox"

vi.mock("../../stores", () => ({ openToolsTab: { set: vi.fn() } }))
vi.mock("../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../components/system/textbox", () => ({ radiusHandleSize: 10, radiusSliderOffset: 0, radiusSliderRatio: 1 }))

afterEach(cleanup)

describe("Movebox", () => {
    it("renderiza los manejadores principales", () => {
        const { container } = render(<Movebox active ratio={1} itemStyle="" />)
        expect(container.querySelector(".hideFromAutosize")).toBeTruthy()
        expect(container.querySelector(".rotate")).toBeTruthy()
        expect(container.querySelector(".radius")).toBeTruthy()
        expect(container.querySelectorAll(".square").length).toBe(8)
    })

    it("oculta lados cuando onlyCorners es true", () => {
        const { container } = render(<Movebox active ratio={1} itemStyle="" onlyCorners />)
        expect(container.querySelectorAll(".square").length).toBe(4)
    })
})
