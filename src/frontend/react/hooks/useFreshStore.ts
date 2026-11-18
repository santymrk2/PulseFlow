import { useEffect, useState } from "react"
import { get, type Readable } from "../../lib/store"

// Como `useStore`, pero cada notificación entrega una copia: varios popups (Rename, Color, NodeOptions) mutan estos
// stores en el lugar y devuelven el mismo objeto. El `$:` de Svelte se reejecuta igual; el React Compiler memoiza por
// identidad y se quedaría con el valor viejo. `copy` renueva también las listas anidadas que el componente deriva.
export function useFreshStore<T>(store: Readable<T>, copy: (value: T) => T = shallowCopy): T {
    const [box, setBox] = useState(() => ({ value: copy(get(store)) }))
    useEffect(() => store.subscribe((value) => setBox({ value: copy(value) })), [store])
    return box.value
}

function shallowCopy<T>(value: T): T {
    if (Array.isArray(value)) return [...value] as T
    if (value && typeof value === "object") return { ...value }
    return value
}
