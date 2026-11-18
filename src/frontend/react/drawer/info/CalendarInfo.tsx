import { useEffect, useState } from "react"
import { activeDays, calendarAddShow, drawerTabsData, events, language, nextActionEventPaused, nextActionEventStart, shows, special } from "../../../stores"
import type { DropdownOptions } from "../../../../types/Input"
import { getSelectedEvents } from "../../../components/drawer/calendar/calendar"
import CalendarsManagement from "../../../components/drawer/calendar/CalendarsManagement.svelte"
import CreateCalendarShow from "../../../components/drawer/calendar/CreateCalendarShow.svelte"
import Day from "../../../components/drawer/calendar/Day.svelte"
import { joinTimeBig } from "../../../components/helpers/time"
import { translateText } from "../../../utils/language"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { PopupField } from "../../ui/popup-field/PopupField"
import { SelectField } from "../../ui/select-field/SelectField"

// Port de components/drawer/info/CalendarInfo.svelte. El calendario sigue en Svelte: se monta con islas.
export interface CalendarInfoProps {
    optionsOpen: boolean
}

export function CalendarInfo({ optionsOpen }: CalendarInfoProps) {
    const days = useStore(activeDays)
    const allEvents = useStore(events)
    const tabsData = useStore(drawerTabsData)
    const currentLanguage = useStore(language)
    const addShow = useStore(calendarAddShow)
    const allShows = useStore(shows)
    const specialValue = useStore(special)
    const paused = useStore(nextActionEventPaused)
    const nextStart = useStore(nextActionEventStart)
    const type = tabsData.calendar?.activeSubTab || "event"

    const [currentEvents, setCurrentEvents] = useState<unknown[]>([])
    useEffect(() => {
        setCurrentEvents(getSelectedEvents() as unknown[])
    }, [days, allEvents])

    function updateSpecial(value: unknown, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    useEffect(() => {
        if (specialValue.firstDayOfWeek) return
        const localeInfo = new Intl.Locale(navigator.language || currentLanguage) as Intl.Locale & { getWeekInfo?: () => { firstDay: number } }
        const firstDay = localeInfo.getWeekInfo?.().firstDay
        if (firstDay) updateSpecial(firstDay.toString(), "firstDayOfWeek")
        // Sólo se calcula una vez cuando falta la preferencia (como el `$:` de Svelte).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const firstWeekDayOptions: DropdownOptions = [
        { value: "1", label: translateText("weekday.1"), style: "text-transform: capitalize;" },
        { value: "7", label: translateText("weekday.7"), style: "text-transform: capitalize;" }
    ]

    if (optionsOpen) {
        return (
            <main style={{ flex: 1, overflowX: "hidden", padding: "10px" }}>
                <SelectField label="calendar.first_day" options={firstWeekDayOptions} value={specialValue.firstDayOfWeek || "1"} onChange={(value) => updateSpecial(value, "firstDayOfWeek")} />
                {type === "event" ? (
                    <>
                        <PopupField label="calendar.add_slides_from_show" style={{ marginTop: "5px" }} value={addShow} name={allShows[addShow]?.name || "—"} popupId="select_show" icon="showIcon" data={{ action: "select_show", location: "calendar" }} onChange={(value) => calendarAddShow.set(value ?? "")} allowEmpty />
                        <SvelteIsland component={CalendarsManagement} />
                    </>
                ) : null}
            </main>
        )
    }

    if (type === "event") {
        return days.length > 1 ? <SvelteIsland component={CreateCalendarShow} props={{ currentEvents }} /> : <SvelteIsland component={Day} props={{ type }} />
    }

    return (
        <>
            <SvelteIsland component={Day} props={{ type }} />
            {nextStart.timeLeft ? (
                <Button align="start" onClick={() => nextActionEventPaused.set(!paused)} title={translateText(paused ? "actions.start_timer" : "media.pause")}>
                    <Icon id={paused ? "play" : "pause"} white={paused} right />
                    {paused ? (
                        <T id="actions.start_timer" />
                    ) : (
                        <p>
                            {joinTimeBig(nextStart.timeLeft / 1000)} <T id="calendar.repeat_until" /> "{nextStart.name}"
                        </p>
                    )}
                </Button>
            ) : null}
        </>
    )
}
