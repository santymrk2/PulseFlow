// ----- FreeShow -----
// Gestor global de atajos de teclado de la ventana de Control.
//
//   - Espacio / →  : siguiente diapositiva
//   - ←            : diapositiva anterior
//   - Enter        : proyectar la diapositiva seleccionada
//   - Escape       : limpiar la pantalla de audiencia (negro)
//   - Backspace    : eliminar la diapositiva seleccionada
//
// Se ignoran cuando el foco está en un campo editable o cuando hay modificadores
// (Ctrl/Cmd/Alt) para no pisar atajos del sistema o del navegador.

import { useEffect } from "react"
import { projectSlide } from "@/lib/outputActions"
import { useProjectionStore } from "@/store/useProjectionStore"
import { useShowStore } from "@/store/useShowStore"

function isEditableTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null
    if (!element) return false
    const tag = element.tagName
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        element.isContentEditable
    )
}

export function useKeyboardShortcuts() {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (isEditableTarget(event.target)) return

            const { stepSlide, selectedSlideId, deleteSlide } = useShowStore.getState()

            switch (event.key) {
                case " ":
                case "Spacebar":
                case "ArrowRight":
                case "ArrowDown":
                case "PageDown":
                    event.preventDefault()
                    stepSlide(1)
                    break
                case "ArrowLeft":
                case "ArrowUp":
                case "PageUp":
                    event.preventDefault()
                    stepSlide(-1)
                    break
                case "Enter":
                    event.preventDefault()
                    projectSlide(selectedSlideId)
                    break
                case "Escape":
                    event.preventDefault()
                    useProjectionStore.getState().clear()
                    break
                case "Backspace":
                case "Delete":
                    if (selectedSlideId) {
                        event.preventDefault()
                        deleteSlide(selectedSlideId)
                    }
                    break
                default:
                    break
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])
}
