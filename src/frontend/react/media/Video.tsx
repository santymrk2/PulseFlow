import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react"
import type { MediaStyle } from "../../../types/Main"
import { useStore } from "../../shared/ui/hooks/useStore"
import { currentWindow, media, playingVideoState } from "../../shared/core/stores"
import { enableSubtitle, encodeFilePath, isVideoSupported } from "../../shared/utils/helpers/media"
import { SoftLoopSync } from "../../components/media/video/softLoop"
import { clampPlaybackRate, syncVideoToAudio, videoSync } from "../../components/media/video/videoSync"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import styles from "./Video.module.css"

export interface VideoData {
    paused?: boolean
    loop?: boolean
    softLoop?: number
    muted?: boolean
    duration?: number
    [key: string]: unknown
}

export interface VideoProps {
    outputId: string
    path: string
    syncPath?: string
    video?: HTMLVideoElement | null
    videoData?: VideoData
    videoTime?: number
    startAt?: number
    mediaStyle?: MediaStyle
    animationStyle?: string
    mirror?: boolean
    fadingOut?: boolean
    onVideoChange?: (video: HTMLVideoElement | null) => void
    onVideoDataChange?: (data: VideoData) => void
    onVideoTimeChange?: (time: number) => void
    onLoaded?: (value: boolean) => void
    onError?: (event: SyntheticEvent<HTMLVideoElement, Event>) => void
    onEnded?: (event: SyntheticEvent<HTMLVideoElement, Event>) => void
}

export function Video({
    outputId,
    path,
    syncPath = "",
    videoData: videoDataProp,
    videoTime: videoTimeProp = 0,
    startAt = 0,
    mediaStyle = {},
    animationStyle = "",
    mirror = false,
    fadingOut = false,
    onVideoChange,
    onVideoDataChange,
    onVideoTimeChange,
    onLoaded,
    onError,
    onEnded
}: VideoProps) {
    const currentWindowStore = useStore(currentWindow)
    const mediaStore = useStore(media) as Record<string, Record<string, unknown> | undefined>
    const playingState = useStore(playingVideoState) as Record<string, { currentTime?: number } | undefined>

    const videoRef = useRef<HTMLVideoElement | null>(null)
    const blurVideoRef = useRef<HTMLVideoElement | null>(null)
    const softLoopVideoRef = useRef<HTMLVideoElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const [containerAspect, setContainerAspect] = useState<number | null>(null)
    const [videoAspect, setVideoAspect] = useState<number | null>(null)
    const [softLoopOpacity, setSoftLoopOpacity] = useState(0)
    const [isFadingOutState, setIsFadingOutState] = useState(false)
    const [softLoopAudioTime, setSoftLoopAudioTime] = useState<number | undefined>(undefined)

    const videoData = videoDataProp || { paused: false, loop: false, softLoop: 0 }
    const hasLoadedRef = useRef(false)
    const lastAppliedRateRef = useRef(1)
    const pingbackTimeRef = useRef(0)
    const pingbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const subtitleChangeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const videoSupportedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const softLoopSyncRef = useRef<SoftLoopSync | null>(null)
    if (softLoopSyncRef.current === null) softLoopSyncRef.current = new SoftLoopSync()

    const videoDataRef = useRef(videoData)
    videoDataRef.current = videoData
    const startAtRef = useRef(startAt)
    startAtRef.current = startAt

    const targetPlaybackRate = Number(mediaStyle.speed) || 1
    const safeTargetPlaybackRate = clampPlaybackRate(targetPlaybackRate)

    function updateVideoData(patch: Partial<VideoData>) {
        const next = { ...videoDataRef.current, ...patch }
        onVideoDataChange?.(next)
    }

    function setMainVideo(el: HTMLVideoElement | null) {
        if (videoRef.current === el) return
        videoRef.current = el
        onVideoChange?.(el)
    }

    useEffect(() => {
        const c = containerRef.current
        if (!c) return
        const w = c.clientWidth
        const h = c.clientHeight
        setContainerAspect(w && h ? w / h : null)
    }, [])

    useEffect(() => {
        const targetPath = syncPath || path
        if (!targetPath || !outputId) return

        let lastSyncedTime: number | null = null
        const unsubscribe = videoSync(targetPath, outputId, (data: Record<string, unknown>) => {
            const videoEl = videoRef.current
            const isSoftLoop = !!(Number(data.softLoop) > 0)
            const isFading = fadingOut || !!data.isFadingOut
            setIsFadingOutState(!!data.isFadingOut)

            syncVideoToAudio(videoEl, data.currentTime as number | undefined, lastSyncedTime, isSoftLoop, safeTargetPlaybackRate, isFading)
            if (typeof data.currentTime === "number") lastSyncedTime = data.currentTime

            if (!isFading) {
                const cur = videoDataRef.current
                if (data.loop !== undefined && cur.loop !== data.loop) updateVideoData({ loop: !!data.loop })
                if (data.paused !== undefined && cur.paused !== data.paused) updateVideoData({ paused: !!data.paused })
            }

            if (data.softLoop !== undefined && videoDataRef.current.softLoop !== data.softLoop) updateVideoData({ softLoop: Number(data.softLoop) })
            if (typeof data.softLoopOpacity === "number") setSoftLoopOpacity(data.softLoopOpacity)
            setSoftLoopAudioTime(typeof data.currentTime === "number" ? data.currentTime : undefined)
        })

        return () => unsubscribe?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncPath, path, outputId, fadingOut, safeTargetPlaybackRate])

    function handleLoaded(e: SyntheticEvent<HTMLVideoElement, Event>) {
        hasLoadedRef.current = true
        const playingKey = `${syncPath || path}_${outputId}`
        const playingTime = mirror ? playingState?.[playingKey]?.currentTime || 0 : 0
        const el = e.currentTarget
        if (playingTime) el.currentTime = playingTime
        onLoaded?.(true)
    }

    function handlePlaying() {
        if (!hasLoadedRef.current || mirror) return
        hasLoadedRef.current = false
        const customStart = Math.max(startAtRef.current, mediaStyle.fromTime || 0) || 0
        if (customStart === 0) return
        const el = videoRef.current
        if (el) {
            el.currentTime = customStart
            onVideoTimeChange?.(customStart)
        }
    }

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        if (safeTargetPlaybackRate !== lastAppliedRateRef.current) {
            lastAppliedRateRef.current = safeTargetPlaybackRate
            if (v.playbackRate !== safeTargetPlaybackRate) v.playbackRate = safeTargetPlaybackRate
        }
        v.preservesPitch = true
    }, [safeTargetPlaybackRate])

    useEffect(() => {
        const isFading = fadingOut || isFadingOutState
        const v = videoRef.current
        if (!v) return
        if (!videoData.paused && v.paused && !v.error) {
            void v.play().catch((err: { name?: string }) => {
                if (err?.name !== "AbortError") console.warn("[Video.tsx] Play failed:", err)
            })
        } else if (videoData.paused && !v.paused && !isFading) {
            v.pause()
        }
    }, [videoData.paused, fadingOut, isFadingOutState, path])

    useEffect(() => {
        if (!path || currentWindowStore) return
        pingbackTimeRef.current = 0
        if (pingbackIntervalRef.current) clearInterval(pingbackIntervalRef.current)
        pingbackIntervalRef.current = setInterval(() => {
            if (videoDataRef.current.paused) return
            pingbackTimeRef.current++
            if (pingbackTimeRef.current < 30) return
            if (pingbackIntervalRef.current) clearInterval(pingbackIntervalRef.current)
            const pingbackUrl = mediaStore?.[path]?.pingbackUrl
            if (typeof pingbackUrl !== "string" || !pingbackUrl) return
            fetch(pingbackUrl, { method: "GET", mode: "no-cors" }).catch(() => {})
        }, 1000)
        return () => {
            if (pingbackIntervalRef.current) clearInterval(pingbackIntervalRef.current)
        }
    }, [path, currentWindowStore, mediaStore])

    useEffect(() => {
        if (!path) return
        if (videoSupportedTimeoutRef.current) clearTimeout(videoSupportedTimeoutRef.current)
        videoSupportedTimeoutRef.current = setTimeout(() => isVideoSupported(path), 200)
        return () => {
            if (videoSupportedTimeoutRef.current) clearTimeout(videoSupportedTimeoutRef.current)
        }
    }, [path])

    const mediaEntry = mediaStore?.[path]
    const subtitle = mediaEntry?.subtitle
    const tracks = Array.isArray(mediaEntry?.tracks) ? (mediaEntry.tracks as Array<Record<string, string>>) : []
    useEffect(() => {
        const v = videoRef.current
        if (!v || subtitle === undefined) return
        if (subtitleChangeRef.current) clearTimeout(subtitleChangeRef.current)
        subtitleChangeRef.current = setTimeout(() => {
            enableSubtitle(v, subtitle as never)
            subtitleChangeRef.current = null
        }, 20)
        return () => {
            if (subtitleChangeRef.current) clearTimeout(subtitleChangeRef.current)
        }
    }, [subtitle, path])

    useEffect(() => {
        const blur = blurVideoRef.current
        if (!blur) return
        if (videoTimeProp < blur.currentTime - 0.1 || videoTimeProp > blur.currentTime + 0.1) blur.currentTime = videoTimeProp
        if (!videoData.paused && blur.paused && !blur.error) {
            void blur.play().catch(() => {})
        } else if (videoData.paused && !blur.paused) {
            blur.pause()
        }
    }, [videoTimeProp, videoData.paused])

    useEffect(() => {
        const blur = blurVideoRef.current
        if (blur && blur.playbackRate !== safeTargetPlaybackRate) blur.playbackRate = safeTargetPlaybackRate
    }, [safeTargetPlaybackRate])

    useEffect(() => {
        const v = videoRef.current
        if (!v || !v.videoWidth || !v.videoHeight) return
        setVideoAspect(v.videoWidth / v.videoHeight)
    }, [path])

    useEffect(() => {
        const soft = softLoopVideoRef.current
        if (soft && soft.playbackRate !== safeTargetPlaybackRate) soft.playbackRate = safeTargetPlaybackRate
    }, [safeTargetPlaybackRate])

    useEffect(() => {
        const videoEl = videoRef.current
        if (!videoEl) return
        const t = videoTimeProp
        if (Math.abs((videoEl.currentTime || 0) - t) > 0.25) {
            try {
                videoEl.currentTime = t
            } catch {
                // ignore seek errors
            }
        }
    }, [videoTimeProp])

    useEffect(() => {
        return () => {
            if (subtitleChangeRef.current) clearTimeout(subtitleChangeRef.current)
            if (videoSupportedTimeoutRef.current) clearTimeout(videoSupportedTimeoutRef.current)
            if (pingbackIntervalRef.current) clearInterval(pingbackIntervalRef.current)
            softLoopSyncRef.current?.destroy()
            const cleanupVideo = (el: HTMLVideoElement | null | undefined) => {
                if (!el) return
                try {
                    el.pause()
                    el.removeAttribute("src")
                    el.load()
                } catch {
                    // ignore
                }
            }
            cleanupVideo(videoRef.current)
            cleanupVideo(blurVideoRef.current)
            cleanupVideo(softLoopVideoRef.current)
            onVideoChange?.(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fit = mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"
    const mediaStyleString = `width: 100%;height: 100%;object-fit: ${fit};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});mix-blend-mode: ${mediaStyle.blend || "normal"};`
    const mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    const perfectFit = containerAspect && videoAspect ? Math.abs(containerAspect - videoAspect) <= 0.01 : false
    const softLoopValue = Number(videoData.softLoop ?? (mediaStyle as Record<string, unknown>).softLoop ?? 0)
    const fromTime = mediaStyle.fromTime || 0
    const toTime = mediaStyle.toTime || 0
    const effectiveSoftLoopOpacity = softLoopSyncRef.current!.update(softLoopOpacity, videoTimeProp, fromTime, softLoopValue, videoRef.current, softLoopVideoRef.current, !!videoData.paused, toTime, softLoopAudioTime)

    return (
        <div ref={containerRef} className={styles.container} style={cssTextToStyle(animationStyle) as CSSProperties}>
            {mediaStyle.fit === "blur" && !perfectFit ? (
                <video className={`media ${styles.media}`} style={cssTextToStyle(mediaStyleBlurString)} src={encodeFilePath(path)} ref={blurVideoRef} muted loop={!!videoData.loop} />
            ) : null}
            <video
                className={`media ${styles.media}`}
                style={cssTextToStyle(mediaStyleString)}
                ref={setMainVideo}
                onLoadedMetadata={(e) => {
                    const el = e.currentTarget
                    if (el.videoWidth && el.videoHeight) setVideoAspect(el.videoWidth / el.videoHeight)
                    handleLoaded(e)
                }}
                onPlaying={handlePlaying}
                onError={onError}
                onEnded={onEnded}
                onTimeUpdate={(e) => onVideoTimeChange?.(e.currentTarget.currentTime)}
                muted
                src={encodeFilePath(path)}
                loop={!!videoData.loop}
            >
                {tracks.map((track, i) => (
                    <track key={i} label={track.name} srcLang={track.lang} kind="subtitles" src={`data:text/vtt;charset=utf-8,${encodeURI(track.vtt || "")}`} />
                ))}
            </video>
            {softLoopValue > 0 && videoData.loop ? (
                <video
                    className={`media ${styles.media}`}
                    style={cssTextToStyle(`${mediaStyleString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: ${effectiveSoftLoopOpacity};pointer-events: none;`)}
                    ref={softLoopVideoRef}
                    src={encodeFilePath(path)}
                    muted
                    loop={!!videoData.loop}
                />
            ) : null}
        </div>
    )
}
