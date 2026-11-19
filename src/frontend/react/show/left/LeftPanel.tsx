import { useEffect, useRef, type ReactNode } from "react"
import styles from "./LeftPanel.module.css"

// Marco de panel con barra de título propia y cuerpo con scroll.
// Dos padres Svelte todavía pasan snippets: su shell crea HTMLElement y acá se insertan con refs (nunca dangerouslySetInnerHTML).
export interface LeftPanelProps {
    title: string
    count?: number | null
    context?: string
    actions?: ReactNode
    children?: ReactNode
    actionsSlot?: HTMLElement | null
    childrenSlot?: HTMLElement | null
}

export function LeftPanel({ title, count, context, actions, children, actionsSlot, childrenSlot }: LeftPanelProps) {
    const actionsHost = useRef<HTMLSpanElement>(null)
    const childrenHost = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const host = actionsHost.current
        if (!host || !actionsSlot) return
        host.appendChild(actionsSlot)
        return () => {
            if (actionsSlot.parentNode === host) host.removeChild(actionsSlot)
        }
    }, [actionsSlot])

    useEffect(() => {
        const host = childrenHost.current
        if (!host || !childrenSlot) return
        host.appendChild(childrenSlot)
        return () => {
            if (childrenSlot.parentNode === host) host.removeChild(childrenSlot)
        }
    }, [childrenSlot])

    return (
        <section className={styles.root} data-slot="left-panel">
            <header className={styles.header}>
                <span className={styles.heading}>
                    <span className={styles.title}>{title}</span>
                    {context ? <span className={styles.context}>{context}</span> : null}
                    {count !== undefined && count !== null ? <span className={styles.count}>{count}</span> : null}
                </span>
                {actions || actionsSlot ? (
                    <span ref={actionsHost} className={styles.actions}>
                        {actions}
                    </span>
                ) : null}
            </header>
            <div ref={childrenHost} className={styles.body}>
                {children}
            </div>
        </section>
    )
}
