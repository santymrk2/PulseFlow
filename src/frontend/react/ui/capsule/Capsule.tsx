import type { ReactNode } from "react"
import { cn } from "../../../lib/utils"
import styles from "./Capsule.module.css"

// Port de ui/capsule/capsule.svelte: grupo de botones de la barra superior (32 px, borde de 1 px, radio de botón).
export interface CapsuleProps {
    className?: string
    children?: ReactNode
}

export function Capsule({ className = "", children }: CapsuleProps) {
    return (
        <div data-slot="capsule" className={cn(styles.root, className)}>
            {children}
        </div>
    )
}
