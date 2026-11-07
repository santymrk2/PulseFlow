import type { ReactNode } from "react"
import { cn } from "../../../lib/utils"

// Port de ui/capsule/capsule.svelte: grupo de botones de la barra superior (32 px, borde de 1 px, radio de botón).
export interface CapsuleProps {
    className?: string
    children?: ReactNode
}

export function Capsule({ className = "", children }: CapsuleProps) {
    return (
        <div data-slot="capsule" className={cn("flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5 [&>button]:rounded-sm", className)}>
            {children}
        </div>
    )
}
