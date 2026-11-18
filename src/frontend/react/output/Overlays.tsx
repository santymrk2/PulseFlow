import { useEffect, useRef, useState } from "react"
import type { Item, Overlays as OverlaysData, Transition } from "../../../types/Show"
import { clone } from "../../components/helpers/array"
import { Overlay } from "./OutputOverlay"

export interface OverlaysProps {
    outputId: string
    overlays: OverlaysData | null
    activeOverlays: string[]
    transition: Transition
    mirror?: boolean
    preview?: boolean
    styleIdOverride?: string
}

// Port de components/output/layers/Overlays.svelte (F24.20c).
export function Overlays({ outputId, overlays, activeOverlays, transition, mirror = false, preview = false, styleIdOverride = "" }: OverlaysProps) {
    const [outputted, setOutputted] = useState<string[]>([])
    const [actualOutputted, setActualOutputted] = useState<string[]>([])
    const [isClearing, setIsClearing] = useState<string[]>([])
    const clearingOverlays = useRef<string[]>([])
    const clearingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const activeKey = JSON.stringify(activeOverlays)

    useEffect(() => {
        const nextOutputted = [...outputted]
        ;[...activeOverlays, ...outputted].forEach((id) => {
            if (clearingOverlays.current.includes(id)) return
            if (!activeOverlays.includes(id) && nextOutputted.includes(id)) {
                nextOutputted.splice(nextOutputted.indexOf(id), 1)
                clearingOverlays.current.push(id)
            } else if (activeOverlays.includes(id) && !nextOutputted.includes(id)) {
                nextOutputted.push(id)
            }
        })
        setOutputted(nextOutputted)

        if (clearingOverlays.current.length) {
            if (clearingTimeout.current) clearTimeout(clearingTimeout.current)
            clearingTimeout.current = setTimeout(() => {
                setOutputted((current) => {
                    const restored = [...current]
                    clearingOverlays.current.forEach((id) => {
                        if (activeOverlays.includes(id) && !restored.includes(id)) restored.push(id)
                    })
                    return restored
                })
                clearingOverlays.current = []
            }, 220)
        }
        return () => {
            if (clearingTimeout.current) clearTimeout(clearingTimeout.current)
        }
        // El original reacciona a `activeOverlays`; `outputted` se lee del estado más reciente.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeKey])

    useEffect(() => {
        setIsClearing(actualOutputted.filter((id) => !outputted.includes(id)))
        const timeout = setTimeout(() => setActualOutputted(clone(outputted)))
        return () => clearTimeout(timeout)
    }, [outputted])

    return (
        <>
            {actualOutputted.map((id) => {
                const overlay = overlays?.[id]
                if (!overlay) return null
                return (
                    <div key={id}>
                        <Overlay overlay={overlay as unknown as { items: Item[]; [key: string]: unknown }} id={id} outputId={outputId} styleIdOverride={styleIdOverride} isClearing={isClearing.includes(id)} mirror={mirror} transition={transition} preview={preview} />
                    </div>
                )
            })}
        </>
    )
}

export default Overlays
