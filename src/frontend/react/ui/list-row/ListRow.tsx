import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../../../lib/utils"
import styles from "./ListRow.module.css"

// Port de ui/list-row/list-row.svelte: fila de 28 px. `active` pinta el fondo y la barra de 2 px a la izquierda.
// `onClick` es el click nativo (sin detail), como `onclick` en Svelte.
export interface ListRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    className?: string
    active?: boolean
    icon?: ReactNode
    trailing?: ReactNode
    children?: ReactNode
}

export function ListRow({ className = "", active = false, icon, trailing, children, ...rest }: ListRowProps) {
    return (
        <button type="button" data-slot="list-row" aria-current={active ? "true" : undefined} className={cn(styles.root, active && styles.active, className)} {...rest}>
            {icon ? <span className={styles.icon}>{icon}</span> : null}
            <span className={styles.label}>{children}</span>
            {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
        </button>
    )
}
