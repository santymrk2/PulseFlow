import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "../../lib/utils"
import styles from "./VirtualList.module.css"

// Port fiel de components/drawer/VirtualList.svelte (de @sveltejs/svelte-virtual-list): mide el offsetHeight de cada fila, usa el promedio
// para las no medidas y corrige el scrollTop al subir sobre filas no medidas. `let:item` -> render(item, index). `start`/`end` ya no se exponen con bind.
// `className` es un agregado para que el padre pinte el viewport.
export interface VirtualListProps<T> {
    items: T[]
    height?: string
    itemHeight?: number
    activeIndex?: number | null
    className?: string
    render: (item: T, index: number) => ReactNode
}

export function VirtualList<T>({ items, height = "100%", itemHeight, activeIndex = null, className, render }: VirtualListProps<T>) {
    const viewport = useRef<HTMLDivElement>(null)
    const contents = useRef<HTMLDivElement>(null)
    const heightMap = useRef<number[]>([])
    const averageHeight = useRef(0)
    const pendingCorrection = useRef<{ oldStart: number; scrollTop: number } | null>(null)

    const [start, setStart] = useState(0)
    const [end, setEnd] = useState(0)
    const [top, setTop] = useState(0)
    const [bottom, setBottom] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)

    const rows = () => contents.current?.children ?? ([] as unknown as HTMLCollection)
    const rowHeight = (row: Element) => itemHeight || (row as HTMLElement).offsetHeight

    // `bind:offsetHeight={viewport_height}`
    useLayoutEffect(() => {
        const el = viewport.current
        if (!el) return
        setViewportHeight(el.offsetHeight)
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => setViewportHeight(el.offsetHeight))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // `$: if (mounted) refresh(items, viewport_height, itemHeight)`. Si falta renderizar una fila sube `end` y vuelve a correr (el `await tick()` del Svelte).
    useLayoutEffect(() => {
        const el = viewport.current
        if (!el) return
        const { scrollTop } = el

        let contentHeight = top - scrollTop
        let i = start

        // loop fix
        if (contentHeight < -500) return

        while (contentHeight < viewportHeight && i < items.length) {
            const row = rows()[i - start]
            if (!row) {
                if (end !== i + 1) setEnd(i + 1)
                return
            }

            // loop fix
            const measured = (heightMap.current[i] = itemHeight || (row as HTMLElement).offsetHeight || 30)

            contentHeight += measured
            i += 1
        }

        setEnd(i)

        const remaining = items.length - i
        averageHeight.current = (top + contentHeight) / i

        setBottom(remaining * averageHeight.current)
        heightMap.current.length = items.length
    }, [items, viewportHeight, itemHeight, end])

    function handleScroll() {
        const el = viewport.current
        if (!el) return
        const { scrollTop } = el
        const oldStart = start
        const current = rows()

        for (let v = 0; v < current.length; v += 1) {
            heightMap.current[start + v] = itemHeight || (current[v] as HTMLElement).offsetHeight
        }

        let i = 0
        let y = 0
        let newStart = start
        let newTop = top

        while (i < items.length) {
            const rowH = heightMap.current[i] || averageHeight.current
            if (y + rowH > scrollTop) {
                newStart = i
                newTop = y

                break
            }

            y += rowH
            i += 1
        }

        while (i < items.length) {
            y += heightMap.current[i] || averageHeight.current
            i += 1

            if (y > scrollTop + viewportHeight) break
        }

        const remaining = items.length - i
        averageHeight.current = y / i

        while (i < items.length) heightMap.current[i++] = averageHeight.current

        setStart(newStart)
        setTop(newTop)
        setEnd(items.length - remaining)
        setBottom(remaining * averageHeight.current)

        // prevent jumping if we scrolled up into unknown territory
        if (newStart < oldStart) pendingCorrection.current = { oldStart, scrollTop }
    }

    // El resto del handler del Svelte, después del `await tick()`: con las filas nuevas ya renderizadas
    useLayoutEffect(() => {
        const pending = pendingCorrection.current
        const el = viewport.current
        if (!pending || !el) return
        pendingCorrection.current = null

        let expectedHeight = 0
        let actualHeight = 0
        const current = rows()
        for (let i = start; i < pending.oldStart; i += 1) {
            if (current[i - start]) {
                expectedHeight += heightMap.current[i]
                actualHeight += rowHeight(current[i - start])
            }
        }

        el.scrollTo(0, pending.scrollTop + (actualHeight - expectedHeight))
    }, [start])

    function scrollToIndex(index: number) {
        const el = viewport.current
        if (!el || index < 0 || index >= items.length) return

        // init if not already scrolled
        handleScroll()

        // Calculate the scroll position for the item
        let itemTop = 0
        for (let i = 0; i < index; i++) {
            itemTop += heightMap.current[i] || averageHeight.current || itemHeight || 30
        }
        const itemHeightValue = heightMap.current[index] || averageHeight.current || itemHeight || 30
        const itemBottom = itemTop + itemHeightValue

        // Get current viewport scroll range
        const scrollTop = el.scrollTop
        const scrollBottom = scrollTop + viewportHeight

        // Only scroll if not already in view
        if (itemTop < scrollTop || itemBottom > scrollBottom) {
            el.scrollTo({ top: itemTop - viewportHeight * 0.3 })
        }
    }

    // `$: if (mounted && activeIndex !== null) setTimeout(() => scrollToIndex(activeIndex))`; lee siempre lo último
    const latest = useRef(scrollToIndex)
    useEffect(() => {
        latest.current = scrollToIndex
    })
    useEffect(() => {
        if (activeIndex === null) return
        const timeout = setTimeout(() => latest.current(activeIndex))
        return () => clearTimeout(timeout)
    }, [activeIndex])

    const visible = items.slice(start, end).map((data, i) => ({ index: i + start, data }))

    return (
        <div ref={viewport} className={cn(styles.viewport, className)} onScroll={handleScroll} style={{ height }}>
            <div ref={contents} className={styles.contents} style={{ paddingTop: `${top}px`, paddingBottom: `${bottom}px` }}>
                {visible.map((row) => (
                    <div key={row.index} className={styles.row}>
                        {render(row.data, row.index)}
                    </div>
                ))}
            </div>
        </div>
    )
}
