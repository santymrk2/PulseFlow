import { useEffect, useMemo, useState } from "react"
import type { TabsObj } from "../../../types/Tabs"
import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import styles from "./EditTabs.module.css"

export interface EditTabsProps {
    tabs: TabsObj
    active: string
    onActiveChange: (id: string) => void
    overflowHidden?: boolean
    labels?: boolean
    style?: React.CSSProperties
}

export function EditTabs({ tabs, active, onActiveChange, overflowHidden: overflowHiddenProp = true, labels, style }: EditTabsProps) {
    const currentActivePage = useStore(activePage)
    const currentDictionary = useStore(dictionary)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOpenToolsTab = useStore(openToolsTab)

    const [manuallyChanged, setManuallyChanged] = useState(false)
    const [overflowHidden, setOverflowHidden] = useState(overflowHiddenProp)

    useEffect(() => {
        setOverflowHidden(overflowHiddenProp)
    }, [overflowHiddenProp])

    const showLabels = labels ?? (currentLabelsDisabled ? false : true)

    const firstOverflowIndex = useMemo(() => Object.values(tabs).findIndex((a) => a.overflow), [tabs])

    function checkOverflow(nextActive = active) {
        if (nextActive && Object.keys(tabs).find((id) => id === nextActive && tabs[id].overflow)) {
            setOverflowHidden(false)
        }
    }

    useEffect(() => {
        checkOverflow()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!currentOpenToolsTab) return
        if (currentActivePage !== "show" && manuallyChanged) {
            openToolsTab.set("")
            return
        }

        const tabId = currentOpenToolsTab
        openToolsTab.set("")

        if (!tabs[tabId]) return
        onActiveChange(tabId)
        if (tabs[tabId].overflow) setOverflowHidden(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentOpenToolsTab])

    return (
        <div className={styles.tabs} style={style}>
            {Object.entries(tabs).map(([id, tab]) => {
                if (tab.remove === true || (tab.overflow && overflowHidden)) return null
                return (
                    <Button
                        key={id}
                        style={{ borderBottom: "2px solid var(--primary-darker)", ...(style || {}) }}
                        onClick={() => {
                            onActiveChange(id)
                            setManuallyChanged(true)
                        }}
                        isActive={active === id}
                        disabled={tab.disabled}
                        title={tab.tooltip || currentDictionary.tooltip?.[id] || tab.name}
                    >
                        <Icon id={tab.icon} white={active === id} />
                        {showLabels ? (
                            <span>
                                {translateText(tab.name, currentDictionary)}
                                {tab.data !== undefined ? <span style={{ marginLeft: "4px", opacity: 0.5, fontSize: "0.75em" }}>{tab.data}</span> : null}
                            </span>
                        ) : null}
                    </Button>
                )
            })}

            {firstOverflowIndex > -1 && overflowHidden ? (
                <Button
                    onClick={() => {
                        const id = Object.keys(tabs)[firstOverflowIndex]
                        onActiveChange(id)
                        setTimeout(() => setOverflowHidden(false))
                    }}
                    title={translateText("tooltip.options", currentDictionary).replace(".", "")}
                    style={{ flex: 0, padding: "0 1em" }}
                >
                    <Icon id="arrow_right" style={{ opacity: 0.8 }} size={1.2} white />
                </Button>
            ) : null}
        </div>
    )
}
