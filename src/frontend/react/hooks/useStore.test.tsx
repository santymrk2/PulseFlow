// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { get, readable, writable } from "svelte/store"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { useStore } from "./useStore"

describe("useStore", () => {
    it("devuelve_el_valor_inicial", () => {
        const store = writable(1)
        const { result } = renderHook(() => useStore(store))
        expect(result.current).toBe(1)
    })

    it("se_actualiza_con_set", () => {
        const store = writable(1)
        const { result } = renderHook(() => useStore(store))
        act(() => store.set(2))
        expect(result.current).toBe(2)
    })

    it("se_actualiza_con_mutacion_en_el_lugar", () => {
        const store = writable({ n: 1 })
        const { result } = renderHook(() => useStore(store))
        act(() =>
            store.update((s) => {
                s.n = 5
                return s
            })
        )
        expect(result.current.n).toBe(5)
    })

    it("se_desuscribe_al_desmontar", () => {
        // get() de svelte/store también arranca y detiene el store: por eso se mide "activo" (suscripciones abiertas), no sólo "alguna vez se detuvo"
        let activo = false
        const store = readable(0, () => {
            activo = true
            return () => {
                activo = false
            }
        })
        const { unmount } = renderHook(() => useStore(store))
        expect(activo).toBe(true)
        unmount()
        expect(activo).toBe(false)
    })

    it("setStoresForTest_restaura", () => {
        const a = writable("a1")
        const b = writable(10)
        const restore = setStoresForTest([storeEntry(a, "a2"), storeEntry(b, 20)])
        expect(get(a)).toBe("a2")
        expect(get(b)).toBe(20)
        restore()
        expect(get(a)).toBe("a1")
        expect(get(b)).toBe(10)
    })
})
