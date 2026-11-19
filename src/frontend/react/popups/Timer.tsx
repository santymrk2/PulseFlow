import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Timer as ShowTimer } from "../../../types/Show"
import { getDateString } from "../../components/drawer/calendar/calendar"
import { getTimer, getTimerDynamicValue } from "../../components/drawer/timers/timers"
import { deselect, getSelected } from "../../shared/utils/helpers/select"
import { secondsToTime } from "../../shared/utils/helpers/time"
import { events, drawerTabsData, timers } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Timer.module.css"

// Port de components/main/popups/Timer.svelte. Lee: selected (al montar), events, timers y drawerTabsData; escribe timers (autoguardado).
// El `setInterval` de un segundo y el listener nativo de <input type="time"> se limpian al desmontar.
// No se porta `updateEventName`: el Svelte buscaba `id`/`name` en una lista de opciones `{ value, label }` y el resultado
// (undefined) sólo se usaba en una línea comentada, así que no tiene efecto observable.
interface EventOption {
    value: string
    label: string
    id?: string
    name?: string
}

const MAX_MINUTES = 60 * 24 * 30

function defaultTimer(): ShowTimer {
    return { type: "counter", name: "", start: 300, end: 0, event: "", time: "12:00" }
}

function getMinutes(number: number) {
    return Math.floor(number / 60)
}

function getSeconds(number: number) {
    return number - getMinutes(number) * 60
}

export function Timer() {
    const eventsValue = useStore(events)
    const [currentTimer, setCurrentTimer] = useState(() => getSelected("timer", 0) as { id?: string } | null)
    const [timer, setTimer] = useState<ShowTimer>(() => (currentTimer?.id ? (getTimer(currentTimer) as ShowTimer) : defaultTimer()))
    const [chosenType, setChosenType] = useState("")
    const [created, setCreated] = useState(false)
    const [today, setToday] = useState(() => new Date())
    const [eventList, setEventList] = useState<EventOption[]>([])
    const [warningMenuOpened, setWarningMenuOpened] = useState(false)
    const [overflowMenuOpened, setOverflowMenuOpened] = useState(false)
    const [showMore, setShowMore] = useState(false)
    const timeInput = useRef<HTMLInputElement>(null)

    const timerTypes = [
        { id: "counter", name: translateText("timer.from_to"), translate: true, icon: "timer" },
        { id: "clock", name: translateText("timer.to_time"), translate: true, icon: "clock" },
        { id: "event", name: translateText("timer.to_event"), translate: true, icon: "calendar" }
    ]

    useEffect(() => {
        if (currentTimer?.id) deselect()
    }, [])

    useEffect(() => {
        const interval = setInterval(() => setToday(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const list: EventOption[] = []
        Object.entries(get(events)).forEach(([id, event]) => {
            if (new Date(event.from).getTime() > today.getTime()) list.push({ value: id, label: `${getDateString(new Date(event.from))}: ${event.name}` })
        })
        // El sort del Svelte hacía `new Date(obj)`: fecha inválida, comparador siempre 1 (invierte el orden). Se conserva tal cual.
        list.sort((a, b) => (new Date(a as unknown as string).getTime() > new Date(b as unknown as string).getTime() ? -1 : 1))
        setEventList(list)
        setTimer((prev) => (prev.event ? prev : { ...prev, event: list[0]?.value || "" }))
    }, [])

    const fromTime = secondsToTime(timer.start === undefined ? 300 : timer.start)
    const toTime = secondsToTime(timer.end === undefined ? 0 : timer.end)

    const effectiveTime = timer.time || "12:00"
    const todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), effectiveTime].join(" "))
    const timeCountdown = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
    const timeCountdownTime = secondsToTime(timeCountdown)

    const eventTime = timer.event && eventList.length && eventsValue[timer.event] ? new Date(eventsValue[timer.event].from) : null
    const eventCountdown = eventTime ? secondsToTime(eventTime.getTime() > today.getTime() ? (eventTime.getTime() - today.getTime()) / 1000 : 0) : { m: "00", s: "00" }

    const dynamicStart = getTimerDynamicValue(timer.startDynamic)
    const dynamicEnd = getTimerDynamicValue(timer.endDynamic)

    function updateTime(e: Event) {
        const value = (e.target as HTMLInputElement | null)?.value
        setTimer((prev) => ({ ...prev, time: value }))
    }

    useEffect(() => {
        const el = timeInput.current
        if (!el) return
        el.addEventListener("change", updateTime)
        return () => el.removeEventListener("change", updateTime)
    }, [timer.type])

    function updateEvent(id: string | null) {
        setTimer((prev) => ({ ...prev, event: id || "" }))
    }

    function changeName(value: string | null) {
        let newName = value || ""
        if (!newName) {
            setTimer((prev) => ({ ...prev, name: "" }))
            return
        }

        let count = 1
        while (Object.values(get(timers)).find((a) => a.name === newName + (count > 1 ? ` ${count}` : ""))) {
            count++
        }
        newName = newName + (count > 1 ? ` ${count}` : "")

        setTimer((prev) => ({ ...prev, name: newName }))
    }

    function getNewTimer(): ShowTimer {
        const newTimer: ShowTimer = { name: timer.name, type: timer.type }

        if (timer.id) newTimer.id = timer.id
        if (timer.tags) newTimer.tags = timer.tags
        if (timer.type === "event") newTimer.event = timer.event
        else if (timer.type === "clock") newTimer.time = timer.time || "12:00"
        else {
            newTimer.start = timer.start === undefined ? 300 : Number(timer.start)
            newTimer.end = timer.end === undefined ? 0 : Number(timer.end)

            if (timer.startDynamic) newTimer.startDynamic = timer.startDynamic
            if (timer.endDynamic) newTimer.endDynamic = timer.endDynamic
        }

        if (timer.warn) {
            newTimer.warn = true
            newTimer.warnOffset = timer.warnOffset || 30
            newTimer.warnColor = timer.warnColor || "#FF8000"
            newTimer.warnFlash = !!timer.warnFlash
        }
        if (timer.overflow) {
            newTimer.overflow = true
            newTimer.overflowColor = timer.overflowColor || "#FF4136"
        }

        return newTimer
    }

    function updateTimer() {
        let id = currentTimer?.id

        const doesNotExist = !id
        if (doesNotExist) {
            id = uid()
            setCreated(true)

            if (get(drawerTabsData).functions?.activeSubTab === "timer" && get(drawerTabsData).functions?.activeSubmenu) {
                setTimer((prev) => ({ ...prev, tags: [get(drawerTabsData).functions!.activeSubmenu!] }))
            }
        }

        const timerId = id!
        timers.update((a) => {
            a[timerId] = getNewTimer()
            return a
        })

        if (doesNotExist) setCurrentTimer({ id: timerId })
    }

    // `$: if (timer && ((!created && currentTimer?.id) || chosenType)) updateTimer()`
    useEffect(() => {
        if (!timer || (!(!created && currentTimer?.id) && !chosenType)) return
        updateTimer()
    }, [timer, currentTimer, created, chosenType])

    function updateTimerValue(key: keyof ShowTimer, value: unknown) {
        setTimer((prev) => ({ ...prev, [key]: value }) as ShowTimer)

        if (key === "warn") setWarningMenuOpened(!!value)
        else if (key === "overflow") setOverflowMenuOpened(!!value)
    }

    if (!currentTimer?.id || created) {
        if (!chosenType) {
            return <ChoiceGrid options={timerTypes} onClick={(id) => (setChosenType(id), setTimer((prev) => ({ ...prev, type: id as ShowTimer["type"] })))} />
        }
    }

    const counterBox = (from: boolean) => {
        const value = from ? timer.start : timer.end
        const time = from ? fromTime : toTime
        const dynamic = from ? dynamicStart : dynamicEnd
        const key = from ? "start" : "end"
        return (
            <div className={styles.timerbox}>
                <p className={styles.part}>
                    <T id={from ? "timer.from" : "timer.to"} />

                    {Number(time.h) > 0 || Number(time.d) > 0 ? (
                        <span style={{ fontWeight: "normal", opacity: 0.6, fontSize: "0.9em" }}>
                            {Number(time.d) ? `${time.d},` : ""}
                            {Number(time.h) ? `${time.h}:` : ""}
                            {time.m}:{time.s}
                        </span>
                    ) : null}
                </p>

                <div>
                    {dynamic !== null ? (
                        <p style={{ fontSize: "2.8em", fontWeight: "bold" }}>{dynamic}</p>
                    ) : (
                        <>
                            <NumberField label="timer.minutes" value={value === undefined ? 5 : getMinutes(value)} padLength={2} max={MAX_MINUTES} onChange={(minutes) => setTimer((prev) => ({ ...prev, [key]: getSeconds(prev[key] || 0) + Number(minutes) * 60 }))} />
                            <span style={{ padding: "0 10px", fontSize: "3em", fontWeight: "bold", lineHeight: 1.7 }}>:</span>
                            <NumberField label="timer.seconds" value={value === undefined ? 0 : getSeconds(value)} padLength={2} max={59} onChange={(seconds) => setTimer((prev) => ({ ...prev, [key]: getMinutes(prev[key] ?? 300) * 60 + Number(seconds) }))} />
                        </>
                    )}
                </div>

                {showMore ? (
                    <div style={{ paddingTop: 0 }}>
                        <TextField label="actions.dynamic_value (s)" value={timer[key === "start" ? "startDynamic" : "endDynamic"] || ""} placeholder={from ? `{$min} * 60` : ""} defaultValue="" style={{ flex: 1 }} onChange={(next) => setTimer((prev) => ({ ...prev, [key === "start" ? "startDynamic" : "endDynamic"]: next || "" }))} />
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <>
            {created ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setChosenType("")} /> : null}

            <TextField label="inputs.name" value={timer.name} onChange={changeName} autoselect={created} />

            {timer.type === "counter" ? (
                <>
                    <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

                    <div style={{ display: "flex", gap: "5px", margin: "20px 0" }}>
                        {counterBox(true)}
                        {counterBox(false)}
                    </div>
                </>
            ) : timer.type === "clock" ? (
                <div className={styles.timerbox} style={{ width: "100%", margin: "20px 0" }}>
                    <p className={styles.part}>
                        <T id="timer.clock" />

                        {Number(timeCountdownTime.m) > 0 || Number(timeCountdownTime.s) > 0 ? (
                            <span style={{ fontWeight: "normal", opacity: 0.6, fontSize: "0.9em" }}>
                                {Number(timeCountdownTime.d) ? `${timeCountdownTime.d},` : ""}
                                {Number(timeCountdownTime.h) ? `${timeCountdownTime.h}:` : ""}
                                {timeCountdownTime.m}:{timeCountdownTime.s}
                            </span>
                        ) : null}
                    </p>

                    <div>
                        <input ref={timeInput} className={styles.timeInput} type="time" step="2" value={effectiveTime} />
                    </div>
                </div>
            ) : timer.type === "event" ? (
                <div className={styles.timerbox} style={{ width: "100%", margin: "20px 0", overflow: "visible" }}>
                    <p style={{ border: "none", minHeight: "unset", borderRadius: "8px" }} className={styles.part}>
                        <T id="timer.to_event" />

                        {Number(eventCountdown.m) > 0 || Number(eventCountdown.s) > 0 ? (
                            <span style={{ border: "none", minWidth: "unset", flex: 0, fontWeight: "normal", display: "flex", alignItems: "center", padding: "0px 10px", opacity: 0.6, fontSize: "0.9em" }}>
                                {Number((eventCountdown as { d?: string }).d) ? `${(eventCountdown as { d?: string }).d},` : ""}
                                {Number((eventCountdown as { h?: string }).h) ? `${(eventCountdown as { h?: string }).h}:` : ""}
                                {eventCountdown.m}:{eventCountdown.s}
                            </span>
                        ) : null}
                    </p>

                    {eventList.length ? (
                        <div>
                            <SelectField label="timer.event" style={{ width: "100%" }} options={eventList} value={timer.event || ""} onChange={updateEvent} />
                        </div>
                    ) : (
                        <div style={{ padding: "10px", display: "flex", alignItems: "center", opacity: 0.5 }}>
                            <T id="timer.no_events" />
                        </div>
                    )}
                </div>
            ) : null}

            <InputRow
                arrow={timer.warn}
                open={warningMenuOpened}
                onOpenChange={setWarningMenuOpened}
                menu={
                    <>
                        <NumberField label="timer.warn_offset" value={timer.warnOffset || 30} min={1} defaultValue={30} max={Math.abs((timer.start ?? 300) - (timer.end || 0))} onChange={(value) => updateTimerValue("warnOffset", value)} />
                        <ColorField label="edit.color" value={timer.warnColor || "#FF8000"} defaultValue="#FF8000" onInput={(value) => updateTimerValue("warnColor", value)} />
                        <ToggleField label="timer.flash" checked={timer.warnFlash} defaultValue={false} onChange={(value) => updateTimerValue("warnFlash", value)} />
                    </>
                }
            >
                <ToggleField label="timer.warn_early" style={{ width: "100%" }} checked={timer.warn} defaultValue={false} onChange={(value) => updateTimerValue("warn", value)} />
            </InputRow>

            <InputRow
                arrow={timer.overflow}
                open={overflowMenuOpened}
                onOpenChange={setOverflowMenuOpened}
                menu={
                    <>
                        <ColorField label="edit.color" value={timer.overflowColor || "#FF4136"} defaultValue="#FF4136" onInput={(value) => updateTimerValue("overflowColor", value)} />
                    </>
                }
            >
                <ToggleField label="timer.overflow" style={{ width: "100%" }} checked={timer.overflow} defaultValue={false} onChange={(value) => updateTimerValue("overflow", value)} />
            </InputRow>
        </>
    )
}
