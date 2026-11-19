import { useEffect, useRef, useState, type FormEvent } from "react"
import { AudioAnalyser } from "../../shared/audio/audioAnalyser"
import { clearAudio } from "../../shared/audio/audioFading"
import { AudioPlayer } from "../../shared/audio/audioPlayer"
import { focusMode, media, outLocked, playingAudio } from "../../shared/core/stores"
import { triggerClickOnEnterSpace } from "../../shared/utils/clickable"
import { Icon } from "../../shared/ui/helpers/Icon"
import { joinTime, secondsToTime } from "../../shared/utils/helpers/time"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { Slider } from "../../shared/ui/kit/slider/Slider"
import styles from "./AudioPreview.module.css"

export interface AudioPreviewProps {
    active?: unknown
}

interface ActiveAudio {
    id?: string
    name?: string
    data?: { isMic?: boolean }
}

// (F24.20a).
export function AudioPreview({ active }: AudioPreviewProps) {
    const currentFocusMode = useStore(focusMode)
    const currentMedia = useStore(media)
    const currentOutLocked = useStore(outLocked)
    const currentPlayingAudio = useStore(playingAudio)
    const activeAudio = (active || {}) as ActiveAudio

    const path = activeAudio.id || ""
    const name = activeAudio.name || ""
    const isMic = activeAudio.data?.isMic
    const playing = currentPlayingAudio[path] || {}
    const paused = playing.paused !== false
    const loop = Boolean(currentMedia[path]?.loop)
    const volume = currentMedia[path]?.volume

    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [sliderValue, setSliderValue] = useState<number | null>(null)
    const [fullLength, setFullLength] = useState(false)
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const mediaElem = useRef<HTMLDivElement>(null)
    const previousPath = useRef("")
    const context = useRef<CanvasRenderingContext2D | null>(null)

    useEffect(() => {
        if (!path) return
        let cancelled = false
        setDuration(0)
        void AudioPlayer.getDuration(path).then((value: number) => {
            if (cancelled) return
            setDuration(value)
            setCurrentTime(playing.audio?.currentTime || 0)
        })
        return () => {
            cancelled = true
        }
        // `playing` se lee al ejecutarse, igual que en el statement reactivo de Svelte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path])

    useEffect(() => {
        if (paused || !path) return
        const interval = setInterval(() => {
            if (sliderValue === null) setCurrentTime(AudioPlayer.getTime(path))
        }, 200)
        return () => clearInterval(interval)
    }, [paused, path, sliderValue])

    useEffect(() => {
        if (path === previousPath.current) return
        if (previousPath.current) AudioAnalyser.releaseAnalyser(previousPath.current)
        previousPath.current = path
    }, [path])

    useEffect(() => {
        if (!canvas || !path || paused) return

        const currentPath = path
        let frame = 0
        let timeout = 0

        function stop() {
            if (frame) cancelAnimationFrame(frame)
            if (timeout) clearTimeout(timeout)
            frame = 0
            timeout = 0
            if (context.current && canvas) context.current.clearRect(0, 0, canvas.width, canvas.height)
        }

        function start() {
            const analysers = AudioAnalyser.getAnalysers(currentPath)
            if (!canvas) return
            if (!analysers.length) {
                timeout = window.setTimeout(start, 50)
                return
            }

            const width = mediaElem.current?.clientWidth || window.innerWidth
            const height = 80
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            context.current = ctx

            const bufferLength = analysers[0].frequencyBinCount
            const maxHeightValue = analysers[0].fftSize
            if (!bufferLength || !maxHeightValue) return

            const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))
            const padding = -0.5
            const barWidth = (width / bufferLength - padding) * 1.42

            function renderFrame() {
                if (!ctx) return
                if (currentPath !== previousPath.current || paused) {
                    stop()
                    return
                }

                frame = requestAnimationFrame(renderFrame)

                for (let i = 0; i < analysers.length; i++) {
                    analysers[i].getByteFrequencyData(dataArrays[i] as Uint8Array<ArrayBuffer>)
                }

                ctx.clearRect(0, 0, width, height)

                let x = 0

                for (let i = 0; i < bufferLength; i++) {
                    const sum = (dataArrays[0]?.[i] || 0) + (dataArrays[1]?.[i] || 0)
                    const percentage = Math.round(sum / (dataArrays.length || 1)) / maxHeightValue
                    const barHeight = height * percentage
                    const r = 255 * percentage

                    ctx.fillStyle = `rgb(${r}, 5, 150)`
                    ctx.fillRect(x, height - barHeight, barWidth, barHeight)

                    x += barWidth + padding
                }
            }

            renderFrame()
        }

        start()
        return stop
    }, [canvas, paused, path])

    useEffect(() => {
        return () => {
            if (previousPath.current) AudioAnalyser.releaseAnalyser(previousPath.current)
        }
    }, [])

    function setTime(value: number | string | null | undefined, newTime: number | null = null) {
        setSliderValue(null)
        const raw = newTime ?? value
        const time = typeof raw === "string" ? Number(raw) : raw
        if (time === null || time === undefined || Number.isNaN(time)) return
        if (!AudioPlayer.setTime(path, time)) setCurrentTime(time)
    }

    function handleSliderInput(event: FormEvent<HTMLInputElement>) {
        setSliderValue(Number(event.currentTarget.value))
    }

    function toggleLoop() {
        media.update((current) => {
            const entry = current[path] || {}
            entry.loop = !loop
            return { ...current, [path]: entry }
        })
    }

    const timeText = sliderValue !== null ? joinTime(secondsToTime(sliderValue)) : joinTime(secondsToTime(currentTime))
    const remainingText = !isMic && fullLength ? joinTime(secondsToTime(duration)) : joinTime(secondsToTime(duration - Math.floor(currentTime)))

    return (
        <>
            {!currentFocusMode ? <canvas ref={setCanvas} className={styles.canvas} /> : null}
            <div id={path} ref={mediaElem} className={`${styles.main} media context #audio_preview`}>
                <div className={styles.buttons}>
                    <Button
                        disabled={currentOutLocked || isMic}
                        title={paused ? "media.play" : "media.pause"}
                        onClick={() => {
                            if (currentOutLocked) return
                            AudioPlayer.start(path, { name }, { pauseIfPlaying: true, startAt: currentTime })
                        }}
                    >
                        <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
                    </Button>
                    <Button
                        disabled={!playing.audio}
                        title="media.stop"
                        onClick={() => {
                            clearAudio(path)
                            setCurrentTime(0)
                        }}
                    >
                        <Icon id="stop" white={paused} size={1.2} />
                    </Button>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, margin: "0 10px", fontSize: "1.1em" }}>
                        {sliderValue !== null ? <span>{timeText}</span> : <span style={{ color: "var(--secondary)" }}>{timeText}</span>}

                        <Slider disabled={isMic} value={currentTime} max={duration} onInput={handleSliderInput} onChange={(event) => setTime((event.target as HTMLInputElement).value)} />

                        <span className={styles.toggle} style={isMic ? { opacity: 0.5 } : fullLength || !currentTime ? undefined : { color: "var(--secondary)" }} role="button" tabIndex={0} onClick={() => setFullLength((value) => !value)} onKeyDown={(event) => triggerClickOnEnterSpace(event.nativeEvent)}>
                            {remainingText}
                        </span>
                    </div>

                    <Button title="media.back10" onClick={() => setTime(null, Math.max(currentTime - 10, 0.01))}>
                        <Icon id="back_10" white size={1.3} />
                    </Button>
                    <Button title="media.forward10" onClick={() => setTime(null, Math.min(currentTime + 10, duration - 0.1))}>
                        <Icon id="forward_10" white size={1.3} />
                    </Button>

                    {!isMic ? (
                        <Button title={"media._loop" + (loop ? ": settings.enabled" : "")} onClick={toggleLoop}>
                            <Icon id="loop" white={!loop} size={1.2} />
                        </Button>
                    ) : null}

                    {volume !== undefined && volume < 1 ? <p style={{ alignSelf: "center", textAlign: "center", minWidth: 50, padding: "0 5px", opacity: 0.7, fontSize: "0.9em" }}>{Math.floor((volume || 1) * 100)}%</p> : null}
                </div>
            </div>
        </>
    )
}
