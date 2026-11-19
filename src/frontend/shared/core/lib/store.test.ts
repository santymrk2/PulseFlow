import { describe, expect, it, vi } from "vitest"
import { derived, get, readable, writable } from "./store"

describe("writable", () => {
    it("subscribe llama enseguida con el valor actual", () => {
        const store = writable(7)
        const values: number[] = []
        store.subscribe((value) => values.push(value))
        expect(values).toEqual([7])
    })

    it("set con el mismo primitivo no notifica", () => {
        const store = writable(1)
        const values: number[] = []
        store.subscribe((value) => values.push(value))
        store.set(1)
        expect(values).toEqual([1])
    })

    it("set con un primitivo distinto notifica", () => {
        const store = writable(1)
        const values: number[] = []
        store.subscribe((value) => values.push(value))
        store.set(2)
        expect(values).toEqual([1, 2])
    })

    it("set con el mismo objeto notifica siempre", () => {
        const obj = { n: 1 }
        const store = writable(obj)
        const values: { n: number }[] = []
        store.subscribe((value) => values.push(value))
        store.set(obj)
        expect(values).toEqual([obj, obj])
    })

    it("set con una función notifica siempre", () => {
        const fn = () => 1
        const store = writable(fn)
        const values: Array<() => number>[] = []
        store.subscribe((value) => values.push(value))
        store.set(fn)
        expect(values).toEqual([fn, fn])
    })

    it("update aplica el updater sobre el valor actual", () => {
        const store = writable(2)
        store.update((n) => n + 3)
        expect(get(store)).toBe(5)
    })

    it("start corre con el primer suscriptor y su limpieza con la salida del último", () => {
        const stop = vi.fn()
        const start = vi.fn(() => stop)
        const store = writable(0, start)

        const unsub1 = store.subscribe(() => {})
        expect(start).toHaveBeenCalledTimes(1)
        expect(stop).not.toHaveBeenCalled()

        const unsub2 = store.subscribe(() => {})
        expect(start).toHaveBeenCalledTimes(1)

        unsub1()
        expect(stop).not.toHaveBeenCalled()

        unsub2()
        expect(stop).toHaveBeenCalledTimes(1)

        store.subscribe(() => {})()
        expect(start).toHaveBeenCalledTimes(2)
        expect(stop).toHaveBeenCalledTimes(2)
    })
})

describe("readable", () => {
    it("expone el valor y permite que start lo actualice", () => {
        let setValue: (value: number) => void = () => {}
        const store = readable(1, (set) => {
            setValue = set
            return () => {}
        })

        const values: number[] = []
        store.subscribe((value) => values.push(value))
        setValue(2)

        expect(values).toEqual([1, 2])
        expect(get(store)).toBe(2)
    })
})

describe("derived", () => {
    it("deriva de un store (forma simple)", () => {
        const a = writable(2)
        const doubled = derived(a, ($a) => $a * 2)

        const values: number[] = []
        doubled.subscribe((value) => values.push(value))
        a.set(3)

        expect(values).toEqual([4, 6])
    })

    it("deriva de un array de stores", () => {
        const a = writable(1)
        const b = writable(10)
        const sum = derived([a, b], ([$a, $b]) => $a + $b)

        const values: number[] = []
        sum.subscribe((value) => values.push(value))
        a.set(2)
        b.set(20)

        expect(values).toEqual([11, 12, 22])
    })

    it("soporta la forma con set asíncrono e initial", async () => {
        const a = writable(1)
        const asyncStore = derived(
            a,
            ($a, set) => {
                queueMicrotask(() => set($a + 1))
                return () => {}
            },
            0
        )

        const values: number[] = []
        asyncStore.subscribe((value) => values.push(value))
        expect(values).toEqual([0])

        await Promise.resolve()
        expect(values).toEqual([0, 2])

        a.set(5)
        await Promise.resolve()
        expect(values).toEqual([0, 2, 6])
    })

    it("limpia la ejecución asíncrona anterior al cambiar la dependencia", async () => {
        const a = writable(1)
        const cleanups: number[] = []
        const store = derived(a, ($a, set) => {
            queueMicrotask(() => set($a))
            return () => {
                cleanups.push($a)
            }
        })

        const unsub = store.subscribe(() => {})
        await Promise.resolve()
        a.set(2)
        expect(cleanups).toEqual([1])

        unsub()
        expect(cleanups).toEqual([1, 2])
    })
})

describe("get", () => {
    it("devuelve el valor actual sin dejar suscriptores activos", () => {
        const stop = vi.fn()
        const start = vi.fn(() => stop)
        const store = writable(42, start)

        expect(get(store)).toBe(42)
        expect(start).toHaveBeenCalledTimes(1)
        expect(stop).toHaveBeenCalledTimes(1)
    })
})
