import { useEffect, useRef, type CSSProperties } from "react"
import { cameraManager } from "../../media/cameraManager"
import { media } from "../../shared/core/stores"
import { getCropState } from "../../shared/utils/helpers/cropping"
import { getMediaStyle } from "../../shared/utils/helpers/media"
import { cn } from "../../shared/core/lib/utils"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import styles from "./Camera.module.css"

export interface CameraProps {
    id: string
    groupId: string
    preview?: boolean
    /** Equivale a `bind:videoElem`: el padre Svelte recibe el elemento vía callback. */
    videoElem?: HTMLVideoElement | null
    onVideoElemChange?: (elem: HTMLVideoElement | null) => void
    className?: string
    style?: string
    onLoaded?: () => void
}

// Port de components/output/Camera.svelte (F24.20c).
export function Camera({ id, groupId, preview = false, onVideoElemChange, className, style: _style = "", onLoaded }: CameraProps) {
    const currentMedia = useStore(media)
    const video = useRef<HTMLVideoElement | null>(null)
    const attachedId = useRef("")
    const destroyed = useRef(false)
    const loaded = useRef(onLoaded)
    loaded.current = onLoaded

    useEffect(() => {
        destroyed.current = false
        return () => {
            destroyed.current = true
            cameraManager.detachCamera(video.current, id)
        }
        // El id se recibe por `key` del padre cuando cambia, igual que el `{#key video.id}` original.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const elem = video.current
        if (!id || !elem || (id === attachedId.current && elem.srcObject)) return
        attachedId.current = id
        let cancelled = false
        void cameraManager
            .attachCamera(elem, id, {
                groupId,
                preview,
                isDestroyed: () => destroyed.current || id !== attachedId.current || cancelled,
                onLoaded: () => loaded.current?.()
            })
            .then((res: unknown) => {
                if (typeof res === "string" && !cancelled) loaded.current?.()
            })
        return () => {
            cancelled = true
        }
    }, [id, groupId, preview])

    useEffect(() => {
        onVideoElemChange?.(video.current)
    }, [onVideoElemChange])

    const mediaStyle = getMediaStyle(currentMedia[id], undefined)
    const cropState = getCropState(mediaStyle.cropping, false, mediaStyle.style)
    const cameraStyleString = `${cropState.mediaCropGeometry}object-fit: ${cropState.cropHasValues ? (mediaStyle.fit === "cover" ? "cover" : "fill") : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    return (
        <div className="mediaContainer" style={cssTextToStyle(cropState.mediaContainerStyle)}>
            <video ref={video} className={cn(styles.video, className)} style={cssTextToStyle(cameraStyleString) as CSSProperties}>
                <track kind="captions" />
            </video>
        </div>
    )
}

export default Camera
