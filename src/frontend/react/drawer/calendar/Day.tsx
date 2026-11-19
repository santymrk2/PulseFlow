import type { Event as CalendarEvent } from "../../../../types/Calendar"
import { actionData } from "../../../components/actions/actionData"
import { getActionName } from "../../../components/actions/actions"
import { copyDate, endsMidnightNextDay, getTime, isBetween, isSameDay } from "../../../components/drawer/calendar/calendar"
import { isCalendarHidden } from "../../../components/drawer/calendar/calendars"
import { sortByTime } from "../../../components/helpers/array"
import { activeDays, activePopup, calendars, eventEdit, events, special } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { triggerClickOnEnterSpace } from "../../helpers/triggerClickOnEnterSpace"
import { Center } from "../../system/Center"
import styles from "./Day.module.css"

// Port de components/drawer/calendar/Day.svelte.
export interface DayProps {
    type?: string
}

export function Day({ type = "event" }: DayProps) {
    const activeDaysValue = useStore(activeDays)
    const eventsValue = useStore(events)
    const calendarsValue = useStore(calendars)
    const specialValue = useStore(special)

    const current = new Date(activeDaysValue[0])
    let currentEvents: (CalendarEvent & { id: string })[] = []

    Object.entries(eventsValue).forEach(([id, a]) => {
        if (isCalendarHidden(calendarsValue, specialValue?.hideUnlabeledCalendar, a.origin)) return
        const toDate = a.to ? new Date(a.to) : new Date(a.from)
        if (isBetween(new Date(a.from), toDate, copyDate(current))) currentEvents.push({ ...a, id })
    })

    currentEvents = currentEvents.filter((a) => a.type === type)
    currentEvents = currentEvents.sort(sortByTime)

    function getEventIcon(eventType: string, actionId?: string) {
        if (eventType === "event") return "calendar"
        if (eventType === "action") return (actionId ? actionData[actionId]?.icon : "") || "actions"
        return eventType
    }

    if (!activeDaysValue.length) return null

    return (
        <div className={styles.main}>
            <span className={styles.date}>
                {current.getDate()}. {translateText("month." + (current.getMonth() + 1))}
                {current.getFullYear()}
            </span>

            <div className={styles.scroll}>
                {currentEvents.length ? (
                    currentEvents.map((event) => {
                        const eventIcon = getEventIcon(event.type, event.action?.id)
                        const customName = type === "action" ? getActionName(event.action?.id, event.action?.data) : ""
                        return (
                            <div
                                key={event.id}
                                className={`${styles.event} context #event`}
                                style={{ color: event.color || "unset" }}
                                id={event.id}
                                data-title={customName}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    eventEdit.set(event.id)
                                    activePopup.set("edit_event")
                                }}
                                onKeyDown={triggerClickOnEnterSpace}
                            >
                                {event.time ? (
                                    <span className={styles.time}>
                                        {isSameDay(new Date(event.from), current) ? getTime(new Date(event.from)) : null}
                                        {type !== "action" && (!isSameDay(new Date(event.from), current) || new Date(event.to).getTime() > new Date(event.from).getTime()) ? (
                                            <>
                                                {isSameDay(new Date(event.to), current) || endsMidnightNextDay(current, new Date(event.to)) ? (
                                                    <>
                                                        {isSameDay(new Date(event.from), current) ? "-" : null}
                                                        {getTime(new Date(event.to))}
                                                    </>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </span>
                                ) : null}

                                <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
                                    <Icon id={eventIcon} right white />
                                    <p>
                                        {event.name ? (
                                            customName ? (
                                                <>
                                                    {event.name}: {customName}
                                                </>
                                            ) : (
                                                event.name
                                            )
                                        ) : (
                                            <span style={{ opacity: 0.5 }}>
                                                <T id="main.unnamed" />
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <Center faded>
                        <T id="empty.events" />
                    </Center>
                )}
            </div>
        </div>
    )
}
