import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { ClickEvent, SelectIds } from "../../../../types/Main"
import SelectElem from "../../../components/system/SelectElem.svelte"
import { cn } from "../../../lib/utils"
import { dictionary } from "../../../stores"
import { translateText } from "../../../utils/language"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./Tabs.module.css"

// Port de ui/tabs/tabs.svelte. dispatch("open", id) → onOpen(id); dispatch("create", detail) → onCreate(detail).
// `<slot {tab} />` → children como función (render prop) que recibe la pestaña.
// Temporal: SelectElem sigue en Svelte (se migra con "sistema"). Se monta como isla y el botón se proyecta en su
// <slot> con un portal; se va cuando SelectElem tenga versión React.
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

function SelectElemSlot({ id, tabId, children }: { id: SelectIds; tabId: string; children: ReactNode }) {
    const wrapper = useRef<HTMLDivElement>(null)
    const [slot, setSlot] = useState<Element | null>(null)

    // la isla se monta en un efecto de su propio componente, que corre antes que éste (hijo antes que padre)
    useEffect(() => {
        setSlot(wrapper.current?.querySelector(".selectElem") ?? null)
    }, [])

    return (
        <div ref={wrapper} style={{ display: "contents" }}>
            <SvelteIsland component={SelectElem} props={{ id, data: { id: tabId }, fill: true }} />
            {slot ? createPortal(children, slot) : null}
        </div>
    )
}

export function Tabs<T extends { id: string; stageOutput?: boolean }>({ id, tabs, value, newLabel = "settings.add", className = "", onOpen, onCreate, children }: TabsProps<T>) {
    const dict = useStore(dictionary)
    const tabsElem = useRef<HTMLDivElement>(null)
    const [isScrollable, setIsScrollable] = useState(false)

    function checkScroll() {
        if (!tabsElem.current) return
        setIsScrollable(tabsElem.current.scrollWidth > tabsElem.current.clientWidth)
    }

    useEffect(checkScroll, [])

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
                        <SelectElemSlot key={i} id={id} tabId={tab.id}>
                            <button className={cn("tab", styles.tab, getTabClass(tab), value === tab.id && styles.active)} onClick={() => onOpen?.(tab.id)}>
                                {children?.(tab)}
                            </button>
                        </SelectElemSlot>
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
