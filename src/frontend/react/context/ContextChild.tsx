import { useEffect, useMemo, useRef, useState } from "react"
import { localeDirection } from "../../stores"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { type ContextMenuItem, contextMenuItems } from "../../components/context/contextMenus"
import { loadItems } from "../../components/context/loadItems"
import { ContextItem } from "./ContextItem"
import styles from "./ContextChild.module.css"

export interface ContextChildProps {
    contextElem: HTMLDivElement | null
    topBar?: boolean
    id: string
    menu?: ContextMenuItem
    translate?: number
    highlightedPath?: string[]
    side?: "right" | "left"
}

export function ContextChild({ contextElem, topBar = false, id, menu, translate = 0, highlightedPath = [], side: sideProp }: ContextChildProps) {
    const direction = useStore(localeDirection)
    const side = sideProp || (direction === "rtl" ? "left" : "right")
    const transform = side === "right" ? "100%" : "-100%"

    const [open, setOpen] = useState(false)
    const elemRef = useRef<HTMLDivElement | null>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const duration = 180

    const menuItem = menu || (contextMenuItems as Record<string, ContextMenuItem>)[id]
    const highlighted = highlightedPath.length > 0 && highlightedPath[0] === id
    const childHighlightedPath = useMemo(() => (highlightedPath.length > 0 && highlightedPath[0] === id ? highlightedPath.slice(1) : []), [highlightedPath, id])

    useEffect(() => {
        if (highlighted) setOpen(true)
        else if (highlightedPath.length > 0) setOpen(false)
    }, [highlighted, highlightedPath.length])

    function clearTimer() {
        if (timeoutRef.current === null) return
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
    }

    useEffect(() => {
        function onMouseOver(e: MouseEvent) {
            const target = e.target as Node | null
            const elem = elemRef.current
            if (!elem) return

            if (target && elem.contains(target)) {
                clearTimer()
                if (open) return
                timeoutRef.current = setTimeout(() => {
                    setOpen(true)
                    timeoutRef.current = null
                }, duration)
                return
            }

            if (open && (target as HTMLElement | null)?.closest?.(".contextMenu") !== null) {
                if (timeoutRef.current !== null) return
                timeoutRef.current = setTimeout(() => {
                    setOpen(false)
                    timeoutRef.current = null
                }, duration * 1.1)
                return
            }

            clearTimer()
        }

        window.addEventListener("mouseover", onMouseOver)
        return () => {
            window.removeEventListener("mouseover", onMouseOver)
            clearTimer()
        }
    }, [open])

    function click(e: React.MouseEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement | null)?.closest?.(".submenu") === null) setOpen(true)
    }

    function keydown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter") setOpen((o) => !o)
    }

    return (
        <div ref={elemRef} className={`${styles.item} ${open ? styles.open : ""} ${highlighted ? styles.highlighted : ""}`.trim()} onClick={click} tabIndex={0} onKeyDown={keydown} role="menuitem">
            <span style={{ display: "flex", gap: 10, justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    {menuItem?.icon ? <Icon style={{ color: "var(--text-muted)" }} id={menuItem.icon} white /> : null}
                    <T id={menuItem?.label || id} />
                </div>
                <div style={{ display: "flex", alignSelf: "center", opacity: 0.5 }}>
                    <Icon id="arrow_right" size={1.2} white />
                </div>
            </span>

            {open ? (
                <div className={`submenu ${styles.submenu}`} style={{ [side]: 0, transform: `translate(${transform}, ${translate ? `calc(-${translate}% + 32px)` : "-14px"})` } as React.CSSProperties}>
                    {(menuItem?.items || []).map((itemId, idx) => {
                        if (itemId === "SEPARATOR") return <hr key={`sep-${idx}`} className={styles.hr} />

                        if ((contextMenuItems as Record<string, ContextMenuItem>)[itemId]?.items) {
                            return <ContextChild key={itemId} id={itemId} contextElem={contextElem} side={side} translate={translate} topBar={topBar} highlightedPath={childHighlightedPath} />
                        }

                        if (itemId.includes("LOAD_")) {
                            return loadItems(itemId.slice(5)).map(([loadId, loadMenu], i) => {
                                if (loadMenu === "SEPARATOR") return <hr key={`lsep-${loadId}-${i}`} className={styles.hr} />
                                const itemActualId = (loadMenu as ContextMenuItem).id || loadId
                                const isHighlighted = childHighlightedPath.length > 0 && childHighlightedPath[0] === itemActualId
                                return <ContextItem key={`${itemActualId}-${i}`} id={loadId} contextElem={contextElem} menu={loadMenu as ContextMenuItem} disabled={(loadMenu as ContextMenuItem).disabled === true} topBar={topBar} highlighted={isHighlighted} />
                            })
                        }

                        return <ContextItem key={itemId} id={itemId} contextElem={contextElem} topBar={topBar} highlighted={childHighlightedPath.length > 0 && childHighlightedPath[0] === itemId} />
                    })}
                </div>
            ) : null}
        </div>
    )
}
