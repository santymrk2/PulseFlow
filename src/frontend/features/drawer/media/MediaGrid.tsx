import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type UIEvent } from "react"
import { debounce } from "@tanstack/pacer"
import styles from "./MediaGrid.module.css"

// Port de components/drawer/media/MediaGrid.svelte: grilla virtualizada. `<slot {item} />` → render(item).
export interface MediaGridProps {
    items: unknown[]
    columns: number
    render: (item: never) => ReactNode
    className?: string
    style?: CSSProperties
}

const MARGIN = 250

export function MediaGrid({ items, columns, render, className, style }: MediaGridProps) {
    const [cardHeight, setCardHeight] = useState(0)
    const [viewHeight, setViewHeight] = useState(0)
    const [ready, setReady] = useState(false)
    const [firstItemIndex, setFirstItemIndex] = useState(0)
    const [lastItemIndex, setLastItemIndex] = useState(0)
    const [lazyLoader, setLazyLoader] = useState(0)

    const gridElem = useRef<HTMLDivElement>(null)
    const customCard = useRef<HTMLDivElement>(null)
    const scrollYPos = useRef(0)
    const lastUpdate = useRef(0)
    const scrollUpdateFrame = useRef<number | null>(null)
    const animationFrame = useRef<number | null>(null)
    const lazyLoadFrame = useRef<number | null>(null)
    const stateRef = useRef({ firstItemIndex, lastItemIndex, cardHeight, viewHeight, items, columns })
    stateRef.current = { firstItemIndex, lastItemIndex, cardHeight, viewHeight, items, columns }

    function slowlyChange(type: "last" | "first", steps = columns - 1) {
        if (steps < 1) return
        if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
        animationFrame.current = requestAnimationFrame(() => {
            if (type === "last") setLastItemIndex((v) => v + 1)
            else setFirstItemIndex((v) => v - 1)
            if (steps > 1) slowlyChange(type, steps - 1)
            else animationFrame.current = null
        })
    }

    function updateVisibleItems(update = false) {
        const current = stateRef.current
        if (!current.cardHeight) return
        const verticalCardsVisible = Math.ceil((current.viewHeight + MARGIN * 2) / current.cardHeight)
        const top = Math.max(0, scrollYPos.current - MARGIN)
        const firstVerticalItemIndex = Math.floor(top / current.cardHeight)
        const lastVerticalItemIndex = firstVerticalItemIndex + verticalCardsVisible

        const newFirst = firstVerticalItemIndex * current.columns
        const newLast = lastVerticalItemIndex * current.columns + current.columns

        if (update) {
            setFirstItemIndex(newFirst)
            setLastItemIndex(newLast)
            return
        }

        if (newLast > current.lastItemIndex) {
            setFirstItemIndex(newFirst)
            setLastItemIndex(newLast > current.items.length ? current.items.length : newLast - current.columns)
            slowlyChange("last")
            return
        }

        if (newFirst < current.firstItemIndex) {
            setLastItemIndex(newLast)
            if (newFirst < 1) {
                setFirstItemIndex(0)
                return
            }
            setFirstItemIndex(newFirst + current.columns - 1)
            slowlyChange("first")
        }
    }

    const debouncedScroll = debounce(
        (scrollTop: number) => {
            scrollYPos.current = scrollTop
            const extraMargin = stateRef.current.cardHeight * 0.4
            if (scrollTop > lastUpdate.current + extraMargin || scrollTop < lastUpdate.current - extraMargin) {
                lastUpdate.current = scrollTop
                if (scrollUpdateFrame.current) cancelAnimationFrame(scrollUpdateFrame.current)
                scrollUpdateFrame.current = requestAnimationFrame(() => {
                    updateVisibleItems()
                    scrollUpdateFrame.current = null
                })
            }
        },
        { wait: 32 }
    )

    useEffect(() => {
        const el = customCard.current
        if (!el || !columns) return
        setCardHeight(el.offsetHeight)
        setReady(true)
    }, [columns])

    useEffect(() => {
        const el = gridElem.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setViewHeight(entry.contentRect.height)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (ready && items && columns) updateVisibleItems(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, items, columns, cardHeight, viewHeight])

    useEffect(() => {
        if (!ready || !items?.length) return
        let loader = 0
        setLazyLoader(0)
        if (lazyLoadFrame.current) cancelAnimationFrame(lazyLoadFrame.current)
        function tick() {
            loader++
            if (loader > stateRef.current.lastItemIndex) {
                setLazyLoader(stateRef.current.items.length)
            } else if (loader < stateRef.current.items.length) {
                lazyLoadFrame.current = requestAnimationFrame(tick)
            }
        }
        lazyLoadFrame.current = requestAnimationFrame(tick)
        return () => {
            if (lazyLoadFrame.current) cancelAnimationFrame(lazyLoadFrame.current)
        }
    }, [ready, items])

    useEffect(() => {
        return () => {
            if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
            if (scrollUpdateFrame.current) cancelAnimationFrame(scrollUpdateFrame.current)
        }
    }, [])

    function scroll(e: UIEvent<HTMLDivElement>) {
        debouncedScroll(e.currentTarget.scrollTop)
    }

    const width = `${100 / columns}%`

    return (
        <div ref={gridElem} className={`${styles.grid} ${className ?? ""}`} style={style} onScroll={scroll}>
            {items.map((item, i) => {
                if (i === 0) {
                    return (
                        <div key={i} ref={customCard} className={styles.card} style={{ width }}>
                            {render(item as never)}
                        </div>
                    )
                }
                if (i > lazyLoader || i < firstItemIndex || i > lastItemIndex) {
                    return <div key={i} style={{ width, height: cardHeight }} />
                }
                return (
                    <div key={i} className={styles.card} style={{ width }}>
                        {render(item as never)}
                    </div>
                )
            })}
        </div>
    )
}
