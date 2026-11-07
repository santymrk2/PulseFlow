import type { KeyboardEvent } from "react"

// Port de utils/clickable.ts (triggerClickOnEnterSpace) para eventos de React: Enter o espacio hacen click en el elemento.
export function triggerClickOnEnterSpace(event: KeyboardEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null
    if (target?.classList.contains("edit") || target?.nodeName === "INPUT" || target?.nodeName === "TEXTAREA") return

    if (event.key === "Enter" || event.key === " ") {
        if (event.key === " " && target?.closest(".slide")) return

        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.click()
    }
}
