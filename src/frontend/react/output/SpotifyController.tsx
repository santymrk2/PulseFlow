import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { destroySpotifyManager, fadePause, initSpotifyManager, seekTo, skipNext, skipPrev, spotifyIsFading, spotifyState, togglePlay } from "../../components/output/preview/SpotifyManager"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./SpotifyController.module.css"

function formatTime(seconds: number) {
    if (!seconds || Number.isNaN(seconds)) return "0:00"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
}

// Port de components/output/preview/SpotifyController.svelte (F24.20b).
export function SpotifyController() {
    const currentState = useStore(spotifyState)
    const currentIsFading = useStore(spotifyIsFading)

    const [isHovering, setIsHovering] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragPercentage, setDragPercentage] = useState(0)

    const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const barEl = useRef<HTMLDivElement | null>(null)
    const prev = useRef({ isPlaying: false, isFading: false, isFirstRun: true })

    useEffect(() => {
        initSpotifyManager()
        return () => {
            destroySpotifyManager()
            if (pauseTimer.current) clearTimeout(pauseTimer.current)
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
        }
    }, [])

    useEffect(() => {
        const nextPlaying = !!currentState?.isPlaying
        const nextFading = currentIsFading
        const { isPlaying, isFading, isFirstRun } = prev.current

        if (nextPlaying || nextFading) {
            if (pauseTimer.current) clearTimeout(pauseTimer.current)
            pauseTimer.current = null
            setIsMinimized(false)
        } else if (currentState) {
            if (isFirstRun || isFading) {
                if (pauseTimer.current) clearTimeout(pauseTimer.current)
                pauseTimer.current = null
                setIsMinimized(true)
            } else if (isPlaying && !pauseTimer.current) {
                pauseTimer.current = setTimeout(() => {
                    setIsMinimized(true)
                    pauseTimer.current = null
                }, 1500)
            }
        } else if (!currentState) {
            if (pauseTimer.current) clearTimeout(pauseTimer.current)
            pauseTimer.current = null
            setIsMinimized(false)
        }

        prev.current = { isPlaying: nextPlaying, isFading: nextFading, isFirstRun: currentState ? false : isFirstRun }
    }, [currentState, currentIsFading])

    function openSpotify() {
        sendMain(Main.URL, "spotify:")
    }

    function handleMouseEnter() {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        setIsHovering(true)
    }

    function handleMouseLeave() {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => {
            setIsHovering(false)
        }, 500) // Delay of 0.5 seconds before collapsing/hiding controls
    }

    // drag handlers with stable refs to current values
    const draggingRef = useRef(false)
    const dragPercentageRef = useRef(0)
    const stateRef = useRef(currentState)
    stateRef.current = currentState

    function getBarPercentageFromClientX(clientX: number) {
        if (!barEl.current) return 0
        const rect = barEl.current.getBoundingClientRect()
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }

    function onPointerMove(e: globalThis.PointerEvent) {
        if (!draggingRef.current) return
        const value = getBarPercentageFromClientX(e.clientX)
        dragPercentageRef.current = value
        setDragPercentage(value)
    }

    function onPointerUp() {
        if (!draggingRef.current) return
        draggingRef.current = false
        setIsDragging(false)
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        const state = stateRef.current
        if (state) seekTo(dragPercentageRef.current * state.durationSec)
    }

    function handleBarPointerDown(e: PointerEvent<HTMLDivElement>) {
        if (currentIsFading) return
        draggingRef.current = true
        const value = getBarPercentageFromClientX(e.clientX)
        dragPercentageRef.current = value
        setDragPercentage(value)
        setIsDragging(true)
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
    }

    function handleSeek(e: MouseEvent<HTMLDivElement>) {
        if (currentIsFading || !barEl.current) return
        const rect = barEl.current.getBoundingClientRect()
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        if (currentState) seekTo(percentage * currentState.durationSec)
    }

    useEffect(() => {
        return () => {
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!currentState) return null

    const displayPosition = isDragging ? dragPercentage * currentState.durationSec : currentState.positionSec
    const fillWidth = isDragging ? Math.min(dragPercentage * 100, 100) : Math.min((currentState.positionSec / Math.max(currentState.durationSec, 1)) * 100, 100)

    return (
        <div className={`${styles.spotifyController} ${currentIsFading ? styles.fading : ""} ${isMinimized && !isHovering ? styles.minimized : ""}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ ["--dynamic-bg" as string]: currentState.bgColor || "transparent" }}>
            <div className={styles.header} onClick={openSpotify}>
                {currentState.albumArt ? <img className={styles.albumArt} src={currentState.albumArt} alt="Album Art" draggable={false} /> : <Icon id="spotify" color="#1db954" size={1.2} box={50} white />}
                <div className={styles.info}>
                    <div className={styles.title}>{currentState.title || "Unknown Title"}</div>
                    <div className={styles.artist}>{currentState.artist || "Unknown Artist"}</div>
                </div>
            </div>

            <div className={styles.controls}>
                <Button onClick={skipPrev} title="media.previous" disabled={currentIsFading}>
                    <Icon id="previousFull" white />
                </Button>
                <Button onClick={togglePlay} title={currentState.isPlaying ? "media.pause" : "media.play"} className="play-btn" disabled={currentIsFading}>
                    <Icon id={currentState.isPlaying ? "pause" : "play"} white />
                </Button>
                <Button onClick={skipNext} title="media.next" disabled={currentIsFading}>
                    <Icon id="nextFull" white />
                </Button>
            </div>

            <div className={`${styles.progress} ${currentIsFading ? styles.disabled : ""}`}>
                <span className={styles.time}>{formatTime(displayPosition)}</span>
                <div className={styles.bar} ref={barEl} onPointerDown={handleBarPointerDown} onClick={handleSeek} style={{ touchAction: "none" }}>
                    {/* transition: {isDragging ? 'none' : 'width 0.1s linear'}; */}
                    <div className={styles.fill} style={{ width: `${fillWidth}%` }}></div>
                </div>
                <span className={styles.time}>{formatTime(currentState.durationSec)}</span>
            </div>

            {currentState.isPlaying ? (
                <div className={`${styles.fadeBtnWrap} ${isHovering || currentIsFading ? styles.showFade : ""}`}>
                    <Button variant="outline" onClick={fadePause} style={{ padding: "4px 8px", marginTop: "5px", background: "none" }} title="media.fade_out" disabled={currentIsFading}>
                        {/* <Icon id="volume_down" white /> */}
                        <Icon id="clear" white />
                        <p>
                            <T id="media.fade_out" />
                        </p>
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
