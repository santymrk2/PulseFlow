import { describe, expect, test } from "vitest"
import { DEFAULT_SIZES, dragSplitter, MIN_ITEMS, MIN_PANEL } from "./panelSizes"

describe("dragSplitter", () => {
    test("el divisor de LIBRARIES le saca a PLAYLISTS y no toca a ÍTEMS", () => {
        const result = dragSplitter({ libraries: 20, playlists: 20 }, "libraries", 5)
        expect(result).toEqual({ libraries: 25, playlists: 15 })
    })

    test("LIBRARIES no baja del mínimo ni pasa por encima de PLAYLISTS", () => {
        expect(dragSplitter({ libraries: 20, playlists: 20 }, "libraries", -50).libraries).toBe(MIN_PANEL)
        expect(dragSplitter({ libraries: 20, playlists: 20 }, "libraries", 50).libraries).toBe(40 - MIN_PANEL)
    })

    test("el divisor de PLAYLISTS cambia su alto y respeta el mínimo de ÍTEMS", () => {
        expect(dragSplitter({ libraries: 20, playlists: 20 }, "playlists", 10)).toEqual({ libraries: 20, playlists: 30 })
        expect(dragSplitter({ libraries: 20, playlists: 20 }, "playlists", 80).playlists).toBe(100 - MIN_ITEMS - 20)
        expect(dragSplitter({ libraries: 20, playlists: 20 }, "playlists", -80).playlists).toBe(MIN_PANEL)
    })

    test("los tamaños por defecto dejan a ÍTEMS con lo más grande", () => {
        const items = 100 - DEFAULT_SIZES.libraries - DEFAULT_SIZES.playlists
        expect(items).toBeGreaterThan(DEFAULT_SIZES.libraries)
        expect(items).toBeGreaterThanOrEqual(MIN_ITEMS)
    })
})
