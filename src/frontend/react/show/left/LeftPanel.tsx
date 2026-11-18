import { useEffect, useRef, type ReactNode } from "react"

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
        <section className="flex min-h-0 flex-1 flex-col" data-slot="left-panel">
            <header className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted px-3 text-[11px] font-semibold tracking-[0.08em] text-foreground uppercase">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{title}</span>
                    {context ? <span className="max-w-[9rem] truncate rounded-full bg-primary px-2 text-[10px] font-semibold tracking-normal text-primary-foreground normal-case">{context}</span> : null}
                    {count !== undefined && count !== null ? <span className="font-normal tracking-normal text-muted-foreground">{count}</span> : null}
                </span>
                {actions || actionsSlot ? (
                    <span ref={actionsHost} className="flex shrink-0 items-center gap-1">
                        {actions}
                    </span>
                ) : null}
            </header>
            <div ref={childrenHost} className="min-h-0 flex-1 overflow-y-auto">
                {children}
            </div>
        </section>
    )
}
