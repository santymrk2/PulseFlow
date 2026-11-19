import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { MediaStyle } from "../../../../types/Main"
import type { Resolution } from "../../../../types/Settings"
import type { MediaType, ShowType } from "../../../../types/Show"
import { outputs, previewOutputId, styles as stylesStore } from "../../../shared/core/stores"
import { videoExtensions } from "../../../shared/core/values/extensions"
import { cropImageToBase64, encodeFilePath, getExtension, isLocalFile } from "../../../shared/utils/helpers/media"
import { getResolution } from "../../../shared/utils/helpers/output"
import { getStyleResolution } from "../../../components/slide/getStyleResolution"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Camera } from "../../output/Camera"
import { Capture } from "../live/Capture"
import { NDIStream } from "../live/NDIStream"
import { OMTStream } from "../live/OMTStream"
import { cn } from "../../../shared/core/lib/utils"
import styles from "./MediaLoader.module.css"

// Port de components/drawer/media/MediaLoader.svelte.
// `bind:loaded/hover/duration/videoElem` → props + callbacks de cambio.
export interface MediaLoaderProps {
    name?: string
    path: string
    thumbnailPath?: string
    loadFullImage?: boolean
    cameraGroup?: string
    mediaStyle?: MediaStyle
    type?: null | MediaType | ShowType
    hover?: boolean
    onHoverChange?: (value: boolean) => void
    loaded?: boolean
    onLoadedChange?: (value: boolean) => void
    resolution?: Resolution | null
    duration?: number
    onDurationChange?: (value: number) => void
    getDuration?: boolean
    ghost?: boolean
    videoElem?: HTMLVideoElement | null
    onVideoElemChange?: (value: HTMLVideoElement | null) => void
    className?: string
    style?: CSSProperties
}

const MAX_RETRIES = 3

export function MediaLoader({ name = "", path, thumbnailPath = "", loadFullImage = false, cameraGroup = "", mediaStyle = {}, type = null, hover: hoverProp = false, loaded: loadedProp = false, onLoadedChange, resolution = null, duration: durationProp = 0, onDurationChange, getDuration = false, ghost = false, videoElem: videoElemProp = null, onVideoElemChange, className, style }: MediaLoaderProps) {
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(stylesStore)
    const previewOutputIdValue = useStore(previewOutputId)

    const [loaded, setLoadedState] = useState(loadedProp)
    const [hover, setHoverState] = useState(hoverProp)
    const [, setDurationState] = useState(durationProp)
    const [videoElem, setVideoElemState] = useState<HTMLVideoElement | null>(videoElemProp)
    const [videoBlurElem, setVideoBlurElem] = useState<HTMLVideoElement | null>(null)

    const [width, setWidth] = useState(0)
    const [height, setHeight] = useState(0)
    const mainElem = useRef<HTMLDivElement>(null)
    const resizeObserver = useRef<ResizeObserver | null>(null)

    const [mediaType, setMediaType] = useState<null | MediaType | ShowType>(type)
    const [retryCount, setRetryCount] = useState(0)
    const [readyToLoad, setReadyToLoad] = useState(false)
    const [croppedImage, setCroppedImage] = useState("")

    // sync props → state
    useEffect(() => setLoadedState(loadedProp), [loadedProp])
    useEffect(() => setHoverState(hoverProp), [hoverProp])
    useEffect(() => setDurationState(durationProp), [durationProp])
    useEffect(() => setMediaType(type), [type])

    const setLoaded = (v: boolean) => {
        setLoadedState(v)
        onLoadedChange?.(v)
    }
    const setDuration = (v: number) => {
        setDurationState(v)
        onDurationChange?.(v)
    }
    const setVideoElem = (v: HTMLVideoElement | null) => {
        setVideoElemState(v)
        onVideoElemChange?.(v)
    }

    // reset loaded on path change
    useEffect(() => {
        if (path) setLoaded(false)
    }, [path])

    // resize observer
    useEffect(() => {
        const el = mainElem.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width: w, height: h } = entry.contentRect
                if (width !== w || height !== h) {
                    setWidth(w)
                    setHeight(h)
                }
            }
        })
        observer.observe(el)
        resizeObserver.current = observer
        return () => {
            observer.unobserve(el)
            resizeObserver.current = null
        }
    }, [])

    // type detection
    useEffect(() => {
        if (!mediaType && path) {
            const extension = getExtension(path)
            if (videoExtensions.includes(extension)) setMediaType("video")
        }
    }, [mediaType, path])

    const customResolution = resolution || getResolution(null, { outputs: outputsValue, styles: stylesValue, previewOutputId: previewOutputIdValue })

    // speed
    useEffect(() => {
        if (mediaStyle.speed && videoElem) {
            videoElem.playbackRate = Number(mediaStyle.speed || 0)
        }
    }, [mediaStyle.speed, videoElem])

    // camera play/pause on hover
    useEffect(() => {
        if (mediaType === "camera" && videoElem) {
            if (hover) void videoElem.play()?.catch(() => {})
            else videoElem.pause()
        }
    }, [mediaType, hover, videoElem])

    // duration reset
    useEffect(() => {
        if (!videoElem) setDuration(0)
    }, [videoElem])

    function getCurrentDuration() {
        if (!videoElem) return
        const videoDuration = videoElem.duration
        if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
            setDuration(0)
            return
        }
        setDuration(videoDuration)
        if (hover || !useOriginal) return
        videoElem.currentTime = videoDuration / 2
    }

    // retry reset
    useEffect(() => {
        if (path || thumbnailPath) setRetryCount(0)
    }, [path, thumbnailPath])

    function reload() {
        if (ghost || croppingActive) return
        if (retryCount > MAX_RETRIES || isLocalFile(path)) {
            setLoaded(true)
            return
        }
        setLoaded(false)
        const time = 500 * (retryCount + 1)
        setTimeout(() => {
            setRetryCount((c) => c + 1)
        }, time)
    }

    const useOriginal = hover || loadFullImage || retryCount > MAX_RETRIES || !thumbnailPath

    // getDuration
    useEffect(() => {
        if (getDuration && mediaType === "video" && thumbnailPath) getVideoDuration()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getDuration, mediaType, thumbnailPath])

    function getVideoDuration() {
        if (ghost) return
        setTimeout(() => {
            const video = document.createElement("video")
            video.onloadeddata = () => {
                const loadedDuration = video.duration
                setDuration(Number.isFinite(loadedDuration) ? loadedDuration : 0)
                video.src = ""
            }
            video.src = encodeFilePath(path)
        }, 20)
    }

    const mediaStyleString = `pointer-events: none;position: absolute;width: 100%;height: 100%;filter: ${mediaStyle.filter || ""};object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});mix-blend-mode: ${mediaStyle.blend || "normal"};`
    const mediaStyleBlurString = `filter: ${mediaStyle.filter || ""} blur(4px) opacity(0.3);object-fit: cover;pointer-events: none;position: absolute;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    useEffect(() => {
        setReadyToLoad(true)
    }, [])

    const croppingActive = Boolean(mediaStyle.cropping?.bottom || mediaStyle.cropping?.left || mediaStyle.cropping?.top || mediaStyle.cropping?.right)

    useEffect(() => {
        if (croppingActive) void cropImage()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [croppingActive])

    async function cropImage() {
        const cropped = await cropImageToBase64(path, mediaStyle.cropping)
        setCroppedImage(cropped)
        if (cropped) {
            // force useOriginal via retryCount trick not needed; useOriginal recomputes? useOriginal depends on retryCount; set retryCount high
            setRetryCount((c) => (c > MAX_RETRIES ? c : MAX_RETRIES + 1))
        }
    }

    // cleanup on unmount
    useEffect(() => {
        return () => {
            const cleanupVideo = (el: HTMLVideoElement | null) => {
                if (!el) return
                try {
                    el.pause()
                    el.removeAttribute("src")
                    el.load()
                } catch (e) {
                    console.error("Error cleaning up video element in MediaLoader:", e)
                }
            }
            cleanupVideo(videoElem)
            cleanupVideo(videoBlurElem)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const videoBlurRef = (el: HTMLVideoElement | null) => setVideoBlurElem(el)
    const videoRef = (el: HTMLVideoElement | null) => setVideoElem(el)

    if (!path) return null

    return (
        <div className={`${styles.main} ${className ?? ""}`} style={{ aspectRatio: `${customResolution.width}/${customResolution.height}`, ...style }} ref={mainElem}>
            {mediaType === "camera" ? (
                <div style={{ height: "100%" }}>
                    <Camera id={path} groupId={cameraGroup} className="media" style={getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, "cover")} preview onLoaded={() => setLoaded(true)} />
                </div>
            ) : mediaType === "screen" ? (
                <Capture screen={{ id: path, name }} streams={[]} background />
            ) : mediaType === "ndi" ? (
                <NDIStream screen={{ id: path, name }} background />
            ) : mediaType === "omt" ? (
                <OMTStream screen={{ id: path, name }} background />
            ) : readyToLoad ? (
                <>
                    {!(ghost && !thumbnailPath) && (mediaType !== "video" || (thumbnailPath && retryCount <= MAX_RETRIES)) ? (
                        <div key={retryCount}>
                            {mediaStyle.fit === "blur" ? <img src={mediaType !== "video" && useOriginal ? (croppingActive ? croppedImage : encodeFilePath(path)) : encodeFilePath(thumbnailPath)} alt={name} style={{ ...parseStyle(mediaStyleBlurString) }} loading="lazy" className={cn(styles.image, !loaded && styles.loading)} /> : null}
                            <img src={mediaType !== "video" && useOriginal ? (croppingActive ? croppedImage : encodeFilePath(path)) : encodeFilePath(thumbnailPath)} alt={name} style={{ ...parseStyle(mediaStyleString) }} loading="lazy" className={cn(styles.image, !loaded && styles.loading, ghost && styles.hideError)} onError={reload} onLoad={() => setLoaded(true)} />
                        </div>
                    ) : null}
                    {mediaType === "video" && useOriginal && !ghost ? (
                        <>
                            {mediaStyle.fit === "blur" ? (
                                <video ref={videoBlurRef} style={{ ...parseStyle(mediaStyleBlurString) }} src={encodeFilePath(path)} muted>
                                    <track kind="captions" />
                                </video>
                            ) : null}
                            <video ref={videoRef} style={{ ...parseStyle(mediaStyleString) }} onError={reload} src={encodeFilePath(path)} onCanPlayThrough={getCurrentDuration} muted>
                                <track kind="captions" />
                            </video>
                        </>
                    ) : null}
                </>
            ) : null}
        </div>
    )
}

function parseStyle(s: string): CSSProperties {
    // convert "key: value;..." to object minimally
    const out: Record<string, string> = {}
    s.split(";").forEach((part) => {
        const idx = part.indexOf(":")
        if (idx < 0) return
        const key = part.slice(0, idx).trim()
        const value = part.slice(idx + 1).trim()
        if (key) out[key] = value
    })
    return out as CSSProperties
}
