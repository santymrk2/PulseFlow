import { useEffect, useState, type CSSProperties } from "react"
import type { ShowType } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeEdit, activeFocus, activePage, activeProject, activeShow, categories, editingProjectTemplate, effects, focusMode, globalTags, media, notFound, outLocked, outputs, overlayCategories, overlays, playerVideos, playingAudio, projects, projectTemplates, refreshEditSlide, shows, showsCache, special, styles as stylesStore } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { customIconsColors } from "../../shared/core/values/customIcons"
import { history, historyAwait } from "../../shared/utils/helpers/history"
import { encodeFilePath, getExtension, getFileName, getMedia, getMediaLayerType, getMediaStyle, getMediaType, getVideoDuration, mediaSize, removeExtension } from "../../shared/utils/helpers/media"
import { findMatchingOut, getActiveOutputs, setOutput } from "../../shared/utils/helpers/output"
import { loadShows } from "../../shared/utils/helpers/setShow"
import { checkName, getLayoutRef } from "../../shared/utils/helpers/show"
import { playPdf, swichProjectItem, updateOut } from "../../shared/utils/helpers/showActions"
import { joinTime, secondsToTime } from "../../shared/utils/helpers/time"
import { clearSlide } from "../../components/output/clear"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button, type ButtonClickDetail } from "../ui/button/Button"
import { HiddenInput } from "../ui/hidden-input/HiddenInput"
import styles from "./ShowButton.module.css"

interface ShowButtonShow {
    id: string
    type?: ShowType
    name?: string
    category?: null | string
    data?: { id?: string; name?: string; type?: string }
    layoutInfo?: { name?: string }
    scheduleLength?: number
    quickAccess?: { number?: string; tags?: string[] }
    meta?: { number?: string }
    locked?: boolean
    played?: boolean
    loop?: boolean
    muted?: boolean
}

export interface ShowButtonProps {
    id: string
    show: ShowButtonShow
    data?: null | string
    index?: null | number
    isProject?: boolean
    icon?: boolean
    className?: string
    style?: CSSProperties | string
}

function toStyle(value?: CSSProperties | string): CSSProperties {
    if (!value) return {}
    if (typeof value !== "string") return value
    const result: Record<string, string> = {}
    for (const declaration of value.split(";")) {
        const separator = declaration.indexOf(":")
        if (separator < 0) continue
        const key = declaration
            .slice(0, separator)
            .trim()
            .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        result[key] = declaration.slice(separator + 1).trim()
    }
    return result as CSSProperties
}

// Port de components/show/ShowButton.svelte (F24.20a).
export function ShowButton({ id, show, data = null, index = null, isProject = false, icon = false, className = "", style }: ShowButtonProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveFocus = useStore(activeFocus)
    const currentActivePage = useStore(activePage)
    const currentActiveProject = useStore(activeProject)
    const currentActiveShow = useStore(activeShow)
    const currentCategories = useStore(categories)
    const currentEditingProjectTemplate = useStore(editingProjectTemplate)
    const currentEffects = useStore(effects)
    const currentFocusMode = useStore(focusMode)
    const currentGlobalTags = useStore(globalTags)
    const currentMedia = useStore(media)
    const currentNotFound = useStore(notFound)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentOverlayCategories = useStore(overlayCategories)
    const currentOverlays = useStore(overlays)
    const currentPlayerVideos = useStore(playerVideos)
    const currentPlayingAudio = useStore(playingAudio)
    const currentProjects = useStore(projects)
    const currentProjectTemplates = useStore(projectTemplates)
    const currentShows = useStore(shows)
    const currentShowsCache = useStore(showsCache)
    const currentSpecial = useStore(special)
    const currentStyles = useStore(stylesStore)
    const [editActive, setEditActive] = useState(false)
    const [thumbnailPath, setThumbnailPath] = useState<string | null>(null)
    const [duration, setDuration] = useState(0)

    const type = show.type || "show"
    const profile = getAccess("shows")
    const readOnly = profile.global === "read" || profile[show.category || ""] === "read"

    let name: string | undefined
    if (type === "show") name = currentShows[show.id]?.name
    else if (type === "overlay") name = currentOverlays[show.id]?.name
    else if (type === "effect") name = currentEffects[show.id]?.name
    else if (type === "player") name = currentPlayerVideos[id] || show.data?.id ? currentPlayerVideos[id]?.name || show.data?.name || show.data?.id : undefined
    else name = show.name

    useEffect(() => {
        if (type === "player" && !currentPlayerVideos[id] && !show.data?.id) {
            notFound.update((all) => {
                all.show.push(id)
                return all
            })
        }
    }, [type, id, currentPlayerVideos, show.data?.id])

    const newName = name === null && (type === "image" || type === "video") ? removeExtension(getFileName(id)) : name || ""
    const showNumber = isProject ? "" : show?.quickAccess?.number || show?.meta?.number || ""
    const showDuration = isProject ? currentShows[show.id]?.quickAccess?.duration || show.scheduleLength || 0 : 0

    let iconID: null | string = null
    let custom = false
    let subicon = ""
    if (icon) {
        if (type === "show") {
            if (currentShows[show.id]?.private) iconID = "private"
            else if (currentShows[show.id]?.category && currentCategories[currentShows[show.id].category || ""]) {
                custom = true
                iconID = currentCategories[currentShows[show.id].category || ""].icon || null
            } else if (currentShowsCache[show.id]?.reference?.type === "scripture") {
                custom = true
                iconID = "scripture"
            } else if (currentShowsCache[show.id]?.reference?.type === "calendar") {
                custom = true
                iconID = "event"
            } else iconID = "noIcon"
        } else if (type === "audio") iconID = "music"
        else if (type === "overlay") {
            if (currentOverlays[show.id]?.category && currentOverlayCategories[currentOverlays[show.id].category || ""]) {
                custom = true
                iconID = currentOverlayCategories[currentOverlays[show.id].category || ""].icon || null
                subicon = "overlays"
            } else iconID = "overlays"
        } else if (type === "effect") iconID = "effects"
        else iconID = type
    }

    const selectedItem = currentFocusMode ? currentActiveFocus : currentActiveShow
    const isActive = index !== null ? selectedItem?.index === index : selectedItem?.id === id

    function click(detail: ButtonClickDetail) {
        const { ctrl, shift, target } = detail
        if (editActive || ctrl || shift || isActive || (target as HTMLElement).closest("input")) return

        let pos = index
        if (index === null && currentActiveProject !== null) {
            const found = currentProjects[currentActiveProject]?.shows?.findIndex((item) => item.id === id) ?? -1
            if (found > -1) pos = found
        }

        const newShow: { id: string; type: ShowType; index?: number; name?: string } = { id, type }

        if (currentFocusMode) {
            const inProject = currentProjects[currentActiveProject || ""]?.shows?.find((item) => item.id === id)
            if (inProject) {
                activeFocus.set({ id, index: pos ?? undefined, type })
                return
            }
            focusMode.set(false)
        }

        if (pos !== null) {
            newShow.index = pos
            if (type === "audio") newShow.name = show.name
            else if (type === "show") {
                setTimeout(async () => {
                    await loadShows([id])
                    if (currentShowsCache[id]) swichProjectItem(pos, id)
                })
            }
        }

        activeShow.set(newShow)
        if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        else if (currentActiveEdit.id) activeEdit.set({ type: "show", slide: 0, items: [], showId: currentActiveShow?.id })
        if (currentActivePage === "edit") refreshEditSlide.set(true)
    }

    async function doubleClick(detail: ButtonClickDetail) {
        if (type === "show_placeholder") return
        if (editActive || currentOutLocked || (detail.target as HTMLElement).closest("input")) return

        const outputId = getActiveOutputs(currentOutputs, false, true, true)[0]
        const currentOutput = currentOutputs[outputId] || {}
        if (type === "show" && currentShowsCache[id]?.settings && currentShowsCache[id].layouts[currentShowsCache[id].settings.activeLayout]?.slides?.length) {
            const layoutRef = getLayoutRef(id)
            const firstEnabledIndex = layoutRef.findIndex((item) => !item.data.disabled)
            updateOut("active", firstEnabledIndex, layoutRef, !detail.alt)
            const slide = currentOutput.out?.slide || null
            if (slide?.id === id && slide?.index === firstEnabledIndex && slide?.layout === currentShowsCache[id].settings.activeLayout) return
            setOutput("slide", { id, layout: currentShowsCache[id].settings.activeLayout, index: firstEnabledIndex })
        } else if (type === "image" || type === "video") {
            const outputStyle = currentStyles[currentOutput.style || ""]
            const mediaData = currentMedia[id] || {}
            const mediaStyle = getMediaStyle(mediaData, outputStyle)
            const videoType = getMediaLayerType(id, mediaStyle)
            const shouldLoop = videoType === "background" ? show.loop || true : false
            const shouldBeMuted = videoType === "background" ? show.muted || true : false
            const located = await getMedia(id)
            if (!located) return
            const out = { path: located.path, muted: shouldBeMuted, loop: shouldLoop, startAt: 0, type, ...mediaStyle }
            if (videoType === "foreground" || (videoType !== "background" && (type === "image" || !shouldLoop))) clearSlide()
            setOutput("background", out)
        } else if (type === "pdf") await playPdf({ id, type: "pdf", name: show.name || "" }, false, false, 0)
        else if (type === "audio") AudioPlayer.start(id, { name: show.name || "" })
        else if (type === "overlay") setOutput("overlays", show.id, false, "", true)
        else if (type === "effect") setOutput("effects", show.id, false, "", true)
        else if (type === "player") setOutput("background", { id, type: "player" })
    }

    function rename(detail: { value: string }) {
        if (readOnly) return
        const value = detail.value.trim()
        if (type === "show_placeholder") {
            const projectId = currentEditingProjectTemplate
            if (!projectId) return
            const project = currentProjectTemplates[projectId]
            if (!project?.shows || index === null || !project.shows[index]) return
            const newShows = [...project.shows]
            newShows[index] = { ...newShows[index], name: value }
            history({ id: "UPDATE", newData: { key: "shows", data: newShows }, oldData: { id: projectId }, location: { page: "show", id: "project_template" } })
            return
        }
        const newShowName = checkName(value, id)
        historyAwait([id], { id: "SHOWS", newData: { data: [{ id, show: { name: newShowName } }], replace: true }, location: { page: "drawer" } })
    }

    let activeOutput: string | null = findMatchingOut(id)
    if (activeOutput && show.layoutInfo?.name) {
        const outputId = getActiveOutputs(currentOutputs, true, true, true)[0]
        const selectedLayoutId = Object.entries(currentShowsCache[id]?.layouts || {}).find(([, layout]) => layout.name === show.layoutInfo?.name)?.[0]
        if (currentOutputs[outputId]?.out?.slide?.layout !== selectedLayoutId) activeOutput = null
    }
    const outline = activeOutput !== null || !!currentPlayingAudio[id]

    const isMedia = type === "image" || type === "video" || type === "player"
    const mediaStyle = isMedia ? getMediaStyle(currentMedia[id], undefined) : {}
    const mediaStyleString: CSSProperties = { pointerEvents: "none", filter: mediaStyle.filter || "", transform: `scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"})` }

    useEffect(() => {
        if (!id || !isMedia) {
            setThumbnailPath("")
            setDuration(0)
            return
        }
        let cancelled = false
        void (async () => {
            setThumbnailPath("")
            setDuration(0)
            if (type === "player") {
                const player = currentPlayerVideos[id] || show.data
                if (player?.type === "youtube") setThumbnailPath(`https://i.ytimg.com/vi/${player.id}/sddefault.jpg`)
                else if (player?.type === "vimeo") setThumbnailPath(`https://vumbnail.com/${player.id}_medium.jpg`)
                return
            }
            const found = await getMedia(id, mediaSize.small)
            if (cancelled) return
            let thumb = found ? found.thumbnail || found.altPath || found.path : null
            if (getMediaType(getExtension(thumb || "")) === "video") thumb = null
            setThumbnailPath(thumb)
            if (type === "video") setDuration(await getVideoDuration(id))
        })()
        return () => {
            cancelled = true
        }
    }, [id, type, isMedia, currentPlayerVideos, show.data])

    const showTemplateName = type === "show_placeholder" ? (show.name && show.name !== "—" ? show.name : translateText("new.placeholder")) : ""

    const buttonStyle = {
        fontWeight: "normal",
        "--outline-color": activeOutput || "var(--secondary)",
        ...(currentNotFound.show?.includes(id) ? { backgroundColor: "rgb(255 0 0 / 0.2)" } : {}),
        ...toStyle(style)
    }

    return (
        <div id={`show_${id}`} className={`${styles.main} ${isProject ? styles.isProject : ""} ${show.played ? styles.played : ""}`}>
            <Button onClick={click} onDblClick={doubleClick} isActive={isActive} showOutline={outline} className={`context ${className}${readOnly ? "_readonly" : ""}`} style={buttonStyle} tab>
                <div className={`row ${styles.row}`} style={type === "show_placeholder" ? { fontStyle: "italic" } : undefined}>
                    <span className={styles.cell} style={isProject ? { width: "100%", maxWidth: show.layoutInfo?.name || show.scheduleLength ? "92%" : "100%" } : { width: "75%", minWidth: 120, maxWidth: `calc(100% ${showNumber ? "- var(--number-width)" : ""} - var(--modified-width, 0px))` }}>
                        <div className={`icon ${styles.icon} ${isMedia ? styles.isMedia : ""}`} style={{ position: "relative" }}>
                            {type === "show_placeholder" ? (
                                <Icon id="swap" white right />
                            ) : thumbnailPath ? (
                                <img className={styles.thumbnail} src={encodeFilePath(thumbnailPath)} alt="thumbnail" style={mediaStyleString} />
                            ) : icon || show.locked ? (
                                <Icon id={show.played ? "check" : iconID ? iconID : show.locked ? "locked" : "noIcon"} custom={!show.played && custom} box={iconID === "ppt" ? 50 : 24} color={show.played ? "#97ff95" : customIconsColors[iconID || ""] || ""} white right={!isMedia} boxed={!show.locked} />
                            ) : null}

                            {duration ? <span className={styles.duration}>{joinTime(secondsToTime(duration))}</span> : null}
                            {subicon ? <Icon id={subicon} size={0.7} white style={{ position: "absolute", bottom: -3, right: 1, opacity: 0.8 }} /> : null}
                        </div>

                        <HiddenInput value={type === "show_placeholder" ? showTemplateName : newName} id={index !== null ? "show_" + id + "#" + index : "show_drawer_" + id} onEdit={rename} edit={editActive} onEditChange={(value) => setEditActive(!!value)} allowEmpty={false} allowEdit={!readOnly && ((type === "show_placeholder" && !!currentEditingProjectTemplate) || !show.type || show.type === "show")} />

                        {isProject ? (
                            <>
                                {show.layoutInfo?.name ? (
                                    <span className={styles.layout} style={{ opacity: 0.6, fontStyle: "italic", fontSize: "0.9em" }}>
                                        {show.layoutInfo.name}
                                    </span>
                                ) : null}
                                {showDuration && Number(showDuration) ? <span className={styles.layout}>{joinTime(secondsToTime(showDuration))}</span> : null}
                            </>
                        ) : null}
                    </span>

                    {isProject ? (
                        isActive ? (
                            <span className={styles.arrow}>
                                <Icon id="next" white />
                            </span>
                        ) : null
                    ) : (
                        <span className={styles.cell}>
                            {currentSpecial.displayTags ? (
                                <span className={styles.tags}>
                                    {(currentShows[show.id]?.quickAccess?.tags || []).map((tagId) => {
                                        const tag = currentGlobalTags[tagId]
                                        return tag ? (
                                            <span key={tagId} className={styles.tag} style={{ "--color": tag.color || "white" } as CSSProperties}>
                                                <p style={{ margin: 0 }}>{tag.name || "—"}</p>
                                            </span>
                                        ) : null
                                    })}
                                </span>
                            ) : null}
                            {showNumber || currentSpecial.displayTags ? <span className={styles.number}>{showNumber || ""}</span> : null}
                            <span className={styles.date}>{data || ""}</span>
                        </span>
                    )}
                </div>
            </Button>
        </div>
    )
}
