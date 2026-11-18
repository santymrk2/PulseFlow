import { useEffect, useRef, type ReactNode } from "react"
import type { Transition } from "../../../types/Show"
import { custom } from "../../utils/transitions"
import styles from "./OutputTransition.module.css"

export interface OutputTransitionProps {
    transition?: Transition
    inTransition?: Transition | null
    outTransition?: Transition | null
    children?: ReactNode
    /** Equivale al `on:outrostart` del original: avisa de que la capa está saliendo. */
    onOutroStart?: () => void
}

interface SvelteTransition {
    duration: number
    delay: number
    css?: (t: number) => string
    easing?: (t: number) => number
}

function hasTransition(value: Transition | null | undefined): value is Transition {
    return !!value && value.type !== "none" && !!value.duration
}

// Port de components/output/transitions/OutputTransition.svelte (F24.20c).
// El wrapper sigue siendo el mismo; las transiciones `in:`/`out:` de Svelte se reproducen con el
// motor `custom()` de utils/transitions aplicado al nodo durante el montaje.
export function OutputTransition({ transition, inTransition = null, outTransition = null, children, onOutroStart }: OutputTransitionProps) {
    const node = useRef<HTMLDivElement | null>(null)
    const outro = useRef(onOutroStart)
    outro.current = onOutroStart

    const entering = inTransition || transition
    const leaving = outTransition || transition
    const disableTransition = !hasTransition(entering) && !hasTransition(leaving) && !inTransition && !outTransition

    const enterKey = hasTransition(entering) ? `${entering.type}:${entering.duration}:${entering.delay}:${entering.easing}:${JSON.stringify(entering.custom || {})}` : ""

    useEffect(() => {
        const elem = node.current
        if (!elem || !enterKey || typeof window === "undefined") return
        const copy = { ...(entering || {}) }
        const effect = custom(elem, copy) as unknown as SvelteTransition
        const base = elem.style.cssText
        const startedAt = performance.now() + (effect.delay || 0)
        let frame = 0

        function step(now: number) {
            const elapsed = Math.max(0, now - startedAt)
            const progress = effect.duration ? Math.min(1, elapsed / effect.duration) : 1
            const t = effect.easing ? effect.easing(progress) : progress
            elem!.style.cssText = `${base};${effect.css ? effect.css(t) : ""};`
            if (progress < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
        return () => {
            cancelAnimationFrame(frame)
            elem.style.cssText = base
        }
        // El efecto se reinicia sólo cuando cambia la transición de entrada, igual que el `{#if}` del original.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enterKey])

    useEffect(() => {
        return () => outro.current?.()
    }, [])

    return (
        <div ref={node} className={styles.transitioner} data-no-transition={disableTransition ? "true" : undefined}>
            {children}
        </div>
    )
}

export default OutputTransition
