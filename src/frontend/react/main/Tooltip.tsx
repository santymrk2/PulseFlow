import { special } from "../../shared/core/stores"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import styles from "./Tooltip.module.css"

export interface TooltipPart {
    text: string
    isShortcut: boolean
}

export interface TooltipProps {
    x?: number
    y?: number
    visible?: boolean
    style?: string
    parsed?: TooltipPart[]
}

export function Tooltip({ x = 0, y = 0, visible = false, style = "", parsed = [] }: TooltipProps) {
    const specialValue = useStore(special)
    const isOptimized = !!specialValue.optimizedMode

    if (!visible) return null

    return (
        <div className={`${styles.tooltip}${isOptimized ? " isOptimized" : ""}`} style={{ top: `${y}px`, left: `${x}px`, ...(style ? cssTextToStyle(style) : {}) }}>
            {parsed.map((part, i) => (
                <span key={`${i}-${part.isShortcut}`} className={part.isShortcut ? styles.shortcut : ""} dangerouslySetInnerHTML={{ __html: part.text.replaceAll("\n", "<br>") }} />
            ))}
        </div>
    )
}
