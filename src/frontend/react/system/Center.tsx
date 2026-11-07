import type { CSSProperties, HTMLAttributes } from "react"
import { cn } from "../../lib/utils"
import styles from "./Center.module.css"

// Port de components/system/Center.svelte. `class` → className; `style` (string en Svelte) → CSSProperties.
// "loader" sigue siendo una clase global: CombinedInput la excluye con `div:not(.loader)`.
export interface CenterProps extends HTMLAttributes<HTMLDivElement> {
    faded?: boolean
    absolute?: boolean
    padding?: number
    size?: number
    style?: CSSProperties
}

export function Center({ faded = false, absolute = false, padding = 0, size = 1, style, className = "", children, ...rest }: CenterProps) {
    return (
        <div {...rest} style={{ fontSize: `${size}em`, padding: `${padding}px`, ...style }} className={cn("loader", styles.center, className, faded && styles.faded, absolute && styles.absolute)}>
            {children}
        </div>
    )
}
