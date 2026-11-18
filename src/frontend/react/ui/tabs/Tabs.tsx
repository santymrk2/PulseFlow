import { useEffect, useRef, useState, type ReactNode } from "react"
import type { ClickEvent, SelectIds } from "../../../../types/Main"
import { cn } from "../../../lib/utils"
import { dictionary } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../button/Button"
import styles from "./Tabs.module.css"

// dispatch("open", id) → onOpen(id); dispatch("create", detail) → onCreate(detail).
// `<slot {tab} />` → children como función (render prop) que recibe la pestaña.
export interface TabsProps<T extends { id: string; stageOutput?: boolean }> {
    id: SelectIds
    tabs: T[]
    value: string
    newLabel?: string
    className?: string
    onOpen?: (id: string) => void
    onCreate?: (detail: ClickEvent["detail"]) => void
    children?: (tab: T) => ReactNode
}

export function Tabs<T extends { id: string; stageOutput?: boolean }>({ id, tabs, value, newLabel = "settings.add", className = "", onOpen, onCreate, children }: TabsProps<T>) {
    const dict = useStore(dictionary)
    const tabsElem = useRef<HTMLDivElement>(null)
    const [isScrollable, setIsScrollable] = useState(false)

    function checkScroll() {
        if (!tabsElem.current) return
        setIsScrollable(tabsElem.current.scrollWidth > tabsElem.current.clientWidth)
    }

    // los botones de las pestañas ya existen cuando corre el efecto; se vuelve a medir al agregar o quitar una
    useEffect(checkScroll, [tabs.length])

    function create(detail: ClickEvent["detail"]) {
        onCreate?.(detail)
        setTimeout(checkScroll, 110)
    }

    const getTabClass = (tab: T) => {
        if (className.includes("output") && tab.stageOutput) return `${className}_stage`
        if (id === "profile" && tab.id === "") return `${className}_admin`
        return className
    }

    return (
        <div className={styles.row}>
            {tabs.length > 1 ? (
                <div ref={tabsElem} className={cn(styles.tabs, isScrollable && styles.isScrollable)}>
                    {tabs.map((tab, i) => (
                        <SelectElem key={i} id={id} data={{ id: tab.id }} fill>
                            <button className={cn("tab", styles.tab, getTabClass(tab), value === tab.id && styles.active)} onClick={() => onOpen?.(tab.id)}>
                                {children?.(tab)}
                            </button>
                        </SelectElem>
                    ))}
                </div>
            ) : null}

            <Button title={newLabel} className={tabs.length > 1 ? "small_add" : ""} style={tabs.length > 1 ? undefined : { flex: 1 }} onClick={(detail) => create(detail)}>
                <Icon id="add" size={1.2} white={tabs.length > 1} />
                {tabs.length <= 1 ? translateText(newLabel, dict) : null}
            </Button>
        </div>
    )
}
