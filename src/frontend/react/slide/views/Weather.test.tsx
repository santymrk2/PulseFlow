// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getWeather } from "../../../utils/weather"
import type { Weather as WeatherData } from "../../../../types/Show"
import { Weather } from "./Weather"

vi.mock("../../../utils/weather", () => ({ getWeather: vi.fn() }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))

const now = new Date()
const iso = (hours: number) => {
    const d = new Date(now)
    d.setHours(hours, 0, 0, 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00:00Z`
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Weather", () => {
    it("sin_latitud_no_muestra_nada", async () => {
        vi.mocked(getWeather).mockResolvedValue(null)
        const { container } = render(<Weather data={{} as WeatherData} />)
        await act(async () => {})
        expect(container.textContent).toBe("")
    })

    it("muestra_cargando_mientras_no_hay_datos", async () => {
        vi.mocked(getWeather).mockResolvedValue(null)
        const { container } = render(<Weather data={{ latitude: 1, longitude: 2 } as WeatherData} />)
        await act(async () => {})
        expect(container.textContent).toContain("remote.loading")
    })

    it("con_datos_muestra_la_temperatura_y_los_creditos", async () => {
        vi.mocked(getWeather).mockResolvedValue({
            properties: {
                meta: { updated_at: "2026-11-17T10:00:00Z", units: { air_temperature: "celsius", wind_speed: "m/s" } },
                timeseries: [{ time: iso(now.getHours() + 1), data: { instant: { details: { air_temperature: 20, wind_speed: 3 } }, next_1_hours: { summary: { symbol_code: "clearsky_day" } } } }]
            }
        } as never)
        const { container } = render(<Weather data={{ latitude: 1, longitude: 2, size: 100 } as WeatherData} />)
        await act(async () => {})
        expect(container.textContent).toContain("20° C")
        expect(container.textContent).toContain("3 m/s")
        expect(container.textContent).toContain("Data from MET Norway")
        expect(container.querySelector('img[src="./assets/weather/clearsky_day.svg"]')).toBeTruthy()
    })

    it("con_useFahrenheit_convierte_la_temperatura", async () => {
        vi.mocked(getWeather).mockResolvedValue({
            properties: {
                meta: { updated_at: "2026-11-17T10:00:00Z", units: { air_temperature: "celsius", wind_speed: "m/s" } },
                timeseries: [{ time: iso(now.getHours() + 1), data: { instant: { details: { air_temperature: 0, wind_speed: 1 } } } }]
            }
        } as never)
        const { container } = render(<Weather data={{ latitude: 1, longitude: 2, useFahrenheit: true } as WeatherData} />)
        await act(async () => {})
        expect(container.textContent).toContain("32° F")
    })
})
