import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { MediaStyle } from "../../../../types/Main"
import { cameraManager, type CameraData } from "../../media/logic/cameraManager"
import { media, os, outputs, special } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getCropState } from "../../../shared/utils/helpers/cropping"
import { getMediaStyle } from "../../../shared/utils/helpers/media"
import { findMatchingOut } from "../../../shared/utils/helpers/output"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { SelectElem } from "../../../shared/ui/system/SelectElem"
import { Button } from "../../../shared/ui/kit/button/Button"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Card } from "../Card"
import { parseStyle } from "./style"
import styles from "./Cam.module.css"

export interface CamProps {
    cam: CameraData
    item?: boolean
    preview?: boolean
    style?: string
    showPlayOnHover?: boolean
    disablePreview?: boolean
    cropping?: any
    cropPreviewMode?: boolean
    itemStyle?: string
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

const MEDIA_OVERFLOW_PREVIEW_STYLE = "position: absolute;width: 100%;height: 100%;left: 0;top: 0;opacity: 0.35;pointer-events: none;"

// Port de components/drawer/live/Cam.svelte.
export function Cam({ cam, item = false, preview = false, style = "", showPlayOnHover = true, disablePreview = false, cropping, cropPreviewMode = false, itemStyle, onClick }: CamProps) {
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<null | string>(null)
    const [overflowVideo, setOverflowVideo] = useState<HTMLVideoElement | null>(null)
    const mediaData = useStore(media)
    const outputList = useStore(outputs)
    const settings = useStore(special)
    const platform = useStore(os)

    const destroyed = useRef(false)
    const hovered = useRef(false)
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const iconClicked = useRef<ReturnType<typeof setTimeout> | null>(null)
    // El video se guarda en ref, no en estado: si el estado cambiara al desmontarse por un error,
    // el efecto volvería a correr, limpiaría el error y remontaría el video en un ciclo infinito.
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const mediaStyle: MediaStyle = cam.id ? getMediaStyle(mediaData[cam.id], undefined) : {}
    const cropState = getCropState(cropping, cropPreviewMode, itemStyle || mediaStyle.style)
    const startupCameras = settings ? cameraManager.getStartupCameras() : []

    useEffect(() => {
        destroyed.current = false

        async function capture() {
            if (disablePreview) return
            if ((settings?.cameraBad || []).includes(cam.id)) {
                setLoaded(true)
                return
            }
            setError("")
            const res = await cameraManager.attachCamera(videoRef.current, cam.id, {
                groupId: cam.group,
                preview: !item || preview,
                isHovered: () => hovered.current,
                isDestroyed: () => destroyed.current
            })
            if (destroyed.current) return
            if (typeof res === "string") {
                setError(res)
                setLoaded(true)
                if (platform?.platform === "darwin") retryTimeout.current = setTimeout(capture, 5000)
            } else setLoaded(true)
        }

        capture()
        return () => {
            destroyed.current = true
            if (retryTimeout.current) clearTimeout(retryTimeout.current)
            cameraManager.detachCamera(videoRef.current, cam.id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cam.id, disablePreview, item, preview])

    useEffect(() => {
        const currentVideo = videoRef.current
        if (overflowVideo && currentVideo?.srcObject && overflowVideo.srcObject !== currentVideo.srcObject) {
            overflowVideo.srcObject = currentVideo.srcObject
            cameraManager.play(overflowVideo)
        }
    }, [overflowVideo, loaded])

    function click(event: ReactMouseEvent<HTMLDivElement>) {
        if (iconClicked.current) return
        onClick?.(event)
    }

    function removeStyle(key: string) {
        iconClicked.current = setTimeout(() => (iconClicked.current = null), 50)
        media.update((all) => {
            if (!all[cam.id]) return all
            if (key === "filters") {
                delete all[cam.id].fit
                delete all[cam.id].flipped
                delete all[cam.id].flippedY
                delete all[cam.id].filter
                delete all[cam.id].cropping
            } else delete all[cam.id][key]
            return all
        })
    }

    function removeFromStartup(cameraId: string) {
        iconClicked.current = setTimeout(() => (iconClicked.current = null), 50)
        cameraManager.setStartupCameras(startupCameras.filter((id) => id !== cameraId))
    }

    if (item) {
        if (disablePreview) {
            return (
                <div className={styles.iconPreview}>
                    <Icon id="camera" size={3} white />
                </div>
            )
        }
        if (error) return null
        return (
            <>
                {cropState.showCropOverflowPreview ? (
                    <video ref={setOverflowVideo} style={parseStyle(MEDIA_OVERFLOW_PREVIEW_STYLE + style.replace(/position:[^;]+;|width:[^;]+;|height:[^;]+;|left:[^;]+;|top:[^;]+;/g, ""))}>
                        <track kind="captions" />
                    </video>
                ) : null}
                <div className="mediaContainer" style={parseStyle(cropState.mediaContainerStyle)}>
                    <video ref={videoRef} className={styles.video} style={parseStyle(style)}>
                        <track kind="captions" />
                    </video>
                </div>
            </>
        )
    }

    const outlineColor = findMatchingOut(cam.id, outputList)
    const hasFilters = !!(mediaStyle.filter?.length || mediaData[cam.id]?.fit || mediaStyle.flipped || mediaStyle.flippedY || Object.keys(mediaStyle.cropping || {}).length)

    return (
        <Card
            className="context #camera_card"
            loaded={loaded}
            outlineColor={outlineColor}
            active={outlineColor !== null}
            onClick={click}
            onMouseEnter={() => {
                hovered.current = true
                cameraManager.play(videoRef.current)
            }}
            onMouseLeave={() => {
                hovered.current = false
                cameraManager.pause(videoRef.current)
            }}
            label={cam.name}
            icon="camera"
            white={!cam.id.includes("cam")}
            showPlayOnHover={showPlayOnHover}
        >
            <SelectElem id="camera" data={{ id: cam.id, type: "camera", name: cam.name, cameraGroup: cam.group }} draggable>
                <div className={styles.icons}>
                    {startupCameras.includes(cam.id) ? (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: 3 }} redHover title={translateText("actions.remove")} onClick={() => removeFromStartup(cam.id)}>
                                    <Icon id="startup" size={0.9} white />
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {hasFilters ? (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: 3 }} redHover title={translateText("actions.remove")} onClick={() => removeStyle("filters")}>
                                    <Icon id="filter" size={0.9} white />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>

                {error ? (
                    <div className={styles.error} dangerouslySetInnerHTML={{ __html: error }} />
                ) : (
                    <video ref={videoRef} className={styles.video} style={parseStyle(style)}>
                        <track kind="captions" />
                    </video>
                )}
            </SelectElem>
        </Card>
    )
}
