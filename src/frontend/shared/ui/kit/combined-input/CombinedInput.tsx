import type { CSSProperties, ReactNode } from "react"
import { cn } from "../../../core/lib/utils"
import styles from "./CombinedInput.module.css"

// `style + ";--text-width: " + textWidth + "%"` → style con la variable CSS.
export interface CombinedInputProps {
    style?: CSSProperties
    title?: string
    textWidth?: number // %
    children?: ReactNode
}

export function CombinedInput({ style, title = "", textWidth = 50, children }: CombinedInputProps) {
    return (
        // "input" sin módulo: es la clase del Svelte y el CSS global puede apuntarle.
        <div className={cn("input", styles.input)} data-title={title} style={{ ...style, "--text-width": `${textWidth}%` } as CSSProperties}>
            {children}
        </div>
    )
}
