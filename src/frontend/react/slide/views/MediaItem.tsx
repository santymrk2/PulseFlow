import { useEffect, useRef, useState } from "react"
import type { Item } from "../../../../types/Show"
import { audioChannelsData, currentWindow, media as mediaStore, outputs, styles } from "../../../stores"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import Image from "../../../components/drawer/media/Image.svelte"
import { getCropState } from "../../../components/helpers/cropping"
import { encodeFilePath, getExtension, getMedia, getMediaType, getThumbnailPath, mediaSize } from "../../../components/helpers/media"
import { defaultLayers } from "../../../components/helpers/output"
import { _show } from "../../../components/helpers/shows"
import { SoftLoopSync } from "../../../components/media/video/softLoop"
import { syncVideoToAudio, videoSync } from "../../../components/media/video/videoSync"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"

export interface MediaItemProps {
    item: Item
    outputId?: string
    slideRef?: { showId?: string; layoutId?: string; slideIndex?: number; [key: string]: unknown }
    preview?: boolean
    miniPreview?: boolean
    edit?: boolean
    cropPreviewMode?: boolean
}

// (F24.18a).
export function MediaItem({ item, outputId = "", slideRef = {}, preview = false, miniPreview = false, edit = false, cropPreviewMode = false }: MediaItemProps) {
    const currentStyles = useStore(styles)
    const currentOutputs = useStore(outputs)
    const currentWindowValue = useStore(currentWindow)
    const currentMedia = useStore(mediaStore)
    const currentAudioChannels = useStore(audioChannelsData)

    const [mediaPath, setMediaPath] = useState("")
    const [updater, setUpdater] = useState(0)
    const [softLoopValue, setSoftLoopValue] = useState(0)
    const [softLoopOpacity, setSoftLoopOpacity] = useState(0)
    const [videoTime, setVideoTime] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [effectiveSoftLoopOpacity, setEffectiveSoftLoopOpacity] = useState(0)

    const videoRef = useRef<HTMLVideoElement | null>(null)
    const videoBlurRef = useRef<HTMLVideoElement | null>(null)
    const softLoopVideoRef = useRef<HTMLVideoElement | null>(null)
    const lastSyncedTimeRef = useRef<number | null>(null)
    const softLoopAudioTimeRef = useRef<number | undefined>(undefined)
    const softLoopSyncRef = useRef<SoftLoopSync | null>(null)
    if (softLoopSyncRef.current === null) softLoopSyncRef.current = new SoftLoopSync()

    const bgPath = item?.src
    const shouldAutoUpdate = typeof bgPath === "string" && bgPath.includes("NowPlayingCover")
    const playbackRate = item.speed ?? 1
    const lastAppliedRateRef = useRef(1)
    const shouldLoop = item.loop !== false
    const fromTime = currentMedia[mediaPath]?.fromTime ?? 0
    const toTime = currentMedia[mediaPath]?.toTime ?? 0
    const mainVol = currentAudioChannels.main?.volume ?? 1

    function getCustomPath() {
        if (!outputId || !slideRef.showId) return ""

        const styleId = currentOutputs[outputId]?.style || ""
        const outputStyle = currentStyles[styleId]
        const layers = Array.isArray(outputStyle?.layers) ? outputStyle.layers : defaultLayers
        if (layers.includes("background")) return ""

        const layoutRef =
            _show(slideRef.showId)
                .layouts([slideRef.layoutId as string])
                .ref()[0] || []
        const layoutSlide = layoutRef[slideRef.slideIndex || 0]
        let backgroundId = layoutSlide?.data?.background || ""
        if (!backgroundId) backgroundId = layoutRef[0]?.data?.background || ""

        return _show(slideRef.showId).get()?.media?.[backgroundId]?.path || ""
    }

    // Only load thumbnails in main preview.
    useEffect(() => {
        let cancelled = false
        async function loadMedia() {
            if (item.type !== "media") return
            if (typeof bgPath !== "string") {
                setMediaPath(getCustomPath())
                return
            }

            setMediaPath(bgPath)
            const thumbnailPath = getThumbnailPath(bgPath, mediaSize.slideSize)
            const loaded = await getMedia(bgPath, mediaSize.slideSize)
            if (cancelled || !loaded) return

            setMediaPath(loaded.path)
            if (shouldAutoUpdate || currentWindowValue || (preview && !miniPreview)) return
            setMediaPath(loaded.thumbnail || thumbnailPath)
        }

        if (bgPath) void loadMedia()
        else setMediaPath("")
        return () => {
            cancelled = true
        }
    }, [bgPath, updater, item.type, currentWindowValue, preview, miniPreview, outputId])

    useEffect(() => {
        if (!shouldAutoUpdate) return
        const interval = setInterval(() => setUpdater(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [shouldAutoUpdate])

    useEffect(() => {
        if (!bgPath || !outputId) return
        const unsubscriber = videoSync(String(bgPath), outputId, (data) => {
            const video = videoRef.current
            if (!video) return

            const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
            const rate = playbackRate
            syncVideoToAudio(video, data.currentTime, lastSyncedTimeRef.current, isSoftLoop, rate, data.isFadingOut)
            syncVideoToAudio(videoBlurRef.current, data.currentTime, lastSyncedTimeRef.current, isSoftLoop, rate, data.isFadingOut)
            if (data.currentTime !== undefined) {
                lastSyncedTimeRef.current = data.currentTime
                setVideoTime(data.currentTime)
            }

            if (data.softLoop !== undefined) setSoftLoopValue(data.softLoop)
            if (data.softLoopOpacity !== undefined) setSoftLoopOpacity(data.softLoopOpacity)
            softLoopAudioTimeRef.current = data.currentTime
            setIsPaused(!!data.paused)

            if (data.paused && !video.paused) {
                video.pause()
                videoBlurRef.current?.pause()
            } else if (!data.paused && video.paused) {
                void video.play()?.catch(() => {})
                void videoBlurRef.current?.play()?.catch(() => {})
            }
        })
        return () => unsubscriber?.()
    }, [bgPath, outputId, playbackRate])

    useEffect(() => {
        if (videoRef.current) videoRef.current.volume = mainVol
    }, [mainVol, mediaPath])

    useEffect(() => {
        if (playbackRate === lastAppliedRateRef.current) return
        lastAppliedRateRef.current = playbackRate
        if (videoRef.current) videoRef.current.playbackRate = playbackRate
        if (videoBlurRef.current) videoBlurRef.current.playbackRate = playbackRate
        if (softLoopVideoRef.current) softLoopVideoRef.current.playbackRate = playbackRate
    }, [playbackRate])

    useEffect(() => {
        setEffectiveSoftLoopOpacity(softLoopSyncRef.current!.update(softLoopOpacity, videoTime, fromTime, softLoopValue, videoRef.current, softLoopVideoRef.current, isPaused, toTime, softLoopAudioTimeRef.current))
    }, [softLoopOpacity, videoTime, fromTime, softLoopValue, isPaused, toTime, mediaPath])

    useEffect(() => {
        return () => {
            const cleanupVideo = (el: HTMLVideoElement | null | undefined) => {
                if (!el) return
                try {
                    el.pause()
                    el.removeAttribute("src")
                    el.load()
                } catch (e) {
                    console.error("Error cleaning up video element:", e)
                }
            }
            cleanupVideo(videoRef.current)
            cleanupVideo(videoBlurRef.current)
            softLoopSyncRef.current?.destroy()
        }
    }, [])

    const cropState = getCropState(item?.cropping, cropPreviewMode, item?.style)
    const flipX = item?.flipped ? -1 : 1
    const flipY = item?.flippedY ? -1 : 1
    const transformString = `scale(${flipX}, ${flipY})`

    const mediaStyleString = `filter: ${item?.filter};object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};mix-blend-mode: ${item?.blend || "normal"};`
    const mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;`
    const mediaStyleCombinedString = `${cropState.mediaCropGeometry}transform-origin: center;transform: ${transformString};${edit ? "pointer-events: none;" : ""}`
    const mediaOverflowPreviewStyle = `position: absolute;width: 100%;height: 100%;left: 0;top: 0;opacity: 0.35;pointer-events: none;transform-origin: center;transform: ${transformString};`
    const transition = !edit && !miniPreview && item.actions?.transition?.type !== "none" ? item.actions?.transition?.duration || false : false
    const isVideo = !!mediaPath && getMediaType(getExtension(mediaPath)) === "video"

    function imageIsland(style: string, key: string) {
        return <SvelteIsland key={key} component={Image} props={{ style, src: mediaPath, updater, alt: "", transition }} />
    }

    if (!mediaPath) return null

    return (
        <>
            {cropState.showCropOverflowPreview ? imageIsland(`${mediaStyleString}${mediaOverflowPreviewStyle}`, "overflow") : null}
            <div className="mediaContainer" style={cssTextToStyle(cropState.mediaContainerStyle)}>
                {isVideo ? (
                    <>
                        {item.fit === "blur" ? <video ref={videoBlurRef} src={encodeFilePath(mediaPath)} style={cssTextToStyle(`${mediaStyleBlurString}${mediaStyleCombinedString}`)} muted autoPlay loop={shouldLoop} /> : null}
                        <video ref={videoRef} src={encodeFilePath(mediaPath)} style={cssTextToStyle(`${mediaStyleString}${mediaStyleCombinedString}`)} muted autoPlay loop={shouldLoop}>
                            <track kind="captions" />
                        </video>
                        {softLoopValue > 0 && shouldLoop ? <video ref={softLoopVideoRef} src={encodeFilePath(mediaPath)} style={cssTextToStyle(`${mediaStyleString}${mediaStyleCombinedString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: ${effectiveSoftLoopOpacity};pointer-events: none;`)} muted loop={shouldLoop} /> : null}
                    </>
                ) : (
                    <>
                        {item.fit === "blur" ? imageIsland(`${mediaStyleBlurString}${mediaStyleCombinedString}`, "blur") : null}
                        {imageIsland(`${mediaStyleString}${mediaStyleCombinedString}`, "main")}
                    </>
                )}
            </div>
        </>
    )
}
