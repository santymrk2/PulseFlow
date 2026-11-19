import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { MediaStyle } from "../../../types/Main"
import type { OutBackground } from "../../../types/Show"
import { downloadOnlineMedia, getExtension, getMediaType } from "../../shared/utils/helpers/media"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { Image } from "../media/Image"
import { Video } from "../media/Video"
import styles from "./Media.module.css"

export interface VideoData {
    paused: boolean
    muted: boolean
    duration: number
    loop?: boolean
    softLoop?: number
}

export interface MediaProps {
    outputId?: string
    path: string
    path2?: string
    data?: OutBackground
    animationStyle?: string
    mediaStyle?: MediaStyle
    mirror?: boolean
    fadingOut?: boolean
    video?: HTMLVideoElement | null
    videoData?: VideoData
    videoTime?: number
    /** Nodo legacy con `<Video>`/`<Image>`; si se omite, el port renderiza sus propios hijos React. */
    slotHost?: HTMLElement | null
    onVideoChange?: (video: HTMLVideoElement | null) => void
    onVideoDataChange?: (data: VideoData) => void
    onVideoTimeChange?: (time: number) => void
    onPathChange?: (path: string) => void
    onRetryCountChange?: (count: number) => void
    onUseAlternativeChange?: (value: boolean) => void
    onTypeChange?: (type: string) => void
}

// Port de components/output/layers/Media.svelte (F24.20c).
// Los hijos `Video`/`Image` siguen en Svelte y conservan sus `bind:` en el cascarón; React reubica ese nodo.
export function Media({ outputId = "", path, path2 = "", data = {}, animationStyle = "", mediaStyle = {}, mirror = false, fadingOut = false, video, videoData, videoTime, slotHost, onVideoChange, onVideoDataChange, onVideoTimeChange, onPathChange, onRetryCountChange, onTypeChange, onUseAlternativeChange }: MediaProps) {
    const [currentPath, setCurrentPath] = useState(path)
    const [retryCount, setRetryCount] = useState(0)
    const [useAlternative, setUseAlternative] = useState(false)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wrapper = useRef<HTMLDivElement | null>(null)
    const [wrapperReady, setWrapperReady] = useState(false)

    useEffect(() => {
        setCurrentPath(path)
    }, [path])

    const extension = getExtension(currentPath)
    const type = data.type || getMediaType(extension)
    useEffect(() => onTypeChange?.(type), [type, onTypeChange])
    useEffect(() => onRetryCountChange?.(retryCount), [retryCount, onRetryCountChange])
    useEffect(() => onUseAlternativeChange?.(useAlternative), [useAlternative, onUseAlternativeChange])

    useEffect(() => {
        if (typeof currentPath !== "string" || !currentPath.startsWith("http")) return
        let cancelled = false
        void downloadOnlineMedia(currentPath).then((downloaded: string) => {
            if (cancelled) return
            setCurrentPath(downloaded)
            onPathChange?.(downloaded)
        })
        return () => {
            cancelled = true
        }
        // El original reaccionaba al path; el efecto se reinicia cuando termina la descarga.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath])

    useEffect(() => {
        if (currentPath) setRetryCount(0)
    }, [currentPath])

    function reload() {
        const croppingActive = mediaStyle.cropping?.bottom || mediaStyle.cropping?.left || mediaStyle.cropping?.top || mediaStyle.cropping?.right
        if (croppingActive) return
        if (retryCount > 4) setUseAlternative(true)
        if (retryCount > 4 || timeout.current) return
        timeout.current = setTimeout(
            () => {
                if (!currentPath || !type) return
                setRetryCount((value) => value + 1)
                timeout.current = null
            },
            (retryCount + 1) * 200
        )
    }

    const reloadRef = useRef(reload)
    reloadRef.current = reload

    useEffect(() => {
        if (!slotHost || !wrapper.current) return
        const target = wrapper.current
        target.appendChild(slotHost)
        setWrapperReady(true)
        return () => {
            if (slotHost.parentNode === target) target.removeChild(slotHost)
        }
    }, [slotHost, wrapperReady, type, retryCount, useAlternative])

    const currentVideoData: VideoData = videoData || { paused: false, muted: true, duration: 0, loop: data.loop === true }

    function handleVideoDataChange(next: NonNullable<Parameters<typeof Video>[0]["videoData"]>) {
        onVideoDataChange?.({ ...currentVideoData, ...next } as VideoData)
    }

    return (
        <>
            <span hidden data-media-type={type} data-retry-count={retryCount} data-use-alternative={useAlternative ? "true" : "false"} data-output-id={outputId} data-path2={path2} />
            {type === "video" ? (
                <div className={styles.video} ref={wrapper}>
                    {slotHost ? null : <Video outputId={outputId} path={currentPath} syncPath={currentPath} video={video} videoData={currentVideoData as NonNullable<Parameters<typeof Video>[0]["videoData"]>} videoTime={videoTime} startAt={data.startAt} mediaStyle={mediaStyle} animationStyle={animationStyle} mirror={mirror} fadingOut={fadingOut} onVideoChange={onVideoChange} onVideoDataChange={handleVideoDataChange} onVideoTimeChange={onVideoTimeChange} onError={reload} />}
                </div>
            ) : type === "image" ? (
                <div className={styles.image} style={cssTextToStyle(`height: 100%;${animationStyle}`) as CSSProperties} ref={wrapper}>
                    {slotHost ? null : <Image path={useAlternative ? path2 : currentPath} mediaStyle={mediaStyle} onError={reload} />}
                </div>
            ) : (
                <div ref={wrapper} />
            )}
        </>
    )
}

export default Media
