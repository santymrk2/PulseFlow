import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "../../../core/lib/utils"
import styles from "./Menu.module.css"

// Port de ui/menu/menu.svelte. Desplegable simple: el padre pone un contenedor `relative` alrededor del disparador y este
// menú se abre debajo. Se cierra con mousedown afuera (fuera del padre) y Esc. `onclose` → onClose.
export interface MenuProps {
    open?: boolean
    className?: string
    onClose?: () => void
    children?: ReactNode
}

export function Menu({ open = false, className = "", onClose, children }: MenuProps) {
    const menu = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        function onPointerDown(e: MouseEvent) {
            const anchor = menu.current?.parentElement
            if (anchor && !anchor.contains(e.target as Node)) onClose?.()
        }

        // capture: Esc cierra el menú sin llegar a utils/shortcuts.ts
        function onKeydown(e: KeyboardEvent) {
            if (e.key !== "Escape") return
            e.stopPropagation()
            onClose?.()
        }

        window.addEventListener("mousedown", onPointerDown, true)
        window.addEventListener("keydown", onKeydown, true)
        return () => {
            window.removeEventListener("mousedown", onPointerDown, true)
            window.removeEventListener("keydown", onKeydown, true)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div ref={menu} role="menu" data-slot="menu" className={cn(styles.root, className)}>
            {children}
        </div>
    )
}
