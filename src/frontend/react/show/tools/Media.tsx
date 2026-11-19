import { useEffect, useState, type CSSProperties } from "react"
import { Main } from "../../../../types/IPC/Main"
import type { MediaStyle } from "../../../../types/Main"
import type { Media as MediaData, MediaType, Overlay, SlideAction } from "../../../../types/Show"
import { requestMain } from "../../../shared/core/ipc/main"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { activePopup, activeShow, alertMessage, media, outLocked, outputs, overlays, playingAudio, showsCache, styles as stylesStore, previewOutputId } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { actionData } from "../../../components/actions/actionData"
import { getActionName, getActionTriggerId, runAction } from "../../../components/actions/actions"
import { clone, sortByName } from "../../../components/helpers/array"
import { encodeFilePath, getExtension, getMedia, getMediaStyle, getMediaType, isMediaExtension, mediaSize } from "../../../components/helpers/media"
import { findMatchingOut, getActiveOutputs, getCurrentStyle, getResolution, setOutput } from "../../../components/helpers/output"
import { _show } from "../../../components/helpers/shows"
import { MediaLoader } from "../../drawer/media/MediaLoader"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Textbox } from "../../slide/Textbox"
import { Zoomed } from "../../slide/Zoomed"
import { Center } from "../../system/Center"
import { HoverPlay } from "../../system/HoverPlay"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import styles from "./Media.module.css"

interface CountedMedia extends MediaData {
    id?: string
    count: number
    path: string
    type: MediaType
}

interface CountedOverlay extends Overlay {
    id: string
    count: number
}

interface CountedMic {
    id: string
    name: string
    count: number
}

interface SimilarMedia {
    path: string
    name: string
}

interface LoadedMedia {
    path?: string
    thumbnail?: string
    data?: MediaStyle
}

// Port (F24.20a).
export function Media() {
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentPlayingAudio = useStore(playingAudio)
    const currentPreviewOutputId = useStore(previewOutputId)
    const currentShowsCache = useStore(showsCache)
    const currentStyles = useStore(stylesStore)

    const currentShow = currentShowsCache[currentActiveShow?.id || ""]
    const outputId = getActiveOutputs(currentOutputs, false, true, true)[0]
    const outputStyle = getCurrentStyle(currentStyles, currentOutputs[outputId]?.style)
    const resolution = getResolution(null, { outputs: currentOutputs, styles: currentStyles, previewOutputId: currentPreviewOutputId })

    const references = currentShow ? _show().layouts().ref() : []
    const layoutBackgrounds: string[] = []
    const layoutOverlays: string[] = []
    const layoutAudio: string[] = []
    const layoutMics: { id: string; name: string }[] = []
    const layoutActions: SlideAction[] = []
    references.forEach((slides) => {
        slides.forEach((slide) => {
            const data = slide.data || {}
            if (data.background !== undefined) layoutBackgrounds.push(data.background)
            if (data.overlays !== undefined) layoutOverlays.push(...data.overlays)
            if (data.audio !== undefined) layoutAudio.push(...data.audio)
            if (data.mics !== undefined) layoutMics.push(...data.mics)
            if (data.actions?.slideActions !== undefined) layoutActions.push(...data.actions.slideActions)
        })
    })

    const backgrounds: CountedMedia[] = []
    const backgroundPaths: string[] = []
    if (layoutBackgrounds.length) {
        const grouped: Record<string, CountedMedia> = {}
        layoutBackgrounds.forEach((id) => {
            const item = currentShow.media?.[id]
            if (!item) return
            const path = item.path || item.id || ""
            const key = path.slice(0, 150)
            if (grouped[key]) grouped[key].count++
            else grouped[key] = { id, name: "—", ...item, path, type: (item.type || getMediaType(getExtension(path))) as MediaType, count: 1 }
        })
        backgrounds.push(...sortByName(Object.values(grouped)))
        backgroundPaths.push(...backgrounds.map((item) => item.path))
    }

    const showOverlays: CountedOverlay[] = []
    if (layoutOverlays.length) {
        const grouped: Record<string, CountedOverlay> = {}
        layoutOverlays.forEach((id) => {
            const item = currentOverlays[id]
            if (!item) return
            if (grouped[id]) grouped[id].count++
            else grouped[id] = { id, ...item, count: 1 }
        })
        showOverlays.push(...sortByName(Object.values(grouped)))
    }

    const audio: CountedMedia[] = []
    if (layoutAudio.length) {
        const grouped: Record<string, CountedMedia> = {}
        layoutAudio.forEach((id) => {
            const item = currentShow.media?.[id]
            if (!item) return
            const path = item.path || ""
            if (grouped[path]) grouped[path].count++
            else grouped[path] = { id, ...item, path, type: "audio", count: 1 }
        })
        audio.push(...Object.values(grouped))
    }

    const mics: CountedMic[] = []
    if (layoutMics.length) {
        const grouped: Record<string, CountedMic> = {}
        layoutMics.forEach((item) => {
            if (grouped[item.id]) grouped[item.id].count++
            else grouped[item.id] = { ...item, count: 1 }
        })
        mics.push(...Object.values(grouped))
    }

    const actions: SlideAction[] = []
    if (layoutActions.length) {
        layoutActions.forEach((action) => {
            if (actions.find((item) => JSON.stringify(item) === JSON.stringify(action))) return
            actions.push(action)
        })
    }

    const [similarBgs, setSimilarBgs] = useState<SimilarMedia[]>([])
    const [loadedMedia, setLoadedMedia] = useState<Record<string, LoadedMedia>>({})
    const backgroundKey = backgroundPaths.join("|")

    useEffect(() => {
        if (!backgroundPaths.length) {
            setSimilarBgs([])
            return
        }
        if (backgroundPaths.every((path) => path.startsWith("http") || path.startsWith("data:"))) return
        requestMain(Main.GET_SIMILAR, { paths: backgroundPaths }, (data) => {
            const found = (data || []).filter((item) => isMediaExtension(getExtension(item.path))).slice(0, 3)
            setSimilarBgs(found)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backgroundKey])

    useEffect(() => {
        let cancelled = false
        backgroundPaths.forEach(async (path) => {
            const found = await getMedia(path, mediaSize.small)
            if (cancelled) return
            setLoadedMedia((all) => ({ ...all, [path]: found || {} }))
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backgroundKey])

    function setBG(id: string, key: string, value: boolean) {
        if (currentShow.locked) {
            alertMessage.set("show.locked")
            activePopup.set("alert")
            return
        }
        const profile = getAccess("shows")
        const showCategory = currentShow.category || ""
        if (profile.global === "read" || profile[showCategory] === "read") {
            alertMessage.set("profile.locked")
            activePopup.set("alert")
            return
        }
        showsCache.update((all) => {
            const show = all[currentActiveShow?.id || ""]
            const item = show?.media?.[id]
            if (!item) return all
            if (value) delete item[key as keyof typeof item]
            else (item as unknown as Record<string, boolean>)[key] = value
            return all
        })
    }

    function playBackground(background: CountedMedia, found: LoadedMedia) {
        if (currentOutLocked) return
        const path = found.path || background.path
        const style = clone(getMediaStyle(found.data, outputStyle)) as MediaStyle
        style.fit = found.data?.fit || ""
        delete style.fitOptions
        setOutput("background", { path, type: background.type, loop: background.loop !== false, muted: background.muted !== false, ...style })
    }

    function playOverlay(overlay: CountedOverlay) {
        if (currentOutLocked) return
        const isActive = findMatchingOut(overlay.id, currentOutputs) !== null
        if (!isActive && Array.isArray(overlay.actions)) overlay.actions.forEach((action) => runAction(action, { source: "overlay" }))
        setOutput("overlays", overlay.id, true)
    }

    function countStyle(count: number): CSSProperties {
        return { color: "var(--secondary)", fontWeight: "bold", display: count > 1 ? undefined : "none" }
    }

    function mediaItemStyle(): CSSProperties {
        return { flex: 2, height: 50, maxWidth: 100 }
    }

    function smallButtonStyle(): CSSProperties {
        return { flex: 0, padding: "14px 5px" }
    }

    return (
        <div className={styles.main}>
            {backgrounds.length || showOverlays.length || audio.length || mics.length || actions.length ? (
                <>
                    {backgrounds.length ? (
                        <>
                            {backgrounds.map((background) => {
                                const found = loadedMedia[background.path] || {}
                                return (
                                    <SelectElem key={background.id} id="media" data={{ ...background, path: found.path || background.path } as never} draggable>
                                        <div className={`media_item item ${styles.media_item} ${styles.item} context #show_media ${findMatchingOut(found.path || "", currentOutputs) ? styles.active : ""}`}>
                                            <HoverPlay style={mediaItemStyle()} icon="play" size={3} onClick={() => playBackground(background, found)}>
                                                <MediaLoader name={background.name} path={found.path || background.path} thumbnailPath={found.thumbnail} type={background.type} mediaStyle={getMediaStyle(found.data, outputStyle)} />
                                            </HoverPlay>
                                            <p className={styles.label} data-title={encodeFilePath(found.path || background.path)}>
                                                {background.name}
                                            </p>
                                            <span className={styles.label} style={countStyle(background.count)}>
                                                {background.count}
                                            </span>
                                            {background.type === "video" ? (
                                                <>
                                                    <Button style={smallButtonStyle()} title={translateText("media._loop" + (background.loop !== false ? ": settings.enabled" : ""))} onClick={() => setBG(background.id || "", "loop", background.loop === false)}>
                                                        <Icon id="loop" white={background.loop === false} size={1.2} />
                                                    </Button>
                                                    <Button style={smallButtonStyle()} title={translateText(background.muted !== false ? "actions.unmute" : "actions.mute")} onClick={() => setBG(background.id || "", "muted", background.muted === false)}>
                                                        <Icon id={background.muted !== false ? "muted" : "volume"} white={background.muted !== false} size={1.2} />
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </SelectElem>
                                )
                            })}

                            {similarBgs.length ? (
                                <>
                                    <h5 className={styles.heading}>
                                        <T id="media.recommended" />
                                    </h5>
                                    {similarBgs.map((background) => {
                                        const mediaStyle = getMediaStyle((currentMedia as unknown as Record<string, MediaStyle>)[background.path], outputStyle)
                                        const type = getMediaType(getExtension(background.path)) || "video"
                                        return (
                                            <SelectElem key={background.path} id="media" data={{ ...background, type } as never} draggable>
                                                <div className={`media_item item ${styles.media_item} ${styles.item} context #show_media ${findMatchingOut(background.path, currentOutputs) ? styles.active : ""}`}>
                                                    <HoverPlay
                                                        style={mediaItemStyle()}
                                                        icon="play"
                                                        size={3}
                                                        onClick={() => {
                                                            if (!currentOutLocked) setOutput("background", { path: background.path, type, loop: true, muted: true, ...mediaStyle })
                                                        }}
                                                    >
                                                        <MediaLoader name={background.name} path={background.path} type={type} mediaStyle={mediaStyle} />
                                                    </HoverPlay>
                                                    <p className={styles.label} data-title={background.path}>
                                                        {background.name}
                                                    </p>
                                                </div>
                                            </SelectElem>
                                        )
                                    })}
                                </>
                            ) : null}
                        </>
                    ) : null}

                    {showOverlays.length ? (
                        <>
                            <h5 className={styles.heading}>
                                <T id="preview.overlays" />
                            </h5>
                            {showOverlays.map((overlay) => {
                                const isActive = findMatchingOut(overlay.id, currentOutputs) !== null
                                return (
                                    <SelectElem key={overlay.id} id="overlay" data={overlay.id as never} draggable>
                                        <div className={`media_item item ${styles.media_item} ${styles.item} context #show_overlay ${isActive ? styles.active : ""}`}>
                                            <HoverPlay style={mediaItemStyle()} icon={isActive ? "clear" : "play"} size={3} onClick={() => playOverlay(overlay)}>
                                                <Zoomed resolution={resolution} background={overlay.items?.length ? "var(--primary)" : overlay.color || "var(--primary)"} checkered={!!overlay.items?.length} center>
                                                    {(overlay.items || []).map((item, index) => (
                                                        <Textbox key={index} item={item} ref={{ type: "overlay", id: overlay.id }} preview miniPreview />
                                                    ))}
                                                </Zoomed>
                                            </HoverPlay>
                                            <p className={styles.label} data-title={overlay.name}>
                                                {overlay.name}
                                            </p>
                                            <span className={styles.label} style={countStyle(overlay.count)}>
                                                {overlay.count}
                                            </span>
                                        </div>
                                    </SelectElem>
                                )
                            })}
                        </>
                    ) : null}

                    {audio.length ? (
                        <>
                            <h5 className={styles.heading}>
                                <T id="preview.audio" />
                            </h5>
                            {audio.map((file) => {
                                const playing = currentPlayingAudio[file.path || ""]
                                return (
                                    <SelectElem key={file.id} id="audio" data={{ path: file.path, name: file.name } as never} draggable>
                                        <Button
                                            align="start"
                                            className="context #show_audio"
                                            onClick={() => {
                                                if (!currentOutLocked) AudioPlayer.start(file.path || "", { name: file.name || "" })
                                            }}
                                            showOutline={!!playing}
                                            style={{ padding: 8, width: "100%" }}
                                            title={file.path}
                                            bold={false}
                                        >
                                            <Icon id={playing?.paused === true ? "play" : playing?.paused === false ? "pause" : "music"} size={1.2} right />
                                            <p className={styles.label} style={{ width: "100%", textAlign: "start" }}>
                                                {file.name?.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name}
                                            </p>
                                            <span className={styles.label} style={countStyle(file.count)}>
                                                {file.count}
                                            </span>
                                        </Button>
                                    </SelectElem>
                                )
                            })}
                        </>
                    ) : null}

                    {mics.length ? (
                        <>
                            <h5 className={styles.heading}>
                                <T id="live.microphones" />
                            </h5>
                            {mics.map((mic) => (
                                <SelectElem key={mic.id} id="microphone" data={{ id: mic.id, type: "microphone", name: mic.name } as never} draggable>
                                    <Button align="start" style={{ padding: 8, width: "100%" }} bold={false} onClick={() => AudioMicrophone.start(mic.id, { name: mic.name }, { pauseIfPlaying: true })}>
                                        <Icon id="microphone" white={!currentPlayingAudio[mic.id]} right />
                                        <p className={styles.label} style={{ width: "100%", textAlign: "start" }}>
                                            {mic.name}
                                        </p>
                                        <span className={styles.label} style={countStyle(mic.count)}>
                                            {mic.count}
                                        </span>
                                    </Button>
                                </SelectElem>
                            ))}
                        </>
                    ) : null}

                    {actions.length ? (
                        <>
                            <h5 className={styles.heading}>
                                <T id="tabs.actions" />
                            </h5>
                            {actions.map((action, index) => {
                                const actionId = getActionTriggerId(action.triggers?.[0])
                                const customData = (actionData as unknown as Record<string, { name?: string; icon?: string }>)[actionId] || {}
                                const actionValue = action?.actionValues?.[actionId] || action?.actionValues?.[action.triggers?.[0]] || {}
                                const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name || "") ? action.name : "")
                                return (
                                    <SelectElem key={index} id="action" data={action as never} draggable>
                                        <Button align="start" onClick={() => runAction(action, { source: "click" })} style={{ padding: 8, width: "100%" }} title={action.name} bold={false}>
                                            <Icon id={customData.icon || "actions"} size={1.1} style={{ marginInlineStart: "0.5em" }} right />
                                            <p className={styles.label}>
                                                <T id={customData.name || ""} />
                                                {customName ? (
                                                    <span className={styles.label} style={{ padding: 0, opacity: 0.7, fontSize: "0.8em" }}>
                                                        : {customName}
                                                    </span>
                                                ) : null}
                                            </p>
                                        </Button>
                                    </SelectElem>
                                )
                            })}
                        </>
                    ) : null}
                </>
            ) : (
                <Center faded>
                    <T id="empty.media" />
                </Center>
            )}
        </div>
    )
}
