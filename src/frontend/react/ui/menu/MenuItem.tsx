import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../../../lib/utils"

// Port de ui/menu/menu-item.svelte: ítem de 28 px. `checked` muestra una marca a la izquierda (ej. el look activo).
// `onClick` es el click nativo (sin detail), como `onclick` en Svelte.
export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    className?: string
    checked?: boolean
    children?: ReactNode
}

export function MenuItem({ className = "", checked = false, children, ...rest }: MenuItemProps) {
    return (
        <button type="button" role="menuitem" data-slot="menu-item" className={cn("flex h-7 w-full items-center gap-2 border-0 bg-transparent px-3 text-left text-[13px] whitespace-nowrap text-popover-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50", className)} {...rest}>
            <span className="w-3 shrink-0 text-xs text-primary">{checked ? "✓" : ""}</span>
            <span className="min-w-0 flex-1 truncate">{children}</span>
        </button>
    )
}
