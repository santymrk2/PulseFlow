import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type WheelEvent } from "react"
import { cn } from "../../shared/core/lib/utils"
import styles from "./Autoscroll.module.css"

// dispatch("wheel", { event }) → onWheel({ event }) con el evento nativo.
// `bind:scrollElem` → `scrollElem`: ref que el padre pasa y que apunta al div. `$: if (offset >= 0) scroll(0)` no corre
// al montar (en Svelte 5 el `$:` corre antes de que exista el DOM, con scrollElem null: no hacía nada), sólo al cambiar `offset`.
export interface AutoscrollProps {
    scrollElem?: RefObject<HTMLDivElement | null>
    timeout?: number
    smoothTimeout?: number
    offset?: number
    shouldSkipSmooth?: number
    disabled?: boolean
    className?: string
    style?: CSSProperties
    children?: ReactNode
    onWheel?: (detail: { event: Event }) => void
}

export function Autoscroll({ scrollElem, timeout = 0, smoothTimeout = 800, offset = -1, shouldSkipSmooth = 0, disabled = false, className, style, children, onWheel }: AutoscrollProps) {
    const ownRef = useRef<HTMLDivElement>(null)
    const elemRef = scrollElem ?? ownRef
    const [instantScroll, setInstantScroll] = useState(true) // el skipSmooth() del arranque

    // las funciones de abajo viven más que un render (timers): leen siempre las props actuales, como las variables de Svelte
    const latest = useRef({ offset, timeout, smoothTimeout, disabled })
    useEffect(() => {
        latest.current = { offset, timeout, smoothTimeout, disabled }
    })

    const skipSmoothTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const t = useRef<ReturnType<typeof setTimeout> | null>(null)
    const st = useRef<ReturnType<typeof setTimeout> | null>(null)

    function scroll(index: number) {
        if (t.current !== null || latest.current.disabled) return

        let elem: Element | null = elemRef.current
        if (!elem) return

        // set this to make it scroll (because of dropping when scrolled)
        if (elem.querySelector(".droparea")) elem = elem.querySelector(".droparea")
        if (elem?.querySelector(".droparea")) elem = elem.querySelector(".droparea")

        if (!elem) return
        const target = elem
        target.setAttribute("style", (target.getAttribute("style") || "") + ";scroll-behavior: smooth;")

        t.current = setTimeout(() => {
            if (!t.current) return
            target.scrollTo(0, latest.current.offset)
            t.current = null
        }, latest.current.timeout)

        // make sure its scrolled
        if (index > 5 || latest.current.offset === target.scrollTop) return

        index++
        if (st.current) return

        st.current = setTimeout(() => {
            if (!st.current) return
            if (latest.current.offset !== target.scrollTop) scroll(index)
            st.current = null
        }, latest.current.timeout + 400)
    }

    function skipSmooth() {
        setInstantScroll(true)
        if (skipSmoothTimer.current) clearTimeout(skipSmoothTimer.current)
        skipSmoothTimer.current = setTimeout(() => setInstantScroll(false), latest.current.smoothTimeout)

        if (latest.current.offset === 0) scroll(0)
    }

    // skipSmooth() al arrancar y `$: if (shouldSkipSmooth) skipSmooth()`
    useEffect(() => {
        skipSmooth()
        return () => {
            if (skipSmoothTimer.current) clearTimeout(skipSmoothTimer.current)
        }
    }, [])
    const mounted = useRef(false)
    useEffect(() => {
        if (mounted.current && shouldSkipSmooth) skipSmooth()
    }, [shouldSkipSmooth])

    useEffect(() => {
        if (!mounted.current) return
        if (offset >= 0) scroll(0)
    }, [offset])

    useEffect(() => {
        mounted.current = true
    }, [])

    function wheel(event: WheelEvent<HTMLDivElement>) {
        onWheel?.({ event: event.nativeEvent })
        t.current = null
        st.current = null
    }

    return (
        <div ref={elemRef} className={cn(styles.scroll, className, instantScroll && styles.instantScroll)} style={style} onWheel={wheel}>
            {children}
        </div>
    )
}
