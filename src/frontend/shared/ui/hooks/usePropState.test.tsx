// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePropState } from "./usePropState"

describe("usePropState", () => {
    it("la_asignacion_local_manda_hasta_que_cambia_la_prop", () => {
        const { result, rerender } = renderHook(({ prop }) => usePropState(prop), { initialProps: { prop: 1 } })
        act(() => result.current[1](5))
        expect(result.current[0]).toBe(5)

        rerender({ prop: 1 })
        expect(result.current[0]).toBe(5)

        rerender({ prop: 2 })
        expect(result.current[0]).toBe(2)
    })
})
