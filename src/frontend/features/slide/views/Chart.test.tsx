// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { replaceDynamicValues } from "../../../shared/utils/helpers/showActions"
import { Chart } from "./Chart"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../shared/utils/helpers/showActions", () => ({ replaceDynamicValues: vi.fn((v: string) => v) }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

const item = (data: string, type = "bar", extra: Record<string, unknown> = {}) => ({ chart: { type, data, ...extra } }) as Item

describe("Chart", () => {
    it("bar_parsea_datos_json_y_dibuja_barras", () => {
        const { container } = render(
            <Chart
                item={item(
                    JSON.stringify([
                        ["A", "50"],
                        ["B", "100"]
                    ])
                )}
            />
        )
        expect(container.querySelectorAll("rect").length).toBe(2)
        expect(container.textContent).toContain("50%")
        expect(container.textContent).toContain("100%")
    })

    it("bar_parsea_datos_de_texto_con_dos_puntos", () => {
        const { container } = render(<Chart item={item("A: 10\nB: 20")} />)
        expect(container.querySelectorAll("rect").length).toBe(2)
        expect(container.textContent).toContain("20%")
    })

    it("ignora_la_fila_de_encabezado_label", () => {
        const { container } = render(
            <Chart
                item={item(
                    JSON.stringify([
                        ["Label", "Value"],
                        ["A", "5"]
                    ])
                )}
            />
        )
        expect(container.querySelectorAll("rect").length).toBe(1)
    })

    it("line_dibuja_las_lineas_y_los_puntos", () => {
        const { container } = render(<Chart item={item("A: 10\nB: 20", "line")} />)
        expect(container.querySelectorAll("circle").length).toBe(2)
        expect(container.querySelectorAll("path").length).toBe(2)
    })

    it("pie_dibuja_los_segmentos_y_la_leyenda", () => {
        const { container } = render(<Chart item={item("A: 70\nB: 30", "pie")} />)
        expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2)
        expect(container.textContent).toContain("70%")
    })

    it("con_valores_dinamicos_usa_replaceDynamicValues", () => {
        render(<Chart item={item("A: {var}")} ref={{ id: "r1" }} />)
        expect(replaceDynamicValues).toHaveBeenCalledWith("A", { id: "r1" }, 0)
    })
})
