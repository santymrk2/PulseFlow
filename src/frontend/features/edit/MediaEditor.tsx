import { useEffect, useRef, useState } from "react"
import type { MediaStyle } from "../../../types/Main"
import { activeEdit, activeShow, media, outputs, playingVideoState, previewOutputId, styles } from "../../shared/core/stores"
import { VideoPlayer } from "../media/logic/video/videoPlayer"
import { getExtension, getMedia, getMediaStyle, getMediaType } from "../../shared/utils/helpers/media"
import { getCurrentStyle, getFirstActiveOutput, getResolution } from "../../shared/utils/helpers/output"
import { getStyleResolution } from "../slide/logic/getStyleResolution"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { observeResize } from "../slide/observeResize"
import { Zoomed } from "../slide/Zoomed"
import { Media } from "../output/Media"
import { VideoSlider } from "../output/VideoSlider"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import stylesModule from "./MediaEditor.module.css"

interface EditorVideoData {
    paused: boolean
    muted: boolean
    duration: number
    loop: boolean
    softLoop?: number
}

type VideoDataPatch = Partial<EditorVideoData>

// Port autocontenedor del editor de medios: estado del reproductor, Media y VideoSlider
// se renderizan aquí, sin cascarones Svelte ni hosts reubicados.
export function MediaEditor() {
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
    const [videoData, setVideoData] = useState<EditorVideoData>({ paused: false, muted: true, duration: 0, loop: true })
    const [videoTime, setVideoTime] = useState(0)
    const parentRef = useRef<HTMLDivElement | null>(null)

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId })
    const widthOrHeight = getStyleResolution(resolution, size.width, size.height, "fit")
    const extension = getExtension(mediaPath)
    const type = getMediaType(extension)
    const output = getFirstActiveOutput(currentOutputs)
    const outputStyle = getCurrentStyle(currentStyles, output?.style)
    const mediaId = currentActiveEdit.id && currentActiveEdit.type === "media" ? currentActiveEdit.id : currentActiveShow?.id && (currentActiveShow.type === "image" || currentActiveShow.type === "video") ? currentActiveShow.id : ""
    const mediaStyle: MediaStyle = mediaId ? getMediaStyle(currentMedia[mediaId], outputStyle) : {}

    function handleVideoDataChange(patch: VideoDataPatch) {
        setVideoData((previous) => ({ ...previous, ...patch, loop: patch.loop ?? previous.loop }))
    }

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

        void VideoPlayer.getDuration(path).then((duration) => {
            if (cancelled) return
            setVideoData((previous) => ({ ...previous, duration }))

            const id = `${path}_${output?.id || ""}`
            const currentTime = currentPlayingVideoState[id]?.currentTime
            if (typeof currentTime === "number") setVideoTime(currentTime)
        })

        void getMedia(path).then((loaded) => {
            if (cancelled || !loaded) return
            setMediaPath(loaded.path)
        })

        return () => {
            cancelled = true
        }
        // `currentPlayingVideoState` se consulta al resolver la duración; el efecto depende del path y la salida.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, output?.id])

    return (
        <div ref={parentRef} className={stylesModule.parent} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Zoomed background="transparent" resolution={resolution} checkered={mediaStyle.fit === "contain"} border style={widthOrHeight}>
                {mediaPath ? <Media path={mediaPath} mediaStyle={mediaStyle} mirror videoData={videoData} videoTime={videoTime} onVideoDataChange={handleVideoDataChange} onVideoTimeChange={setVideoTime} /> : null}
            </Zoomed>

            {type === "video" && mediaPath ? (
                <FloatingBar side="center" style={{ width: "60%" }}>
                    <Button title={videoData.paused ? "media.play" : "media.pause"} onClick={() => handleVideoDataChange({ paused: !videoData.paused })}>
                        <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.3} />
                    </Button>

                    <div className="divider" />

                    <VideoSlider path={mediaPath} videoData={videoData} videoTime={videoTime} big onVideoDataChange={handleVideoDataChange} onVideoTimeChange={setVideoTime} />

                    <div className="divider" />

                    <Button title="media._loop" disabled>
                        <Icon id="loop" size={1.2} />
                    </Button>
                </FloatingBar>
            ) : null}
        </div>
    )
}
