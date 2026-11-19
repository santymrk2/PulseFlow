import type { CSSProperties } from "react"

// `Option.style` es un string CSS; React pide un objeto. shortcut: no soporta `!important`, ampliar si algún valor lo usa.
export function cssTextToStyle(css: string): CSSProperties {
    const style: Record<string, string> = {}
    for (const declaration of css.split(";")) {
        const colon = declaration.indexOf(":")
        const property = declaration.slice(0, colon).trim()
        if (colon < 0 || !property) continue
        style[property.startsWith("--") ? property : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = declaration.slice(colon + 1).trim()
    }
    return style
}
