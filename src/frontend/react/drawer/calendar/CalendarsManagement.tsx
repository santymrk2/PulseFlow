import { useState } from "react"
import type { IcsCalendar } from "../../../components/drawer/calendar/calendars"
import { fetchAndImportIcs, getIcsCalendars, isCalendarHidden, toggleCalendarHidden } from "../../../components/drawer/calendar/calendars"
import { calendars, events, special } from "../../../stores"
import { newToast } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import styles from "./CalendarsManagement.module.css"

// Port de components/drawer/calendar/CalendarsManagement.svelte.
export function CalendarsManagement() {
    const eventsValue = useStore(events)
    const calendarsValue = useStore(calendars)
    const specialValue = useStore(special)
    const [syncingCalendars, setSyncingCalendars] = useState<Record<string, boolean>>({})

    const icsCalendars = getIcsCalendars(eventsValue, calendarsValue)

    async function syncCalendar(cal: IcsCalendar) {
        if (!cal.url || syncingCalendars[cal.id]) return

        setSyncingCalendars((current) => ({ ...current, [cal.id]: true }))
        const success = await fetchAndImportIcs(cal.url, cal.id)
        setSyncingCalendars((current) => ({ ...current, [cal.id]: false }))

        if (success !== true) {
            let msg = "error.import"
            if (typeof success === "string") msg = success
            newToast(msg)
            return
        }
    }

    if (!icsCalendars.length) return null

    return (
        <div className={styles["calendars-section"]} style={{ marginTop: "10px" }}>
            <p className={styles["section-title"]}>
                <T id="calendar.calendars" />
            </p>

            <div className={styles["calendar-list"]}>
                {icsCalendars.map((cal) => {
                    const isHidden = isCalendarHidden(calendarsValue, specialValue?.hideUnlabeledCalendar, cal.unassigned ? undefined : cal.id)
                    return (
                        <div key={cal.id} className={cn(styles["calendar-card"], "context", cal.unassigned ? "#calendar_item_unlabeled" : "#calendar_item")} id={cal.id}>
                            <div className={styles["calendar-info"]}>
                                <span className={styles["calendar-color-dot"]} style={{ backgroundColor: cal.unassigned ? "rgb(255 255 255 / 0.2)" : cal.color || "#FF5733" }} />

                                <div className={styles["calendar-title-col"]}>
                                    <p className={styles["calendar-name"]} data-title={cal.url || cal.name}>
                                        {cal.name}
                                    </p>
                                    <span className={styles["calendar-desc"]}>
                                        {cal.url ? <Icon id="web" size={0.6} white /> : null}
                                        <p>
                                            {translateText("category.events")}: {cal.count}
                                        </p>
                                    </span>
                                </div>
                            </div>

                            <div className={styles["calendar-actions"]}>
                                {cal.url ? (
                                    <Button title="cloud.sync" disabled={syncingCalendars[cal.id]} style={{ padding: "10px" }} onClick={() => syncCalendar(cal)}>
                                        <Icon id="refresh" className={syncingCalendars[cal.id] ? "spinning" : ""} white />
                                    </Button>
                                ) : null}

                                <Button title={isHidden ? "profile.show" : "profile.hide"} style={{ padding: "10px" }} onClick={() => toggleCalendarHidden(cal.id)}>
                                    <Icon id={isHidden ? "hide" : "eye"} white={isHidden} />
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
