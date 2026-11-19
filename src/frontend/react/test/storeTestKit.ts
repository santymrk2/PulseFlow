import { get, type Writable } from "../../shared/core/lib/store"

export interface StoreEntry {
    apply: () => () => void
}

// Setea `value` y devuelve la función que restaura el valor anterior
export function storeEntry<T>(store: Writable<T>, value: T): StoreEntry {
    return {
        apply: () => {
            const previous = get(store)
            store.set(value)
            return () => store.set(previous)
        }
    }
}

// Aplica todas las entradas; la función devuelta las restaura en orden inverso
export function setStoresForTest(entries: StoreEntry[]): () => void {
    const restores = entries.map((entry) => entry.apply())
    return () => [...restores].reverse().forEach((restore) => restore())
}

// Como `storeEntry`, pero el valor de ejemplo no tiene que cumplir el tipo completo del store (tests con datos mínimos)
export function looseEntry<T>(store: Writable<T>, value: unknown): StoreEntry {
    return storeEntry(store, value as T)
}
