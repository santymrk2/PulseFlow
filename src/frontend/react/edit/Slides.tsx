import { useEffect, useRef, useState } from "react"
import { activeEdit, activeShow, cachedShowsData, editColumns, showsCache } from "../../shared/core/stores"
import { T } from "../helpers/T"
import { findMatchingOut } from "../../components/helpers/output"
import { getShowCacheId } from "../../components/helpers/show"
import { SkeletonSlide } from "../slide/SkeletonSlide"
import { Slide } from "../slide/Slide"
import { Autoscroll } from "../system/Autoscroll"
import { Center } from "../system/Center"
import { DropArea } from "../system/DropArea"
import { useStore } from "../hooks/useStore"
import styles from "./Slides.module.css"

// Port de components/edit/Slides.svelte (F24.21c).
export function Slides() {
    const currentActiveShow = useStore(activeShow)
    const currentActiveEdit = useStore(activeEdit)
    const currentCachedShowsData = useStore(cachedShowsData)
    const currentEditColumns = useStore(editColumns)
    const currentShowsCache = useStore(showsCache)

    const showId = currentActiveShow?.id || currentActiveEdit.showId || ""
    const currentShow = currentShowsCache[showId]
    const layoutSlides = currentCachedShowsData[getShowCacheId(showId, currentShow)]?.layout || []

    const [hasMounted, setHasMounted] = useState(false)
    const [altKeyPressed, setAltKeyPressed] = useState(false)
    const [offset, setOffset] = useState(-1)
    const [lazyLoader, setLazyLoader] = useState(1)
    const [loaded, setLoaded] = useState(false)

    const scrollElemRef = useRef<HTMLDivElement>(null)
    const skipScrollingRef = useRef(false)
    const nextScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lazyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lazyLoadingRef = useRef(false)

    useEffect(() => {
        const t = setTimeout(() => setHasMounted(true), 80)
        return () => clearTimeout(t)
    }, [])

    // reset loading when changing view modes/show
    useEffect(() => {
        setLoaded(false)
        lazyLoadingRef.current = false
    }, [showId])

    useEffect(() => {
        if (loaded || lazyLoadingRef.current || !layoutSlides?.length) return
        lazyLoadingRef.current = true
        setLazyLoader(1)

        function startLazyLoader(current: number) {
            if (!layoutSlides) return
            if (current >= layoutSlides.length) {
                setLoaded(true)
                lazyLoadingRef.current = false
                return
            }
            if (lazyTimeoutRef.current) clearTimeout(lazyTimeoutRef.current)
            lazyTimeoutRef.current = setTimeout(() => {
                const next = current + 1
                setLazyLoader(next)
                startLazyLoader(next)
            }, 10)
        }

        startLazyLoader(1)

        return () => {
            if (lazyTimeoutRef.current) clearTimeout(lazyTimeoutRef.current)
        }
    }, [layoutSlides, loaded])

    function updateScroll(slideIndex: number | null | undefined) {
        if (skipScrollingRef.current) return
        const index = (slideIndex ?? -1) - 1
        setTimeout(() => {
            if (index >= 0 && scrollElemRef.current) {
                const gridChild = scrollElemRef.current.querySelector(".grid")?.children?.[index] as HTMLElement | undefined
                setOffset((gridChild?.offsetTop || 5) - 5)
            }
        }, 10)
    }

    useEffect(() => {
        if (currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined) updateScroll(currentActiveEdit.slide)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentActiveEdit.slide])

    // key handlers con acceso a estado actual
    const latest = useRef({ currentActiveEdit, layoutSlides, showId, currentEditColumns })
    latest.current = { currentActiveEdit, layoutSlides, showId, currentEditColumns }

    useEffect(() => {
        function onKeydown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey) return

            if (e.altKey) {
                e.preventDefault()
                setAltKeyPressed(true)
            }

            const target = e.target as HTMLElement | null
            if (target instanceof HTMLTextAreaElement || target?.closest?.(".edit")) return
            const { currentActiveEdit, layoutSlides, showId } = latest.current
            if (currentActiveEdit.items?.length) return

            if (e.key === "ArrowDown") {
                e.preventDefault()
                ;(document.activeElement as HTMLElement | null)?.blur()
                if (currentActiveEdit.slide === null || currentActiveEdit.slide === undefined) {
                    activeEdit.set({ slide: 0, items: [], showId })
                } else if (currentActiveEdit.slide < layoutSlides.length - 1) {
                    activeEdit.set({ slide: currentActiveEdit.slide + 1, items: [], showId })
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                ;(document.activeElement as HTMLElement | null)?.blur()
                if (currentActiveEdit.slide === null || currentActiveEdit.slide === undefined) {
                    activeEdit.set({ slide: layoutSlides.length - 1, items: [], showId })
                } else if (currentActiveEdit.slide > 0) {
                    activeEdit.set({ slide: currentActiveEdit.slide - 1, items: [], showId })
                }
            }
        }

        function onKeyup() {
            setAltKeyPressed(false)
        }

        window.addEventListener("keydown", onKeydown)
        window.addEventListener("keyup", onKeyup)
        window.addEventListener("mousedown", onKeyup)
        return () => {
            window.removeEventListener("keydown", onKeydown)
            window.removeEventListener("keyup", onKeyup)
            window.removeEventListener("mousedown", onKeyup)
        }
    }, [])

    function wheel(e: { event: Event }) {
        const ev = e.event as WheelEvent
        if (!ev.ctrlKey && !ev.metaKey) return
        if (nextScrollTimeoutRef.current) return

        ev.preventDefault()
        editColumns.set(Math.max(1, Math.min(4, latest.current.currentEditColumns + (ev.deltaY < 0 ? -1 : 1))))

        if (ev.deltaY >= 100 || ev.deltaY <= -100) return
        nextScrollTimeoutRef.current = setTimeout(() => {
            nextScrollTimeoutRef.current = null
        }, 500)
    }

    function slideClick(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, index: number) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            activeEdit.set({ slide: index, items: [], showId: latest.current.showId })
            skipScrollingRef.current = true
            setTimeout(() => (skipScrollingRef.current = false), 10)
        }
    }

    return (
        <Autoscroll offset={offset} scrollElem={scrollElemRef} style={{ display: "flex", backgroundColor: "var(--primary-darker)" }}>
            <DropArea id="all_slides" selectChildren>
                <DropArea id="slides" hoverTimeout={0} selectChildren>
                    {layoutSlides.length ? (
                        <div className={`grid ${styles.grid}`} onWheel={(ev) => wheel({ event: ev.nativeEvent })}>
                            {layoutSlides.map((slide: { id: string; color?: string | null }, i: number) => {
                                const currentSlide = currentShow?.slides?.[slide.id]
                                if (hasMounted && (loaded || i < lazyLoader)) {
                                    if (!currentSlide) return null
                                    return <Slide key={slide.id || i} showId={showId} slide={currentSlide} show={currentShow} layoutSlide={slide} layoutSlides={layoutSlides} index={i} color={slide.color || ""} active={findMatchingOut(slide.id) !== null} focused={currentActiveEdit.slide === i} noQuickEdit altKeyPressed={altKeyPressed} columns={currentEditColumns} onClick={(e) => slideClick(e, i)} />
                                }
                                return <SkeletonSlide key={slide.id || i} slide={currentSlide} index={i} color={slide.color || ""} columns={currentEditColumns} active={currentActiveEdit.slide === i} onClick={(e) => slideClick(e, i)} />
                            })}

                            <div className="padding" style={{ height: 60, width: 1 }}></div>
                        </div>
                    ) : (
                        <Center faded>
                            <T id="empty.slides" />
                        </Center>
                    )}
                </DropArea>
            </DropArea>
        </Autoscroll>
    )
}
