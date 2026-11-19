import { useLayoutEffect, useRef, useState, type RefObject } from "react"

// Equivale a `transition:slide` de Svelte (entrada y salida) con la Web Animations API: anima height, padding/margin/border
// de arriba y abajo y la opacidad entre 0 y los valores medidos. Sin `height: auto` ni `interpolate-size` (WKWebView no lo soporta).
// Al abrir monta y anima 0 -> medido; al cerrar mantiene montado, anima medido -> 0 y desmonta al terminar.
// Si el entorno no tiene `animate`, monta y desmonta sin animar.
export const SLIDE_EASING = "cubic-bezier(0.215, 0.61, 0.355, 1)" // cubicOut, el easing por defecto de slide

const SIDES = ["Top", "Bottom"] as const

function slideKeyframes(el: HTMLElement, open: boolean): Keyframe[] {
    const style = getComputedStyle(el)
    const opacity = +style.opacity
    const full: Keyframe = { overflow: "hidden", opacity, height: style.height, minHeight: "0px" }
    const collapsed: Keyframe = { overflow: "hidden", opacity: 0, height: "0px", minHeight: "0px" }
    for (const side of SIDES) {
        for (const prop of [`padding${side}`, `margin${side}`, `border${side}Width`]) {
            full[prop] = style[prop as keyof CSSStyleDeclaration] as string
            collapsed[prop] = "0px"
        }
    }
    // Svelte: opacity = min(t * 20, 1) * opacity, con t ya suavizado por el easing (a la salida, t baja de 1 a 0)
    return open ? [collapsed, { ...full, offset: 0.05 }, full] : [full, { ...full, offset: 0.95 }, collapsed]
}

export function useSlide<T extends HTMLElement>(open: boolean, durationMs: number): { mounted: boolean; ref: RefObject<T | null> } {
    const ref = useRef<T | null>(null)
    const animation = useRef<Animation | null>(null)
    const [mounted, setMounted] = useState(open)

    if (open && !mounted) setMounted(true)

    useLayoutEffect(() => {
        animation.current?.cancel()
        animation.current = null
        const el = ref.current

        if (!el || typeof el.animate !== "function") {
            if (!open) setMounted(false)
            return
        }
        if (!mounted) return

        const anim = el.animate(slideKeyframes(el, open), { duration: durationMs, easing: SLIDE_EASING, fill: "forwards" })
        animation.current = anim
        if (!open) {
            anim.finished.then(
                () => {
                    if (animation.current === anim) setMounted(false)
                },
                () => {}
            )
        }
        return () => animation.current?.cancel()
    }, [open, mounted])

    return { mounted, ref }
}
