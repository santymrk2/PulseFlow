import { useEffect, useRef, useState } from "react"
import type { Output } from "../../../types/Output"
import type { MediaType, ShowType } from "../../../types/Show"
import { activeFocus, activeShow, focusMode, outLocked, playerVideos } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getExtension, getMediaType } from "../../shared/utils/helpers/media"
import { splitPath } from "../../shared/utils/helpers/get"
import { VideoPlayer, type PlayingVideoState } from "../media/logic/video/videoPlayer"
import { videoSync } from "../media/logic/video/videoSync"
import { clearBackground } from "./logic/clear"
import { Icon } from "../../shared/ui/helpers/Icon"
import { triggerClickOnEnterSpace } from "../../shared/ui/helpers/triggerClickOnEnterSpace"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { VideoSlider, type VideoControlData } from "./VideoSlider"
import styles from "./MediaControls.module.css"

export interface MediaControlsProps {
    currentOutput: Output | null
    outputId: string
    big?: boolean
    // barra de transporte del panel de salida: nombre, play/pausa, stop, línea de tiempo, loop y mute
    transport?: boolean
}

// Port de components/output/tools/MediaControls.svelte (F24.20b).
export function MediaControls({ currentOutput, outputId, big = false, transport = false }: MediaControlsProps) {
    const currentOutLocked = useStore(outLocked)
    const currentPlayerVideos = useStore(playerVideos)
    const currentFocusMode = useStore(focusMode)

    const [videoData, setVideoData] = useState<VideoControlData>({ duration: 0, paused: true, loop: false, muted: false })
    const [videoTime, setVideoTime] = useState(0)
    const [changeValue, setChangeValue] = useState(0)
    const unsubscriber = useRef<(() => void) | null>(null)

    const background = currentOutput?.out?.background
    const path = background?.path || background?.id
    const type: MediaType | "player" | "image" = background?.type || (path ? (getMediaType(getExtension(path)) as MediaType) : "image")

    // reset
    useEffect(() => {
        if (path) setVideoTime(0)
    }, [path])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (unsubscriber.current) {
                unsubscriber.current()
                unsubscriber.current = null
            }

            if (!path || (type !== "video" && type !== "player")) return

            const unsubscribe = videoSync(path, outputId, (data: PlayingVideoState) => {
                setVideoTime(data.currentTime || 0)
                setVideoData((prev) => ({
                    ...prev,
                    duration: data.duration && Number.isFinite(data.duration) ? data.duration : prev.duration,
                    paused: data.paused,
                    loop: data.loop,
                    muted: data.muted
                }))
            })
            unsubscriber.current = unsubscribe
        })

        return () => {
            clearTimeout(timer)
            if (unsubscriber.current) {
                unsubscriber.current()
                unsubscriber.current = null
            }
        }
    }, [path, outputId, type])

    const outName = path && path.includes(".") && !path.includes("base64") ? splitPath(path).name : ""
    const mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : background?.name || ""

    function toggleMute() {
        if (!path) return

        setVideoData((prev) => ({ ...prev, muted: !prev.muted }))
        VideoPlayer.toggleMute(path, outputId)
    }

    function toggleLoop() {
        if (!path) return

        setVideoData((prev) => ({ ...prev, loop: !prev.loop }))
        VideoPlayer.toggleLoop(path, outputId)
    }

    function openPreview() {
        if (!background || !path) return

        if (currentFocusMode) activeFocus.set({ id: path, type: type as ShowType })
        else activeShow.set({ id: path, type: type as ShowType })
    }

    function playPause() {
        if (!path) return

        const isPaused = videoData.paused
        setVideoData((prev) => ({ ...prev, paused: !isPaused }))

        if (isPaused) VideoPlayer.play(path, outputId)
        else VideoPlayer.pause(path, outputId)
    }

    if (!background) return null

    if (transport) {
        if (type === "video" || type === "player") {
            return (
                <div className={styles.transport}>
                    <span className={styles.name} style={{ fontSize: "0.9em" }} role="button" tabIndex={0} onClick={openPreview} onKeyDown={triggerClickOnEnterSpace}>
                        <p>{type === "player" ? currentPlayerVideos[background?.id || ""]?.name || "—" : mediaName || "—"}</p>
                    </span>
                    <span className={styles.group}>
                        <Button title={translateText(videoData.paused ? "media.play" : "media.pause")} disabled={currentOutLocked} onClick={playPause}>
                            <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
                        </Button>
                        <Button title={translateText("media.stop")} disabled={currentOutLocked} onClick={() => clearBackground()}>
                            <Icon id="stop" white size={1.2} />
                        </Button>

                        <VideoSlider outputId={outputId} path={path} disabled={currentOutLocked} videoData={videoData} videoTime={videoTime} changeValue={changeValue} onVideoDataChange={setVideoData} onVideoTimeChange={setVideoTime} onChangeValueChange={setChangeValue} />

                        <Button title={translateText("media._loop" + (videoData.loop ? ": settings.enabled" : ""))} onClick={toggleLoop}>
                            <Icon id="loop" white={!videoData.loop} size={1.2} />
                        </Button>
                        <Button title={translateText(videoData.muted === false ? "actions.mute" : "actions.unmute")} disabled={currentOutLocked} onClick={toggleMute}>
                            <Icon id={videoData.muted === false ? "volume" : "muted"} white={videoData.muted !== false} size={1.2} />
                        </Button>
                    </span>
                </div>
            )
        }
        return null
    }

    if (big) {
        if (type === "video" || background?.type === "player") {
            return (
                <FloatingBar side="center" style={{ width: "80%" }}>
                    <Button title={translateText(videoData.paused ? "media.play" : "media.pause")} disabled={currentOutLocked} onClick={playPause}>
                        <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.5} />
                    </Button>

                    <div className="divider" />

                    <VideoSlider outputId={outputId} path={path} disabled={currentOutLocked} videoData={videoData} videoTime={videoTime} changeValue={changeValue} onVideoDataChange={setVideoData} onVideoTimeChange={setVideoTime} onChangeValueChange={setChangeValue} big />

                    <div className="divider" />

                    <Button title="media.back10" onClick={() => setChangeValue(Math.max(videoTime - 10, 0.01))}>
                        <Icon id="back_10" white size={1.3} />
                    </Button>
                    <Button title="media.forward10" onClick={() => setChangeValue(Math.min(videoTime + 10, videoData.duration - 0.1))}>
                        <Icon id="forward_10" white size={1.3} />
                    </Button>

                    <div className="divider" />

                    <Button title={translateText("media._loop" + (videoData.loop !== false ? ": settings.enabled" : ""))} onClick={toggleLoop}>
                        <Icon id="loop" white={!videoData.loop} size={1.3} />
                    </Button>

                    <Button title={translateText(videoData.muted === false ? "actions.mute" : "actions.unmute")} disabled={currentOutLocked} onClick={toggleMute}>
                        <Icon id={videoData.muted === false ? "volume" : "muted"} white={videoData.muted !== false} size={1.3} />
                    </Button>
                </FloatingBar>
            )
        }
        return null
    }

    return (
        <>
            <span className={styles.name} style={{ fontSize: "0.9em" }} role="button" tabIndex={0} onClick={openPreview} onKeyDown={triggerClickOnEnterSpace}>
                {background?.type === "player" ? <p>{currentPlayerVideos[background?.id || ""]?.name || "—"}</p> : <p>{mediaName || "—"}</p>}
            </span>

            {type === "video" || background?.type === "player" ? (
                <span className={styles.group}>
                    <Button title={translateText(videoData.paused ? "media.play" : "media.pause")} disabled={currentOutLocked} onClick={playPause}>
                        <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
                    </Button>

                    <VideoSlider outputId={outputId} path={path} disabled={currentOutLocked} videoData={videoData} videoTime={videoTime} changeValue={changeValue} onVideoDataChange={setVideoData} onVideoTimeChange={setVideoTime} onChangeValueChange={setChangeValue} />

                    <Button title={translateText("media.forward10")} onClick={() => setChangeValue(Math.min(videoTime + 10, videoData.duration - 0.1))}>
                        <Icon id="forward_10" white size={1.2} />
                    </Button>
                    <Button title={translateText("media._loop" + (videoData.loop ? ": settings.enabled" : ""))} onClick={toggleLoop}>
                        <Icon id="loop" white={!videoData.loop} size={1.2} />
                    </Button>
                    <Button title={translateText(videoData.muted === false ? "actions.mute" : "actions.unmute")} disabled={currentOutLocked} onClick={toggleMute}>
                        <Icon id={videoData.muted === false ? "volume" : "muted"} white={videoData.muted !== false} size={1.2} />
                    </Button>
                </span>
            ) : null}
        </>
    )
}
