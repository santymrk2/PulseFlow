import { useEffect, useRef, useState } from "react"
import { actionHistory, activeTimers, drawerTabsData } from "../../../shared/core/stores"
import { useStore } from "../../hooks/useStore"
import { InteractionsInfo } from "../pages/InteractionsInfo"
import { TimerInfo } from "../timers/TimerInfo"
import { OBSInfo } from "./OBSInfo"
import { ScenesInfo } from "./ScenesInfo"
import styles from "./FunctionsInfo.module.css"

// Port de components/drawer/info/FunctionsInfo.svelte.
export function FunctionsInfo() {
    const tabsData = useStore(drawerTabsData)
    const history = useStore(actionHistory)
    const timers = useStore(activeTimers)
    const type = tabsData.functions?.activeSubTab || ""
    const [updated, setUpdated] = useState(false)
    const isMounted = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (!isMounted.current) return
        setUpdated(true)
        const timeout = setTimeout(() => setUpdated(false), 1000)
        return () => clearTimeout(timeout)
    }, [history])

    if (type === "actions") {
        const last = history[0]
        return (
            <div className={styles.scroll}>
                {updated && last ? (
                    <p style={{ textAlign: "center", padding: "10px" }}>
                        {last.action[0].toUpperCase() + last.action.slice(1).replaceAll("_", " ")}
                        {last.count > 1 ? <span style={{ opacity: 0.5 }}>({last.count})</span> : null}
                    </p>
                ) : null}
            </div>
        )
    }

    if (type === "timer") return timers.length ? <TimerInfo /> : null
    if (type === "scenes") return <ScenesInfo />
    if (type === "interactions") return <InteractionsInfo />
    if (type === "obs") return <OBSInfo />
    return null
}
