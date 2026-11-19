import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { cn } from "../../shared/core/lib/utils"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import { joinTime, secondsToTime } from "../../shared/utils/helpers/time"
import { VideoPlayer } from "../../components/media/video/videoPlayer"
import { Slider } from "../ui/slider/Slider"
import styles from "./VideoSlider.module.css"

export interface VideoControlData {
    duration: number
    paused: boolean
    loop: boolean
    muted: boolean
    softLoop?: number
}

export interface VideoSliderProps {
    outputId?: string
    path?: string
    videoData: VideoControlData
    videoTime: number
    big?: boolean
    disabled?: boolean
    changeValue?: number
    // Equivalentes de los `bind:` del componente Svelte.
    onVideoDataChange?: (data: VideoControlData) => void
    onVideoTimeChange?: (time: number) => void
    onChangeValueChange?: (value: number) => void
}

function getNumericValue(value: unknown): number | null {
    if (typeof value === "number") return Number.isNaN(value) ? null : value
    if (typeof value === "string") {
        const num = Number(value)
        return Number.isNaN(num) ? null : num
    }
    if (value && typeof value === "object") {
        if ("target" in value) {
            const target = value.target
            if (target && typeof target === "object" && "value" in target) {
                const num = Number(target.value)
                return Number.isNaN(num) ? null : num
            }
        }
        if ("detail" in value) return getNumericValue(value.detail)
    }
    return null
}

// Port de components/output/VideoSlider.svelte (F24.20b). Mantiene la lógica de seek/pausa durante el arrastre.
export function VideoSlider({ outputId, path, videoData, videoTime, big = false, disabled = false, changeValue = 0, onVideoDataChange, onVideoTimeChange, onChangeValueChange }: VideoSliderProps) {
    const [data, setData] = useState<VideoControlData>(videoData)
    const [time, setTimeState] = useState(videoTime)
    const [sliderValue, setSliderValue] = useState(0)
    const [hover, setHover] = useState(false)
    const [hoverTime, setHoverTime] = useState("00:00")
    const [fullLength, setFullLength] = useState(false)

    const dataRef = useRef(data)
    const timeRef = useRef(time)
    const sliderRef = useRef(sliderValue)
    const latestValue = useRef<number | null>(null)
    const dragSeekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSeekedValue = useRef<number | null>(null)
    const movePause = useRef(false)
    const wasPausedBeforeMove = useRef(false)
    dataRef.current = data
    timeRef.current = time
    sliderRef.current = sliderValue

    function updateVideoData(patch: Partial<VideoControlData>) {
        const next = { ...dataRef.current, ...patch }
        dataRef.current = next
        setData(next)
        onVideoDataChange?.(next)
    }

    function updateVideoTime(value: number) {
        timeRef.current = value
        setTimeState(value)
        onVideoTimeChange?.(value)
    }

    useEffect(() => {
        dataRef.current = videoData
        setData(videoData)
    }, [videoData])

    useEffect(() => {
        timeRef.current = videoTime
        setTimeState(videoTime)
        if (!movePause.current) setSliderValue(videoTime)
    }, [videoTime])

    useEffect(() => {
        if (changeValue) {
            finishDrag(changeValue)
            onChangeValueChange?.(0)
        }
        // `finishDrag` se redefine en cada render; el efecto reacciona sólo al valor pedido por el padre.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changeValue])

    useEffect(() => () => {
        if (dragSeekTimeout.current) clearTimeout(dragSeekTimeout.current)
    }, [])

    function move(event: MouseEvent<HTMLInputElement>) {
        const padding = 3.5
        const width = event.currentTarget.offsetWidth - padding * 2
        const offset = event.nativeEvent.offsetX - padding
        let percentage = offset / width

        if (percentage < 0) percentage = 0
        else if (percentage > 1) percentage = 1

        const dur = Number.isFinite(dataRef.current?.duration) && dataRef.current.duration > 0 ? dataRef.current.duration : 0
        setHoverTime(joinTime(secondsToTime(dur * percentage)))
    }

    function onInput(event: FormEvent<HTMLInputElement>) {
        const val = getNumericValue(event.currentTarget.value) ?? latestValue.current
        if (val === null) return
        latestValue.current = val
        sliderRef.current = val
        setSliderValue(val)

        if (!dragSeekTimeout.current) {
            dragSeekTimeout.current = setTimeout(() => {
                dragSeekTimeout.current = null
                if (movePause.current && sliderRef.current !== null) {
                    updateVideoTime(sliderRef.current)
                    lastSeekedValue.current = timeRef.current
                    if (path && outputId) VideoPlayer.seekTo(path, outputId, timeRef.current)
                }
            }, 150)
        }
    }

    function finishDrag(value: unknown = null) {
        if (dragSeekTimeout.current) {
            clearTimeout(dragSeekTimeout.current)
            dragSeekTimeout.current = null
        }

        const wasDragging = movePause.current
        if (movePause.current) pauseAtMove(false)

        const val = getNumericValue(value) ?? sliderRef.current ?? latestValue.current
        if (val !== null) {
            latestValue.current = val
            sliderRef.current = val
            setSliderValue(val)
            updateVideoTime(val)
            if (path && outputId && (wasDragging || lastSeekedValue.current !== val)) {
                lastSeekedValue.current = val
                VideoPlayer.seekTo(path, outputId, timeRef.current)
            }
        }
    }

    function pauseAtMove(boolean = true) {
        if (!path) return

        if (boolean) {
            wasPausedBeforeMove.current = !!dataRef.current.paused
            movePause.current = true
            updateVideoData({ paused: true })
            if (outputId) VideoPlayer.pause(path, outputId)
        } else {
            movePause.current = false
            updateVideoData({ paused: wasPausedBeforeMove.current })
            if (outputId && !wasPausedBeforeMove.current) VideoPlayer.play(path, outputId)
        }
    }

    useEffect(() => {
        function mouseup() {
            if (movePause.current) finishDrag()
        }
        window.addEventListener("mouseup", mouseup)
        return () => window.removeEventListener("mouseup", mouseup)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const validDuration = Number.isFinite(data?.duration) && data.duration > 0 ? data.duration : 0
    const validTime = Number.isFinite(time) && time > 0 ? time : 0
    const displayTime = Math.max(0, validDuration ? Math.min(validTime, validDuration) : validTime)
    const remainingTime = Math.max(0, validDuration - Math.floor(displayTime))

    return (
        <div className={cn(styles.main, big && styles.big)}>
            {hover ? <span>{hoverTime}</span> : <span className={styles.muted}>{joinTime(secondsToTime(Math.floor(displayTime)))}</span>}
            <div className={styles.slider}>
                <Slider
                    disabled={disabled}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    value={sliderValue}
                    step={1}
                    max={validDuration}
                    onMouseDown={() => pauseAtMove(true)}
                    onMouseMove={move}
                    onChange={(event) => {
                        const target = event.target
                        if (target instanceof HTMLInputElement) finishDrag(target.value)
                        else finishDrag()
                    }}
                    onInput={onInput}
                />
            </div>
            <span className={cn(!fullLength && styles.muted)} onClick={() => setFullLength(!fullLength)} onKeyDown={triggerClickOnEnterSpace} role="button" tabIndex={0} aria-label="Toggle time display format">
                {fullLength ? joinTime(secondsToTime(validDuration)) : joinTime(secondsToTime(remainingTime))}
            </span>
        </div>
    )
}
