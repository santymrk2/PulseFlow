import { useEffect, useState, type CSSProperties } from "react"
import type { MediaStyle } from "../../../../types/Main"
import type { ProjectShowRef } from "../../../../types/Projects"
import { activeShow, media, outLocked, outputs, styles } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getMedia, getMediaLayerType, getMediaStyle } from "../../../components/helpers/media"
import { getActiveOutputs, getCurrentStyle, setOutput } from "../../../components/helpers/output"
import { clearSlide } from "../../../components/output/clear"
import { Image } from "../../drawer/media/Image"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { HoverPlay } from "../../system/HoverPlay"
import { VideoShow } from "../VideoShow"

export interface MediaPreviewProps {
    projectShow?: ProjectShowRef | null
}

// (F24.20a).
export function MediaPreview({ projectShow = null }: MediaPreviewProps) {
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)

    const show = projectShow || currentActiveShow
    const path = show?.id || ""
    const [mediaPath, setMediaPath] = useState("")
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (!path) return
        let cancelled = false
        setFailed(false)
        setMediaPath(path)
        if (show?.type === "player") return
        void getMedia(path).then((found) => {
            if (cancelled) return
            if (!found) {
                setFailed(true)
                return
            }
            setMediaPath(found.path)
        })
        return () => {
            cancelled = true
        }
    }, [path, show?.type])

    const outputId = getActiveOutputs(currentOutputs)[0]
    const currentOutput = currentOutputs[outputId] || {}
    const currentStyle = getCurrentStyle(currentStyles, currentOutput.style)
    const mediaData = currentMedia[path] || {}
    const mediaStyle: MediaStyle = show ? getMediaStyle(mediaData, currentStyle) : {}

    const imageStyle: CSSProperties = {
        width: "100%",
        height: "100%",
        objectFit: mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain",
        filter: mediaStyle.filter || "",
        transform: `scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"})`,
        mixBlendMode: (mediaStyle.blend || "normal") as CSSProperties["mixBlendMode"]
    }
    const blurStyle: CSSProperties = {
        position: "absolute",
        filter: `${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3})`,
        objectFit: "cover",
        width: "100%",
        height: "100%",
        transform: `scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"})`
    }

    if (!show) return null

    function play() {
        if (currentOutLocked) return
        const type = getMediaLayerType(mediaPath, mediaStyle)
        if (type === "foreground" || type !== "background") clearSlide()
        setOutput("background", { path: mediaPath, ...mediaStyle })
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: projectShow ? "250px" : "100%" }} data-title={failed ? translateText(`error.media: ${mediaPath}`) : ""}>
            {failed ? (
                <Center>
                    <Icon size={4} id="close" style={{ color: "var(--disconnected)" }} white />
                </Center>
            ) : show.type === "video" || show.type === "player" ? (
                <VideoShow mediaPath={mediaPath} show={show} mediaStyle={mediaStyle} />
            ) : (
                <div id={mediaPath} className="media context #media_preview" style={{ flex: 1, overflow: "hidden" }}>
                    <HoverPlay icon="play" size={10} onClick={play}>
                        {mediaStyle.fit === "blur" ? <Image style={blurStyle} src={mediaPath} alt="" /> : null}
                        <Image style={imageStyle} src={mediaPath} alt={show.name || ""} />
                    </HoverPlay>
                </div>
            )}
        </div>
    )
}
