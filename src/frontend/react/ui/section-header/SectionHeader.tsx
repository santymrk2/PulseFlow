import type { ReactNode } from "react"
import { cn } from "../../../lib/utils"

// Port de ui/section-header/section-header.svelte: título de sección de 28 px. `actions` va a la derecha (ej. "+").
// `class` de Svelte pasa a `className`, como en el resto de React.
export interface SectionHeaderProps {
    className?: string
    children?: ReactNode
    actions?: ReactNode
}

export function SectionHeader({ className = "", children, actions }: SectionHeaderProps) {
    return (
        <div data-slot="section-header" className={cn("flex h-7 shrink-0 items-center justify-between gap-2 px-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase", className)}>
            <span className="min-w-0 truncate">{children}</span>
            {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
    )
}
