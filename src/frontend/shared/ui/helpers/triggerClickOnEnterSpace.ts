import type { KeyboardEvent } from "react"

// Port de utils/clickable.ts (triggerClickOnEnterSpace) para eventos de React: Enter o espacio hacen click en el elemento.
export function triggerClickOnEnterSpace(event: KeyboardEvent<Element>) {
    const target = event.target instanceof Element ? event.target : null
    if (target?.classList.contains("edit") || target?.nodeName === "INPUT" || target?.nodeName === "TEXTAREA") return

    if (event.key === "Enter" || event.key === " ") {
        if (event.key === " " && target?.closest(".slide")) return

        event.preventDefault()
        event.stopPropagation()
        // Equivale al .click() de Svelte (dispara el click y burbuja); Element no tiene click() (SVG), por eso se despacha el evento
        event.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    }
}

// Equivalente a createKeydownHandler de utils/clickable.ts para eventos de React.
export function createKeydownHandler(callback: (event: React.KeyboardEvent<Element>) => void) {
    return (event: React.KeyboardEvent<Element>) => callback(event)
}
