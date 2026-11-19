import { useEffect, useRef, useState } from "react"
import type { Effect as EffectData, EffectItem } from "../../../types/Effects"
import { effects, hoveredEffectItem } from "../../shared/core/stores"
import { clone, getChangedKeys } from "../../components/helpers/array"
import { EffectRender } from "../../components/output/effects/effectRenderer"
import { useStore } from "../hooks/useStore"
import styles from "./Effect.module.css"

export interface EffectProps {
    effect?: (EffectData & { id?: string }) | undefined
    preview?: boolean
    edit?: boolean
}

interface MovableItem extends EffectItem {
    offset?: number
    side?: "left" | "right" | "top" | "bottom"
}

const BASIC_MOVE = ["circle", "rectangle", "triangle", "galaxy", "sun", "lens_flare", "spotlight", "candle", "neon", "asset"]
const VERTICAL_MOVE = ["aurora", "fog", "fireworks", "city", "grass", "rainbow"]

function getTopOffset(item: MovableItem): number {
    if (item.type === "aurora") return item.offset ?? 0.2
    if (item.type === "fog") return item.offset ?? 0.3
    if (item.type === "fireworks") return 1 - (item.offset ?? 0.7)
    if (item.type === "city") return 1 - (item.offset ?? 0)
    if (item.type === "grass") return item.offset ?? 1
    if (item.type === "rainbow") return item.offset ?? 0.2
    return item.offset ?? 0.5
}

// Port de components/output/effects/Effect.svelte (F24.20c).
export function Effect({ effect, preview = false, edit = false }: EffectProps) {
    const currentHovered = useStore(hoveredEffectItem)
    const items = effect?.items || []

    const canvasElem = useRef<HTMLCanvasElement | null>(null)
    const renderer = useRef<EffectRender | null>(null)
    const previousItems = useRef<EffectItem[]>([])
    const pressed = useRef(false)
    const movedIndex = useRef(-1)
    const effectId = useRef(effect?.id)
    const [, forceUpdate] = useState(0)

    useEffect(() => {
        const elem = canvasElem.current
        if (!elem) return
        renderer.current = new EffectRender(elem, items, preview)
        previousItems.current = clone(items)
        return () => {
            renderer.current?.stop()
            renderer.current = null
        }
        // El renderer se crea una sola vez; las actualizaciones de items van por el efecto de abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (renderer.current) renderer.current.highlightedIndex = edit ? currentHovered : null
    }, [currentHovered, edit])

    useEffect(() => {
        const elem = canvasElem.current
        if (!elem) return
        elem.style.cssText = `${effect?.style || ""};background: ${effect?.background || ""};opacity: ${effect?.opacity ?? 1};`
    }, [effect?.style, effect?.background, effect?.opacity])

    useEffect(() => {
        const current = renderer.current
        const elem = canvasElem.current
        if (!current || !elem) return

        const changedKeys = getChangedKeys(
            items.filter((a) => !a.hidden),
            previousItems.current.filter((a) => !a.hidden)
        ) as { key: string }[]
        if (items.length !== previousItems.current.length || items.some((it, i) => it.type !== previousItems.current[i]?.type || it.hidden !== previousItems.current[i]?.hidden)) {
            current.stop()
            renderer.current = new EffectRender(elem, items, preview)
            previousItems.current = clone(items)
            return
        }
        previousItems.current = clone(items)
        const relevant = changedKeys.filter((a) => a.key !== "x" && a.key !== "y" && a.key !== "offset")
        current.updateItems(items, !relevant.length)
    }, [items, preview])

    useEffect(() => {
        function mousemove(event: MouseEvent) {
            if (!pressed.current || movedIndex.current < 0) return
            const target = event.target instanceof Element ? event.target : null
            const parentSlide = target?.closest(".slide") as HTMLElement | null
            const center = target?.closest(".editArea")?.closest(".center") as HTMLElement | null
            if (!parentSlide || !center) return

            const mouseX = event.clientX - parentSlide.offsetLeft - center.offsetLeft
            const mouseY = event.clientY - parentSlide.offsetTop - center.offsetTop
            const x = Math.max(0, mouseX / parentSlide.clientWidth)
            const y = Math.max(0, mouseY / parentSlide.clientHeight)
            const index = movedIndex.current
            effects.update((all) => {
                const item = all[effectId.current || ""]?.items[index] as MovableItem | undefined
                if (!item) return all
                if (BASIC_MOVE.includes(item.type)) {
                    item.x = x
                    item.y = y
                } else if (item.type === "wave") {
                    if (item.side === "left") item.offset = x
                    else if (item.side === "right") item.offset = 1 - x
                    else if (item.side === "top") item.offset = y
                    else item.offset = 1 - y
                } else if (VERTICAL_MOVE.includes(item.type)) {
                    item.offset = item.type === "fireworks" || item.type === "city" ? 1 - y : y
                }
                return all
            })
        }
        function mouseup() {
            pressed.current = false
            movedIndex.current = -1
        }
        window.addEventListener("mousemove", mousemove)
        window.addEventListener("mouseup", mouseup)
        return () => {
            window.removeEventListener("mousemove", mousemove)
            window.removeEventListener("mouseup", mouseup)
        }
    }, [])

    function mousedown(index: number) {
        pressed.current = true
        movedIndex.current = index
        forceUpdate((value) => value + 1)
    }

    return (
        <>
            <canvas ref={canvasElem} className={styles.canvas} />
            {edit
                ? items.map((item, i) => {
                      const movable = item as MovableItem
                      if (movable.hidden) return null
                      if (BASIC_MOVE.includes(movable.type)) return <div key={i} className={styles.mover} style={{ left: `${(movable.x ?? 0) * 100}%`, top: `${(movable.y ?? 0) * 100}%` }} onMouseDown={() => mousedown(i)} />
                      if (movable.type === "wave") {
                          if (movable.side === "left" || movable.side === "right") return <div key={i} className={styles.mover} style={{ left: `${(movable.side === "left" ? (movable.offset ?? 0) : 1 - (movable.offset ?? 0)) * 100}%`, width: 12, height: 50 }} onMouseDown={() => mousedown(i)} />
                          return <div key={i} className={styles.mover} style={{ top: `${(movable.side === "top" ? (movable.offset ?? 0) : 1 - (movable.offset ?? 0)) * 100}%`, width: 50, height: 12 }} onMouseDown={() => mousedown(i)} />
                      }
                      if (VERTICAL_MOVE.includes(movable.type)) return <div key={i} className={styles.mover} style={{ top: `${getTopOffset(movable) * 100}%`, width: 50, height: 12 }} onMouseDown={() => mousedown(i)} />
                      return null
                  })
                : null}
        </>
    )
}

export default Effect
