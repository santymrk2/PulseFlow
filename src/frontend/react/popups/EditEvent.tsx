import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Event } from "../../../types/Calendar"
import { cn } from "../../shared/core/lib/utils"
import { getTime, isSameDay } from "../../components/drawer/calendar/calendar"
import { createCustomCalendar, isCalendarImported } from "../../components/drawer/calendar/calendars"
import { createRepeatedEvents, updateEventData } from "../../components/drawer/calendar/event"
import { history } from "../../shared/utils/helpers/history"
import { changeTime } from "../../shared/utils/helpers/time"
import { activeDays, activePopup, calendars, drawerTabsData, eventEdit, events, popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { CreateAction } from "../actions/CreateAction"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { DateField } from "../ui/date-field/DateField"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { TimeField } from "../ui/time-field/TimeField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./EditEvent.module.css"

// Port de components/main/popups/EditEvent.svelte. Lee: eventEdit + events (evento a editar), activeDays (día inicial), drawerTabsData.calendar.activeSubTab
// ("event" | "action"), calendars, popupData.showId/event (vuelta de elegir un show). Escribe: popupData.event (refleja el evento en edición, salvo mientras hay showId),
// delete popupData.showId, calendars (createCustomCalendar), y al guardar: history UPDATE { newData: { data }, oldData: { id } } (o createRepeatedEvents si repite y no
// tiene grupo), "guardar todos": history UPDATE con todos los del grupo + createRepeatedEvents(data, true); luego activePopup = null y eventEdit = null.
// Cerrar sin guardar no escribe nada (salvo el espejo popupData.event, igual que antes). CreateAction ya es port React (F24.24); sus handlers van por `live`.
// Se conserva del Svelte: el evento nuevo se resetea dos veces al montar (onMount y el `$:` de selectedType) y `editEvent.action` es el mismo objeto que
// `actionData` (por eso un evento nuevo se guarda con `action: {}`); al editar una acción guardada, `actionData` es el objeto del evento en el store y se
// muta en el lugar (cancelar no lo deshace), por eso `actionTarget`. Diferencia: `repeatData` de un evento ya guardado se copia (el Svelte lo mutaba en el store).
interface RepeatData {
    type: string
    ending: string
    count: number | null
    endingDate: string
    afterRepeats: number | null
}
interface EventWithData extends Omit<Event, "repeatData"> {
    id: string
    repeatData: RepeatData
}
interface EventAction {
    id?: string
    data?: unknown
}
interface ActionChange {
    id?: string
    actionValue?: unknown
}

const DEFAULT_REPEAT: RepeatData = { type: "day", ending: "date", count: 1, endingDate: "", afterRepeats: 10 }

const BLANK_EVENT: EventWithData = { type: "event", id: "", name: "", color: "#FFFFFF", time: true, from: "", to: "", repeat: false, repeatData: DEFAULT_REPEAT }

const endings = [
    { value: "date", label: translateText("calendar.ending_the") },
    { value: "after", label: translateText("calendar.ending_repeated") }
]

const getISO = (date: Date) => {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().substring(0, 10)
}

const parseISODate = (isoStr: string) => {
    if (!isoStr) return new Date()
    const [year, month, day] = isoStr.split("-").map(Number)
    return new Date(year, month - 1, day)
}

const setDate = (date: Date, options: { year?: number; month?: number; date?: number }): Date => {
    const newDate = [options.year ?? date.getFullYear(), (options.month ?? date.getMonth()) + 1, options.date ?? date.getDate()]
    const time = date.getHours() + ":" + date.getMinutes()
    return new Date([...newDate, time].join(" "))
}

export function EditEvent() {
    const eventEditValue = useStore(eventEdit)
    const calendarsValue = useStore(calendars)
    const popupShowId = useStore(popupData).showId

    const [stored, setStored] = useState("")
    const [editEvent, setEditEvent] = useState<EventWithData>(BLANK_EVENT)
    const [selectedType, setSelectedType] = useState("") // "event" | "action"
    const [actionData, setActionData] = useState<EventAction>({})
    const actionTarget = useRef<EventAction>({})
    const [actionSelector, setActionSelector] = useState<{ id: string } | null>(null)
    const [showMore, setShowMore] = useState(false)

    function setActionTarget(target: EventAction) {
        actionTarget.current = target
        setActionData({ ...target })
    }

    function edit(event: Event) {
        const from = new Date(event.from)
        const to = new Date(event.to)

        // narrowing verificado: los eventos guardados salen de este mismo formulario (repeatData completo) y eventEdit no es null acá
        const next = { ...event, id: get(eventEdit) as string, isoFrom: getISO(from), isoTo: getISO(to), fromTime: getTime(from), toTime: getTime(to) } as EventWithData
        if (!next.repeatData) next.repeatData = { ...DEFAULT_REPEAT }

        if (event.action) setActionTarget(event.action)

        setEditEvent(next)
        setStored(JSON.stringify(next))
    }

    function resetEdit() {
        const days = get(activeDays)
        const selectedDate = new Date(days[0])

        const next: EventWithData = {
            type: "event",
            id: uid(),
            name: "",
            color: "#FFFFFF",
            time: true,
            from: "",
            to: "",
            isoFrom: days.length ? getISO(selectedDate) : "",
            isoTo: days.length ? getISO(selectedDate) : "",
            fromTime: "11:00",
            toTime: "13:00",
            location: "",
            repeat: false,
            repeatData: { ...DEFAULT_REPEAT },
            notes: "",
            origin: undefined
        }

        // update action
        // WIP don't know if this does anything
        if (actionTarget.current) next.action = actionTarget.current

        let options: { month: number; year?: number } = { month: selectedDate.getMonth() + 1 }
        if (options.month > 11) options = { month: 0, year: selectedDate.getFullYear() + 1 }
        next.repeatData.endingDate = getISO(setDate(selectedDate, options))

        setEditEvent(next)
        setStored(JSON.stringify(next))
    }

    // onMount
    useEffect(() => {
        setSelectedType(get(drawerTabsData).calendar?.activeSubTab || "event")

        const current = get(eventEdit)
        if (current) edit(get(events)[current])
        else resetEdit()
    }, [])

    // $: if (!$eventEdit && selectedType) resetEdit()
    useEffect(() => {
        if (!eventEditValue && selectedType) resetEdit()
    }, [eventEditValue, selectedType])

    // set show when selected
    useEffect(() => {
        if (popupShowId) setTimeout(setShow, 100)
    }, [popupShowId])

    function setShow() {
        const data = get(popupData)
        if (!data.event) return

        setEditEvent(data.event)
        setActionTarget({ id: "start_show", data: { id: data.showId } })

        popupData.update((a) => {
            delete a.showId
            return a
        })
    }

    // $: updatePopup(editEvent)
    useEffect(() => {
        if (get(popupData).showId) return

        popupData.update((a) => {
            a.event = editEvent
            return a
        })
    }, [editEvent])

    const updateEvent = (changes: Partial<EventWithData>) => setEditEvent((a) => ({ ...a, ...changes }))
    const updateRepeat = (changes: Partial<RepeatData>) => setEditEvent((a) => ({ ...a, repeatData: { ...a.repeatData, ...changes } }))

    function saveAll() {
        const { data } = updateEventData(editEvent, stored, { type: selectedType, action: actionTarget.current })
        if (!data) return

        const updatedData: { [key: string]: unknown } = {}
        Object.entries(get(events)).forEach(([eventId, event]) => {
            if (event.group !== editEvent.group) return

            const newFromTime = changeTime(event.from, data.from).toString()
            const newToTime = changeTime(event.to, data.to).toString()
            updatedData[eventId] = {
                ...data,
                from: newFromTime,
                to: newToTime
            }
        })

        history({ id: "UPDATE", newData: { data: updatedData, keys: Object.keys(updatedData) }, location: { page: "drawer", id: "event" } })

        if (data.repeat) {
            createRepeatedEvents(data, true)
        }

        activePopup.set(null)
        eventEdit.set(null)
    }

    function save() {
        if (selectedType === "event" && stored === JSON.stringify(editEvent)) return activePopup.set(null)
        if (selectedType === "event" && !editEvent.name?.length) return activePopup.set(null)
        if (selectedType === "action" && !actionData) return activePopup.set(null)

        let current = editEvent
        if (selectedType === "action") {
            current = { ...editEvent, isoTo: editEvent.isoFrom }
            setEditEvent(current)
        }

        const { data, id } = updateEventData(current, stored, { type: selectedType, action: actionTarget.current })
        if (!data) return

        if (data.repeat && !data.group) {
            data.group = id
            createRepeatedEvents(data)
        } else {
            history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "drawer", id: "event" } })
        }

        activePopup.set(null)
        eventEdit.set(null)
    }

    const weekdayIndex = editEvent.isoFrom ? parseISODate(editEvent.isoFrom).getDay() : 1
    const weekdayName = translateText("weekday." + (weekdayIndex === 0 ? 7 : weekdayIndex))
    const repeats = [
        { value: "day", label: translateText("calendar.day") },
        { value: "week", label: translateText("calendar.week") },
        { value: "month", label: translateText("calendar.month") },
        { value: "year", label: translateText("calendar.year") },
        { value: "1st", label: "1st " + weekdayName },
        { value: "2nd", label: "2nd " + weekdayName },
        { value: "3rd", label: "3rd " + weekdayName },
        { value: "4th", label: "4th " + weekdayName },
        { value: "last", label: "last " + weekdayName }
    ]

    function changeAction(value: ActionChange) {
        const target = actionTarget.current
        if (value.actionValue) target.data = value.actionValue
        else target.id = value.id

        setActionData({ ...target })
    }

    function updateTime(changed: "from" | "to") {
        if (!editEvent.isoFrom || !editEvent.isoTo) return
        if (!isSameDay(new Date(editEvent.isoFrom), new Date(editEvent.isoTo))) return
        if (!editEvent.fromTime || !editEvent.toTime) return

        const from = Number(editEvent.fromTime.replace(":", ""))
        const to = Number(editEvent.toTime.replace(":", ""))

        if (changed === "to" && editEvent.toTime[0] === "0") return
        if (changed === "from" ? from <= to : to >= from) return

        if (changed === "from") {
            let newTime = from + 100
            if (newTime >= 2400) newTime = 2359
            const sliced = newTime.toString() + "000"
            updateEvent({ toTime: sliced.slice(0, 2) + ":" + sliced.slice(2, 4) })
        } else if (changed === "to") {
            let newTime = to - 100
            if (newTime < 0) newTime = 0
            const sliced = newTime.toString() + "000"
            updateEvent({ fromTime: sliced.slice(0, 2) + ":" + sliced.slice(2, 4) })
        }
    }

    const actionDataString = JSON.stringify(actionData)

    const cantSave = selectedType === "event" ? !editEvent.name?.length || stored === JSON.stringify(editEvent) : selectedType === "action" ? !actionData?.id : true

    const customCalendars = Object.values(calendarsValue || {}).filter((cal) => !isCalendarImported(cal))
    const currentCal = editEvent.origin ? calendarsValue?.[editEvent.origin] || Object.values(calendarsValue || {}).find((c) => c.name === editEvent.origin) : null
    const isCurrentOriginImported = editEvent.origin ? (currentCal ? isCalendarImported(currentCal) : false) : false

    const calendarOptions = isCurrentOriginImported
        ? [
              {
                  value: editEvent.origin || "",
                  label: currentCal?.name || editEvent.origin || "",
                  icon: "calendar",
                  iconColor: currentCal?.color || editEvent.color || undefined
              }
          ]
        : customCalendars.map((cal) => ({
              value: cal.id,
              label: cal.name,
              icon: "calendar",
              iconColor: cal.color
          }))

    function handleCalendarChange(calId: string | null) {
        const color = calId ? get(calendars)?.[calId]?.color : undefined
        updateEvent({ origin: calId || undefined, ...(color ? { color } : {}) })
    }

    function handleCreateCalendar(name: string) {
        const newCalId = createCustomCalendar(name)
        const color = get(calendars)?.[newCalId]?.color
        updateEvent({ origin: newCalId, ...(color ? { color } : {}) })
    }

    // Los handlers del port leen siempre `live`
    const live = useRef({ changeAction })
    useEffect(() => {
        live.current = { changeAction }
    })

    return (
        <>
            {selectedType === "event" ? (
                <>
                    <InputRow>
                        <TextField label="calendar.name" value={editEvent.name} onInput={(value) => updateEvent({ name: value ?? "" })} autofocus={!editEvent.name} />
                        <ColorField label="calendar.color" style={{ minWidth: "200px", maxWidth: "200px" }} value={editEvent.color || ""} onInput={(value) => updateEvent({ color: value })} noLabel />
                    </InputRow>

                    {showMore ? (
                        <>
                            <InputRow>
                                <SelectField label="calendar.calendar" value={editEvent.origin || ""} options={calendarOptions} disabled={isCurrentOriginImported} allowEmpty addNew={isCurrentOriginImported ? null : "new.calendar"} onChange={handleCalendarChange} onNew={handleCreateCalendar} />
                            </InputRow>

                            <TextField label="calendar.location" value={editEvent.location || ""} onInput={(value) => updateEvent({ location: value ?? "" })} />
                            <TextField label="calendar.notes" value={editEvent.notes || ""} onInput={(value) => updateEvent({ notes: value ?? "" })} />
                        </>
                    ) : null}

                    <Button className={cn("popup-options", showMore && "active")} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

                    {showMore ? <ToggleField label="calendar.time" style={{ marginTop: "10px" }} checked={editEvent.time} defaultValue={true} onChange={(value) => updateEvent({ time: value })} /> : null}
                </>
            ) : selectedType === "action" ? (
                actionSelector !== null ? (
                    <>
                        <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setActionSelector(null)} />

                        <CreateAction
                            actionId={actionData?.id || ""}
                            existingActions={actionData?.id ? [actionData.id] : []}
                            actionValue={actionData?.data || {}}
                            mode="calendar"
                            list
                            full
                            onChange={(data) => {
                                live.current.changeAction(data as ActionChange)
                                setActionSelector(null)
                            }}
                        />
                    </>
                ) : (
                    // TODO: only choose actual "Actions"
                    <CreateAction key={actionDataString} actionId={actionData?.id || ""} actionValue={actionData?.data || {}} mode="calendar" choosePopup onChange={(data) => live.current.changeAction(data as ActionChange)} onChoose={() => setActionSelector({ id: actionData?.id || "" })} />
                )
            ) : null}

            {!actionSelector ? (
                <>
                    {/* TODO: update totime if fromtime is newer */}
                    <InputRow style={{ marginTop: `${showMore ? 0 : 10}px` }}>
                        <DateField label={selectedType === "event" ? "calendar.from_date" : "sort.date"} style={{ flex: 1 }} value={editEvent.isoFrom || ""} onChange={(value) => updateEvent({ isoFrom: value ?? "" })} />
                        <TimeField label={selectedType === "event" ? "calendar.from_time" : "calendar.time"} style={{ width: "200px" }} disabled={!editEvent.time} value={editEvent.fromTime || ""} onInput={(value) => updateEvent({ fromTime: value ?? "" })} onChange={() => updateTime("from")} />
                    </InputRow>
                    {selectedType === "event" ? (
                        <InputRow>
                            <DateField label="calendar.to_date" style={{ flex: 1 }} value={editEvent.isoTo || ""} onChange={(value) => updateEvent({ isoTo: value ?? "" })} />
                            <TimeField label="calendar.to_time" style={{ width: "200px" }} disabled={!editEvent.time} value={editEvent.toTime || ""} onInput={(value) => updateEvent({ toTime: value ?? "" })} onChange={() => updateTime("to")} />
                        </InputRow>
                    ) : null}

                    <ToggleField label="calendar.repeat" style={{ marginTop: "10px" }} disabled={!!editEvent.group} checked={editEvent.repeat} onChange={(value) => updateEvent({ repeat: value })} />

                    {editEvent.repeat ? (
                        <InputRow style={{ backgroundColor: "var(--primary-darker)", borderRadius: "4px" }}>
                            {["1st", "2nd", "3rd", "4th", "last"].includes(editEvent.repeatData.type) ? (
                                <span style={{ display: "flex", alignItems: "center", fontSize: "0.9em", padding: "0 10px" }}>Repeat monthly on the</span>
                            ) : (
                                <>
                                    <span style={{ display: "flex", alignItems: "center", fontSize: "0.9em", padding: "0 10px" }}>
                                        <T id="calendar.repeat_every" />
                                    </span>
                                    <NumberField label="edit.count" disabled={!!editEvent.group} style={{ width: "80px" }} value={editEvent.repeatData.count ?? undefined} min={1} onChange={(value) => updateRepeat({ count: value })} />
                                </>
                            )}
                            <SelectField label="edit.interval" disabled={!!editEvent.group} style={{ width: "100px" }} options={repeats} value={editEvent.repeatData.type} onChange={(value) => updateRepeat({ type: value ?? "" })} />
                            {/* TODO: select weekdays? */}
                            <span style={{ display: "flex", alignItems: "center", fontSize: "0.9em", padding: "0 10px" }}>
                                <T id="calendar.repeat_until" />
                            </span>
                            <SelectField label="calendar.type" disabled={!!editEvent.group} style={{ width: "130px" }} options={endings} value={editEvent.repeatData.ending} onChange={(value) => updateRepeat({ ending: value ?? "" })} />

                            {editEvent.repeatData.ending === "date" ? (
                                <DateField label="calendar.to_date" style={{ flex: 0 }} disabled={!!editEvent.group} value={editEvent.repeatData.endingDate} onChange={(value) => updateRepeat({ endingDate: value ?? "" })} />
                            ) : editEvent.repeatData.ending === "after" ? (
                                <>
                                    <NumberField label="edit.count" disabled={!!editEvent.group} style={{ width: "80px" }} value={editEvent.repeatData.afterRepeats ?? undefined} min={1} onChange={(value) => updateRepeat({ afterRepeats: value })} />
                                    <span style={{ display: "flex", alignItems: "center", padding: "0 10px" }}>
                                        <T id="calendar.ending_times" />
                                    </span>
                                </>
                            ) : null}
                        </InputRow>
                    ) : null}

                    <InputRow style={{ marginTop: "20px" }}>
                        <Button variant="default" className={cn(!cantSave && styles.save)} style={{ flex: 1 }} disabled={cantSave} onClick={save}>
                            {eventEditValue ? (
                                <>
                                    <Icon id="save" white />
                                    <T id="actions.save" />
                                </>
                            ) : (
                                <>
                                    <Icon id="add" white />
                                    <T id="timer.create" />
                                </>
                            )}
                        </Button>
                        {editEvent.group ? (
                            <Button variant="default" className={cn(!cantSave && styles.save)} style={{ flex: 2, marginLeft: "5px" }} disabled={cantSave} onClick={saveAll}>
                                <Icon id="save" white />
                                <T id="calendar.save_all" />
                            </Button>
                        ) : null}
                    </InputRow>
                </>
            ) : null}
        </>
    )
}
