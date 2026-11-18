import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { MediaStyle } from "../../../types/Main"
import type { Item, Media, Show, Slide as SlideType, SlideData } from "../../../types/Show"
import { removeTagsAndContent } from "../../show/slides"
import { activeEdit, activePage, activeShow, activeTimers, editMode, effects, focusMode, fullColors, groups, media, outputs, overlays, playerVideos, refreshListBoxes, refreshSlideThumbnails, slideDeleteHighlight, slideNotesActive, slidesOptions, slideTimers, special, styles as stylesStore, previewOutputId } from "../../stores"
import { wait } from "../../utils/common"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { slideHasAction } from "../../components/actions/actions"
import { shouldItemBeShown } from "../../components/edit/scripts/itemHelpers"
import { clone } from "../../components/helpers/array"
import { getContrast, hexToRgb, splitRgb } from "../../components/helpers/color"
import { encodeFilePath, getMedia, getMediaCached, getMediaStyle, mediaSize } from "../../components/helpers/media"
import { referenceOutputId } from "../../components/helpers/outputAspect"
import { allOutputsHasStyleTemplate, getActiveOutputs, getFirstActiveOutput, getResolution, getSlideFilter, setTemplateStyle } from "../../components/helpers/output"
import { getGroupName, isSlideLocked } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { SelectElem } from "../system/SelectElem"
import { MediaLoader } from "../drawer/media/MediaLoader"
import { Actions } from "./Actions"
import { BreakCountdown } from "./BreakCountdown"
import { Editbox } from "../edit/editbox/Editbox"
import { Effect } from "../output/Effect"
import { Icons } from "./Icons"
import { Textbox } from "./Textbox"
import { Zoomed } from "./Zoomed"
import css from "./Slide.module.css"

interface SlideOutput {
    color: string
    line: number
    maxLines: number
    cached: boolean
    clickRevealed?: boolean
}

export interface SlideProps {
    showId: string
    slide: SlideType
    layoutSlide: SlideData
    layoutSlides?: SlideData[]
    show: Show
    color?: string | null
    index: number
    columns?: number
    output?: SlideOutput | null
    active?: boolean
    focused?: boolean
    list?: boolean
    endIndex?: number | null
    icons?: boolean
    noQuickEdit?: boolean
    altKeyPressed?: boolean
    disableThumbnails?: boolean
    centerPreview?: boolean
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

function fadeColorValue(hexColor: string | null, alpha = 0.7) {
    if (typeof hexColor !== "string" || !hexColor.startsWith("#")) return hexColor || ""
    const rgb = hexToRgb(hexColor)
    return `rgba(${rgb.r} ${rgb.g} ${rgb.b} / ${alpha})`
}

// Port (F24.18b).
export function Slide({ showId, slide, layoutSlide, layoutSlides = [], show, color = slide.color, index, columns = 1, output = null, active = false, focused = false, list = false, endIndex = null, icons = false, noQuickEdit = false, altKeyPressed = false, disableThumbnails = false, centerPreview = false, onClick }: SlideProps) {
    const currentActivePage = useStore(activePage)
    const currentActiveEdit = useStore(activeEdit)
    const currentEditMode = useStore(editMode)
    const currentSlidesOptions = useStore(slidesOptions)
    const currentFullColors = useStore(fullColors)
    const currentGroups = useStore(groups)
    const currentMedia = useStore(media)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentPlayerVideos = useStore(playerVideos)
    const currentEffects = useStore(effects)
    const currentFocusMode = useStore(focusMode)
    const currentSpecial = useStore(special)
    const currentStyles = useStore(stylesStore)
    const currentPreviewOutputId = useStore(previewOutputId)
    const currentActiveTimers = useStore(activeTimers)
    const currentSlideTimers = useStore(slideTimers)
    const currentDeleteHighlight = useStore(slideDeleteHighlight)
    const currentRefreshListBoxes = useStore(refreshListBoxes)
    const currentRefreshThumbnails = useStore(refreshSlideThumbnails)
    const currentActiveShow = useStore(activeShow)

    const [ghostBackground, setGhostBackground] = useState<Media | null>(null)
    const [mediaPath, setMediaPath] = useState("")
    const [thumbnailPath, setThumbnailPath] = useState("")
    const [mediaStyle, setMediaStyle] = useState<MediaStyle>({})
    const [duration, setDuration] = useState(0)
    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const [ratio, setRatio] = useState(1)
    const loadToken = useRef(0)

    const isLessons = show?.reference?.type === "lessons"
    const viewMode = isLessons ? "grid" : currentSlidesOptions.mode || "grid"
    const background: Media | null = layoutSlide.background ? show.media[layoutSlide.background] : slide?.settings?.backgroundImage ? ({ path: slide.settings.backgroundImage } as Media) : null
    const ghostSize = currentSpecial.optimizedMode || index + 1 > 28 ? mediaSize.small : mediaSize.drawerSize

    function checkGhostBackground() {
        let next: Media | null = null
        layoutSlides.forEach((a, i) => {
            if (i > index) return
            if (slideHasAction(a.actions, "clear_background") && (!a.disabled || i === index)) next = null
            else if (a.background && !a.disabled) next = show.media[a.background]

            const mediaData = a.background ? show.media[a.background] : null
            if (mediaData && (mediaData?.loop === false || (currentPlayerVideos[mediaData?.path || ""] as { videoType?: string } | undefined)?.videoType === "foreground")) next = null
        })
        setGhostBackground(next)
    }

    useEffect(() => {
        if (background || !(currentSpecial.optimizedMode ? index < 40 : true) || !layoutSlides.length) return
        const timeout = setTimeout(checkGhostBackground)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- las keys estabilizan los datos que el Svelte original observaba
    }, [background, currentSpecial.optimizedMode, index, layoutSlides, show, currentPlayerVideos])

    const bg = clone(background || ghostBackground)
    const bgPath = bg?.path || bg?.id || ""
    const previewId = referenceOutputId(currentOutputs, currentPreviewOutputId)
    const resolution = getResolution(null, { outputs: currentOutputs, styles: currentStyles, previewOutputId: currentPreviewOutputId }, false, previewId)
    const currentOutput = getFirstActiveOutput(currentOutputs)
    const transparentOutput = !!currentOutput?.transparent
    const currentStyle = currentStyles[currentOutput?.style || ""] || {}
    const layers = Array.isArray(currentStyle.layers) ? currentStyle.layers : ["background"]

    async function loadBackground() {
        const token = ++loadToken.current
        const isGhost = !!ghostBackground
        setMediaPath(bgPath)
        setThumbnailPath("")
        if (bg?.type === "player" || currentPlayerVideos[bgPath]) {
            const playerVid = currentPlayerVideos[bgPath] || (bg as (Media & { data?: { id?: string; type?: string } }) | null)?.data || bg
            if (playerVid?.id) {
                if (playerVid.type === "youtube") setThumbnailPath(`https://i.ytimg.com/vi/${playerVid.id}/sddefault.jpg`)
                else if (playerVid.type === "vimeo") setThumbnailPath(`https://vumbnail.com/${playerVid.id}_medium.jpg`)
                return
            }
        }
        if (isLessons) await wait(1000)
        if (token !== loadToken.current) return

        if (isGhost) {
            await wait(50)
            if (token !== loadToken.current) return
            const media = await getMediaCached(bgPath, ghostSize)
            if (!media || token !== loadToken.current) return
            setThumbnailPath(media.thumbnail)
            return
        }

        if (!bgPath.startsWith("http")) {
            getMedia(bgPath, mediaSize.drawerSize)
            const refs = _show().layouts().ref()
            if (currentSpecial.optimizedMode || refs.some((a) => a.length > 28)) getMedia(bgPath, mediaSize.small)
        }
        const media = await getMedia(bgPath, mediaSize.slideSize)
        if (!media || token !== loadToken.current) return
        setMediaPath(media.path)
        setThumbnailPath(media.thumbnail)
        setMediaStyle(getMediaStyle(media.data, currentStyle))
    }

    useEffect(() => {
        if (!bgPath || disableThumbnails) return
        const timeout = setTimeout(() => void loadBackground())
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `loadBackground` lee el estado vigente vía closures
    }, [bgPath, disableThumbnails, isLessons, ghostBackground, currentPlayerVideos, bg, currentStyle])

    useEffect(() => {
        if (!bgPath) return
        setMediaStyle(getMediaStyle(currentMedia[bgPath], currentStyle))
    }, [bgPath, currentMedia, currentStyle])

    // MediaLoader muta `duration` mediante bind:; se calcula acá para alimentar Icons sin depender de ese bind.
    useEffect(() => {
        if (!mediaPath || !thumbnailPath || bg?.type !== "video") return
        let cancelled = false
        const video = document.createElement("video")
        video.onloadeddata = () => {
            if (cancelled) return
            setDuration(Number.isFinite(video.duration) ? video.duration : 0)
        }
        video.src = encodeFilePath(mediaPath)
        return () => {
            cancelled = true
            video.src = ""
        }
    }, [mediaPath, thumbnailPath, bg?.type])

    const groupInfo = slide.globalGroup && currentGroups[slide.globalGroup] ? currentGroups[slide.globalGroup] : null
    const group = groupInfo ? (slide.globalGroup === "none" ? "." : groupInfo.default ? translateText(`groups.${groupInfo.name}`) : groupInfo.name) : slide.group
    const displayColor = groupInfo ? groupInfo.color : color
    const name = getGroupName({ show, showId }, layoutSlide.id, group, index, true)

    const timer = currentActiveTimers.reduce<number[]>((list, activeTimer, i) => {
        if (activeTimer.showId === showId && activeTimer.slideId === layoutSlide.id && slide.items?.some((item) => item?.type === "timer" && item.timer?.id === activeTimer.id)) list.push(i)
        return list
    }, [])

    const outputId = getActiveOutputs(currentOutputs, false, true)[0] || ""
    const slideTimer = active && currentSlideTimers[outputId] ? currentSlideTimers[outputId] : null
    const isBreakSlide = slide?.globalGroup === "break" && !slide?.items?.length
    const breakActiveKey = active && isBreakSlide ? layoutSlide.id : ""

    useEffect(() => {
        const interval = setInterval(() => {
            if (!Array.isArray(itemsList) || !itemsList.some((item) => item?.conditions)) return
            setConditionsUpdater((value) => value + 1)
        }, 3000)
        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `itemsList` se lee del render vigente
    }, [])

    useEffect(() => {
        if (currentRefreshListBoxes < 0) return
        const timeout = setTimeout(() => refreshListBoxes.set(-1), 100)
        return () => clearTimeout(timeout)
    }, [currentRefreshListBoxes])

    const profile = getAccess("shows") as Record<string, string>
    const isFake = layoutSlide?.id === "fake_empty"
    const isGroupLocked = isSlideLocked(showId, layoutSlide.id, show)
    const isLocked = isFake || show?.locked || isGroupLocked || profile.global === "read" || profile[show?.category || ""] === "read"

    let itemsList: Item[] = clone(slide.items) || []
    if (currentSpecial.styleTemplatePreview !== false && allOutputsHasStyleTemplate(show?.reference?.type === "scripture")) {
        itemsList = setTemplateStyle({ id: showId, index }, currentStyle, itemsList, outputId, slide?.customDynamicValues) || []
    }

    const isDeleteHighlighted = !!currentDeleteHighlight?.indexes?.includes(index) && (showId === currentActiveShow?.id || showId === currentActiveEdit?.showId)
    const highlightColor = currentDeleteHighlight?.color || "#ff5454"

    let colorStyle = ""
    let slideStyle = ""
    if (viewMode !== "lyrics" || noQuickEdit) colorStyle += "background-color: black;"
    if (!currentFullColors && (viewMode !== "lyrics" || noQuickEdit)) {
        const rgb = hexToRgb(displayColor || "")
        const isBlack = rgb.r < 30 && rgb.g < 30 && rgb.b < 30
        if (!isBlack) colorStyle += `color: ${displayColor};`
    }
    if (viewMode === "lyrics" && !noQuickEdit) colorStyle += "background-color: transparent;"
    if (!["grid", "simple", "groups", "lyrics"].includes(viewMode) && !noQuickEdit) slideStyle += `width: calc(${100 / columns}% - 6px)`

    const slideFilter = getSlideFilter(layoutSlide)
    const showIcons = icons && !altKeyPressed && viewMode !== "simple" && !currentFocusMode

    function getOutputColor(value: string) {
        if (output?.cached) {
            const rgb = value.includes("rgb") ? splitRgb(value) : hexToRgb(value)
            return "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / 0.5);"
        }
        return value
    }

    function openNotes() {
        if (currentEditMode === "text_edit") editMode.set("default")
        slideNotesActive.set(true)
        activeEdit.set({ slide: index, items: [], showId })
        activePage.set("edit")
    }

    const zoomedBackground = slide.items?.length && (viewMode !== "lyrics" || noQuickEdit) ? (transparentOutput || currentSpecial.transparentSlides ? "var(--primary);" : slide.settings?.color || currentStyle.background || "black") : viewMode !== "lyrics" || noQuickEdit ? fadeColorValue(displayColor) : ""
    const finalZoomedBackground = zoomedBackground || "transparent"
    const checkered = viewMode !== "lyrics" && (slide.items?.length || 0) > 0 && (transparentOutput || currentSpecial.transparentSlides) && !bg

    function renderNameHtml(fallback: string) {
        return { __html: name === null || name === "." ? fallback : name || "—" }
    }

    const rootStyle = `${output?.color ? "outline: 2px solid " + getOutputColor(output.color) + ";" : ""}width: ${["grid", "simple", "groups"].includes(viewMode) || noQuickEdit ? 100 / columns : 100}%;`
    const slideContentStyle = `${slideStyle};${isDeleteHighlighted ? `--highlight-color: ${highlightColor};--highlight-bg: ${fadeColorValue(highlightColor, 0.35)};` : ""}`
    const slideClass = isFake ? "slideFake" : isLocked ? "default" : currentFocusMode ? "slideFocus" : name === null ? "slideChild" : "slide"

    return (
        <div className={`main ${css.main} ${active ? `active ${css.active}` : ""} ${focused ? `focused ${css.focused}` : ""}`} style={cssTextToStyle(rootStyle)}>
            {currentFullColors ? <div className={`group_box ${css.group_box}`} style={{ backgroundColor: displayColor || "" }} /> : null}

            {showIcons ? (
                <>
                    <Icons slide={slide} timer={timer} layoutSlide={layoutSlide} background={background} backgroundCount={layoutSlides.reduce((count, layoutRef) => count + (layoutRef.background ? 1 : 0), 0)} duration={duration} columns={columns} index={index} style={viewMode === "lyrics" ? "padding-top: 23px;" : ""} />
                    <Actions slide={slide} columns={columns} index={index} actions={layoutSlide.actions || {}} />
                </>
            ) : null}

            <div className={`slide context ${slideClass} ${css.slide} ${layoutSlide.disabled ? `disabled ${css.disabled}` : ""} ${endIndex !== null && index > endIndex ? `afterEnd ${css.afterEnd}` : ""} ${isDeleteHighlighted ? `isDeleteHighlighted ${css.isDeleteHighlighted}` : ""}`} style={cssTextToStyle(slideContentStyle)} role="none" onClick={onClick}>
                <div className={`hover overlay ${css.hover}`} />

                {isDeleteHighlighted ? (
                    <div className={`deleteOverlay ${css.deleteOverlay}`}>
                        <Icon id={currentDeleteHighlight?.icon || "delete"} size={8 * (1 / columns)} style={cssTextToStyle(`color: ${highlightColor};`)} white />
                    </div>
                ) : null}

                <div style={{ width: "100%", height: "100%" }}>
                    <SelectElem id="slide" data={{ index, showId }} draggable={!currentFocusMode && !isLocked} shiftRange={layoutSlides.map((_, position) => ({ index: position, showId }))} onlyRightClickSelect={currentFocusMode} selectable={!isLocked} trigger={list ? "column" : "row"} style={cssTextToStyle(colorStyle)}>
                        {viewMode === "lyrics" && !noQuickEdit ? (
                            <div className={`label ${css.label}`} data-title={removeTagsAndContent(name || "")} style={{ color: displayColor || "", marginBottom: "5px" }}>
                                <span style={{ color: "var(--text)", opacity: 0.85, fontSize: "0.9em" }}>{index + 1}</span>
                                <span className={`text ${css.text}`} dangerouslySetInnerHTML={renderNameHtml("")} />
                            </div>
                        ) : null}

                        <Zoomed background={finalZoomedBackground} checkered={!!checkered} resolution={resolution} zoom={viewMode !== "lyrics" || noQuickEdit} aspectRatio={viewMode !== "lyrics" || noQuickEdit} disableStyle={viewMode === "lyrics" && !noQuickEdit} relative={viewMode === "lyrics" && !noQuickEdit} onRatioChange={setRatio}>
                            {!altKeyPressed && bg && (viewMode !== "lyrics" || noQuickEdit) && (background || layers.includes("background")) ? (
                                <div key={String(currentRefreshThumbnails)} className={`background ${css.background} ${!background ? `ghost ${css.ghost}` : ""}`} style={cssTextToStyle(`zoom: ${1 / ratio};${slideFilter}`)}>
                                    <MediaLoader name={translateText("error.load")} ghost={!background} path={mediaPath} thumbnailPath={thumbnailPath} cameraGroup={bg.cameraGroup || ""} type={bg.type !== "player" ? bg.type : null} mediaStyle={mediaStyle} duration={duration} getDuration={false} />
                                </div>
                            ) : null}

                            {!altKeyPressed && layoutSlide.effects?.length && (viewMode !== "lyrics" || noQuickEdit) ? layoutSlide.effects.map((id) => (currentEffects[id]?.placeUnderSlide === true ? <Effect key={id} effect={{ id, ...currentEffects[id] }} preview /> : null)) : null}

                            {!altKeyPressed && layoutSlide.overlays?.length && (viewMode !== "lyrics" || noQuickEdit) ? layoutSlide.overlays.map((id) => (currentOverlays[id]?.placeUnderSlide === true ? (currentOverlays[id]?.items || []).map((item, itemIndex) => <Textbox key={`${id}-${itemIndex}`} item={item} ref={{ type: "overlay", id }} preview miniPreview />) : null)) : null}

                            {slide.items
                                ? itemsList.map((item, i) => {
                                      const allowedInLyrics = viewMode !== "lyrics" || item.type === undefined || ["text", "events", "list"].includes(item.type)
                                      if (!item || !allowedInLyrics) return null
                                      if (!shouldItemBeShown(item, [], { outputId, id: showId, slideIndex: index }, conditionsUpdater, true)) return null
                                      return (
                                          <Textbox
                                              key={item.id || i}
                                              backdropFilter={layoutSlide["backdrop-filter"] || ""}
                                              item={item}
                                              isOutputted={!!output?.color}
                                              revealed={output?.line ?? -1}
                                              itemIndex={i}
                                              ratio={ratio}
                                              slideIndex={index}
                                              ref={{ type: "show", showId, slideId: layoutSlide.id, id: layoutSlide.id, origin: show.origin }}
                                              style={viewMode !== "lyrics" || noQuickEdit}
                                              smallFontSize={viewMode === "lyrics" && !noQuickEdit}
                                              clickRevealed={!!output?.clickRevealed}
                                              centerPreview={centerPreview}
                                              preview
                                              chords={item.chords?.enabled}
                                          />
                                      )
                                  })
                                : null}

                            {!altKeyPressed && layoutSlide.effects?.length && (viewMode !== "lyrics" || noQuickEdit) ? layoutSlide.effects.map((id) => (currentEffects[id] && !currentEffects[id]?.placeUnderSlide ? <Effect key={id} effect={{ id, ...currentEffects[id] }} preview /> : null)) : null}

                            {!altKeyPressed && layoutSlide.overlays?.length && (viewMode !== "lyrics" || noQuickEdit) ? layoutSlide.overlays.map((id) => (currentOverlays[id] && !currentOverlays[id]?.placeUnderSlide ? (currentOverlays[id]?.items || []).map((item, itemIndex) => <Textbox key={`${id}-${itemIndex}`} item={item} ref={{ type: "overlay", id }} preview miniPreview />) : null)) : null}

                            {isBreakSlide && layoutSlide.breakDuration ? <BreakCountdown activeKey={breakActiveKey} breakDuration={layoutSlide.breakDuration} ratio={ratio} /> : null}
                        </Zoomed>

                        {viewMode === "simple" ? (
                            <>
                                {output?.maxLines ? (
                                    <div className={`lineProgress ${css.lineProgress}`}>
                                        <div className={`fill ${css.fill}`} style={{ width: `${((output.line + 1) / output.maxLines) * 100}%`, backgroundColor: getOutputColor(output.color) }} />
                                    </div>
                                ) : null}
                                <div data-title={name || ""} style={{ height: "2px", backgroundColor: displayColor || "" }} />
                            </>
                        ) : viewMode !== "lyrics" || noQuickEdit ? (
                            <div className={`label ${css.label}`} data-title={removeTagsAndContent(name || "")} style={currentFullColors ? { backgroundColor: displayColor || "", color: getContrast(displayColor || "") } : { borderBottom: `2px solid ${displayColor || "var(--primary-darkest)"}` }}>
                                {name === null && currentFullColors && currentActivePage === "show" ? <div className={`childLink ${css.childLink} ${css.full}`} style={{ backgroundColor: displayColor || "" }} /> : null}
                                {output?.maxLines ? (
                                    <div className={`lineProgress ${css.lineProgress}`}>
                                        <div className={`fill ${css.fill}`} style={{ width: `${((output.line + 1) / output.maxLines) * 100}%`, backgroundColor: getOutputColor(output.color) }} />
                                    </div>
                                ) : null}
                                {slideTimer && output ? (
                                    <div className={`slideTimer ${css.slideTimer}`} style={output.maxLines ? { top: "-3px" } : undefined}>
                                        <div className={`fill ${css.fill}`} style={{ width: `${(slideTimer.time / slideTimer.max) * 100}%`, backgroundColor: getOutputColor(output.color) }} />
                                    </div>
                                ) : null}
                                {slide.notes && icons ? (
                                    <button className={`notes ${css.notes}`} data-title={slide.notes} onClick={openNotes}>
                                        <Icon id="notes" white right />
                                        <span>
                                            {slide.notes.slice(0, 80)}
                                            {slide.notes.length > 80 ? "..." : ""}
                                        </span>
                                    </button>
                                ) : null}
                                <span style={{ color: currentFullColors ? getContrast(displayColor || "") : "var(--text)", opacity: 0.85, fontSize: "0.9em" }}>{index + 1}</span>
                                <span className={`text ${css.text}`} style={name === null || name === "." ? { opacity: 0 } : undefined} dangerouslySetInnerHTML={renderNameHtml("-")} />
                                {isGroupLocked ? (
                                    <span className={`lock ${css.lock}`}>
                                        <Icon id="lock" size={0.7} style={cssTextToStyle("color: var(--text);opacity: 0.3;")} white />
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </SelectElem>
                </div>
            </div>

            {viewMode === "list" && !noQuickEdit ? (
                <>
                    <hr className={css.divider} />
                    <div className={`quickEdit ${css.quickEdit}`} style={{ fontSize: `${(-1.1 * currentSlidesOptions.columns + 12) / 6}em` }} data-index={index}>
                        {currentRefreshListBoxes >= 0 && currentRefreshListBoxes !== index ? slide.items?.map((item, itemIndex) => (item?.lines ? <Editbox key={itemIndex} item={item} ref={{ showId, id: layoutSlide.id }} editIndex={index} index={itemIndex} plain /> : null)) : null}
                    </div>
                </>
            ) : null}
        </div>
    )
}
