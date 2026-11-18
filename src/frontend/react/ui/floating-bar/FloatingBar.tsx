import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react"
import { cn } from "../../../lib/utils"
import { special } from "../../../stores"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./FloatingBar.module.css"

// `<slot {open} />` → children (nodo o función de `open`); `<slot name="menu" />` → menu;
// `on:mousedown` reenviado → onMouseDown; `$$props.style` → style.
export interface FloatingBarProps {
    side?: "right" | "left" | "center"
    onlyOne?: boolean
    round?: boolean
    arrow?: boolean
    bottom?: number
    style?: CSSProperties
    menu?: ReactNode
    children?: ReactNode | ((open: boolean) => ReactNode)
    onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void
}

export function FloatingBar({ side = "right", onlyOne = false, round = false, arrow = false, bottom = 10, style, menu, children, onMouseDown }: FloatingBarProps) {
    const [open, setOpen] = useState(false)
    const isOptimized = !!useStore(special).optimizedMode

    return (
        // Las clases sin módulo (row, side, isOptimized…) son las del Svelte: CSS global de otros componentes puede apuntarles.
        <div className={cn("row", side, isOptimized && "isOptimized", onlyOne && "onlyOne", round && "round", styles.row, styles[side], onlyOne && styles.onlyOne, round && styles.round)} style={{ bottom: `${bottom}px`, ...style }} onMouseDown={onMouseDown}>
            {arrow ? (
                <>
                    <Button className="expand" style={open ? undefined : { opacity: 0.6 }} title={open ? "actions.close" : "create_show.more_options"} isActive={open} onClick={() => setOpen(!open)}>
                        <Icon className={`submenu_${open ? "close" : "open"}`} id="arrow_back_modern" size={0.9} white={!open} />
                    </Button>

                    <div className="divider"></div>

                    {open ? <div className={styles.menu}>{menu}</div> : null}
                </>
            ) : null}

            {typeof children === "function" ? children(open) : children}
        </div>
    )
}
