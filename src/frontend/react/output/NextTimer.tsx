import { useEffect, useRef, useState } from "react"
import type { Output } from "../../../types/Output"
import { slideTimers } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAllActiveOutputIds } from "../../shared/utils/helpers/output"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Slider } from "../ui/slider/Slider"
import styles from "./NextTimer.module.css"

export interface NextTimerTimer {
    time: number
    paused?: boolean
    max?: number
    timer: { pause: () => void; resume: () => void }
}

export interface NextTimerProps {
    currentOutput: Output
    timer: NextTimerTimer
}

// Port de components/output/tools/NextTimer.svelte (F24.20b). `timer` sigue siendo el objeto del store:
// como en el Svelte, se muta en el lugar y los timers de todas las salidas activas se pausan/reanudan juntos.
export function NextTimer({ currentOutput, timer }: NextTimerProps) {
    const currentSlideTimers = useStore(slideTimers)
    const [step, setStep] = useState(false)
    const [displayTime, setDisplayTime] = useState(timer.time)
    const autoPause = useRef(false)
    const timersRef = useRef(currentSlideTimers)
    timersRef.current = currentSlideTimers

    useEffect(() => {
        setDisplayTime(timer.time)
    }, [timer.time])

    function updateTime(time: number, slideTimer: NextTimerTimer) {
        if (!slideTimer.paused) {
            autoPause.current = true
            slideTimer.timer.pause()
        }
        slideTimer.time = time
    }

    function transitionChange(value: number) {
        setStep(true)
        getAllActiveOutputIds().forEach((id) => {
            const slideTimer = timersRef.current[id]
            if (slideTimer) updateTime(value, slideTimer)
        })
    }

    function mouseup() {
        setStep(false)

        if (autoPause.current) {
            getAllActiveOutputIds().forEach((id) => {
                const slideTimer = timersRef.current[id]
                if (slideTimer) slideTimer.timer.resume()
            })

            autoPause.current = false
        }
    }

    useEffect(() => {
        window.addEventListener("mouseup", mouseup)
        return () => window.removeEventListener("mouseup", mouseup)
    }, [])

    function playPause(isPaused: boolean) {
        getAllActiveOutputIds().forEach((id) => {
            const slideTimer = timersRef.current[id]
            if (slideTimer) {
                if (isPaused) slideTimer.timer.resume()
                else slideTimer.timer.pause()
            }
        })
    }

    function round(value: number, stepValue = 1) {
        const inv = 1 / stepValue
        return Math.floor(value * inv) / inv
    }

    function sliderValue(event: { currentTarget: { value: string } }) {
        const value = Number(event.currentTarget.value)
        if (!Number.isNaN(value)) {
            setDisplayTime(value)
            transitionChange(value)
        }
    }

    if (!timer.timer || !timer.max) return null

    return (
        <span className={styles.group}>
            <Button style={{ flex: 0 }} title={translateText(timer.paused ? "media.play" : "media.pause")} onClick={() => playPause(!!timer.paused)}>
                <Icon id={timer.paused ? "play" : "pause"} size={1.2} white={timer.paused} />
            </Button>
            <span className={styles.time}>{round(displayTime)}</span>
            <Slider style={{ flex: 1 }} value={displayTime} step={step ? 1 : 0.01} max={timer.max} onInput={sliderValue} onMouseDown={sliderValue} />
            <span className={styles.duration}>{round(currentOutput?.out?.transition?.duration || 0)}</span>
        </span>
    )
}
