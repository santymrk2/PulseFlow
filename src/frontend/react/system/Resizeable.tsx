import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { get } from "svelte/store"
import { cn } from "../../lib/utils"
import { drawer, editColumns, localeDirection, os, resized } from "../../stores"
import { DEFAULT_WIDTH } from "../../utils/common"
import { startResizing, stopResizing } from "../../utils/cursor"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import styles from "./Resizeable.module.css"

// `<slot {width} />` → children como nodo o como función que recibe el ancho.
// Los `<svelte:window on:mouseup on:mousemove>` son listeners de window con limpieza.
// `export let minWidth = handleWidth` tomaba el valor inicial del handle (4).
export interface ResizeableProps {
    id: string
    side?: "left" | "right" | "top" | "bottom"
    defaultWidth?: number
    maxWidth?: number
    minWidth?: number
    children?: ReactNode | ((width: number) => ReactNode)
}

interface MouseState {
    x: number
    y: number
    offset: number
    target: EventTarget | null
}

type Side = NonNullable<ResizeableProps["side"]>

const MIN_WIDTH = 0.69

export function Resizeable({ id, side: originalSide = "left", defaultWidth = DEFAULT_WIDTH, maxWidth = defaultWidth * 2.2, minWidth = 4, children }: ResizeableProps) {
    const direction = useStore(localeDirection)
    const resizedWidths = useStore(resized)
    const side: Side = direction === "rtl" ? (originalSide === "left" ? "right" : originalSide === "right" ? "left" : originalSide) : originalSide

    const [width, setWidth] = useState(defaultWidth)
    const [mouseActive, setMouseActive] = useState(false) // `mouse !== null`, para las dependencias del efecto
    const mouse = useRef<MouseState | null>(null)
    const loaded = useRef(false)
    const move = useRef(false)
    const storeWidth = useRef<number | null>(null)

    const handleWidth = width <= 8 ? 6 : 4

    function setMouse(value: MouseState | null) {
        mouse.current = value
        setMouseActive(value !== null)
    }

    // $: if (!mouse && $resized[id]) width = $resized[id]
    const storedWidth = resizedWidths[id]
    useEffect(() => {
        if (!mouseActive && storedWidth) setWidth(storedWidth)
    }, [mouseActive, storedWidth, id])

    useEffect(() => {
        const timer = setTimeout(() => {
            let next = get(resized)[id] ?? defaultWidth
            // reset to default if closed on startup
            if ((id === "leftPanel" || id === "rightPanel") && next <= handleWidth) next = defaultWidth
            loaded.current = true
            setWidth(next)
        }, 2000)
        return () => clearTimeout(timer)
    }, [])

    // $: if (width !== null) storeValue()
    useEffect(() => {
        if (!loaded.current) return

        resized.update((a) => {
            a[id] = width
            return a
        })

        if (side === "left") {
            const gap = maxWidth - defaultWidth
            const triple = defaultWidth + gap * 0.8
            const double = defaultWidth + gap * 0.4
            const columns = get(editColumns)
            if (width > triple && columns === 2) {
                editColumns.set(3)
            } else if (width > double && width < triple && (columns === 1 || columns === 3)) {
                editColumns.set(2)
            } else if (width <= double && columns === 2) {
                editColumns.set(1)
            }
        }
    }, [width])

    const conditions: Record<Side, (e: MouseEvent) => boolean> = {
        left: (e) => closestPanel(e).offsetWidth - e.offsetX <= handleWidth,
        right: (e) => e.clientX < closestPanel(e).offsetLeft + handleWidth && e.offsetX <= handleWidth && e.offsetX >= 0,
        top: (e) => e.clientY < closestPanel(e).offsetTop + handleWidth && e.offsetY <= handleWidth && e.offsetY >= 0,
        bottom: (e) => e.clientY < closestPanel(e).offsetTop + (closestPanel(e).offsetParent as HTMLElement).offsetTop + handleWidth && e.offsetY <= handleWidth && e.offsetY >= 0
    }
    function closestPanel(e: MouseEvent) {
        return (e.target as Element).closest(".panel") as HTMLElement
    }

    function mousedown(event: ReactMouseEvent) {
        const e = event.nativeEvent
        if (!conditions[side](e)) return

        startResizing(side === "left" || side === "right" ? "ew-resize" : "ns-resize")

        setMouse({
            x: e.clientX,
            y: e.clientY,
            offset: side === "top" || side === "bottom" ? window.innerHeight - width - e.clientY : window.innerWidth - width - e.clientX,
            target: e.target
        })
    }

    function getWidth(next: number) {
        if (next < (defaultWidth * MIN_WIDTH) / 2) return minWidth
        if (next < defaultWidth * MIN_WIDTH) return defaultWidth * MIN_WIDTH
        if (next > defaultWidth - 20 && next < defaultWidth + 20) return defaultWidth
        if (next > maxWidth) return maxWidth
        if (side === "bottom") {
            const availableHeight = window.innerHeight - (get(os).platform === "win32" ? 25 : 0) - get(drawer).height - 48 // 48: Top.svelte
            if (next > availableHeight) return availableHeight
        }
        move.current = true
        return next
    }

    function mousemove(e: MouseEvent) {
        const current = mouse.current
        if (!current) return
        const widths: Record<Side, number> = {
            left: e.clientX,
            right: window.innerWidth - e.clientX - current.offset,
            top: e.clientY,
            bottom: window.innerHeight - e.clientY - current.offset
        }
        setWidth(getWidth(widths[side]))
    }

    function click(event: ReactMouseEvent) {
        if (move.current || !conditions[side](event.nativeEvent)) {
            move.current = false
            return
        }

        if (width > minWidth) {
            // don't click to close, only to open (to prevent accidentally closing without knowing)
            return
        }

        setWidth(storeWidth.current === null || storeWidth.current < defaultWidth / 2 ? defaultWidth : storeWidth.current)
        storeWidth.current = null
    }

    function mouseup(e: MouseEvent) {
        if (mouse.current) {
            stopResizing()
            setMouse(null)
        }
        if (!(e.target as Element | null)?.closest?.(".panel")) move.current = false
    }

    // los listeners de window se registran una vez y llaman a la versión del último render
    const latest = useRef({ mouseup, mousemove })
    useEffect(() => {
        latest.current = { mouseup, mousemove }
    })
    useEffect(() => {
        const up = (e: MouseEvent) => latest.current.mouseup(e)
        const moving = (e: MouseEvent) => latest.current.mousemove(e)
        window.addEventListener("mouseup", up)
        window.addEventListener("mousemove", moving)
        return () => {
            window.removeEventListener("mouseup", up)
            window.removeEventListener("mousemove", moving)
        }
    }, [])
    useEffect(
        () => () => {
            if (mouse.current) stopResizing()
        },
        []
    )

    const horizontal = side === "left" || side === "right"
    const style: CSSProperties & { "--handle-width": string } = horizontal ? { width: `${width}px`, "--handle-width": `${handleWidth}px` } : { height: `${width}px`, minHeight: `${width}px`, "--handle-width": `${handleWidth}px` }

    return (
        <div id={id} style={style} className={cn(styles.panel, "panel", `bar_${side}`, width <= handleWidth && styles.zero)} onMouseDown={mousedown} onClick={click}>
            {width <= handleWidth ? <Icon id="arrow_right" size={1.3} white /> : null}

            {typeof children === "function" ? children(width) : children}
        </div>
    )
}
