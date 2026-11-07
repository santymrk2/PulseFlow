// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDerivedState } from "./useDerivedState"

describe("useDerivedState", () => {
    it("la_asignacion_local_manda_hasta_que_cambia_la_fuente", () => {
        const derive = vi.fn((n: number) => ({ doble: n * 2 }))
        const { result, rerender } = renderHook(({ source }) => useDerivedState(source, derive), { initialProps: { source: 1 } })
        expect(result.current[0]).toEqual({ doble: 2 })

        act(() => result.current[1]({ doble: 99 }))
        expect(result.current[0]).toEqual({ doble: 99 })

        rerender({ source: 1 })
        expect(result.current[0]).toEqual({ doble: 99 })

        rerender({ source: 2 })
        expect(result.current[0]).toEqual({ doble: 4 })
    })

    it("deriva_una_sola_vez_por_cambio_de_fuente", () => {
        const derive = vi.fn((n: number) => n + 1)
        const { rerender } = renderHook(({ source }) => useDerivedState(source, derive), { initialProps: { source: 1 } })
        rerender({ source: 1 })
        rerender({ source: 1 })
        expect(derive).toHaveBeenCalledTimes(1)
        rerender({ source: 5 })
        expect(derive).toHaveBeenCalledTimes(2)
    })
})
