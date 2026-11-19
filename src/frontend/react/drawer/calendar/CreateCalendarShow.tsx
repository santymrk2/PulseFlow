import { useEffect } from "react"
import { cn } from "../../../shared/core/lib/utils"
import { createSlides } from "../../../components/drawer/calendar/calendar"
import { history } from "../../../components/helpers/history"
import { activeProject, calendarAddShow, popupData } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { Button } from "../../ui/button/Button"
import styles from "./CreateCalendarShow.module.css"

// Port de components/drawer/calendar/CreateCalendarShow.svelte.
interface CalendarShowEvent {
    name?: string
    color?: null | string
}

export interface CalendarShowDay {
    date: number
    events: CalendarShowEvent[]
}

export interface CreateCalendarShowProps {
    currentEvents?: CalendarShowDay[]
}

export function CreateCalendarShow({ currentEvents = [] }: CreateCalendarShowProps) {
    const activeProjectValue = useStore(activeProject)
    const popupDataValue = useStore(popupData)

    async function createShow() {
        const { show } = await createSlides(currentEvents)
        // new calendar shows are private
        history({ id: "UPDATE", newData: { data: show, remember: { project: activeProjectValue } }, location: { page: "show", id: "show" } })
    }

    useEffect(() => {
        if (popupDataValue?.action === "select_show" && popupDataValue?.location === "calendar" && popupDataValue?.showId) selectedShow()
    }, [popupDataValue])

    function selectedShow() {
        calendarAddShow.set(popupDataValue.id)
        popupData.set({})
    }

    return (
        <div className={cn(styles.main, "border")}>
            <div className={styles.main} style={{ padding: "10px" }}>
                {currentEvents.length ? (
                    <>
                        {currentEvents.map((day, index) => (
                            <div key={`${day.date}-${index}`}>
                                <b style={{ marginTop: "10px" }}>
                                    {new Date(day.date).getDate()}. {translateText("month." + (new Date(day.date).getMonth() + 1))}
                                </b>
                                <ul style={{ listStylePosition: "inside" }}>
                                    {day.events.map((event, eventIndex) => (
                                        <li key={eventIndex} className="event">
                                            <p style={{ display: "inline", color: event.color || "unset" }}>
                                                {event.name ? (
                                                    event.name
                                                ) : (
                                                    <span style={{ opacity: 0.5 }}>
                                                        <T id="main.unnamed" />
                                                    </span>
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}

                        <Button variant="outline" icon="slide" style={{ marginTop: "10px" }} info={currentEvents.length > 1 ? `${currentEvents.length}` : ""} onClick={createShow}>
                            <T id="new.show_convert" />
                        </Button>
                    </>
                ) : (
                    <Center faded>
                        <T id="empty.events" />
                    </Center>
                )}
            </div>
        </div>
    )
}
