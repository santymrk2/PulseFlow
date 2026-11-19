import { type CSSProperties, type ReactNode } from "react"
import { cn } from "../../../shared/core/lib/utils"
import { usePropState } from "../../hooks/usePropState"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import styles from "./InputRow.module.css"

// Port de ui/input-row/input-row.svelte. Se adelanta a F24.10 porque los campos segmentados y el select lo necesitan como padre de sus botones.
// `<slot />` → children; `<slot name="menu" />` → menu; `bind:open` → `open` inicial + onOpenChange.
export interface InputRowProps {
    arrow?: boolean
    open?: boolean
    style?: CSSProperties
    children?: ReactNode
    menu?: ReactNode
    onOpenChange?: (open: boolean) => void
}

export function InputRow({ arrow = false, open = false, style, children, menu, onOpenChange }: InputRowProps) {
    const [isOpen, setOpen] = usePropState(open)

    function toggle() {
        setOpen(!isOpen)
        onOpenChange?.(!isOpen)
    }

    return (
        <>
            <div className={cn("row", styles.row)} style={style}>
                {children}

                {arrow ? (
                    <Button style={{ padding: "0.75rem", minWidth: "50px" }} title={isOpen ? "actions.close" : "main.open"} onClick={toggle}>
                        {isOpen ? <Icon className="submenu_open" id="arrow_down" size={1.4} /> : <Icon className="submenu_open" id="arrow_right" size={1.4} white />}
                    </Button>
                ) : null}
            </div>

            {arrow && isOpen ? <div className={styles.menu}>{menu}</div> : null}
        </>
    )
}
