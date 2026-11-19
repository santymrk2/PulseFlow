import { useState } from "react"

// Equivale a un `$: x = derive(source)` de Svelte que el componente también reasigna: la asignación local manda hasta que
// cambia `source` (por referencia, como el Object.is de usePropState); entonces se vuelve a derivar. Derivar es barato y puro.
export function useDerivedState<S, P>(source: P, derive: (source: P) => S): [S, (value: S) => void] {
    const [state, setState] = useState(() => derive(source))
    const [previous, setPrevious] = useState(source)
    if (!Object.is(previous, source)) {
        setPrevious(source)
        const next = derive(source)
        setState(next)
        return [next, setState]
    }
    return [state, setState]
}
