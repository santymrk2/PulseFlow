import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { LayoutRef, Show, ShowGroups, Slide } from "../../../../types/Show"
import { activeProject, activeShow, allOutputs, groups, outputs, projects, showsCache } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getFirstActiveOutput } from "../../../shared/utils/helpers/output"
import { getCurrentProjectIndexes, getProjectItemLabel, getProjectItems } from "../../../shared/utils/helpers/projectProgress"
import { getGroupName, getLayoutRef } from "../../../shared/utils/helpers/show"
import { slideTrackerParts } from "../../../shared/utils/helpers/dynamicItemText"
import { useStore } from "../../hooks/useStore"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import styles from "./SlideProgress.module.css"

export interface SlideProgressProps {
    tracker: { type?: "number" | "bar" | "group" | "project"; oneLetter?: boolean; childProgress?: boolean; projectMetadata?: string; accent?: string }
    outputId?: string
    item?: { align?: string; alignX?: boolean }
    autoSize?: number
}

interface LayoutGroupInfo {
    name: string
    oneLetterName: string
    index: number
    child: number
    hide?: boolean
}

interface ProgressEntry {
    layoutGroups: LayoutGroupInfo[]
    slidesLength: number
    layoutSeed: string
    groupSeed: string
    trackerKey: string
}

function getLayoutSeed(show: Show | null) {
    if (!show) return "0"
    const layoutId = show.settings?.activeLayout || ""
    const layoutSlides = show.layouts?.[layoutId]?.slides || []
    if (!layoutSlides.length) return layoutId
    let seed = `${layoutId}:`
    layoutSlides.forEach((layoutSlide) => {
        const slide = show.slides?.[layoutSlide.id]
        const slideChildren = Array.isArray(slide?.children) ? (slide?.children as string[]) : []
        const children = slideChildren.join(",")
        const group = slide?.group || ""
        const globalGroup = slide?.globalGroup || ""
        const disabled = layoutSlide?.disabled ? 1 : 0
        seed += `${layoutSlide.id}:${disabled}:${children}:${group}:${globalGroup}|`
    })
    return seed
}

function getGroupSeed(groupsStore: ShowGroups) {
    if (!groupsStore) return "0"
    return Object.entries(groupsStore)
        .map(([id, value]) => `${id}:${value?.name || ""}:${value?.default ? 1 : 0}`)
        .join("|")
}

function getProgress(showId: string, show: Show | null, layoutRef: LayoutRef[], slides: { [key: string]: Slide | undefined }, groupsStore: ShowGroups, trackerData: SlideProgressProps["tracker"], progressCache: Map<string, ProgressEntry>): ProgressEntry {
    if (!showId || !show || !layoutRef.length) return { layoutGroups: [], slidesLength: 0, layoutSeed: "", groupSeed: "", trackerKey: "" }

    const layoutSeed = getLayoutSeed(show)
    const groupSeed = getGroupSeed(groupsStore)
    const trackerKey = trackerData?.oneLetter ? "one" : "full"
    const cacheKey = `${showId}:${trackerKey}`
    const cached = progressCache.get(cacheKey)
    if (cached && cached.layoutSeed === layoutSeed && cached.groupSeed === groupSeed) return cached

    const parentChildrenMap = new Map<string, string[]>()
    layoutRef.forEach((ref) => {
        if (ref.type === "parent" && Array.isArray(ref.children)) parentChildrenMap.set(ref.id, ref.children)
    })

    const showData = { show: show as Show, showId }
    const layoutGroups: LayoutGroupInfo[] = layoutRef.map((entry) => {
        const ref = entry.parent || entry
        const slide = slides[ref.id]
        if (!slide) return { name: "—", oneLetterName: "—", index: ref.layoutIndex, child: 0 }

        if (entry.data?.disabled || slide.group?.startsWith("~")) {
            return { name: "—", oneLetterName: "—", index: ref.layoutIndex, child: 0, hide: true }
        }

        let groupName: string = slide.group || "—"
        if (slide.globalGroup && groupsStore?.[slide.globalGroup]) {
            const globalGroup = groupsStore[slide.globalGroup]
            groupName = globalGroup.default ? translateText(`groups.${globalGroup.name}`) : globalGroup.name
        }
        if (typeof groupName !== "string") groupName = ""

        const fullName = (getGroupName(showData, ref.id, groupName, ref.layoutIndex) || "—").replace(/ *\([^)]*\) */g, "")
        const oneLetterSource = groupName ? groupName[0]?.toUpperCase() || "" : ""
        const oneLetterName = (getGroupName(showData, ref.id, oneLetterSource, ref.layoutIndex) || "—").replace(/ *\([^)]*\) */g, "").replace(" ", "")

        let childIndex = 0
        if (entry.type === "child") {
            const parentChildren = parentChildrenMap.get(ref.id) || []
            const childPos = parentChildren.indexOf(entry.id)
            childIndex = childPos >= 0 ? childPos + 1 : 0
        }

        return { name: fullName || "—", oneLetterName: oneLetterName || "—", index: ref.layoutIndex, child: childIndex }
    })

    const entry: ProgressEntry = { layoutGroups, slidesLength: layoutRef.length, layoutSeed, groupSeed, trackerKey }
    progressCache.set(cacheKey, entry)
    return entry
}

// Port de components/slide/views/SlideProgress.svelte (F24.18a).
export function SlideProgress({ tracker, outputId = "", item = {}, autoSize = 0 }: SlideProgressProps) {
    const currentOutputs = useStore(outputs)
    const currentAllOutputs = useStore(allOutputs)
    const currentShowsCache = useStore(showsCache)
    const currentGroups = useStore(groups)
    const currentProjects = useStore(projects)
    const currentActiveProject = useStore(activeProject)
    const currentActiveShow = useStore(activeShow)
    const layoutCache = useRef(new Map<string, { seed: string; ref: LayoutRef[] }>())
    const progressCache = useRef(new Map<string, ProgressEntry>())
    const [column, setColumn] = useState(false)
    const [progressElem, setProgressElem] = useState<HTMLDivElement | null>(null)

    const resolvedOutputId = outputId || getFirstActiveOutput()?.id || ""
    const currentOutput = (currentOutputs as Record<string, { out?: { slide?: { id?: string; index?: number } } }>)[resolvedOutputId] || (currentAllOutputs as Record<string, { out?: { slide?: { id?: string; index?: number } } }>)[resolvedOutputId] || {}
    const currentSlideOut = currentOutput?.out?.slide || null
    const currentShowId = currentSlideOut?.id || ""
    const currentShowSlide = currentSlideOut?.index ?? -1
    const currentShow = currentShowId ? (currentShowsCache[currentShowId] as Show | undefined) || null : null
    const currentShowSlides = currentShow?.slides || {}

    function getCachedLayoutRef(showId: string, show: Show | null): LayoutRef[] {
        if (!showId || !show) return []
        const seed = getLayoutSeed(show)
        const cached = layoutCache.current.get(showId)
        if (cached && cached.seed === seed) return cached.ref
        const ref = getLayoutRef(showId, currentShowsCache)
        layoutCache.current.set(showId, { seed, ref })
        return ref
    }

    const currentLayoutRef = getCachedLayoutRef(currentShowId, currentShow)
    const progressData = getProgress(currentShowId, currentShow, currentLayoutRef, currentShowSlides, currentGroups, tracker, progressCache.current)
    const layoutGroups = progressData.layoutGroups
    const slidesLength = progressData.slidesLength
    const projectItems = getProjectItems(currentProjects[currentActiveProject || ""]?.shows || [], currentShowsCache)
    const currentProjectIndexes = getCurrentProjectIndexes(currentProjects[currentActiveProject || ""]?.shows || [], currentOutput?.out || {}, typeof currentActiveShow?.index === "number" ? currentActiveShow.index : -1)
    const numberText = slideTrackerParts({ type: tracker.type || "number" }, currentShowSlide, slidesLength)?.current ?? ""
    const projectMetadata = tracker.projectMetadata || "name"
    const type = tracker.type || "number"

    // El Svelte media el elemento para decidir si apila los grupos en columna.
    useEffect(() => {
        if (!progressElem) return
        setColumn(progressElem.offsetWidth < progressElem.offsetHeight)
    }, [progressElem])

    const alignStyle = cssTextToStyle(`${autoSize ? `font-size: ${autoSize}px;` : ""}${item?.alignX ? "" : (item?.align || "justify-content: center;").replaceAll("text-align", "justify-content")}`)

    return (
        <div ref={setProgressElem} className={`${styles.progress} ${type === "bar" ? styles.barBG : ""}`} style={{ "--accent": tracker.accent } as CSSProperties}>
            {type === "number" ? (
                <div className={`align autoFontSize ${styles.align}`} style={alignStyle}>
                    <span style={{ color: "var(--accent)" }}>{numberText}</span>/{slidesLength}
                </div>
            ) : type === "bar" ? (
                <div className={styles.bar} style={{ width: `${slidesLength ? ((currentShowSlide + 1) / slidesLength) * 100 : 0}%` }} />
            ) : type === "group" ? (
                <div className={`align groups autoFontSize ${styles.align} ${styles.groups} ${column ? styles.column : ""}`} style={alignStyle}>
                    {layoutGroups.map((group, i) => {
                        if (group.child || group.hide) return null
                        const activeGroup = layoutGroups.find((a, j) => a.index === group.index && j === currentShowSlide)
                        const nextSlide = layoutGroups.find((a, j) => a.index === group.index && j === currentShowSlide + 1)
                        const active = group.index === layoutGroups.find((_, j) => j === currentShowSlide)?.index
                        return (
                            <div key={i} className={`${styles.group} ${active ? styles.active : ""}`}>
                                {tracker.oneLetter ? group.oneLetterName : group.name}
                                {tracker.childProgress && (activeGroup?.child || nextSlide?.child) ? <span style={{ opacity: 0.8, fontSize: "0.7em" }}>.{(activeGroup?.child ?? -1) + 1}</span> : null}
                            </div>
                        )
                    })}
                </div>
            ) : type === "project" ? (
                <div className={`align groups projectGroups autoFontSize ${styles.align} ${styles.groups} ${styles.projectGroups}`} style={autoSize ? { fontSize: `${autoSize}px` } : undefined}>
                    {projectItems.map((projectItem) => {
                        const label = getProjectItemLabel(projectItem, projectMetadata)
                        return (
                            <div key={projectItem.index} className={`${styles.group} ${styles.projectItem} ${currentProjectIndexes.includes(projectItem.index) ? styles.active : ""}`}>
                                {label || "\u00A0"}
                            </div>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}
