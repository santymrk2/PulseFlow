import { useEffect, useState } from "react"
import type { TabsObj } from "../../../types/Tabs"
import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { Button } from "../ui/button/Button"
import styles from "./Tabs.module.css"

export interface TabsProps {
    tabs: TabsObj
    active: string
    onActiveChange?: (id: string) => void
    labels?: boolean
    style?: string
}

export function Tabs({ tabs, active, onActiveChange, labels, style }: TabsProps) {
    const labelsDisabledValue = useStore(labelsDisabled)
    const dict = useStore(dictionary)
    const openTabStore = useStore(openToolsTab)
    const page = useStore(activePage)
    const [manuallyChanged, setManuallyChanged] = useState(false)
    const [overflowHidden, setOverflowHidden] = useState(true)

    const showLabels = labels ?? !labelsDisabledValue

    function setActive(id: string, manual = false) {
        onActiveChange?.(id)
        if (manual) setManuallyChanged(true)
    }

    useEffect(() => {
        if (active && Object.keys(tabs).find((id) => id === active && tabs[id].overflow)) {
            setOverflowHidden(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!openTabStore) return
        if (page !== "show" && manuallyChanged) return

        const tabId = openTabStore
        openToolsTab.set("")
        if (!tabs[tabId]) return
        onActiveChange?.(tabId)
    }, [openTabStore, page, manuallyChanged, tabs, onActiveChange])

    const entries = Object.entries(tabs)
    const firstOverflowIndex = entries.findIndex(([, tab]) => tab.overflow)

    return (
        <div className={styles.tabs} style={style ? cssTextToStyle(style) : undefined}>
            {entries.map(([id, tab]) => {
                if (tab.remove === true || (tab.overflow && overflowHidden)) return null
                return (
                    <Button key={id} style={{ borderBottom: "2px solid var(--primary-darker)", ...(style ? cssTextToStyle(style) : {}) }} onClick={() => setActive(id, true)} isActive={active === id} disabled={tab.disabled} title={tab.tooltip || dict.tooltip?.[id] || tab.name}>
                        <Icon id={tab.icon} white={active === id} />
                        {showLabels ? (
                            <span>
                                {translateText(tab.name)}
                                {tab.data !== undefined ? <span style={{ marginLeft: "4px", opacity: 0.5, fontSize: "0.75em" }}>{tab.data}</span> : null}
                            </span>
                        ) : null}
                    </Button>
                )
            })}

            {firstOverflowIndex > -1 && overflowHidden ? (
                <Button
                    onClick={() => {
                        const id = entries[firstOverflowIndex][0]
                        setActive(id)
                        setTimeout(() => setOverflowHidden(false))
                    }}
                    title={translateText("tooltip.options").replace(".", "")}
                    style={{ flex: "0", padding: "0 1em" }}
                >
                    <Icon id="arrow_right" style={{ opacity: 0.8 }} size={1.2} white />
                </Button>
            ) : null}
        </div>
    )
}
