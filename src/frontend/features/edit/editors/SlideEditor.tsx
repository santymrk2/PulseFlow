import { useEffect, useRef, useState } from "react"
import type { MediaStyle } from "../../../../types/Main"
import { activeEdit, activePopup, activeShow, alertMessage, editMode, focusMode, media, outputs, overlays, playerVideos, resized, showsCache, slideNotesActive, special, styles as stylesStore, previewOutputId } from "../../../shared/core/stores"
import { transposeText } from "../../../shared/utils/chordTranspose"
import { DEFAULT_WIDTH } from "../../../shared/utils/common"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { slideHasAction } from "../../actions/logic/actions"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { history } from "../../../shared/utils/helpers/history"
import { getExtension, getMedia, getMediaFileFromClipboard, getMediaLayerType, getMediaStyle, getMediaType, getThumbnailPath, mediaSize } from "../../../shared/utils/helpers/media"
import { getFirstActiveOutput, getResolution, getSlideFilter } from "../../../shared/utils/helpers/output"
import { getLayoutRef, isSlideLocked } from "../../../shared/utils/helpers/show"
import { _show } from "../../../shared/utils/helpers/shows"
import { getStyles } from "../../../shared/utils/helpers/style"
import { getStyleResolution } from "../../slide/logic/getStyleResolution"
import { formatText } from "../../show/logic/formatTextEditor"
import { getPlainEditorText } from "../../show/logic/getTextEditor"
import { getShowChords, getUsedChords } from "../logic/scripts/chords"
import { addItem } from "../logic/scripts/itemHelpers"
import { setCaretAtEnd } from "../logic/scripts/textStyle"
import { centerZoom } from "../logic/scripts/zoom"
import { Button } from "../../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../../shared/ui/kit/floating-bar/FloatingBar"
import { ZoomControl } from "../../../shared/ui/kit/zoom-control/ZoomControl"
import { Center } from "../../../shared/ui/system/Center"
import { DropArea } from "../../../shared/ui/system/DropArea"
import { Resizeable } from "../../../shared/ui/system/Resizeable"
import { Snaplines, type Snapline, type SnaplinesMouse } from "../../../shared/ui/system/Snaplines"
import { Zoomed } from "../../slide/Zoomed"
import { Textbox } from "../../slide/Textbox"
import { MediaLoader } from "../../drawer/media/MediaLoader"
import { Notes } from "../../show/tools/Notes"
import { Timeline } from "../../timeline/Timeline"
import { Editbox } from "../editbox/Editbox"
import { EditHeader } from "../EditHeader"
import { useStore } from "../../../shared/ui/hooks/useStore"
import css from "./SlideEditor.module.css"

// (F24.21c).
export function SlideEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentEditMode = useStore(editMode)
    const currentFocusMode = useStore(focusMode)
    const currentMedia = useStore(media)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentPlayerVideos = useStore(playerVideos)
    const currentResized = useStore(resized)
    const currentShowsCache = useStore(showsCache)
    const currentSlideNotesActive = useStore(slideNotesActive)
    const currentSpecial = useStore(special)
    const currentStylesStore = useStore(stylesStore)
    const currentPreviewOutputId = useStore(previewOutputId)

    const [lines, setLines] = useState<Snapline[]>([])
    const [mouse, setMouse] = useState<SnaplinesMouse | null>(null)
    const [newStyles, setNewStyles] = useState<{ [key: string]: string | number }>({})
    const [ratio, setRatio] = useState(1)
    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const [mediaPath, setMediaPath] = useState("")
    const [thumbnailPath, setThumbnailPath] = useState("")
    const [altTemp, setAltTemp] = useState(false)
    const [altKeyPressed, setAltKeyPressed] = useState(false)
    const [chordsAction, setChordsAction] = useState("")
    const [note, setNote] = useState("")
    const hideOverflow = false
    const loadFullImage = false

    const parentRef = useRef<HTMLDivElement>(null)
    const altTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loadTokenRef = useRef(0)
    const [width, setWidth] = useState(0)
    const [height, setHeight] = useState(0)

    const active = currentActiveEdit.items || []
    const activeKey = active.join(",")
    const lastActiveIds = useRef("")
    useEffect(() => {
        if (activeKey !== lastActiveIds.current) {
            setNewStyles({})
            lastActiveIds.current = activeKey
        }
    }, [activeKey])

    const currentShowId = currentActiveShow?.id || currentActiveEdit.showId || ""
    const currentShow = currentShowsCache[currentShowId]

    useEffect(() => {
        if (currentShowId && currentShow && currentActiveEdit.slide === null && _show(currentShowId).slides().get().length) {
            activeEdit.set({ slide: 0, items: [], showId: currentShowId })
        }
    }, [currentShowId, currentShow, currentActiveEdit.slide])

    const ref = currentShowId && currentShow ? getLayoutRef(currentShowId) : []
    const Slide = currentActiveEdit.slide !== null && ref?.[currentActiveEdit.slide!] ? _show(currentShowId).slides([ref[currentActiveEdit.slide!]?.id]).get()?.[0] : null

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStylesStore, $previewOutputId: currentPreviewOutputId })

    const layoutSlide = ref?.[currentActiveEdit.slide!]?.data || {}
    let bgId = layoutSlide.background || null

    // ghost background
    if (!bgId && !Slide?.settings?.backgroundImage) {
        ref?.forEach((a, i) => {
            if (a.data && i <= (currentActiveEdit.slide ?? -1) && !a.data.disabled) {
                if (slideHasAction(a.data.actions, "clear_background")) bgId = null
                else if (a.data.background) bgId = a.data.background

                const mediaData = a.data.background ? currentShow?.media[a.data.background] : null
                const mediaType = mediaData ? getMediaLayerType(mediaData.path || "", (currentMedia as Record<string, never>)[mediaData.path || ""] as never) : ""
                if (mediaData && (mediaData?.loop === false || mediaType === "foreground")) bgId = null
            }
        })
    }

    const background = bgId && currentShowId ? currentShow?.media[bgId] : Slide?.settings?.backgroundImage ? { path: Slide.settings.backgroundImage, type: currentPlayerVideos[Slide.settings.backgroundImage] ? "player" : getMediaType(getExtension(Slide.settings.backgroundImage)), id: "" } : null
    const backgroundPath = (background as { path?: string } | undefined)?.path || ""
    const bgPath = backgroundPath || (background as { id?: string } | undefined)?.id || ""

    useEffect(() => {
        const token = ++loadTokenRef.current
        async function loadBackground() {
            if (!bgPath) {
                setMediaPath("")
                setThumbnailPath("")
                return
            }
            setMediaPath(bgPath)
            setThumbnailPath(getThumbnailPath(bgPath, mediaSize.slideSize))

            if ((background as { type?: string } | undefined)?.type === "player" || currentPlayerVideos[bgPath]) {
                const playerVid = currentPlayerVideos[bgPath] || (background as { data?: unknown } | undefined)?.data || background
                if (playerVid?.id) {
                    if (playerVid.type === "youtube") setThumbnailPath(`https://i.ytimg.com/vi/${playerVid.id}/sddefault.jpg`)
                    else if (playerVid.type === "vimeo") setThumbnailPath(`https://vumbnail.com/${playerVid.id}_medium.jpg`)
                    return
                }
            }

            const media = await getMedia(bgPath, mediaSize.slideSize)
            if (token !== loadTokenRef.current || !media) return
            setMediaPath(media.path)
            setThumbnailPath(media.thumbnail)
        }
        void loadBackground()
    }, [bgPath, currentPlayerVideos])

    const currentOutput = getFirstActiveOutput(currentOutputs)
    const transparentOutput = !!currentOutput?.transparent
    const currentStyle = (currentStylesStore as Record<string, unknown>)[(currentOutput as { style?: string } | undefined)?.style || ""] || {}

    let mediaStyle: MediaStyle = {}
    if (mediaPath) mediaStyle = getMediaStyle((currentMedia as Record<string, never>)[bgPath] as never, currentStyle as never)

    const latest = useRef({ newStyles, active, currentShow, ref, currentActiveEdit, currentActiveShow, currentShowId })
    latest.current = { newStyles, active, currentShow, ref, currentActiveEdit, currentActiveShow, currentShowId }

    function updateStyles() {
        const { newStyles, active, currentShow, ref, currentActiveEdit, currentActiveShow, currentShowId } = latest.current
        if (!Object.keys(newStyles || {}).length) return

        const slideIndex = currentActiveEdit.slide ?? 0
        const slideId = ref[slideIndex]?.id
        if (!slideId) return

        let items = currentShow?.slides?.[slideId]?.items || []
        let values: string[] = []
        active.forEach((id: number) => {
            let item = items[id]
            if (item) {
                let stylesObj = getStyles(item.style)
                let textStyles = ""
                const multi = (newStyles as unknown as { __multiPositions?: Record<string, Record<string, string | number>> }).__multiPositions
                const itemNewStyles = multi ? multi[id] || {} : newStyles
                Object.entries(itemNewStyles || {}).forEach(([key, value]) => ((stylesObj as Record<string, string>)[key] = String(value)))
                Object.entries(stylesObj).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))
                values.push(textStyles)
            }
        })

        let activeItems = [...active]
        let historyShow: unknown = currentActiveShow
        if (!historyShow && currentShowId) historyShow = { type: "show", id: currentShowId, index: slideIndex }
        else if (!historyShow) return

        history({
            id: "setStyle",
            newData: { style: { key: "style", values } },
            location: { page: "edit", show: historyShow, slide: slideId, items: activeItems }
        } as unknown as Parameters<typeof history>[0])

        if (!items[0]?.auto) return
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = setTimeout(() => {
            showsCache.update(((a: Record<string, unknown>) => {
                const shows = a as Record<string, { slides?: Record<string, { items?: Array<{ autoFontSize?: number }> }> }>
                if (!shows[currentShowId]?.slides?.[slideId]?.items?.[activeItems[0] || 0]?.autoFontSize) return a
                delete shows[currentShowId].slides![slideId].items![activeItems[0] || 0].autoFontSize
                return a
            }) as unknown as Parameters<typeof showsCache.update>[0])
        }, 3000)
    }

    useEffect(() => {
        if (active.length) setTimeout(updateStyles)
        else setNewStyles({})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newStyles, activeKey])

    useEffect(() => {
        function keydown(e: KeyboardEvent) {
            if (!e.altKey && altTimeoutRef.current) clearTimeout(altTimeoutRef.current)
            if (e.altKey) {
                if (altTemp) return
                setAltTemp(true)
                altTimeoutRef.current = setTimeout(() => {
                    if (document.hasFocus()) setAltKeyPressed(true)
                }, 300)
            }
        }
        function keyup(e: KeyboardEvent) {
            if (e.key === "Alt" || !e.altKey) {
                setAltTemp(false)
                setAltKeyPressed(false)
            }
        }
        function blurred() {
            setAltTemp(false)
            setAltKeyPressed(false)
        }
        async function paste(e: ClipboardEvent) {
            const mediaData = await getMediaFileFromClipboard(e as unknown as Parameters<typeof getMediaFileFromClipboard>[0])
            if (mediaData) addItem("media", null as never, { src: mediaData } as never)
        }

        window.addEventListener("keydown", keydown)
        window.addEventListener("keyup", keyup)
        window.addEventListener("blur", blurred)
        window.addEventListener("paste", paste as unknown as EventListener)
        return () => {
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("keyup", keyup)
            window.removeEventListener("blur", blurred)
            window.removeEventListener("paste", paste as unknown as EventListener)
            if (altTimeoutRef.current) clearTimeout(altTimeoutRef.current)
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [altTemp])

    useEffect(() => {
        const el = parentRef.current
        if (!el) return
        const update = () => {
            setWidth(el.offsetWidth)
            setHeight(el.offsetHeight)
        }
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    function updateZoom(value: number) {
        setZoom(value)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, parentRef.current ?? undefined, ".droparea")
    }

    // CHORDS
    const slideChords = Slide ? getUsedChords(Slide) : []
    const allChords = getShowChords(currentShow)
    const usedChords = slideChords.length + allChords.length ? [...new Set([...slideChords, ...allChords])] : []

    function setDefaultChordsAction() {
        if (chordsAction === "") {
            alertMessage.set("actions.chord_info")
            activePopup.set("alert")
        } else {
            setChordsAction("")
        }
    }

    function transposeUp() {
        const text = getPlainEditorText("", false)
        formatText(transposeText(text, 1), currentShowId)
    }
    function transposeDown() {
        const text = getPlainEditorText("", false)
        formatText(transposeText(text, -1), currentShowId)
    }

    const slideFilter = getSlideFilter(layoutSlide)
    const checkered = (transparentOutput || currentSpecial.transparentSlides) && !background

    useEffect(() => {
        if (currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined) setNote(Slide?.notes || "")
    }, [currentActiveEdit.slide, Slide?.notes, Slide?.id])

    function edit(e: string) {
        const value = e
        const slideId = ref[currentActiveEdit.slide!]?.id
        if (!Slide || Slide.notes === value || !slideId) return
        _show(currentShowId).slides([slideId]).set({ key: "notes", value })
    }

    const profile = getAccess("shows")
    const isGroupLocked = isSlideLocked(currentShowId, ref[currentActiveEdit.slide ?? -1]?.id || "", currentShowsCache)
    const isLocked = currentShow?.locked || isGroupLocked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    useEffect(() => {
        if (!Slide) return
        const t = setTimeout(() => {
            if (Slide?.items?.length === 1) {
                activeEdit.update(((a) => {
                    if (a?.items?.length) return a
                    return { ...(a || {}), items: [0] }
                }) as unknown as Parameters<typeof activeEdit.update>[0])
                const elem = document.querySelector(".editItem")?.querySelector(".edit") as HTMLElement | null
                if (elem && !currentSpecial.slideTimelineActive) {
                    elem.addEventListener("focus", () => setCaretAtEnd(elem), { once: true })
                    elem.focus()
                }
            }
        })
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentActiveEdit.slide, Slide?.id])

    function convertBackgroundToMedia() {
        const currentBackgroundPath = currentShow?.media?.[ref[currentActiveEdit.slide ?? -1]?.data.background || ""]?.path || ""
        addItem("media", null as never, { src: currentBackgroundPath } as never, "" as never, { left: "0px", top: "0px", width: "1920px", height: "1080px" } as never, 0)

        showsCache.update(((a: Record<string, unknown>) => {
            const currentRef = ref[currentActiveEdit.slide ?? -1]
            if (!currentRef) return a
            const layoutId = currentShow?.settings?.activeLayout || ""
            const shows = a as Record<string, { layouts?: Record<string, { slides?: Array<{ background?: string; children?: Record<string, { background?: string }> }> }> }>
            const layoutSlides = shows[currentShowId]?.layouts?.[layoutId]?.slides
            if (!layoutSlides) return a
            if (currentRef.type === "child" && currentRef.parent) {
                const parentSlide = layoutSlides[currentRef.parent.index]
                if (parentSlide?.children?.[currentRef.id]?.background) delete parentSlide.children[currentRef.id].background
            } else if (layoutSlides[currentRef.index]?.background) {
                delete layoutSlides[currentRef.index].background
            }
            return a
        }) as unknown as Parameters<typeof showsCache.update>[0])
    }

    const hasBackground = !!(currentShow?.media?.[ref[currentActiveEdit.slide ?? -1]?.data.background || ""]?.path || "")
    const bottomHeight = 40
    const widthOrHeight = getStyleResolution(resolution, width, height, "fit", { zoom })
    const notesText = (Slide?.notes || "").replaceAll("\n", "&nbsp;")
    const notesVisible = !!Slide?.notes

    return (
        <>
            {currentShow ? <EditHeader showId={currentShowId} /> : null}

            <div className={`editArea ${css.editArea}`}>
                <div ref={parentRef} className={`parent ${zoom >= 1 ? `noOverflow ${css.noOverflow}` : ""} ${css.parent}`} style={{ overflow: "auto" }}>
                    {Slide ? (
                        <DropArea id="edit" file>
                            <Zoomed background={(transparentOutput || currentSpecial.transparentSlides) && !background ? "transparent" : background ? "black" : Slide?.settings?.color || (currentStyle as { background?: string }).background || "black"} checkered={checkered} border={checkered} resolution={resolution} style={widthOrHeight} onRatioChange={setRatio} hideOverflow={hideOverflow} center>
                                {!altKeyPressed && background ? (
                                    <div className="background" style={{ zoom: 1 / ratio, opacity: 0.5, height: "100%", width: "100%", ...(slideFilter ? ({ filter: slideFilter } as React.CSSProperties) : {}) }}>
                                        <MediaLoader path={mediaPath} thumbnailPath={thumbnailPath} loadFullImage={loadFullImage} type={((background as { type?: string } | undefined)?.type !== "player" ? ((background as { type?: string } | undefined)?.type ?? null) : null) as never} mediaStyle={mediaStyle} />
                                    </div>
                                ) : null}

                                <div className="overlays preview" style={{ opacity: 0.5 }}>
                                    {!altKeyPressed && layoutSlide.overlays?.length ? layoutSlide.overlays.map((id: string) => (currentOverlays[id] ? (currentOverlays[id]?.items || []).map((item, i) => <Textbox key={`${id}-${i}`} item={item} ref={{ type: "overlay", id }} preview />) : null)) : null}
                                </div>

                                {!isLocked ? <Snaplines lines={lines} mouse={mouse} newStyles={newStyles} ratio={ratio} active={active} onLinesChange={setLines} onMouseChange={setMouse} onNewStylesChange={setNewStyles} /> : null}

                                {(Slide.items || []).map((item, index) => (
                                    <Editbox
                                        key={`${currentActiveEdit.slide || 0}-${index}`}
                                        backdropFilter={layoutSlide["backdrop-filter"] || ""}
                                        item={item}
                                        chordsMode={currentEditMode === "chords"}
                                        chordsAction={chordsAction}
                                        ref={{ showId: currentShowId, id: Slide.id, origin: (currentShow as { origin?: string } | undefined)?.origin }}
                                        index={index}
                                        ratio={ratio}
                                        mouse={(mouse as unknown as Parameters<typeof Editbox>[0]["mouse"]) || undefined}
                                        onMouseChange={(m) => setMouse(m as unknown as SnaplinesMouse)}
                                    />
                                ))}
                            </Zoomed>
                        </DropArea>
                    ) : (
                        <Center size={2} faded>
                            <T id="empty.slide" />
                        </Center>
                    )}
                </div>

                {currentSlideNotesActive ? (
                    <Resizeable id="notes" side="bottom" defaultWidth={DEFAULT_WIDTH * 0.5} maxWidth={DEFAULT_WIDTH * 0.8} minWidth={47}>
                        <div className={`dark ${css.dark}`} style={{ display: "contents" }}>
                            <Notes value={note} autofocus onEdit={(v) => edit(v)} />
                        </div>
                        <Button title="actions.close" onClick={() => slideNotesActive.set(false)} style={{ position: "absolute", top: 9, right: 4.5, opacity: 0.8, padding: 8 }} white>
                            <Icon id={note ? "remove" : "close"} white />
                        </Button>
                    </Resizeable>
                ) : notesVisible ? (
                    <div className={`notes ${css.notes}`} role="none" data-title={translateText("tools.notes")} onClick={() => slideNotesActive.set(true)}>
                        <Icon id="notes" right white />
                        <p dangerouslySetInnerHTML={{ __html: notesText }} />
                    </div>
                ) : null}

                {!currentFocusMode && !isLocked && !currentSlideNotesActive && !currentSpecial.slideTimelineActive ? (
                    <FloatingBar side="left" bottom={notesVisible ? bottomHeight : 10} onlyOne={currentEditMode !== "chords" && hasBackground}>
                        {currentEditMode === "chords" ? (
                            <>
                                <Button onClick={transposeUp} title="edit.transpose_up">
                                    <Icon id="arrow_up" size={1.3} white />
                                </Button>
                                <Button onClick={transposeDown} title="edit.transpose_down">
                                    <Icon id="arrow_down" size={1.3} white />
                                </Button>
                                <div className="divider"></div>
                                <Button isActive={!chordsAction} onClick={setDefaultChordsAction}>
                                    <p>
                                        <T id="popup.choose_chord" />
                                    </p>
                                </Button>
                                {usedChords.map((chord) => (
                                    <Button key={chord} isActive={chordsAction === chord} onClick={() => setChordsAction(chord)}>
                                        {chord}
                                    </Button>
                                ))}
                            </>
                        ) : hasBackground ? (
                            <Button onClick={convertBackgroundToMedia}>
                                <Icon id="autofill" />
                                <T id="edit.convert_to_media_item" />
                            </Button>
                        ) : null}

                        <ZoomControl hidden={currentEditMode === "chords" || hasBackground} columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={(v) => updateZoom(v)} onOrigin={(o) => setZoomOrigin(o)} />
                    </FloatingBar>
                ) : null}

                {currentSpecial.slideTimelineActive ? (
                    <>
                        <ZoomControl hidden columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={(v) => updateZoom(v)} onOrigin={(o) => setZoomOrigin(o)} />
                        <Resizeable id="slide_timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
                            <Timeline type="slide" isClosed={((currentResized as { slide_timeline?: number } | undefined)?.slide_timeline ?? 0) <= 40} />
                        </Resizeable>
                    </>
                ) : null}
            </div>
        </>
    )
}
