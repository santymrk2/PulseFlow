import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react"
import type { Event as CalendarEvent } from "../../../../types/Calendar"
import { actionData } from "../../actions/logic/actionData"
import { removeDuplicates, sortByTime } from "../../../shared/utils/helpers/array"
import { activeDays, activePopup, calendars, eventEdit, events, labelsDisabled, popupData, special } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { cn } from "../../../shared/core/lib/utils"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { FloatingBar } from "../../../shared/ui/kit/floating-bar/FloatingBar"
import { Button } from "../../../shared/ui/kit/button/Button"
import { MILLISECONDS_IN_A_DAY, copyDate, getDaysInMonth, getWeekNumber, isBetween, isSameDay } from "../logic/calendar/calendar"
import { isCalendarHidden } from "../logic/calendar/calendars"
import styles from "./Calendar.module.css"

// Port de components/drawer/calendar/Calendar.svelte.
export interface CalendarProps {
    active: string | null
}

export function Calendar({ active }: CalendarProps) {
    const specialValue = useStore(special)
    const activeDaysValue = useStore(activeDays)
    const eventsValue = useStore(events)
    const calendarsValue = useStore(calendars)
    const popupDataValue = useStore(popupData)
    const labelsDisabledValue = useStore(labelsDisabled)

    const [today] = useState(() => new Date())
    const [current, setCurrent] = useState(() => new Date(today.getFullYear(), today.getMonth()))
    const calendarElem = useRef<HTMLDivElement>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const sundayFirstDay = specialValue.firstDayOfWeek === "7"
    const year = current.getFullYear()
    const month = current.getMonth()

    useEffect(() => {
        activeDays.set([copyDate(today).getTime()])
    }, [today])

    const days = getDays(month, year, sundayFirstDay)
    const weekdays: string[] = []
    for (let i = 0; i < 7; i++) {
        const index = sundayFirstDay ? (i === 0 ? 7 : i) : i + 1
        weekdays.push(translateText("weekday." + index))
    }

    const currentEvents = getMonthEvents(eventsValue, days, calendarsValue, specialValue?.hideUnlabeledCalendar)
    const filteredEvents = [...currentEvents]

    function getDays(month: number, year: number, sundayFirst: boolean) {
        let daysList: Date[] = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i))
        if (!daysList[0]) return []

        const before: Date[] = getDaysBefore(daysList[0].getDay(), sundayFirst)
        daysList = [...before, ...daysList]
        const tempDays: Date[][] = []

        while (daysList.length < 42) daysList.push(copyDate(daysList[daysList.length - 1], 1))
        while (daysList.length) tempDays.push(daysList.splice(0, 7))
        return tempDays
    }

    function getDaysBefore(firstDay: number, sundayFirst: boolean): Date[] {
        if (!sundayFirst && firstDay < 1 && firstDay <= 1 && firstDay !== 0) return []

        const before: Date[] = []
        let i = (sundayFirst ? firstDay : firstDay === 0 ? 6 : firstDay - 1) - 1
        for (i; i >= 0; i--) before.push(new Date(year, month, -i))

        return before
    }

    function getMonthEvents(allEvents: Record<string, CalendarEvent>, daysList: Date[][], calendarsMap: Record<string, { hidden?: boolean }> = {}, hideUnlabeled = false) {
        if (!daysList || !daysList[0]) return []

        const tempEvents: (CalendarEvent & { id: string })[] = []
        const first = daysList[0][0].getTime()
        const last = daysList[5][daysList[5].length - 1].getTime()

        Object.entries(allEvents).forEach(([id, event]) => {
            if (isCalendarHidden(calendarsMap, hideUnlabeled, event.origin)) return

            const from = new Date(event.from).getTime()
            const to = new Date(event.to)?.getTime() || 0

            const startOrEndIsInMonth = from > first || from < last || to > first || to < last
            if (startOrEndIsInMonth) tempEvents.push({ ...event, id })
        })

        return tempEvents.sort(sortByTime)
    }

    function wheel(e: ReactWheelEvent<HTMLDivElement>) {
        if (nextScrollTimeout.current || !calendarElem.current) return

        const scrollDown = e.deltaY > 0
        if (scrollDown) nextMonth(true)
        else previousMonth(true)

        const isMouseAndNotTrackpad = e.deltaY >= 100 || e.deltaY <= -100
        if (isMouseAndNotTrackpad) return

        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
        }, 500)
    }

    function nextMonth(checkScroll = false) {
        const elem = calendarElem.current
        if (!elem) return
        const scrolledToBottom = elem.scrollTop + 1 + elem.offsetHeight >= elem.scrollHeight
        if (checkScroll && !scrolledToBottom) return

        setCurrent(new Date(year, month, 33))
    }

    function previousMonth(checkScroll = false) {
        const scrolledToTop = calendarElem.current?.scrollTop === 0
        if (checkScroll && !scrolledToTop) return

        setCurrent(new Date(year, month, 0))
    }

    function getEvents(day: Date, currentEventsValue: (CalendarEvent & { id: string })[], type: string) {
        let dayEvents: (CalendarEvent & { id: string })[] = []
        currentEventsValue.forEach((a) => {
            const eventIsAtDayOrGoingThrough = a.to ? isBetween(new Date(a.from), new Date(a.to), copyDate(day)) : isSameDay(new Date(a.from), day)
            if (eventIsAtDayOrGoingThrough) dayEvents.push(a)
        })
        dayEvents.sort(sortByTime)
        dayEvents = dayEvents.filter((a) => a.type === type)

        return dayEvents
    }

    function dayClick(e: ReactMouseEvent<HTMLDivElement>, day: Date) {
        day = copyDate(day)

        if (e.ctrlKey || e.metaKey) return toggleCurrentDay(day)
        if (e.shiftKey) return selectRange(day)

        activeDays.set([day.getTime()])
    }

    function toggleCurrentDay(day: Date) {
        activeDays.update((a) => {
            const alreadySelected = a.includes(day.getTime())
            if (!alreadySelected) return [...a, day.getTime()]

            if (a.length < 2) return a
            a.splice(a.indexOf(day.getTime()), 1)

            return a
        })
    }

    function selectRange(day: Date) {
        let first = activeDaysValue[0] || day.getTime()
        let last = day.getTime()
        const timeDifference = day.getTime() - first
        if (timeDifference === 0) return

        // invert
        if (timeDifference < 0) {
            first = last
            last = activeDaysValue[activeDaysValue.length - 1]
        }

        const newActiveDays: number[] = []
        let count = 0

        do {
            const newDay = copyDate(new Date(first + count * MILLISECONDS_IN_A_DAY)).getTime()
            newActiveDays.push(newDay)
            count++
        } while (!isSameDay(new Date(newActiveDays[newActiveDays.length - 1]), new Date(last)))

        activeDays.set(newActiveDays)
    }

    function move(e: ReactMouseEvent<HTMLDivElement>, day: Date) {
        if (!e.buttons) return
        activeDays.set(removeDuplicates([...activeDaysValue, copyDate(day).getTime()]))
    }

    // listen for update
    useEffect(() => {
        if (popupDataValue?.action === "select_show" && popupDataValue?.location === "event" && popupDataValue?.showId) {
            // let animation finish
            const timeout = setTimeout(() => activePopup.set("edit_event"), 300)
            return () => clearTimeout(timeout)
        }
        return undefined
    }, [popupDataValue])

    function getEventIcon(type: string, actionId?: string) {
        if (type === "event") return "calendar"
        if (type === "action") return (actionId ? actionData[actionId]?.icon : "") || "actions"
        return type
    }

    const isPresentDay = !!activeDaysValue.length && isSameDay(new Date(activeDaysValue[0]), today) && current.getMonth() === new Date(activeDaysValue[0]).getMonth() && current.getFullYear() === new Date(activeDaysValue[0]).getFullYear()

    function setToPresentDay() {
        setCurrent(today)
        activeDays.set([copyDate(today).getTime()])
    }

    return (
        <>
            <div className={styles.calendar}>
                <div className={styles.week} style={{ flex: 1 }}>
                    <div className={styles.weekday} style={{ minWidth: "25px", flex: 1, padding: 0, backgroundColor: "var(--primary-darker)", fontSize: "0.9em", opacity: 0.7, fontWeight: 600 }}>
                        {current.getFullYear().toString().slice(2)}
                    </div>

                    {weekdays.map((weekday) => (
                        <div key={weekday} className={styles.weekday}>
                            {weekday}
                        </div>
                    ))}
                </div>

                <div className={styles.grid} onWheel={wheel} ref={calendarElem}>
                    {days.map((week) => (
                        <div key={week[0].getTime()} className={styles.week}>
                            <span className={styles.weeknumber}>{getWeekNumber(week[0])}</span>

                            {week.map((day) => {
                                const dayEvents = getEvents(day, filteredEvents, active || "event")
                                return (
                                    <div key={day.getTime()} className={cn(styles.day, isSameDay(day, today) && styles.today, (day.getMonth() !== month || day.getFullYear() !== year) && styles.faded, activeDaysValue?.includes(copyDate(day).getTime()) && styles.active)} onMouseDown={(e) => dayClick(e, day)} onMouseMove={(e) => move(e, day)}>
                                        <span style={{ fontSize: "1.5em", fontWeight: 600 }}>{day.getDate()}</span>
                                        <span className={styles.events}>
                                            {dayEvents.map((event, i) => {
                                                const eventIcon = getEventIcon(event.type, event.action?.id)
                                                if (dayEvents.length > 3 && i > 1) return <span key={event.id} className={styles.dot} style={{ backgroundColor: event.color || "white" }} data-title={event.name} />
                                                return (
                                                    <div key={event.id} className={styles.event} style={{ color: event.color || "white" }} data-title={event.name}>
                                                        <Icon id={eventIcon} right white />
                                                        <p>{event.name}</p>
                                                    </div>
                                                )
                                            })}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <FloatingBar style={{ marginLeft: "25px" }} side="left">
                <Button title="media.previous" onClick={() => previousMonth()}>
                    <Icon id="previous" size={1.1} />
                </Button>
                <Button title="media.next" onClick={() => nextMonth()}>
                    <Icon id="next" size={1.1} />
                </Button>

                <div className="divider"></div>

                <Button title="calendar.today" isActive={isPresentDay} onClick={setToPresentDay}>
                    <Icon id="home" white={!isPresentDay} size={1.1} />
                </Button>

                <div className="divider"></div>

                <span style={{ opacity: 0.8, textTransform: "capitalize", whiteSpace: "nowrap", alignSelf: "center", padding: "0 10px" }}>
                    {translateText("month." + (current.getMonth() + 1))}
                    {current.getFullYear()}
                </span>
            </FloatingBar>

            <FloatingBar onlyOne>
                <Button
                    onClick={() => {
                        eventEdit.set(null)
                        popupData.set({})
                        activePopup.set("edit_event")
                    }}
                >
                    <Icon id="add" right={!labelsDisabledValue} />
                    {!labelsDisabledValue ? <T id={`new.${active === "action" ? "event_action" : "event"}`} /> : null}
                </Button>
            </FloatingBar>
        </>
    )
}
