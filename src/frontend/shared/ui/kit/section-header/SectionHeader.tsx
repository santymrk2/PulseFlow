import type { ReactNode } from "react"
import { cn } from "../../../core/lib/utils"
import styles from "./SectionHeader.module.css"

// Port de ui/section-header/section-header.svelte: título de sección de 28 px. `actions` va a la derecha (ej. "+").
// `class` de Svelte pasa a `className`, como en el resto de React.
export interface SectionHeaderProps {
    className?: string
    children?: ReactNode
    actions?: ReactNode
}

export function SectionHeader({ className = "", children, actions }: SectionHeaderProps) {
    return (
        <div data-slot="section-header" className={cn(styles.root, className)}>
            <span className={styles.title}>{children}</span>
            {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
    )
}
