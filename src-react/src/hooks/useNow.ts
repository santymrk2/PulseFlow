// ----- FreeShow -----
// Devuelve la marca de tiempo actual, refrescándose con el intervalo indicado.
// Útil para relojes y cuentas atrás sin depender de estado global.

import { useEffect, useState } from "react"

export function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])
    return now
}
