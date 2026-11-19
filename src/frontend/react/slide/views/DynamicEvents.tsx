import { useEffect, useState } from "react"
import { get } from "../../../shared/core/lib/store"
import { activeDrawerTab, drawer, events } from "../../../shared/core/stores"
import { getTime } from "../../../components/drawer/calendar/calendar"
import { keysToID } from "../../../shared/utils/helpers/array"
import { visibleEvents } from "../../../shared/utils/helpers/dynamicItemText"
import { setDrawerTabData } from "../../../shared/utils/helpers/historyHelpers"
import { useStore } from "../../hooks/useStore"
import styles from "./DynamicEvents.module.css"

export interface DynamicEventsProps {
    edit?: boolean
    textSize?: number
    maxEvents?: number
    startDaysFromToday?: number
    justOneDay?: boolean
    enableStartDate?: boolean
    startDate?: string
    startTime?: string
    fromTime?: string
    toTime?: string
}

// (F24.18a). El HTML de cada evento se concatena en un solo
// dangerouslySetInnerHTML para conservar exactamente el DOM que producían los `{@html}` del Svelte.
function getEventElement(event: { time?: boolean; from?: string; name?: string; location?: string; notes?: string }, textSize = 80): string {
    let html = "<p>"

    if (event.time) {
        const time = getTime(new Date(event.from!))
        html += `<span style="font-weight: bold;font-size:${textSize * 0.8}px;font-family:Arial;">${time} </span>`
    }
    html += `<span style="font-size:${textSize}px;">${event.name}`
    if (event.location) html += `<span style="font-size:${textSize * 0.9}px;font-style:italic;"> - ${event.location}`
    if (event.notes) html += ":"
    html += `</span>`
    if (event.location) html += `</span>`

    html += "</p>"
    if (event.notes) html += `<p><span style="font-size:${textSize * 0.8}px;">&nbsp;&nbsp;&nbsp;&nbsp;${event.notes}</span></p>`

    return html
}

export function DynamicEvents({ edit = false, textSize = 80, maxEvents = 5, startDaysFromToday = 0, justOneDay = false, enableStartDate = false, startDate = "", startTime = "00:00", fromTime = "00:00", toTime = "00:00" }: DynamicEventsProps) {
    const allEvents = useStore(events)
    const [filteredEvents, setFilteredEvents] = useState<ReturnType<typeof visibleEvents>>([])

    function updateEvents() {
        setFilteredEvents(visibleEvents({ maxEvents, startDaysFromToday, justOneDay, enableStartDate, startDate, startTime, fromTime, toTime }, keysToID(allEvents), new Date()))
    }

    useEffect(() => {
        updateEvents()
        const timer = setInterval(updateEvents, 10 * 1000)
        return () => clearInterval(timer)
    }, [allEvents, maxEvents, startDaysFromToday, justOneDay, enableStartDate, startDate, startTime, fromTime, toTime])

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("calendar", "event")
        activeDrawerTab.set("calendar")

        const current = get(drawer)
        if (current.height <= 40) drawer.set({ height: current.stored || 300, stored: null })
    }

    const html = filteredEvents
        .filter((event) => event.name)
        .map((event) => getEventElement(event, textSize))
        .join("")
    return <div className={styles.events} onDoubleClick={openInDrawer} dangerouslySetInnerHTML={{ __html: html }} />
}
