import type { CSSProperties } from "react"

// Los ports reciben `style` como string (igual que el Svelte original). MediaLoader ya usa este mismo patrón.
export function parseStyle(s: string): CSSProperties {
    const out: Record<string, string> = {}
    s.split(";").forEach((part) => {
        const idx = part.indexOf(":")
        if (idx < 0) return
        const key = part.slice(0, idx).trim()
        const value = part.slice(idx + 1).trim()
        if (key) out[key] = value
    })
    return out as CSSProperties
}
