import { useEffect, useState } from "react"
import { T } from "../helpers/T"
import styles from "./Date.module.css"

export interface DateProps {
    format?: string
}

// Port de components/system/Date.svelte (F24.18a).
export function Date({ format = "day,d,m,y" }: DateProps) {
    const [currentDate, setCurrentDate] = useState(() => new globalThis.Date())

    useEffect(() => {
        // check for new day every 10 seconds
        const dateInterval = setInterval(() => setCurrentDate(new globalThis.Date()), 10000)
        return () => clearInterval(dateInterval)
    }, [])

    const data: Record<string, string> = {
        d: currentDate.getDate() + ".",
        day: "T: weekday." + (currentDate.getDay() === 0 ? 7 : currentDate.getDay()),
        m: "T: month." + (currentDate.getMonth() + 1),
        y: String(currentDate.getFullYear())
    }

    return (
        <div className={styles.date}>
            {format.split(",").map((key, i) => {
                const value = data[key] ?? ""
                return <span key={i}>{value.includes("T: ") ? <T id={value.slice(3)} /> : value} </span>
            })}
        </div>
    )
}
