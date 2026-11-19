import { useEffect, useState, type FormEvent } from "react"
import type { Timer } from "../../../../types/Show"
import { activePopup, activeProfile, activeTimerTagFilter, activeTimers, disableDragging, labelsDisabled, profiles, timers } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { clone, keysToID, sortByName } from "../../../components/helpers/array"
import { joinTime, secondsToTime } from "../../../components/helpers/time"
import { openDrawer } from "../../../components/edit/scripts/edit"
import { getCurrentTimerValue, getTimerDynamicValue, playPauseGlobal, resetTimer } from "../../../components/drawer/timers/timers"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Timer as TimerView } from "../../slide/views/Timer"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Slider } from "../../ui/slider/Slider"
import "./Timers.module.css"

// Port de components/drawer/timers/Timers.svelte: lista de temporizadores globales.
// `views/Timer` ya es React (port); el resto de la lógica usa los helpers de `timers.ts`.
export interface TimersProps {
    onlyPlaying?: boolean
}

interface TimerRef {
    id: string
    showId?: string
    slideId?: string
}

const TIMER_TYPE_NAMES: Record<string, string> = {
    counter: "timer.from_to",
    clock: "timer.to_time",
    event: "timer.to_event"
}

const TYPE_ORDER: Record<string, number> = { counter: 1, clock: 2, event: 3 }

export function Timers({ onlyPlaying = false }: TimersProps) {
    const timersValue = useStore(timers)
    const activeTimersValue = useStore(activeTimers)
    const tagFilter = useStore(activeTimerTagFilter)
    const labelsDisabledValue = useStore(labelsDisabled)
    const activeProfileValue = useStore(activeProfile)
    const profilesValue = useStore(profiles)

    const profile = (activeProfileValue ? profilesValue[activeProfileValue]?.access["timers"] || {} : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read"

    const today = useToday()
    useEffect(() => {
        const clear = () => disableDragging.set(false)
        window.addEventListener("mouseup", clear)
        return () => window.removeEventListener("mouseup", clear)
    }, [])

    // `list` (temporizadores en shows del proyecto) quedó sin llenar desde el original; el orden final es el mismo.
    const list: string[] = []
    const sortedTimers = sortByName(keysToID(clone(timersValue)) as unknown as TimerWithId[], "name", true)
        .filter((a) => (onlyPlaying ? a.type === "counter" && activeTimersValue.some((at) => a.id === at.id) : true))
        .sort((a, b) => (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0))
    const filteredTimersTags = sortedTimers.filter((a) => !tagFilter.length || (a.tags?.length && !tagFilter.find((tagId) => !a.tags?.includes(tagId)))).filter((a) => !a.tags?.some((tagId) => profile[tagId] === "none"))
    const filteredTimers = filteredTimersTags.sort((a, b) => (list.includes(a.id) && !list.includes(b.id) ? -1 : 1))

    function getCurrentValue(timer: TimerWithId, ref: TimerRef) {
        return getCurrentTimerValue(timer, ref, today)
    }

    function adjustTimer(delta: number, ref: TimerRef, minVal: number, maxVal: number) {
        activeTimers.update((a) => {
            const index = a.findIndex((t) => (ref.showId ? ref.showId === t.showId && ref.slideId === t.slideId && ref.id === t.id : t.id === ref.id))
            if (index < 0) return a
            const current = a[index].currentTime ?? minVal
            a[index].currentTime = Math.max(minVal, Math.min(maxVal, current + delta))
            delete a[index].startTime
            return a
        })
    }

    function updateActiveTimer(event: FormEvent<HTMLInputElement>, timer: TimerWithId) {
        const time = Number(event.currentTarget.value)
        const ref: TimerRef = { id: timer.id }
        activeTimers.update((a) => {
            const index = a.findIndex((current) => (ref.showId ? ref.showId === current.showId && ref.slideId === current.slideId && ref.id === current.id : current.id === ref.id))
            if (index < 0) a.push({ ...timer, ...ref, currentTime: time, paused: true })
            else {
                a[index].currentTime = time
                delete a[index].startTime
            }

            return a
        })
    }

    function openTimers() {
        if (onlyPlaying) openDrawer("timer")
    }

    return (
        <>
            {filteredTimers.length ? (
                <div className={`timers context #timers${readOnly ? "_readonly" : ""}`} style={onlyPlaying ? undefined : { paddingBottom: "60px" }}>
                    {filteredTimers.map((timer, i) => {
                        const isReadOnly = readOnly || timer.tags?.some((tagId) => profile[tagId] === "read")
                        const title = timer.type === filteredTimers[i - 1]?.type ? "" : timer.type
                        const isActive = activeTimersValue.find((a) => a.id === timer.id)
                        const isPlaying = timer.type !== "counter" || activeTimersValue.find((a) => a.id === timer.id && a.paused !== true)
                        const startTime = timer.startDynamic !== undefined ? (getTimerDynamicValue(timer.startDynamic) ?? 0) : timer.start || 0
                        const endTime = timer.endDynamic !== undefined ? (getTimerDynamicValue(timer.endDynamic) ?? 0) : timer.end || 0
                        const currentVal = getCurrentValue(timer, { id: timer.id })
                        const minVal = Math.min(startTime, endTime)
                        const maxVal = Math.max(startTime, endTime)
                        const delta = currentVal < 60 ? 10 : 60

                        return (
                            <div key={timer.id}>
                                {i === 0 && list.length ? (
                                    <h5>
                                        <T id="remote.project" />
                                    </h5>
                                ) : title && i > 0 ? (
                                    <h5>{translateText(TIMER_TYPE_NAMES[title])}</h5>
                                ) : null}

                                <SelectElem id="global_timer" data={timer as never} draggable={!onlyPlaying} selectable={!onlyPlaying}>
                                    <div className={`${onlyPlaying ? "" : `context #global_timer${isReadOnly ? "_readonly" : ""}`} ${!onlyPlaying && isActive ? "outline" : ""} ${list.includes(timer.id) ? "project" : ""}`} style={{ display: "flex", justifyContent: "space-between", padding: "3px" }}>
                                        <div style={{ display: "flex", ...(onlyPlaying ? {} : { width: "50%" }) }}>
                                            <Button align="start" disabled={isReadOnly || timer.type !== "counter"} onClick={() => playPauseGlobal(timer.id, timer)} title={translateText(isPlaying ? "media.pause" : "media.play")}>
                                                <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                                            </Button>
                                            {!onlyPlaying ? (
                                                <p style={{ alignSelf: "center", padding: "0 5px", ...(onlyPlaying ? {} : { minWidth: "100px" }) }} data-title={timer.name}>
                                                    {timer.name ? (
                                                        timer.name
                                                    ) : (
                                                        <span style={{ opacity: 0.5 }}>
                                                            <T id="main.unnamed" />
                                                        </span>
                                                    )}
                                                </p>
                                            ) : null}
                                        </div>

                                        {timer.type === "counter" ? <Slider disabled={isReadOnly} style={{ background: "var(--primary)", alignSelf: "center", margin: "0 10px" }} onInput={(event) => updateActiveTimer(event, timer)} onMouseDown={() => disableDragging.set(true)} value={currentVal} min={minVal} max={maxVal} invert={endTime < startTime} /> : null}

                                        <div style={{ display: "flex", justifyContent: "end", flexShrink: 0, ...(onlyPlaying ? {} : { minWidth: "220px" }) }}>
                                            <span style={{ display: "flex", alignSelf: "center", padding: "0 5px" }} role="none" onClick={openTimers}>
                                                <TimerView id={timer.id} today={today} />

                                                {timer.type === "counter" && endTime && endTime !== 0 ? (
                                                    <span className="end" style={{ opacity: 0.6, fontSize: "0.8em", alignSelf: "center", marginLeft: "5px" }}>
                                                        {joinTime(secondsToTime(endTime))}
                                                    </span>
                                                ) : null}
                                            </span>

                                            {timer.type === "counter" && isActive ? (
                                                <>
                                                    {!onlyPlaying ? (
                                                        <>
                                                            <Button align="start" disabled={isReadOnly || currentVal >= maxVal} onClick={() => adjustTimer(delta, { id: timer.id }, minVal, maxVal)} title={delta === 10 ? "-10 sec" : "-1 min"}>
                                                                {delta === 10 ? "-10s" : "-1m"}
                                                            </Button>
                                                            <Button align="start" disabled={isReadOnly || currentVal <= minVal} onClick={() => adjustTimer(-delta, { id: timer.id }, minVal, maxVal)} title={delta === 10 ? "+10 sec" : "+1 min"}>
                                                                {delta === 10 ? "+10s" : "+1m"}
                                                            </Button>
                                                        </>
                                                    ) : null}

                                                    <Button align="start" onClick={() => resetTimer(timer.id)} title={translateText("media.stop")} disabled={isReadOnly || !isActive}>
                                                        <Icon id="stop" white={!isPlaying} />
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </SelectElem>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <Center faded>
                    <T id="empty.timers" />
                </Center>
            )}

            {!onlyPlaying ? (
                <FloatingBar onlyOne>
                    <Button disabled={readOnly} icon="add" title="new.timer" onClick={() => activePopup.set("timer")}>
                        {!labelsDisabledValue ? <T id="new.timer" /> : null}
                    </Button>
                </FloatingBar>
            ) : null}
        </>
    )
}

interface TimerWithId extends Timer {
    id: string
}

function useToday() {
    const [today, setToday] = useState(() => new Date())
    useEffect(() => {
        const interval = setInterval(() => setToday(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])
    return today
}
