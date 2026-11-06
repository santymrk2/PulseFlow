import { useEffect, useState } from "react"
import { get, type Readable } from "svelte/store"

export function useStore<T>(store: Readable<T>): T {
    const [box, setBox] = useState(() => ({ value: get(store) }))
    useEffect(() => store.subscribe((value) => setBox({ value })), [store])
    return box.value
}
