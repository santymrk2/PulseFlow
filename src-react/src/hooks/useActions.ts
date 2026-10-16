// ----- FreeShow -----
// Ejecutor de disparadores de acciones: teclado (keypress) y arranque (startup).

import { useEffect } from "react"
import { runAction } from "@/lib/actions"
import { useActionsStore } from "@/store/useActionsStore"

function isEditable(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null
    if (!element) return false
    const tag = element.tagName
    return tag === "INPUT" || tag === "TEXTAREA" || element.isContentEditable
}

export function useActions() {
    useEffect(() => {
        const actions = useActionsStore.getState().actions

        // Acciones de arranque.
        for (const action of Object.values(actions)) {
            if (action.enabled && action.trigger === "startup") runAction(action.command)
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (isEditable(event.target)) return
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
            for (const action of Object.values(useActionsStore.getState().actions)) {
                if (!action.enabled || action.trigger !== "keypress" || !action.key) continue
                if (action.key.toLowerCase() === key) {
                    event.preventDefault()
                    runAction(action.command)
                    break
                }
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])
}
