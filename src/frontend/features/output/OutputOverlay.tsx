import { useEffect, useRef, useState } from "react"
import type { Item, Transition } from "../../../types/Show"
import { shouldItemBeShown } from "../edit/logic/scripts/itemHelpers"
import { clone } from "../../shared/utils/helpers/array"
import { Textbox } from "../slide/Textbox"
import { SlideItemTransition } from "./SlideItemTransition"

export interface OverlayProps {
    outputId: string
    isClearing?: boolean
    id?: string
    overlay: { items: Item[]; [key: string]: unknown }
    mirror?: boolean
    preview?: boolean
    transition: Transition
    styleIdOverride?: string
}

type OverlayItem = Item & { conditions?: unknown }

// Port de components/output/layers/Overlay.svelte (F24.20c).
export function Overlay({ outputId, isClearing = false, id = "", overlay, mirror = false, preview = false, transition, styleIdOverride = "" }: OverlayProps) {
    const [currentItems, setCurrentItems] = useState<Item[]>([])
    const [show, setShow] = useState(false)
    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const isMic = JSON.stringify((currentItems as OverlayItem[]).map((a) => a?.conditions) || "").includes('"element":"volume"')
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const itemsKey = JSON.stringify(overlay?.items)
    const showItemRef = { outputId, type: "default" }

    useEffect(() => {
        if (overlay?.items === undefined) return
        setShow(false)
        if (timeout.current) clearTimeout(timeout.current)
        timeout.current = setTimeout(() => {
            setCurrentItems(clone(overlay.items || []))
            setShow(true)
        })
        return () => {
            if (timeout.current) clearTimeout(timeout.current)
        }
        // Igual que el statement reactivo: compara por contenido.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsKey])

    useEffect(() => {
        const interval = setInterval(
            () => {
                if (isClearing || !Array.isArray(currentItems)) return
                if ((currentItems as OverlayItem[]).find((a) => a?.conditions)) setConditionsUpdater((value) => value + 1)
            },
            isMic ? 100 : 300
        )
        return () => clearInterval(interval)
    }, [isClearing, currentItems, isMic])

    const transitionEnabled = !!((transition.type !== "none" && transition.duration) || transition.in || transition.out)

    return (
        <>
            {show &&
                currentItems.map((item, index) => {
                    if (!shouldItemBeShown(item, [], showItemRef, conditionsUpdater)) return null
                    return (
                        <SlideItemTransition key={`${item.id || index}-${show}`} transitionEnabled={transitionEnabled} isClearing={isClearing} globalTransition={transition} item={item}>
                            {({ customItem }) => <Textbox item={customItem} ref={{ type: "overlay", id }} mirror={mirror} preview={preview} outputId={outputId} styleIdOverride={styleIdOverride} updateDynamicValues={!isClearing} />}
                        </SlideItemTransition>
                    )
                })}
        </>
    )
}

export default Overlay
