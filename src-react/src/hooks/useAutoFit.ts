// ----- FreeShow -----
// Ajuste automático de texto al alto de su caja.
//
// Port reducido de `autosize(element, { type: "growToFit" })` de la app Svelte.
// Mide el alto natural del contenido y calcula un factor de escala para que el
// texto llene (o quepa en) el alto de la caja contenedora. El factor se aplica
// al `font-size` de cada línea, de modo que las proporciones entre líneas se
// mantienen.
//
// El factor se recalcula sólo cuando cambia el contenido (`signature`) o la caja
// (ResizeObserver); al dividir el alto medido entre el factor actual se obtiene
// el alto natural independiente de la escala, evitando oscilaciones.

import { useLayoutEffect, useRef, useState } from "react"

const MIN_FACTOR = 0.15
const MAX_FACTOR = 4

export function useAutoFit(enabled: boolean, signature: string) {
    const ref = useRef<HTMLDivElement | null>(null)
    const factorRef = useRef(1)
    const [factor, setFactor] = useState(1)

    useLayoutEffect(() => {
        const element = ref.current
        const parent = element?.parentElement
        if (!element || !parent) return

        const compute = () => {
            if (!enabled) {
                factorRef.current = 1
                setFactor(1)
                return
            }
            const boxHeight = parent.clientHeight
            const naturalHeight = element.scrollHeight / (factorRef.current || 1)
            if (!boxHeight || !naturalHeight) return
            const next = Math.min(Math.max(boxHeight / naturalHeight, MIN_FACTOR), MAX_FACTOR)
            if (Math.abs(next - factorRef.current) > 0.005) {
                factorRef.current = next
                setFactor(next)
            }
        }

        compute()
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null
        observer?.observe(parent)
        return () => observer?.disconnect()
    }, [enabled, signature])

    return { ref, factor }
}
