import { useEffect, useState, type RefObject } from "react"
import { MAX_DB, MIN_DB } from "../../../../shared/audio/dBUtils"
import { AudioAnalyser } from "../../../../shared/audio/audioAnalyser"

// Equivalente a `bind:clientWidth` de Svelte: mide el ancho del contenedor y reacciona a resize.
// Si no hay ResizeObserver (tests, entornos sin DOM completo) se conserva el ancho por defecto.
export function useElementWidth(ref: RefObject<HTMLElement | null>, defaultWidth: number): number {
    const [width, setWidth] = useState(defaultWidth)

    useEffect(() => {
        const element = ref.current
        if (!element || typeof ResizeObserver === "undefined") return

        const measure = () => {
            const next = element.clientWidth || element.getBoundingClientRect().width
            if (next > 0) setWidth(Math.floor(next))
        }
        measure()

        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return width
}

export interface LiveLevels {
    inputLevelDb: number
    reduction: number
}

// Nivel de entrada en vivo y reducción de ganancia, muestreados cada 50 ms como en los componentes Svelte originales.
export function useLiveLevels(channelId: string, getReduction: (() => number) | null = null, minDb = MIN_DB, maxDb = MAX_DB): LiveLevels {
    const [levels, setLevels] = useState<LiveLevels>({ inputLevelDb: minDb, reduction: 0 })

    useEffect(() => {
        const poll = () => {
            const channelDb = AudioAnalyser.getChannelLiveVolume(channelId)
            setLevels({ inputLevelDb: Math.max(minDb, Math.min(maxDb, channelDb)), reduction: getReduction?.() ?? 0 })
        }
        poll()
        const interval = setInterval(poll, 50)
        return () => clearInterval(interval)
    }, [channelId, getReduction, minDb, maxDb])

    return levels
}
