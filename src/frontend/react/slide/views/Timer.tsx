import { useEffect, useState, type CSSProperties } from "react"
import type { Item } from "../../../../types/Show"
import type { StageItem } from "../../../../types/Stage"
import { activeDrawerTab, activeTimers, drawer, timers } from "../../../shared/core/stores"
import { getCurrentTimerValue } from "../../../components/drawer/timers/timers"
import { setDrawerTabData } from "../../../components/helpers/historyHelpers"
import { getStyles } from "../../../components/helpers/style"
import { joinTimeBig } from "../../../components/helpers/time"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"
import styles from "./Timer.module.css"

export interface TimerProps {
    item?: null | Item | StageItem
    id: string
    today: globalThis.Date
    style?: string
    edit?: boolean
    showMs?: boolean
}

const INTERVAL = 1200

// Port de components/slide/views/Timer.svelte (F24.18a).
export function Timer({ item = null, id, today, style = "", edit = false, showMs = false }: TimerProps) {
    const currentTimers = useStore(timers)
    const currentActiveTimers = useStore(activeTimers)
    const currentDrawer = useStore(drawer)
    const [updateDynamic, setUpdateDynamic] = useState(0)
    const [blinkingOff, setBlinkingOff] = useState(false)

    const ref = { id }
    const timer = currentTimers[id] || {}
    const currentTime = timer?.type ? getCurrentTimerValue(timer, ref, today, currentActiveTimers, updateDynamic) : 0
    const timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0, item?.timer?.showHours !== false, item?.timer?.padding !== false)

    const min = Math.min(timer.start || 0, timer.end || 0)
    const max = Math.max(timer.start || 0, timer.end || 0)
    const percentage = Math.max(0, Math.min(100, ((currentTime - min) / (max - min)) * 100))
    const itemColor = getStyles(item?.style)?.color || "#ffffff"

    function getTimerOverflow(time: number, offset = 0) {
        if (currentTime < 0) return true
        if (timer.type !== "counter") return time <= offset
        const start = timer.start || 0
        const end = timer.end || 0
        if (start < end) return time + offset > end
        return time - offset < end
    }

    const overflow = timer.overflow && getTimerOverflow(currentTime)
    const negative = (timer?.start || 0) > (timer?.end || 0) || currentTime < 0
    const shouldWarn = !!timer.warn && getTimerOverflow(currentTime, (timer.warnOffset || 30) + 1)
    const playingTimer = currentActiveTimers.filter((a) => a.id === ref.id)[0]
    const isPaused = playingTimer?.paused
    const hasDynamicValues = timer.startDynamic !== undefined || timer.endDynamic !== undefined

    function openInDrawer() {
        if (!edit) return
        setDrawerTabData("functions", "timer")
        activeDrawerTab.set("functions")
        if (currentDrawer.height <= 40) drawer.set({ height: currentDrawer.stored || 300, stored: null })
    }

    // BLINKING WHEN OVERFLOWING
    useEffect(() => {
        if (!shouldWarn || overflow || !timer.warnFlash || isPaused) {
            setBlinkingOff(false)
            return
        }
        const blinkingInterval = setInterval(() => {
            setBlinkingOff(true)
            setTimeout(() => setBlinkingOff(false), INTERVAL * 0.2)
        }, INTERVAL)
        return () => clearInterval(blinkingInterval)
    }, [shouldWarn, overflow, timer.warnFlash, isPaused])

    // DYNAMIC VALUES: only update if text contains dynamic values
    useEffect(() => {
        if (!hasDynamicValues) return
        const dynamicInterval = setInterval(() => setUpdateDynamic((n) => n + 1), 5000)
        return () => clearInterval(dynamicInterval)
    }, [hasDynamicValues])

    const alignX = (item as { alignX?: boolean } | null)?.alignX
    const alignStyle = `${style}${alignX ? "" : (item?.align || "justify-content: center;").replaceAll("text-align", "justify-content")}`
    const valueColor = overflow ? timer.overflowColor || "#FF4136" : shouldWarn ? timer.warnColor || "#FF8000" : ""

    if (item?.timer?.viewType === "line") {
        return <div className={styles.line} style={{ width: `${percentage}%`, backgroundColor: itemColor }} onDoubleClick={openInDrawer} />
    }

    if (item?.timer?.viewType === "circle") {
        return <div className={`${styles.circle} ${item?.timer?.circleMask ? styles.mask : ""}`} style={{ "--percentage": percentage, "--color": itemColor } as CSSProperties} onDoubleClick={openInDrawer} />
    }

    return (
        <div className={`align autoFontSize ${styles.align}`} style={cssTextToStyle(alignStyle)} onDoubleClick={openInDrawer}>
            <div style={{ display: "flex", whiteSpace: "nowrap", ...(valueColor ? { color: valueColor } : {}) }}>
                {!shouldWarn || isPaused || !blinkingOff ? (
                    <>
                        {overflow && negative ? <span>-</span> : null}
                        {timeValue}
                        {showMs ? `.${String(0).padStart(2, "0")}` : null}
                    </>
                ) : null}
            </div>
        </div>
    )
}
