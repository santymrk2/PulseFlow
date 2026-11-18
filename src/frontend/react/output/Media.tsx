import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { MediaStyle } from "../../../types/Main"
import type { OutBackground } from "../../../types/Show"
import { downloadOnlineMedia, getExtension, getMediaType } from "../../components/helpers/media"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
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
    /** Nodo del cascarón Svelte con `<Video>`/`<Image>` y sus `bind:` originales. */
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
export function Media({ outputId = "", path, path2 = "", data = {}, animationStyle = "", mediaStyle = {}, mirror = false, fadingOut = false, slotHost, onPathChange, onRetryCountChange, onTypeChange, onUseAlternativeChange }: MediaProps) {
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

    // `outputId`, `path2`, `mirror`, `fadingOut` y el cambio de path se consumen en el cascarón Svelte que conserva los `bind:`.
    void outputId
    void path2
    void mirror
    void fadingOut

    return (
        <>
            <span hidden data-media-type={type} data-retry-count={retryCount} data-use-alternative={useAlternative ? "true" : "false"} data-output-id={outputId} data-path2={path2} />
            {type === "video" ? <div className={styles.video} ref={wrapper} /> : type === "image" ? <div className={styles.image} style={cssTextToStyle(`height: 100%;${animationStyle}`) as CSSProperties} ref={wrapper} /> : <div ref={wrapper} />}
        </>
    )
}

export default Media
