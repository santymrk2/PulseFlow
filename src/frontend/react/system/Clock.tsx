import { useEffect, useState } from "react"
import dayjs from "dayjs"
import localizedFormat from "dayjs/plugin/localizedFormat"
import { cn } from "../../lib/utils"
import { timeFormat } from "../../stores"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import { AnalogClock } from "./AnalogClock"
import styles from "./Clock.module.css"

dayjs.extend(localizedFormat)

export interface ClockProps {
    item?: { align?: string; alignX?: boolean; [key: string]: unknown }
    style?: boolean
    fontStyle?: string
    type?: "digital" | "analog" | "custom"
    dateFormat?: string
    customFormat?: string
    offsetDays?: number
    showTime?: boolean
    seconds?: boolean
}

function pad(value: number) {
    return ("0" + value).slice(-2)
}

// Port de components/system/Clock.svelte (F24.18a).
export function Clock({ item = {}, style = true, fontStyle = "", type = "digital", dateFormat = "none", customFormat = "hh:mm a", offsetDays = 0, showTime = true, seconds = true }: ClockProps) {
    const format = useStore(timeFormat)
    const twelve = format === "12"
    const [currentDate, setCurrentDate] = useState(() => new globalThis.Date())

    useEffect(() => {
        const clockInterval = setInterval(() => setCurrentDate(new globalThis.Date()), 250)
        return () => clearInterval(clockInterval)
    }, [])

    const hRaw = currentDate.getHours()
    let h = hRaw
    if (twelve) {
        if (h === 0) h = 12
        else if (h > 12) h -= 12
    }
    const m = currentDate.getMinutes()
    const s = currentDate.getSeconds()
    const pm = hRaw >= 12

    function formatTime(date: globalThis.Date): string {
        const is12Hour = format === "12"
        const timeFormatString = is12Hour ? (seconds ? "h:mm:ss A" : "h:mm A") : seconds ? "HH:mm:ss" : "HH:mm"
        return dayjs(date).format(timeFormatString)
    }

    function formatDateTime(date: globalThis.Date, dateFormatString: string) {
        if (dateFormatString === "none") return ""

        const targetDate = offsetDays ? dayjs(date).add(Number(offsetDays) || 0, "day") : dayjs(date)

        if (typeof dateFormatString !== "string" || !dateFormatString) return targetDate.format()

        try {
            return targetDate.format(dateFormatString)
        } catch (err) {
            console.error(err)
            return targetDate.format()
        }
    }

    const formattedDate = dateFormat !== "none" ? formatDateTime(currentDate, dateFormat) : ""
    const formattedCustom = type === "custom" ? formatDateTime(currentDate, customFormat) : ""
    const resolvedShowTime = type === "digital" && dateFormat === "none" && showTime === false ? true : showTime

    const alignStyle = `${fontStyle}${item?.alignX ? "" : (item?.align || "justify-content: center;").replaceAll("text-align", "justify-content")}`

    if (type === "analog") {
        return <AnalogClock date={currentDate} h={h} m={m} s={s} seconds={seconds} />
    }

    if (type === "custom") {
        return (
            <div className={cn("autoFontSize", styles.align)} style={cssTextToStyle(alignStyle)}>
                {style ? <span className={styles.colored}>{formattedCustom}</span> : formattedCustom}
            </div>
        )
    }

    return (
        <div className={cn("autoFontSize", styles.align, style && styles.styled)} style={cssTextToStyle(alignStyle)}>
            {style ? (
                <>
                    <span className={styles.colored}>{pad(h)}</span>:<span className={styles.colored}>{pad(m)}</span>
                    {seconds ? <span style={{ fontSize: "0.5em" }}>:{pad(s)}</span> : null}
                    {twelve ? (
                        <span className={pm ? styles.colored : undefined} style={{ fontSize: "0.3em", fontWeight: "bold" }}>
                            &nbsp;{pm ? "PM" : "AM"}
                        </span>
                    ) : null}
                </>
            ) : (
                <>
                    {formattedDate ? formattedDate : null}
                    {resolvedShowTime ? formatTime(currentDate) : null}
                </>
            )}
        </div>
    )
}
