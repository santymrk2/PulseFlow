import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../../../lib/utils"

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
        <button type="button" data-slot="list-row" aria-current={active ? "true" : undefined} className={cn("relative flex h-7 w-full min-w-0 items-center gap-2 border-0 bg-transparent pr-2 pl-3 text-left text-[13px] text-foreground transition-colors hover:bg-accent/50", active && "bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary", className)} {...rest}>
            {icon ? <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">{icon}</span> : null}
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {trailing ? <span className="flex shrink-0 items-center text-xs text-muted-foreground">{trailing}</span> : null}
        </button>
    )
}
