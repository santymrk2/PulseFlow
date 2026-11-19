import { useEffect, useRef, useState, type CSSProperties } from "react"
import { uid } from "uid"
import { Main } from "../../../types/IPC/Main"
import type { MediaStyle } from "../../../types/Main"
import type { ShowType } from "../../../types/Show"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { activeProject, activeRename, focusMode, media, outLocked, outputs, playingVideos, projects, videoMarkers } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { addVideoMarker, enableSubtitle, encodeFilePath, getExtension, getFileName, getMediaLayerType, removeExtension } from "../../components/helpers/media"
import { getFirstActiveOutput, setOutput } from "../../components/helpers/output"
import { joinTime, secondsToTime } from "../../components/helpers/time"
import { clearSlide } from "../../components/output/clear"
import { SoftLoopSync } from "../../components/media/video/softLoop"
import { syncVideoToAudio, videoSync } from "../../components/media/video/videoSync"
import { formatVTT, SRTtoVTT } from "../../components/show/media/subtitles"
import { HiddenInput } from "../ui/hidden-input/HiddenInput"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { HoverPlay } from "../system/HoverPlay"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { useStore } from "../hooks/useStore"
import { MediaPicker } from "./MediaPicker"
import styles from "./VideoShow.module.css"

interface VideoData {
    paused: boolean
    muted: boolean
    duration: number
    loop: boolean
    softLoop: number
}

interface ShowLike {
    id?: string
    type?: ShowType
    index?: number
}

export interface VideoShowProps {
    mediaPath: string
    show?: ShowLike
    mediaStyle?: MediaStyle
    videoData?: VideoData
    videoTime?: number
    onVideoDataChange?: (data: VideoData) => void
    onVideoTimeChange?: (time: number) => void
    // Los componentes Svelte con bind: (Player, VideoSlider, MediaControls) se montan en el cascarón y React los reubica.
    playerHost?: HTMLElement | null
    sliderHost?: HTMLElement | null
    controlsHost?: HTMLElement | null
}

function useHost(host: HTMLElement | null | undefined, ref: { current: HTMLDivElement | null }, active: boolean) {
    useEffect(() => {
        const container = ref.current
        if (!container || !host || !active) return
        container.appendChild(host)
        return () => {
            if (host.parentNode === container) container.removeChild(host)
        }
    }, [host, active, ref])
}

// (F24.20a).
export function VideoShow({ mediaPath, show, mediaStyle = {}, videoData: videoDataProp, videoTime: videoTimeProp, onVideoDataChange, onVideoTimeChange, playerHost, sliderHost, controlsHost }: VideoShowProps) {
    const defaultVideoData: VideoData = { paused: false, muted: true, duration: 0, loop: false, softLoop: 0 }
    const currentProjects = useStore(projects)
    const currentActiveProject = useStore(activeProject)
    const currentFocusMode = useStore(focusMode)
    const currentMedia = useStore(media)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentPlayingVideos = useStore(playingVideos)
    const currentVideoMarkers = useStore(videoMarkers)

    const showId = show?.id
    const type = show?.type

    const [videoData, setVideoDataState] = useState<VideoData>(videoDataProp || defaultVideoData)
    const [videoTime, setVideoTimeState] = useState(videoTimeProp ?? 0)
    const [softLoopOpacity, setSoftLoopOpacity] = useState(0)
    const [softLoopAudioTime, setSoftLoopAudioTime] = useState<number | undefined>(undefined)
    const [autoPause, setAutoPause] = useState(true)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [manageSubtitles, setManageSubtitles] = useState(false)
    const [timeMarkersEnabled, setTimeMarkersEnabled] = useState(false)
    const [playingInOutput, setPlayingInOutput] = useState(false)
    const [shouldLoop, setShouldLoop] = useState(false)
    const [shouldBeMuted, setShouldBeMuted] = useState(false)
    const [edit, setEdit] = useState(false)
    const [pausedByEdit, setPausedByEdit] = useState(false)

    const videoRef = useRef<HTMLVideoElement | null>(null)
    const blurVideoRef = useRef<HTMLVideoElement | null>(null)
    const softLoopVideoRef = useRef<HTMLVideoElement | null>(null)
    const unsubscriber = useRef<(() => void) | null>(null)
    const prevId = useRef<string | undefined>(undefined)
    const softLoopSync = useRef(new SoftLoopSync())

    const subtitleData = currentMedia[mediaPath] || {}
    const tracks = subtitleData.tracks || []
    const subtitle = subtitleData.subtitle || ""
    const markers = showId ? currentVideoMarkers[showId] || [] : []

    const outputId = currentPlayingVideos.find((a) => a.path === mediaPath)?.linkedOutputIds?.[0] || getFirstActiveOutput()?.id || ""
    const currentOutput = outputId ? currentOutputs[outputId] || null : null
    const background = currentOutput?.out?.background || {}
    const videoType = getMediaLayerType(mediaPath, mediaStyle)
    const projectItem = currentProjects[currentActiveProject || ""]?.shows?.[show?.index ?? -1]

    const videoDataRef = useRef(videoData)
    useEffect(() => {
        videoDataRef.current = videoData
    }, [videoData])

    function updateVideoData(patch: Partial<VideoData>) {
        const next = { ...videoDataRef.current, ...patch }
        videoDataRef.current = next
        setVideoDataState(next)
        onVideoDataChange?.(next)
    }
    function updateVideoTime(value: number) {
        setVideoTimeState(value)
        onVideoTimeChange?.(value)
    }

    useEffect(() => {
        if (videoDataProp) {
            videoDataRef.current = videoDataProp
            setVideoDataState(videoDataProp)
        }
    }, [videoDataProp])
    useEffect(() => {
        if (videoTimeProp !== undefined) setVideoTimeState(videoTimeProp)
    }, [videoTimeProp])

    // request subtitle tracks
    useEffect(() => {
        if (type !== "player" && mediaPath && subtitleData.tracks === undefined) sendMain(Main.MEDIA_TRACKS, { path: mediaPath })
    }, [mediaPath, type, subtitleData.tracks])

    // video sync
    useEffect(() => {
        if (unsubscriber.current) {
            unsubscriber.current()
            unsubscriber.current = null
        }
        if (!mediaPath || type !== "video") return
        updateVideoData({ paused: false, muted: true, duration: 0, loop: false, softLoop: 0 })

        let firstLoad = true
        let lastSyncedTime: number | null = null
        const unsubscribe = videoSync(mediaPath, outputId, (data) => {
            if (firstLoad) {
                firstLoad = false
                setTimeout(() => updateVideoTime(data.currentTime || 0), 50)
            } else {
                const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
                const rate = Number(mediaStyle.speed) || 1
                syncVideoToAudio(videoRef.current || null, data.currentTime, lastSyncedTime, isSoftLoop, rate, data.isFadingOut)
                if (data.currentTime !== undefined) lastSyncedTime = data.currentTime
            }

            const patch: Partial<VideoData> = {}
            if (data.duration) patch.duration = data.duration
            if (playingInOutput) patch.paused = data.paused
            patch.loop = playingInOutput ? data.loop : false
            if (data.softLoop !== undefined) patch.softLoop = data.softLoop
            if (Object.keys(patch).length) updateVideoData(patch)
            if (data.softLoopOpacity !== undefined) setSoftLoopOpacity(data.softLoopOpacity)
            setSoftLoopAudioTime(data.currentTime)
        })
        unsubscriber.current = unsubscribe || null
        return () => {
            if (unsubscribe) unsubscribe()
            if (unsubscriber.current === unsubscribe) unsubscriber.current = null
        }
    }, [mediaPath, outputId, type])

    useEffect(
        () => () => {
            if (unsubscriber.current) unsubscriber.current()
        },
        []
    )

    useEffect(() => {
        if (showId) updateVideoData({ paused: false })
    }, [showId])

    useEffect(() => {
        if (mediaPath === prevId.current) return
        prevId.current = mediaPath
        updateVideoTime(0)
        setAutoPause(true)
        const enabled = !!currentVideoMarkers[mediaPath]?.length || false
        setTimeMarkersEnabled(enabled)
        if (enabled && manageSubtitles) setManageSubtitles(false)
    }, [mediaPath])

    useEffect(() => {
        if (background === null || (background.path || background.id) !== mediaPath) {
            setPlayingInOutput(false)
            return
        }
        setAutoPause(true)
        setPlayingInOutput(true)
        if (type === "player") return
        const timer = setTimeout(() => updateVideoTime(0), 50)
        return () => clearTimeout(timer)
    }, [background, mediaPath, type])

    function onLoad() {
        setHasLoaded(true)
        if (videoData.paused) return
        if (currentFocusMode) {
            setTimeout(() => updateVideoData({ paused: true, duration: videoData.duration }))
            setTimeout(() => updateVideoTime(videoData.duration ? videoData.duration / 2 : 0))
            return
        }
        if (autoPause) updateVideoData({ paused: false })
        else updateVideoTime(0)
        if (subtitle && videoRef.current) enableSubtitle(videoRef.current, subtitle)
    }

    useEffect(() => {
        if (type !== "player" || !currentFocusMode) return
        const timer = setTimeout(() => {
            updateVideoData({ paused: true })
            updateVideoTime(videoData.duration ? videoData.duration / 2 : 0)
        }, 2000)
        return () => clearTimeout(timer)
    }, [type, currentFocusMode])

    function onPlay() {
        if (hasLoaded) {
            if (!playingInOutput) updateVideoTime(0)
            setHasLoaded(false)
        }
    }

    useEffect(() => {
        if (mediaPath) {
            setShouldLoop(typeof projectItem?.loop === "boolean" ? projectItem.loop : videoType === "background")
            setShouldBeMuted(typeof projectItem?.muted === "boolean" ? projectItem.muted : videoType === "background")
        }
    }, [mediaPath, projectItem, videoType])

    function playVideo(startAt = 0) {
        if (currentOutLocked) return
        const loop = shouldLoop
        const muted = shouldBeMuted
        if (videoType === "foreground" || (videoType !== "background" && !shouldLoop)) clearSlide()
        const backgroundData: Record<string, unknown> = { type, startAt, muted, loop, ...mediaStyle, ignoreLayer: videoType === "foreground" }
        if (type === "player") backgroundData.id = mediaPath
        else backgroundData.path = mediaPath
        setOutput("background", backgroundData)
    }

    function saveToProject(key: "loop" | "muted", value: boolean) {
        if (!projectItem || projectItem.id !== showId) return
        projects.update((all) => {
            const showIndex = show?.index
            if (showIndex === undefined || !all[currentActiveProject || ""]?.shows?.[showIndex]) return all
            all[currentActiveProject || ""].shows[showIndex][key] = value
            return all
        })
    }

    function toggleLoop() {
        setShouldLoop(!shouldLoop)
        saveToProject("loop", !shouldLoop)
    }
    function toggleMute() {
        setShouldBeMuted(!shouldBeMuted)
        saveToProject("muted", !shouldBeMuted)
    }

    function changeSubtitleName(detail: { id?: string; value: string }) {
        const subtitleIndex = detail.id?.slice("subtitle_".length)
        const value = detail.value
        if (subtitleIndex === undefined || !value) return
        media.update((all) => {
            const item = all[mediaPath]
            if (!item?.tracks?.[Number(subtitleIndex)]) return all
            item.tracks[Number(subtitleIndex)].name = value
            if (item.tracks[Number(subtitleIndex)].lang.length !== 2) item.tracks[Number(subtitleIndex)].lang = value.replaceAll(" ", "_").toLowerCase()
            return all
        })
    }

    async function subtitlePicked(path: string | string[]) {
        const picked = typeof path === "string" ? path : path[0]
        if (!picked) return
        let content = (await requestMain(Main.READ_FILE, { path: picked }))?.content
        if (!content) return
        if (getExtension(picked) === "srt") content = SRTtoVTT(content)
        content = formatVTT(content)
        media.update((all) => {
            if (!all[mediaPath]) all[mediaPath] = {}
            if (!all[mediaPath].tracks) all[mediaPath].tracks = []
            const name = removeExtension(getFileName(picked)).replaceAll(" ", "_")
            const id = name || uid(5)
            all[mediaPath].tracks!.push({ lang: id, name, vtt: content })
            activeRename.set("subtitle_" + (all[mediaPath].tracks!.length - 1))
            return all
        })
    }

    function setActiveSubtitle(event: { target?: unknown }, lang: string) {
        if ((event.target as HTMLElement)?.closest?.(".edit")) return
        media.update((all) => {
            if (!all[mediaPath]) all[mediaPath] = {}
            all[mediaPath].subtitle = all[mediaPath].subtitle === lang ? "" : lang
            return all
        })
    }

    useEffect(() => {
        if (subtitle !== undefined && videoRef.current) enableSubtitle(videoRef.current, subtitle)
    }, [subtitle])

    function addMarker() {
        if (!showId) return
        const markerIndex = addVideoMarker(showId, Math.floor(videoTime || 0))
        if (markerIndex > -1) activeRename.set("marker_" + markerIndex)
    }

    function changeName(detail: { id?: string; value: string }) {
        const currentMarker = detail.id?.slice("marker_".length)
        if (currentMarker === undefined || !showId) return
        videoMarkers.update((all) => {
            if (all[showId]?.[Number(currentMarker)]) all[showId][Number(currentMarker)].name = detail.value
            return all
        })
    }

    useEffect(() => {
        if (edit) {
            if (!videoData.paused) {
                updateVideoData({ paused: true })
                setPausedByEdit(true)
            }
        } else if (pausedByEdit) {
            updateVideoData({ paused: false })
            setPausedByEdit(false)
        }
    }, [edit])

    const transform = `scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"})`
    const mainVideoStyle: CSSProperties = {
        width: "100%",
        height: "100%",
        filter: mediaStyle.filter || "",
        objectFit: (mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain") as CSSProperties["objectFit"],
        transform
    }
    const blurVideoStyle: CSSProperties = {
        position: "absolute",
        filter: `${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3})`,
        objectFit: "cover",
        width: "100%",
        height: "100%",
        transform
    }

    useEffect(() => {
        const blurVideo = blurVideoRef.current
        if (blurVideo && (videoTime < blurVideo.currentTime - 0.3 || videoTime > blurVideo.currentTime + 0.3)) blurVideo.currentTime = videoTime
        if (!videoData.paused && blurVideo?.paused) void blurVideo.play()
    }, [videoTime, videoData.paused])

    useEffect(() => {
        const video = videoRef.current
        if (video && mediaStyle.speed) video.playbackRate = Number(mediaStyle.speed)
    }, [mediaStyle.speed])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        if (videoData.paused) video.pause()
        else void video.play()
    }, [videoData.paused])

    useEffect(() => {
        const video = videoRef.current
        if (video && Math.abs(video.currentTime - videoTime) > 0.3) video.currentTime = videoTime
    }, [videoTime])

    useEffect(() => {
        const cleanup = (element: HTMLVideoElement | null) => {
            if (!element) return
            try {
                element.pause()
                element.removeAttribute("src")
                element.load()
            } catch (error) {
                console.error("Error cleaning up video element in VideoShow:", error)
            }
        }
        return () => {
            cleanup(videoRef.current)
            cleanup(blurVideoRef.current)
            cleanup(softLoopVideoRef.current)
        }
    }, [])

    useEffect(() => () => softLoopSync.current.destroy(), [])

    const softLoopValue = videoData.softLoop ?? mediaStyle.softLoop ?? 0
    const fromTime = mediaStyle.fromTime || 0
    const toTime = mediaStyle.toTime || 0
    const effectiveSoftLoopOpacity = softLoopSync.current.update(softLoopOpacity, videoTime, fromTime, softLoopValue, videoRef.current, softLoopVideoRef.current, videoData.paused, toTime, softLoopAudioTime)

    const playerRef = useRef<HTMLDivElement>(null)
    const sliderRef = useRef<HTMLDivElement>(null)
    const controlsRef = useRef<HTMLDivElement>(null)
    useHost(playerHost, playerRef, type === "player")
    useHost(sliderHost, sliderRef, !playingInOutput && !currentFocusMode)
    useHost(controlsHost, controlsRef, playingInOutput && !currentFocusMode)

    return (
        <>
            <div key={mediaPath || showId} id={mediaPath || showId} className="media context #media{type === 'player' ? '_player' : ''}_preview" style={{ flex: 1, overflow: "hidden" }}>
                <HoverPlay hide={playingInOutput} icon="play" size={10} onClick={(event) => playVideo(event.ctrlKey || event.metaKey ? videoTime : 0)}>
                    {type === "player" ? (
                        <div ref={playerRef} style={{ display: "contents" }} />
                    ) : mediaPath ? (
                        <>
                            {mediaStyle.fit === "blur" ? <video ref={blurVideoRef} style={blurVideoStyle} src={encodeFilePath(mediaPath)} loop={videoData.loop} muted /> : null}
                            <video ref={videoRef} style={mainVideoStyle} src={encodeFilePath(mediaPath)} onLoadedMetadata={onLoad} onPlaying={onPlay} muted={videoData.muted} loop={videoData.loop}>
                                <track kind="captions" src="" label="No captions available" />
                                {tracks.map((track, i) => (
                                    <track key={`${track.lang}_${i}`} label={track.name} srcLang={track.lang} kind="subtitles" src={`data:text/vtt;charset=utf-8,${encodeURI(track.vtt)}`} />
                                ))}
                            </video>
                            {softLoopValue > 0 && videoData.loop ? <video ref={softLoopVideoRef} style={{ ...mainVideoStyle, position: "absolute", top: 0, left: 0, transition: "0.2s opacity", opacity: effectiveSoftLoopOpacity, pointerEvents: "none" }} src={encodeFilePath(mediaPath)} muted loop={videoData.loop} /> : null}
                        </>
                    ) : null}
                </HoverPlay>
            </div>

            {!currentFocusMode ? (
                <>
                    {!playingInOutput && !manageSubtitles && !timeMarkersEnabled ? (
                        <FloatingBar side="left">
                            <Button title={"media._loop" + (shouldLoop ? ": settings.enabled" : "")} onClick={toggleLoop}>
                                <Icon id="loop" size={1.2} white={!shouldLoop} />
                            </Button>
                            <Button title={!shouldBeMuted ? "actions.mute" : "actions.unmute"} disabled={currentOutLocked} onClick={toggleMute}>
                                <Icon id={!shouldBeMuted ? "volume" : "muted"} size={1.2} white={shouldBeMuted} />
                            </Button>
                        </FloatingBar>
                    ) : null}

                    {playingInOutput ? (
                        tracks.length
                    ) : manageSubtitles ? (
                        <FloatingBar side="left" style={{ marginBottom: playingInOutput ? (currentVideoMarkers[showId || ""]?.length ? 100 : 50) : undefined, maxWidth: playingInOutput ? undefined : "50%" }}>
                            {tracks.length ? (
                                <div className={styles.scroll}>
                                    {tracks.map((track, i) => (
                                        <Button key={`${track.lang}_${i}`} id={i.toString()} style={{ fontWeight: "normal" }} isActive={subtitle === track.lang} className={`context #video_subtitle${track.embedded ? "_embedded" : ""}`} onClick={(event) => setActiveSubtitle(event, track.lang)}>
                                            {playingInOutput ? <p style={{ padding: 5 }}>{track.name}</p> : <HiddenInput value={track.name} id={"subtitle_" + i} onEdit={changeSubtitleName} edit={edit} onEditChange={(value) => setEdit(!!value)} />}
                                        </Button>
                                    ))}
                                </div>
                            ) : null}

                            {!playingInOutput ? (
                                <>
                                    <div className="divider" />
                                    <MediaPicker id="subtitles" title={translateText("scripture.local")} filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} onPicked={subtitlePicked}>
                                        <Icon id="add" right={!tracks.length} />
                                        {!tracks.length ? <T id="scripture.local" /> : null}
                                    </MediaPicker>
                                </>
                            ) : null}
                        </FloatingBar>
                    ) : null}

                    {playingInOutput ? (
                        markers.length
                    ) : timeMarkersEnabled ? (
                        <FloatingBar side="left" style={{ marginBottom: playingInOutput || manageSubtitles ? 50 : undefined, maxWidth: playingInOutput || manageSubtitles ? undefined : "50%" }}>
                            {markers.length ? (
                                <div className={styles.scroll}>
                                    {markers.map((marker, i) => (
                                        <Button
                                            key={`${marker.time}_${i}`}
                                            id={i.toString()}
                                            style={{ fontWeight: "normal" }}
                                            className="context #video_marker"
                                            onClick={() => {
                                                if (!edit) playVideo(marker.time || 0)
                                            }}
                                        >
                                            <p style={{ display: "flex", alignItems: "center" }}>
                                                <HiddenInput value={marker.name} id={"marker_" + i} onEdit={changeName} edit={edit} onEditChange={(value) => setEdit(!!value)} />
                                                <span style={{ opacity: 0.7 }}>{joinTime(secondsToTime(marker.time))}</span>
                                            </p>
                                        </Button>
                                    ))}
                                </div>
                            ) : null}

                            {!playingInOutput ? (
                                <>
                                    <div className="diviver" />
                                    <Button icon="add" title="actions.add_time_marker" onClick={addMarker}>
                                        {!markers.length ? <T id="actions.add_time_marker" /> : null}
                                    </Button>
                                </>
                            ) : null}
                        </FloatingBar>
                    ) : null}

                    {playingInOutput ? (
                        <div ref={controlsRef} style={{ display: "contents" }} />
                    ) : (
                        <FloatingBar
                            arrow={type === "video" || type === "player"}
                            menu={
                                <div style={{ display: "flex", minWidth: 500 }}>
                                    <Button
                                        title={videoData.paused ? "media.play" : "media.pause"}
                                        onClick={() => {
                                            setAutoPause(false)
                                            updateVideoData({ paused: !videoData.paused })
                                        }}
                                    >
                                        <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} />
                                    </Button>
                                    <div ref={sliderRef} style={{ display: "contents" }} />
                                    <Button title={videoData.muted ? "actions.unmute" : "actions.mute"} onClick={() => updateVideoData({ muted: !videoData.muted })}>
                                        <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} />
                                    </Button>
                                    <div className="divider"></div>
                                </div>
                            }
                        >
                            {(open) => (
                                <>
                                    <Button
                                        isActive={manageSubtitles}
                                        title="actions.manage_subtitles"
                                        onClick={() => {
                                            setManageSubtitles(!manageSubtitles)
                                            if (timeMarkersEnabled) setTimeMarkersEnabled(false)
                                        }}
                                    >
                                        <Icon id="captions" white={!tracks.length} size={1.2} />
                                    </Button>
                                    {open ? <div className="divider"></div> : null}
                                    <Button
                                        isActive={timeMarkersEnabled}
                                        title="actions.toggle_time_marker"
                                        onClick={() => {
                                            setTimeMarkersEnabled(!timeMarkersEnabled)
                                            if (manageSubtitles) setManageSubtitles(false)
                                        }}
                                    >
                                        <Icon id="timeMarker" white={!markers.length} size={1.2} />
                                    </Button>
                                </>
                            )}
                        </FloatingBar>
                    )}
                </>
            ) : null}
        </>
    )
}
