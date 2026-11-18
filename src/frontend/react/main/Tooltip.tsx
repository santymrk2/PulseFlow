import { special } from "../../stores"
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
        <div className={`${styles.tooltip}${isOptimized ? ` ${styles.isOptimized}` : ""}`} style={{ top: `${y}px`, left: `${x}px`, ...(style ? parseInlineStyle(style) : {}) }}>
            {parsed.map((part, i) => (
                <span key={`${i}-${part.isShortcut}`} className={part.isShortcut ? styles.shortcut : ""} dangerouslySetInnerHTML={{ __html: part.text.replaceAll("\n", "<br>") }} />
            ))}
        </div>
    )
}

function parseInlineStyle(style: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const decl of style.split(";")) {
        const idx = decl.indexOf(":")
        if (idx === -1) continue
        const prop = decl.slice(0, idx).trim()
        const value = decl.slice(idx + 1).trim()
        if (!prop) continue
        const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        out[camel] = value
    }
    return out
}
