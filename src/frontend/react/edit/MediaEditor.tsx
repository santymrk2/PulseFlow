import { useEffect, useRef, useState } from "react"
import type { MediaStyle } from "../../../types/Main"
import { activeEdit, activeShow, media, outputs, playingVideoState, previewOutputId, styles } from "../../stores"
import { VideoPlayer } from "../../components/media/video/videoPlayer"
import { getExtension, getMedia, getMediaStyle, getMediaType } from "../../components/helpers/media"
import { getCurrentStyle, getFirstActiveOutput, getResolution } from "../../components/helpers/output"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { observeResize } from "../slide/observeResize"
import { Zoomed } from "../slide/Zoomed"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import stylesModule from "./MediaEditor.module.css"

export interface MediaEditorComputed {
    mediaPath: string
    mediaStyle: MediaStyle
    type: string
}

export interface MediaEditorProps {
    videoData: { paused: boolean; muted: boolean; duration: number; loop: boolean }
    videoTime: number
    onVideoDataChange?: (data: { paused: boolean; muted: boolean; duration: number; loop: boolean }) => void
    onVideoTimeChange?: (time: number) => void
    onComputedChange?: (computed: MediaEditorComputed) => void
    mediaHost?: HTMLElement | null
    sliderHost?: HTMLElement | null
}

function useHost(host: HTMLElement | null | undefined, ref: { current: HTMLDivElement | null }, active = true) {
    useEffect(() => {
        const container = ref.current
        if (!container || !host || !active) return
        container.appendChild(host)
        return () => {
            if (host.parentNode === container) container.removeChild(host)
        }
    }, [host, active, ref])
}

// Port de components/edit/editors/MediaEditor.svelte. Los componentes Svelte con bind: (Media, VideoSlider)
// se montan en el cascarón y React los reubica en su layout.
export function MediaEditor({ videoData, videoTime: _videoTime, onVideoDataChange, onVideoTimeChange, onComputedChange, mediaHost, sliderHost }: MediaEditorProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)
    const currentOutputs = useStore(outputs)
    const currentPlayingVideoState = useStore(playingVideoState)
    const currentStyles = useStore(styles)
    const currentPreviewOutputId = useStore(previewOutputId)

    const path = currentActiveEdit.id || currentActiveShow?.id || ""

    const [mediaPath, setMediaPath] = useState("")
    const [size, setSize] = useState({ width: 0, height: 0 })
    const parentRef = useRef<HTMLDivElement | null>(null)
    const mediaSlotRef = useRef<HTMLDivElement | null>(null)
    const sliderSlotRef = useRef<HTMLDivElement | null>(null)

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId })
    const widthOrHeight = getStyleResolution(resolution, size.width, size.height, "fit")
    const extension = getExtension(mediaPath)
    const type = getMediaType(extension)
    const output = getFirstActiveOutput(currentOutputs)
    const outputStyle = getCurrentStyle(currentStyles, output?.style)
    const mediaId = currentActiveEdit.id && currentActiveEdit.type === "media" ? currentActiveEdit.id : currentActiveShow?.id && (currentActiveShow.type === "image" || currentActiveShow.type === "video") ? currentActiveShow.id : ""
    const mediaStyle = mediaId ? getMediaStyle(currentMedia[mediaId], outputStyle) : {}

    useEffect(() => {
        onComputedChange?.({ mediaPath, mediaStyle, type })
    }, [mediaPath, type, JSON.stringify(mediaStyle)])

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => setSize({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [])

    useEffect(() => {
        if (!path) return

        let cancelled = false
        setMediaPath(path)

        VideoPlayer.getDuration(path).then((duration) => {
            if (cancelled) return
            onVideoDataChange?.({ ...videoData, duration })

            const id = `${path}_${output?.id || ""}`
            const currentTime = currentPlayingVideoState[id]?.currentTime
            if (typeof currentTime === "number") onVideoTimeChange?.(currentTime)
        })

        void getMedia(path).then((loaded) => {
            if (cancelled || !loaded) return
            setMediaPath(loaded.path)
        })

        return () => {
            cancelled = true
        }
    }, [path, output?.id])

    useHost(mediaHost, mediaSlotRef)
    useHost(sliderHost, sliderSlotRef, type === "video")

    return (
        <div ref={parentRef} className={stylesModule.parent} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Zoomed background="transparent" resolution={resolution} checkered={mediaStyle.fit === "contain"} border style={widthOrHeight}>
                <div ref={mediaSlotRef} style={{ display: "contents" }} />
            </Zoomed>

            {type === "video" ? (
                <FloatingBar side="center" style={{ width: "60%" }}>
                    <Button title={videoData.paused ? "media.play" : "media.pause"} onClick={() => onVideoDataChange?.({ ...videoData, paused: !videoData.paused })}>
                        <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.3} />
                    </Button>

                    <div className="divider" />

                    <div ref={sliderSlotRef} style={{ display: "contents" }} />

                    <div className="divider" />

                    <Button title="media._loop" disabled>
                        <Icon id="loop" size={1.2} />
                    </Button>
                </FloatingBar>
            ) : null}
        </div>
    )
}
