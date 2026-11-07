import type { CSSProperties, ReactNode } from "react"
import styles from "./List.module.css"

// Port de ui/list/list.svelte (lista de inputs de opciones). `$$props.style` → style; bottom/top en px.
export interface ListProps {
    bottom?: number
    top?: number
    style?: CSSProperties
    children?: ReactNode
}

export function List({ bottom = 0, top = 0, style, children }: ListProps) {
    return (
        <div className={styles.list} style={{ marginBottom: `${bottom}px`, marginTop: `${top}px`, ...style }}>
            {children}
        </div>
    )
}
