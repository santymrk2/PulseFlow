import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../../../shared/core/lib/utils"
import styles from "./MenuItem.module.css"

// Port de ui/menu/menu-item.svelte: ítem de 28 px. `checked` muestra una marca a la izquierda (ej. el look activo).
// `onClick` es el click nativo (sin detail), como `onclick` en Svelte.
export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    className?: string
    checked?: boolean
    children?: ReactNode
}

export function MenuItem({ className = "", checked = false, children, ...rest }: MenuItemProps) {
    return (
        <button type="button" role="menuitem" data-slot="menu-item" className={cn(styles.root, className)} {...rest}>
            <span className={styles.check}>{checked ? "✓" : ""}</span>
            <span className={styles.label}>{children}</span>
        </button>
    )
}
