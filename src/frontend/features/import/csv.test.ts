import "./testEnv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture } from "./converterTestKit"

const { setTempShows } = vi.hoisted(() => ({ setTempShows: vi.fn() }))
vi.mock("./importHelpers", () => ({ setTempShows, createCategory: vi.fn(() => "cat") }))

const { convertCSV } = await import("./csv")

/** Valores de los campos de cada diapositiva (un item por campo). */
const rows = (show: any) => Object.values<any>(show.slides).map((slide) => slide.items.map((item: any) => item.lines[0].text[0].value))

describe("convertCSV", () => {
    beforeEach(() => {
        setTempShows.mockClear()
        vi.useFakeTimers()
    })

    it("convierte un .csv real: una diapositiva por fila y un item por campo (con comas entre comillas)", () => {
        convertCSV([{ name: "agenda", content: fixture("agenda.csv") }])
        vi.runAllTimers()

        const [shows] = setTempShows.mock.calls[0]
        expect(shows).toHaveLength(1)
        expect(shows[0].show.name).toBe("agenda")
        expect(rows(shows[0].show)).toEqual([
            ["Domingo", "Bienvenida, oración", "9:00"],
            ["Sermón", "Pastor Juan", "10:30"]
        ])
    })

    it("los finales de línea de Windows (CRLF) no dejan un \\r pegado al último campo", () => {
        convertCSV([{ name: "agenda", content: fixture("agenda.csv") }])
        vi.runAllTimers()

        const flat = rows(setTempShows.mock.calls[0][0][0].show).flat()
        expect(flat.some((value: string) => value.includes("\r"))).toBe(false)
    })

    it("las líneas vacías no generan diapositivas", () => {
        convertCSV([{ name: "con-vacias", content: "a,b\n\n\nc,d\n" }])
        vi.runAllTimers()

        expect(rows(setTempShows.mock.calls[0][0][0].show)).toEqual([
            ["a", "b"],
            ["c", "d"]
        ])
    })
})
