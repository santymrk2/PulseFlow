import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { get } from "../../lib/store"
import { activeEdit, activeFocus, activePage, activePopup, alertMessage, cachedShowsData, categories, focusMode, groups, lessonsLoaded, notFound, outLocked, outputs, outputSlideCache, showsCache, slidesOptions, special, templates } from "../../stores"
import { hasNewerUpdate, wait } from "../../utils/common"
import { getAccess } from "../../utils/profile"
import { videoExtensions } from "../../values/extensions"
import { customActionActivation } from "../../components/actions/actions"
import { loadCustomFonts } from "../../components/helpers/fonts"
import { history } from "../../components/helpers/history"
import { encodeFilePath, getExtension } from "../../components/helpers/media"
import { getActiveOutputs, refreshOut, setOutput } from "../../components/helpers/output"
import { getCachedShow } from "../../components/helpers/show"
import { checkActionTrigger, getFewestOutputLines, getFewestOutputLinesReveal, getItemWithMostLines, updateOut } from "../../components/helpers/showActions"
import { _show } from "../../components/helpers/shows"
import { Loader } from "../main/Loader"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { SkeletonSlide } from "../slide/SkeletonSlide"
import { Slide } from "../slide/Slide"
import { Center } from "../system/Center"
import { DropArea } from "../system/DropArea"
import { Autoscroll } from "../system/Autoscroll"
import { Button } from "../ui/button/Button"
import { ShowHeader } from "./ShowHeader"
import styles from "./Slides.module.css"

interface ActiveSlide {
    color: string
    line: number
    maxLines: number
    cached: boolean
    clickRevealed: boolean
}

export interface SlidesProps {
    showId: string
    layout?: string
    projectIndex?: number
}

// Port (F24.20a).
export function Slides({ showId, layout = "", projectIndex = -1 }: SlidesProps) {
    const currentShowsCache = useStore(showsCache)
    const currentCachedShowsData = useStore(cachedShowsData)
    const currentFocusMode = useStore(focusMode)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentOutputSlideCache = useStore(outputSlideCache)
    const currentSlidesOptions = useStore(slidesOptions)
    const currentGroups = useStore(groups)
    const currentCategories = useStore(categories)
    const currentTemplates = useStore(templates)
    const currentSpecial = useStore(special)
    const currentLessonsLoaded = useStore(lessonsLoaded)
    const currentNotFound = useStore(notFound)

    const currentShow = currentShowsCache[showId]
    const activeLayout = layout || currentShow?.settings?.activeLayout || ""
    const layoutSlides = currentShow ? getCachedShow(showId, activeLayout, currentCachedShowsData)?.layout || [] : []
    const isLessons = currentShow?.reference?.type === "lessons"
    const mode = isLessons ? "grid" : currentSlidesOptions.mode || "grid"
    const gridMode = mode === "grid" || mode === "simple" || mode === "groups"

    const profile = getAccess("shows")
    const isLocked = !!currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    const activeOutputs = getActiveOutputs(currentOutputs, false, true)

    const [hasMounted, setHasMounted] = useState(false)
    const [shouldSkipSmooth, setShouldSkipSmooth] = useState(0)
    const [offset, setOffset] = useState(-1)
    const [endIndex, setEndIndex] = useState<number | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [altKeyPressed, setAltKeyPressed] = useState(false)
    const [disableAutoScroll, setDisableAutoScroll] = useState(false)
    const [activeSlides, setActiveSlides] = useState<Record<number, ActiveSlide>>({})

    const isDestroyed = useRef(false)
    const scrollElem = useRef<HTMLDivElement>(null)
    const timeout = useRef<ReturnType<typeof setTimeout> | true | null>(null)
    const loadingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lessonsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lazyLoader = useRef(1)
    const lazyLoading = useRef(false)
    const lessonsFailed = useRef(0)
    const previousTemplateSignature = useRef("")
    const altTemp = useRef(false)
    const altTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const disableAutoScrollRef = useRef(false)

    function showSlideRef() {
        return _show(showId).layouts([activeLayout]).ref()[0] || []
    }

    useEffect(() => {
        isDestroyed.current = false
        const mountTimer = setTimeout(() => setHasMounted(true), 80)
        if (currentShow?.settings?.customFonts) loadCustomFonts(currentShow.settings.customFonts)
        return () => {
            isDestroyed.current = true
            setHasMounted(false)
            clearTimeout(mountTimer)
            if (timeout.current && typeof timeout.current !== "boolean") clearTimeout(timeout.current)
            if (loadingTimeout.current) clearTimeout(loadingTimeout.current)
            if (lessonsTimeout.current) clearTimeout(lessonsTimeout.current)
            if (nextScrollTimeout.current) clearTimeout(nextScrollTimeout.current)
            if (altTimeout.current) clearTimeout(altTimeout.current)
        }
    }, [])

    // fix broken media
    useEffect(() => {
        if (!showId) return
        const show = get(showsCache)[showId]
        if (!show) return
        showsCache.update((all) => {
            if (!all[showId]) return all
            Object.entries(show.layouts || {}).forEach(([layoutId, currentLayout]) => {
                if (Array.isArray(currentLayout.slides)) {
                    currentLayout.slides.forEach((slide, i) => {
                        const backgroundId = slide.background
                        if (backgroundId && !show.media[backgroundId]) {
                            if (all[showId].layouts?.[layoutId]?.slides?.[i]) delete all[showId].layouts[layoutId].slides[i].background
                        }
                    })
                }
            })
            return all
        })
    }, [showId])

    // reset offset when show changes
    useEffect(() => {
        setOffset(0)
        setShouldSkipSmooth((value) => value + 1)
    }, [showId])

    // update scroll offset
    useEffect(() => {
        const timer = setTimeout(() => {
            void (async () => {
                if (!scrollElem.current) return
                if (await hasNewerUpdate("SHOWS_SCROLL_OFFSET", 10)) return
                const output = currentOutputs[activeOutputs[0]]
                if (output?.out?.slide && showId === output.out.slide.id && activeLayout === output.out.slide.layout) {
                    const columns = mode === "grid" ? (currentSlidesOptions.columns > 2 ? currentSlidesOptions.columns : 0) : 1
                    const index = Math.max(0, (output.out.slide.index || 0) - columns)
                    const elem = scrollElem.current.querySelector(".grid")?.children[index] as HTMLElement | undefined
                    setOffset((elem?.offsetTop || 5) - 5)
                }
            })()
        })
        return () => clearTimeout(timer)
    }, [currentOutputs, showId, activeLayout, mode, currentSlidesOptions.columns])

    function slideClick(event: ReactMouseEvent<HTMLDivElement>, index: number) {
        if (currentOutLocked || event.ctrlKey || event.metaKey || event.shiftKey) return

        customActionActivation("slide_click")
        const slideRef = showSlideRef()
        checkActionTrigger(slideRef[index]?.data, index)

        setTimeout(() => {
            const outputId = getActiveOutputs(currentOutputs, true, true, true)[0]
            const currentOutput = currentOutputs[outputId] || {}
            const outSlide = currentOutput.out?.slide || null
            const amountOfLinesToShow = getFewestOutputLines(currentOutputs)
            const showSlide = _show(showId).slides([slideRef[index]?.id]).get()?.[0]
            let line = 0
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && amountOfLinesToShow > 0) {
                line = (outSlide.line || 0) + amountOfLinesToShow
                const slideLines = showSlide ? getItemWithMostLines(showSlide) : 0
                if (line >= slideLines) line = 0
            }

            const clickRevealItems = Array.isArray(showSlide?.items) ? showSlide.items.filter((a) => a?.clickReveal) : []
            const isRevealed = clickRevealItems.length ? !!outSlide?.itemClickReveal : true
            let itemClickReveal = false
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && clickRevealItems.length) itemClickReveal = true

            const linesRevealItems = Array.isArray(showSlide?.items) ? showSlide.items.filter((a) => a?.lineReveal) : []
            let revealCount = outSlide?.revealCount ?? 0
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && linesRevealItems.length && isRevealed) {
                revealCount++
                const maxLines = getItemWithMostLines({ items: linesRevealItems })
                if (revealCount > maxLines) revealCount = 0
            } else revealCount = 0

            setOutput("slide", { id: showId, layout: activeLayout, index, line, revealCount, itemClickReveal })
            updateOut(showId, index, slideRef, !event.altKey)
            if (activeSlides[index]) refreshOut()
        })

        if (currentFocusMode) {
            activeFocus.set({ id: showId, index: projectIndex, type: "show" })
            return
        }

        setDisableAutoScroll(true)
        disableAutoScrollRef.current = true
        if (nextScrollTimeout.current) return
        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
            setDisableAutoScroll(false)
            disableAutoScrollRef.current = false
        }, 500)
    }

    // disable slides after end (visual only)
    useEffect(() => {
        if (!layoutSlides.length) {
            setEndIndex(null)
            return
        }
        const index = layoutSlides.findIndex((slide) => slide.end === true && slide.disabled !== true)
        setEndIndex(index >= 0 ? index : null)
    }, [layoutSlides])

    function updateTemplate() {
        if (!loaded) return
        let currentTemplate = currentShow?.settings?.template || ""
        let createItems = false
        const categoryTemplate = currentCategories[currentShow?.category || ""]?.template || ""
        if (categoryTemplate && currentTemplates[categoryTemplate]) {
            currentTemplate = categoryTemplate
            createItems = true
        }
        history({ id: "TEMPLATE", save: false, newData: { id: currentTemplate, data: { createItems } }, location: { page: "show" } })
    }

    useEffect(() => {
        if (!showId || !loaded) return
        const signature = layoutSlides
            .map((layoutSlide) => {
                const slide = currentShow?.slides?.[layoutSlide.id]
                const slideTemplate = slide?.settings?.template
                const groupTemplate = slide?.globalGroup && currentGroups[slide.globalGroup]?.template
                return slideTemplate || groupTemplate || ""
            })
            .join("|")
        if (signature && signature !== previousTemplateSignature.current) {
            const timer = setTimeout(updateTemplate, 100)
            previousTemplateSignature.current = signature
            return () => clearTimeout(timer)
        }
        previousTemplateSignature.current = signature
        const timer = setTimeout(updateTemplate, 100)
        return () => clearTimeout(timer)
    }, [showId, loaded, layoutSlides, currentShow, currentGroups, currentCategories, currentTemplates])

    useEffect(() => {
        if (!showId || !currentSpecial.capitalize_words || isDestroyed.current) return
        const slides = _show(showId).get("slides") || {}
        let capitalized = false
        const words = currentSpecial.capitalize_words.split(",")
        for (const slide of Object.values(slides) as { items?: unknown[] }[]) {
            if (!Array.isArray(slide?.items)) continue
            for (const item of slide.items as { lines?: unknown[] }[]) {
                if (!Array.isArray(item?.lines)) continue
                for (const line of item.lines as { text?: unknown[] }[]) {
                    if (!Array.isArray(line?.text)) continue
                    for (const text of line.text as { value?: string }[]) {
                        let value = text.value || ""
                        for (const word of words) {
                            const newWord = word.trim()
                            if (!newWord.length) continue
                            const regEx = new RegExp(`(?<!\\p{L})${newWord.toLowerCase()}(?!\\p{L})`, "giu")
                            value = value.replace(regEx, (match) => (match === match.toUpperCase() ? match : newWord))
                        }
                        if (text.value !== value) {
                            text.value = value
                            capitalized = true
                        }
                    }
                }
            }
        }
        if (!capitalized) return
        showsCache.update((all) => {
            if (all[showId]) all[showId].slides = slides
            return all
        })
    }, [showId, currentSpecial.capitalize_words])

    // active slides on outputs
    useEffect(() => {
        const result: Record<number, ActiveSlide> = {}
        activeOutputs.forEach((outputId) => {
            const currentOutput = currentOutputs[outputId]
            if (!currentOutput || currentOutput.stageOutput) return
            const outSlide = currentOutput.out?.slide || currentOutputSlideCache[outputId] || {}
            if (outSlide.id !== showId || outSlide.layout !== activeLayout) return
            if (outSlide.index === undefined) return
            if (result[outSlide.index]) return
            if (projectIndex !== -1 && outSlide.projectIndex !== undefined && outSlide.projectIndex !== projectIndex) return

            const ref = outSlide.id === "temp" ? [{ temp: true, items: outSlide.tempItems, id: "" }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []
            const showSlide = _show(outSlide.id).slides([ref[outSlide.index]?.id]).get()?.[0]
            const amountOfLinesToShow = getFewestOutputLines(currentOutputs)
            let lineIndex = 0
            let maxLines = 0
            if (amountOfLinesToShow > 0) {
                const slideLines = showSlide ? getItemWithMostLines(showSlide) : null
                maxLines = slideLines && amountOfLinesToShow < slideLines ? Math.ceil(slideLines / amountOfLinesToShow) : 0
                const outputLine = outSlide ? outSlide.line || 0 : null
                const linesPercentage = slideLines && outputLine !== null ? outputLine / slideLines : 0
                lineIndex = Math.floor(maxLines * linesPercentage)
                if (!maxLines) maxLines = 1
            }

            const linesRevealItems = (showSlide?.items || []).filter((item) => item?.lineReveal)
            if (linesRevealItems.length) {
                lineIndex = getFewestOutputLinesReveal(currentOutputs) - 1
                maxLines = getItemWithMostLines({ items: linesRevealItems })
            }

            result[outSlide.index] = {
                color: String(currentOutput.color || ""),
                line: lineIndex,
                maxLines,
                cached: !currentOutput.out?.slide,
                clickRevealed: !!currentOutput.out?.slide?.itemClickReveal
            }
        })
        setActiveSlides(result)
    }, [currentOutputs, currentOutputSlideCache, showId, activeLayout, projectIndex])

    // lazy loader
    function startLazyLoader() {
        if (isDestroyed.current || !layoutSlides || timeout.current) return

        if (lazyLoader.current >= layoutSlides.length) {
            setLoaded(true)
            lazyLoading.current = false
            return
        }

        if (isLessons) {
            timeout.current = true
            if (lessonsTimeout.current) clearTimeout(lessonsTimeout.current)
            const count = currentLessonsLoaded[showId]
            if (count === undefined) {
                lessonsTimeout.current = setTimeout(async () => {
                    const mediaId = layoutSlides[lazyLoader.current]?.background
                    const mediaPath = currentShow?.media?.[mediaId]?.path || ""
                    const exists = await checkImage(mediaPath)
                    if (exists) {
                        if (lazyLoader.current > 0) await wait(1000)
                        lazyLoader.current = layoutSlides.length
                        setLoaded(true)
                        lazyLoading.current = false
                        return
                    }
                    lazyLoader.current++
                    lessonsFailed.current++
                    timeout.current = null
                    startLazyLoader()
                }, 800)
                timeout.current = null
                return
            }

            const downloaded = count.finished + count.failed
            lazyLoader.current = downloaded
            lessonsFailed.current = count.failed
            if (downloaded < layoutSlides.length) {
                alertMessage.set(`Please wait! Downloading Lessons.church media ${downloaded + 1}/${layoutSlides.length} ...`)
                activePopup.set("alert")
            } else {
                if (lessonsFailed.current) alertMessage.set(`Something went wrong!<br>Could not get ${count.failed} files of total ${layoutSlides.length}!<br><br>The files might have expired, but you can try importing again`)
                else alertMessage.set(`Downloaded ${layoutSlides.length} files!`)
                activePopup.set("alert")
                setLoaded(true)
                lazyLoading.current = false
                lessonsLoaded.set({})
            }
            timeout.current = null
            return
        }

        function next() {
            if (isDestroyed.current) return
            const currentBatch = lazyLoader.current === 0 ? 4 : Math.min(currentFocusMode ? 128 : 32, lazyLoader.current * 2)
            lazyLoader.current += currentBatch
            if (timeout.current && typeof timeout.current !== "boolean") clearTimeout(timeout.current)
            timeout.current = null
            startLazyLoader()
        }

        timeout.current = setTimeout(next, 50)
    }

    async function checkImage(src: string) {
        const isVideo = videoExtensions.includes(getExtension(src))
        let mediaElement: HTMLImageElement | HTMLVideoElement
        mediaElement = isVideo ? document.createElement("video") : new Image()
        return new Promise<boolean>((resolve) => {
            let hasLoaded = false
            if (isVideo) mediaElement.onloadeddata = onLoaded
            else (mediaElement as HTMLImageElement).onload = onLoaded
            mediaElement.onerror = () => {
                if (hasLoaded) return
                resolve(false)
            }
            mediaElement.src = encodeFilePath(src)
            function onLoaded() {
                hasLoaded = true
                resolve(true)
            }
        })
    }

    useEffect(() => {
        setLoaded(false)
        lazyLoader.current = 1
    }, [showId, activeLayout])

    useEffect(() => {
        if (loaded || lazyLoading.current || !layoutSlides.length) return
        lazyLoading.current = true
        lazyLoader.current = 0
        startLazyLoader()
    }, [loaded, layoutSlides.length, isLessons, showId, activeLayout])

    useEffect(() => {
        if (isLessons && currentLessonsLoaded) startLazyLoader()
    }, [isLessons, currentLessonsLoaded])

    // loading indicator
    useEffect(() => {
        if (!showId) return
        setLoading(true)
        if (loadingTimeout.current) clearTimeout(loadingTimeout.current)
        loadingTimeout.current = setTimeout(() => setLoading(false), 8000)
        return () => {
            if (loadingTimeout.current) clearTimeout(loadingTimeout.current)
        }
    }, [showId])

    useEffect(() => {
        if (currentNotFound.show?.includes(showId)) setLoading(false)
    }, [currentNotFound, showId])

    // alt key handling
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (!event.altKey && altTimeout.current) clearTimeout(altTimeout.current)
            if (event.altKey) {
                if (altTemp.current) return
                altTemp.current = true
                altTimeout.current = setTimeout(() => {
                    if (altTemp.current && document.hasFocus()) setAltKeyPressed(true)
                }, 300)
            }
        }
        const keyup = (event: KeyboardEvent) => {
            if (event.altKey) return
            altTemp.current = false
            setAltKeyPressed(false)
        }
        const blurred = () => {
            altTemp.current = false
            setAltKeyPressed(false)
        }
        window.addEventListener("keydown", keydown)
        window.addEventListener("keyup", keyup)
        window.addEventListener("mousedown", keyup as EventListener)
        window.addEventListener("blur", blurred)
        return () => {
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("keyup", keyup)
            window.removeEventListener("mousedown", keyup as EventListener)
            window.removeEventListener("blur", blurred)
        }
    }, [])

    function createSlide() {
        if (isLocked) return
        history({ id: "SLIDES" })
        activeEdit.set({ type: "show", slide: 0, items: [] })
        activePage.set("edit")
    }

    return (
        <div className="main" style={{ display: "contents" }}>
            <Autoscroll className={currentFocusMode || isLocked ? "" : "context #shows__close"} scrollElem={scrollElem} offset={offset} disabled={disableAutoScroll} shouldSkipSmooth={shouldSkipSmooth} style={{ display: "flex" }}>
                <DropArea id="all_slides" selectChildren>
                    <DropArea id="slides" hoverTimeout={0} selectChildren>
                        {!currentFocusMode ? <ShowHeader showId={showId} hideOptions={!layoutSlides?.length} /> : null}

                        {currentShowsCache[showId] === undefined ? (
                            <Center faded={!loading}>{loading ? <Loader /> : <T id="error.no_show" />}</Center>
                        ) : (
                            <div className={styles.grid} style={currentFocusMode ? undefined : { paddingBottom: 60 }}>
                                {layoutSlides.length ? (
                                    layoutSlides.map((slide, i) => {
                                        const currentSlide = currentShow?.slides?.[slide.id] || (slide.id === "fake_empty" ? { group: null, color: null, settings: {}, notes: "", items: [] } : undefined)
                                        const visible = currentSlide && (mode === "grid" || mode === "groups" || !slide.disabled) && (mode !== "groups" || currentSlide.group !== null || activeSlides[i] !== undefined)
                                        return hasMounted && (loaded || i < lazyLoader.current) ? (
                                            visible ? (
                                                <Slide key={`${slide.id}_${i}`} showId={showId} slide={currentSlide} show={currentShow} layoutSlides={layoutSlides} layoutSlide={slide} index={i} color={slide.color} output={activeSlides[i] || null} active={activeSlides[i] !== undefined} endIndex={endIndex} list={!gridMode} columns={currentSlidesOptions.columns} icons altKeyPressed={altKeyPressed} disableThumbnails={isLessons && !loaded} centerPreview onClick={(event) => slideClick(event, i)} />
                                            ) : null
                                        ) : (
                                            <SkeletonSlide key={`${slide.id}_${i}`} slide={currentSlide} index={i} color={slide.color || ""} columns={currentSlidesOptions.columns} active={activeSlides[i] !== undefined} onClick={(event) => slideClick(event, i)} />
                                        )
                                    })
                                ) : (
                                    <Center absolute>
                                        <span style={{ opacity: 0.5, fontSize: "2em", marginBottom: 10 }}>
                                            <T id="empty.slides" />
                                        </span>
                                        <Button variant="outline" disabled={isLocked} icon="add" title="tooltip.project" style={{ justifyContent: "start", padding: "8px 14px" }} onClick={createSlide}>
                                            <T id="new.slide" />
                                        </Button>
                                    </Center>
                                )}
                            </div>
                        )}
                    </DropArea>
                </DropArea>
            </Autoscroll>
        </div>
    )
}
