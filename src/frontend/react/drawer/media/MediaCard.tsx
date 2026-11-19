import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import type { ContentFile, ContentProviderId } from "../../../../types/ContentProvider"
import type { ShowType } from "../../../../types/Show"
import { addProjectItem } from "../../../converters/project"
import { activeShow, customMessageCredits, media, mediaOptions, mediaTags, outLocked, outputs, photoApiCredits, styles as stylesStore } from "../../../shared/core/stores"
import { getKey } from "../../../shared/core/values/keys"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { getMediaLayerType, getMediaStyle, getMediaType, loadThumbnail } from "../../../shared/utils/helpers/media"
import { findMatchingOut, getAllActiveOutputs, getFirstActiveOutput, setOutput } from "../../../shared/utils/helpers/output"
import { Button } from "../../../shared/ui/kit/button/Button"
import { clearBackground, clearSlide } from "../../../components/output/clear"
import { SelectElem } from "../../../shared/ui/system/SelectElem"
import { Card } from "../Card"
import { MediaLoader } from "./MediaLoader"
import { useStore } from "../../../shared/ui/hooks/useStore"
import styles from "./MediaCard.module.css"

export interface MediaCardProps {
    name: string
    path: string
    credits?: unknown
    type: ShowType
    active: string | null
    shiftRange?: unknown[]
    thumbnailPath?: string
    thumbnail?: boolean
    loadFullImage?: boolean
    contentProvider?: ContentProviderId | false
    contentFileData?: ContentFile | null
}

export function MediaCard({ name, path, credits = {}, type, active, shiftRange = [], thumbnailPath: thumbnailPathProp = "", thumbnail = true, loadFullImage = false, contentProvider = false, contentFileData = null }: MediaCardProps) {
    const mediaValue = useStore(media)
    const mediaOptionsValue = useStore(mediaOptions)
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(stylesStore)
    const activeShowValue = useStore(activeShow)
    const mediaTagsValue = useStore(mediaTags)
    const outLockedValue = useStore(outLocked)

    const [failed, setFailed] = useState(false)
    const [thumbnailPath, setThumbnailPath] = useState(thumbnailPathProp)
    const [loaded] = useState(true)
    const [hover, setHover] = useState(false)
    const [duration] = useState(0)
    const videoElemRef = useRef<HTMLVideoElement | null>(null)
    const [wait, setWait] = useState(false)
    const [iconClicked, setIconClicked] = useState<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setThumbnailPath(thumbnailPathProp)
    }, [thumbnailPathProp])

    useEffect(() => {
        if (!contentFileData || !contentProvider || !path) return
        media.update((m) => {
            const next = { ...m }
            const prev = next[path] ? { ...next[path] } : {}
            prev.contentFile = { ...contentFileData, providerId: contentProvider }
            prev.name = name
            next[path] = prev
            return next
        })
    }, [contentFileData, contentProvider, path, name])

    useEffect(() => {
        if (!thumbnail || thumbnailPath || loadFullImage) return
        let cancelled = false
        setFailed(false)
        loadThumbnail(path).then((tp) => {
            if (cancelled) return
            setThumbnailPath(tp || "")
            if (!tp) setFailed(true)
        })
        return () => {
            cancelled = true
        }
    }, [thumbnail, thumbnailPath, loadFullImage, path])

    const currentOutput = getFirstActiveOutput(outputsValue)
    const currentStyle = stylesValue[currentOutput?.style || ""] || {}
    const mediaStyle = getMediaStyle(mediaValue[path], currentStyle)

    const mediaData = mediaValue[path]
    const isFavourite = mediaData?.favourite === true
    const icon = type === "video" ? "movie" : "image"
    const tags = mediaData?.tags || []

    const displayName = (() => {
        const dotIndex = name.lastIndexOf(".")
        return dotIndex > 0 ? name.slice(0, dotIndex) : name
    })()

    function removeStyle(key: string) {
        const timeout = setTimeout(() => setIconClicked(null), 50)
        setIconClicked(timeout)
        media.update((a) => {
            const next = { ...a }
            const prev = next[path] ? { ...next[path] } : null
            if (!prev) return a
            if (key === "filters") {
                delete prev.fit
                delete prev.flipped
                delete prev.flippedY
                delete prev.blend
                delete prev.filter
                delete prev.cropping
            } else if (key === "tags") {
                prev.tags = []
            } else {
                delete prev[key]
            }
            next[path] = prev
            return next
        })
    }

    function move(e: unknown) {
        if (!loaded || !videoElemRef.current) {
            setHover(false)
            return
        }
        const ev = e as { offsetX?: number; target?: { offsetWidth?: number } }
        const videoElem = videoElemRef.current
        const offsetX = ev.offsetX ?? 0
        const offsetWidth = ev.target?.offsetWidth || 1
        const percentage = offsetX / offsetWidth
        const steps = 10
        const time = Math.floor(duration * ((Math.floor(percentage * steps) * steps + steps) / 100))
        if (time && videoElem.currentTime === time) return
        if (!isFinite(time)) return
        if (Number(time) === time) videoElem.currentTime = time
    }

    function mousedown(e: unknown) {
        const ev = e as { ctrlKey?: boolean; metaKey?: boolean }
        if (ev.ctrlKey || ev.metaKey) return
        if (credits) {
            photoApiCredits.set(credits as never)
        }
    }

    function mouseenter(e: unknown) {
        const ev = e as { buttons?: number }
        const mediaGrid = document.querySelector(".grid")?.querySelector(".grid")
        if (!mediaGrid) return
        if ((ev.buttons ?? 0) > 0) return
        setHover(true)
    }

    function click(e: unknown) {
        const ev = e as { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || outLockedValue || wait || iconClicked) return

        setWait(true)
        setTimeout(() => setWait(false), 800)

        const activeOutputs = getAllActiveOutputs()
        const isActive = activeOutputs.some((a) => {
            const out = (a as { out?: { background?: { path?: string; id?: string } } }).out
            return (out?.background?.path || out?.background?.id) === path
        })
        if (isActive) {
            clearBackground()
            return
        }

        const videoType = getMediaLayerType(path, mediaStyle)
        const loop = contentProvider || videoType === "foreground" ? false : true
        const muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()

        activeOutputs.forEach((output) => {
            const currentOutputStyle = stylesValue[output.style || ""]
            const currentMediaStyle = getMediaStyle(mediaValue[path], currentOutputStyle)
            setOutput("background", { path, type, loop, muted, startAt: 0, ...currentMediaStyle, ignoreLayer: videoType === "foreground" }, false, output.id)
        })

        const creditsObj = credits as { type?: string; trigger_download?: string; artist?: string } | null
        if (creditsObj && creditsObj.type === "unsplash" && creditsObj.trigger_download) {
            fetch(creditsObj.trigger_download + "?client_id=" + getKey("unsplash"), { method: "GET" }).catch((err) => console.error("Could not trigger download:", err))
            customMessageCredits.set(`Photo by ${creditsObj.artist} on Unsplash`)
        } else {
            customMessageCredits.set("")
        }
    }

    function dblclick(e: unknown) {
        const ev = e as { ctrlKey?: boolean; metaKey?: boolean }
        if (ev.ctrlKey || ev.metaKey || iconClicked) return
        const data = { id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) }
        addProjectItem(data as never)
    }

    const filterCondition = !!mediaStyle.filter?.length || !!mediaValue[path]?.fit || !!mediaStyle.flipped || !!mediaStyle.flippedY || (!!mediaStyle.blend && mediaStyle.blend !== "normal") || Object.keys(mediaStyle.cropping || {}).length > 0

    return (
        <SelectElem id="media" className="context #media_card" data={{ name, path, type, contentProvider } as never} shiftRange={shiftRange} draggable fill>
            <Card
                resolution={{ width: 16, height: 9 }}
                loaded={(loaded && (mediaOptionsValue.mode === "grid" ? thumbnailPath !== "" || loadFullImage : true)) || failed}
                style={{ width: `${mediaOptionsValue.mode === "grid" ? 100 : 100 / mediaOptionsValue.columns}%` } as CSSProperties}
                mode={mediaOptionsValue.mode as "grid" | "list" | "lyrics"}
                width={100}
                preview={activeShowValue?.id === path}
                outlineColor={findMatchingOut(path, outputsValue)}
                active={findMatchingOut(path, outputsValue) !== null}
                label={displayName}
                title={contentProvider ? "" : path}
                icon={thumbnail ? icon : null}
                white={type === "image"}
                showPlayOnHover
                checkered={mediaOptionsValue.mode === "grid" && mediaStyle.fit !== "blur" && !failed}
                onMouseDown={mousedown as (event: MouseEvent<HTMLDivElement>) => void}
                onClick={click as (event: MouseEvent<HTMLDivElement>) => void}
                onDblClick={dblclick as (event: MouseEvent<HTMLDivElement>) => void}
                onMouseEnter={mouseenter as (event: MouseEvent<HTMLDivElement>) => void}
                onMouseLeave={() => setHover(false)}
                onMouseMove={move as (event: MouseEvent<HTMLDivElement>) => void}
            >
                <div className={styles.icons}>
                    {isFavourite && active !== "favourites" && (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: "3px" }} redHover title="actions.remove" onNativeClick={() => removeStyle("favourite")}>
                                    <Icon id="star" size={0.9} white />
                                </Button>
                            </div>
                        </div>
                    )}
                    {mediaStyle.videoType && (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: "3px" }} redHover title="actions.remove" onNativeClick={() => removeStyle("videoType")}>
                                    <Icon id={`type_${mediaStyle.videoType}`} size={0.9} white />
                                </Button>
                            </div>
                        </div>
                    )}
                    {filterCondition && (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: "3px" }} redHover title="actions.remove" onNativeClick={() => removeStyle("filters")}>
                                    <Icon id="filter" size={0.9} white />
                                </Button>
                            </div>
                        </div>
                    )}
                    {tags.length > 0 && (
                        <div style={{ maxWidth: "100%" }}>
                            <div className={styles.button}>
                                <Button align="start" style={{ padding: "3px" }} redHover title="actions.remove" onNativeClick={() => removeStyle("tags")}>
                                    <Icon id="tag" size={0.9} white />
                                </Button>
                            </div>
                            <span style={{ maxWidth: "100%" }}>
                                <p>{tags.length === 1 ? mediaTagsValue[tags[0]]?.name || "—" : tags.length}</p>
                            </span>
                        </div>
                    )}
                </div>

                {failed ? (
                    <div className={styles.icon}>
                        <Icon size={2.5} id="close" style={{ color: "var(--disconnected)" }} white />
                    </div>
                ) : thumbnail ? (
                    thumbnailPath || loadFullImage ? (
                        <MediaLoader loaded={loaded} hover={hover} duration={duration} videoElem={videoElemRef.current} resolution={{ width: 16, height: 9 }} type={type} path={path} thumbnailPath={thumbnailPath} name={name} mediaStyle={mediaStyle} loadFullImage={loadFullImage} />
                    ) : null
                ) : (
                    <div className={styles.icon}>
                        <Icon size={2.5} id={icon} white={type === "image"} />
                    </div>
                )}
            </Card>
        </SelectElem>
    )
}
