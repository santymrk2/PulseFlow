import { useDerivedState } from "./useDerivedState"

// Equivale a un `export let x` de Svelte que el componente también reasigna: la asignación local manda hasta que el padre pasa otro valor.
export const usePropState = <T>(prop: T): [T, (value: T) => void] => useDerivedState(prop, (value: T) => value)
