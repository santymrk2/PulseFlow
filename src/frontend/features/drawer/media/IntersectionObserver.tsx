import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "../../../shared/core/lib/utils"
import styles from "./IntersectionObserver.module.css"

// Port de components/drawer/media/IntersectionObserver.svelte.
// `<slot {intersecting} />` → children como nodo o como función que recibe `intersecting`.
export interface IntersectionObserverProps {
    once?: boolean
    top?: number
    bottom?: number
    left?: number
    right?: number
    className?: string
    style?: CSSProperties
    children?: ReactNode | ((intersecting: boolean) => ReactNode)
}

export function IntersectionObserver({ once = false, top = 0, bottom = 0, left = 0, right = 0, className, style, children }: IntersectionObserverProps) {
    const [intersecting, setIntersecting] = useState(false)
    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") return
        const el = container.current
        if (!el) return

        const rootMargin = `${bottom}px ${left}px ${top}px ${right}px`
        const observer = new window.IntersectionObserver(
            (entries) => {
                const isIntersecting = entries[0]?.isIntersecting ?? false
                setIntersecting(isIntersecting)
                if (isIntersecting && once) observer.unobserve(el)
            },
            { rootMargin }
        )
        observer.observe(el)
        return () => observer.unobserve(el)
    }, [once, top, bottom, left, right])

    return (
        <div ref={container} className={cn(styles.container, className)} style={style}>
            {typeof children === "function" ? (children as (i: boolean) => ReactNode)(intersecting) : children}
        </div>
    )
}
