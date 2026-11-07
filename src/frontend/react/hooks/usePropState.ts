import { useState } from "react"

// Equivale a un `export let x` de Svelte que el componente también reasigna: la asignación local manda hasta que el padre pasa otro valor.
export function usePropState<T>(prop: T): [T, (value: T) => void] {
    const [state, setState] = useState(prop)
    const [previous, setPrevious] = useState(prop)
    if (!Object.is(previous, prop)) {
        setPrevious(prop)
        setState(prop)
    }
    return [state, setState]
}
