import { useEffect, useRef, useState } from "react"
import type { ProjectShowRef } from "../../../../types/Projects"
import { activeFocus, activeProject, outputs, projects, resized } from "../../../shared/core/stores"
import { getAllProjectItems } from "../logic/focus/focus"
import { getActiveOutputs } from "../../../shared/utils/helpers/output"
import { hasNewerUpdate } from "../../../shared/utils/common"
import { Loader } from "../../../react/main/Loader"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Center } from "../../../shared/ui/system/Center"
import { FocusItem } from "./FocusItem"
import styles from "./FocusMode.module.css"

// (F24.20a).
export function FocusMode() {
    const currentActiveProject = useStore(activeProject)
    const currentProjects = useStore(projects)
    const currentOutputs = useStore(outputs)
    const currentResized = useStore(resized)
    const active = useStore(activeFocus)

    const projectId = currentActiveProject || ""
    const project = currentProjects[projectId]
    const projectItems = (project?.shows || []).map((a) => a.id || a.name).join(",")

    const outputId = getActiveOutputs(currentOutputs, true, true, true)[0] || ""
    const output = currentOutputs[outputId]
    const outputShowId = output?.out?.slide?.id
    const outputShowLayout = output?.out?.slide?.layout
    const outputShowProjectIndex = output?.out?.slide?.projectIndex
    const outputIndex = output?.out?.slide?.index
    const sidebarClosed = currentResized.leftPanel < 5

    const [projectsItemsList, setProjectsItemsList] = useState<ProjectShowRef[]>(() => project?.shows || [])
    const [items, setItems] = useState<ProjectShowRef[]>([])
    const [loading, setLoading] = useState(true)

    const listElem = useRef<HTMLDivElement | null>(null)
    const fromTop = useRef(0)
    const projectUpdating = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isScrolling = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scrollingToActive = useRef<ReturnType<typeof setTimeout> | null>(null)
    const previousId = useRef("")

    function getProjectItemIndex(id: string, type?: string, layout?: string) {
        const shows = project?.shows || []
        let index = shows.findIndex((item) => item.id === id && (!type || item.type === type) && (!layout || item.layout === layout))
        if (index !== -1) return index
        index = shows.findIndex((item) => item.id === id && (!type || item.type === type))
        if (index !== -1) return index
        index = shows.findIndex((item) => item.id === id && (!layout || item.layout === layout))
        if (index !== -1) return index
        return shows.findIndex((item) => item.id === id)
    }

    function getId(text: string) {
        if (typeof text !== "string") return ""
        return text.replace(/[^a-zA-Z0-9]+/g, "")
    }

    async function scrollToActive() {
        const list = listElem.current
        if (!list || isScrolling.current || projectUpdating.current) return

        if (await hasNewerUpdate("FOCUS_SCROLL")) return
        const currentList = listElem.current
        if (!currentList) return

        let currentId = active.id
        const slideIndex = active.id === outputShowId ? outputIndex || 0 : 0
        let currentType = active.type

        let index = active.index
        if (index === undefined) {
            if (outputShowProjectIndex !== undefined) {
                index = outputShowProjectIndex
            } else {
                if (outputShowId) currentId = outputShowId
                if (outputShowId) currentType = undefined
                index = getProjectItemIndex(currentId, currentType, outputShowLayout)
            }
        }

        if (index < 0) return
        if (!outputShowId && previousId.current && previousId.current === currentId) return
        previousId.current = currentId

        const id = "id_" + getId(currentId) + "_" + index
        const elem = currentList.querySelector<HTMLElement>("#" + id)
        if (!elem) return
        const elemTop = elem.offsetTop || 0
        const slide = elem.querySelector(".grid")?.children[slideIndex] as HTMLElement | undefined
        const slideTop = slide ? elemTop + slide.offsetTop : elemTop

        const center = currentList.closest(".center") as HTMLElement | null
        const currentScrollPos = center?.scrollTop || 0
        const currentViewHeight = center?.clientHeight || 0
        if (slideTop - currentScrollPos > -250 && slideTop - currentScrollPos < currentViewHeight - 200) return

        if (scrollingToActive.current) clearTimeout(scrollingToActive.current)
        scrollingToActive.current = setTimeout(() => {
            scrollingToActive.current = null
        }, 3000)

        const MARGIN = 80
        center?.scrollTo(0, slideTop - fromTop.current - MARGIN)
    }

    function scrolling(event: Event) {
        if (scrollingToActive.current || !listElem.current || !project?.shows || projectUpdating.current) return

        if (isScrolling.current) clearTimeout(isScrolling.current)
        isScrolling.current = setTimeout(() => {
            isScrolling.current = null
        }, 500)

        if (sidebarClosed) return

        const target = event.target as HTMLElement
        const scrollTop = target.scrollTop
        const list = listElem.current
        let focusedId = ""
        const elements = list.querySelectorAll(".focusId")
        for (const element of elements) {
            const elem = element as HTMLElement
            const top = elem.offsetTop - fromTop.current
            if (top <= scrollTop) focusedId = elem.id
        }

        if (!focusedId) return

        const index = Number(focusedId.split("_")[2])
        const projectItem = project.shows[index]
        if (!projectItem) return

        activeFocus.set({ id: projectItem.id, index, type: projectItem.type })
    }

    // "don't refresh list unless order changes"
    useEffect(() => {
        setProjectsItemsList(project?.shows || [])
    }, [projectItems])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        void getAllProjectItems(projectsItemsList).then((list) => {
            if (cancelled) return
            setItems(list)
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [projectsItemsList])

    useEffect(() => {
        if (!project?.shows) return
        if (projectUpdating.current) clearTimeout(projectUpdating.current)
        projectUpdating.current = setTimeout(() => {
            if (isScrolling.current) clearTimeout(isScrolling.current)
            isScrolling.current = null
            projectUpdating.current = null
            if (active.id) {
                const shows = project.shows || []
                if (active.index !== undefined && shows[active.index]?.id === active.id) {
                    activeFocus.set(active)
                } else {
                    activeFocus.set({ ...active, index: getProjectItemIndex(active.id, active.type, outputShowLayout) })
                }
            }
        }, 100)
        return () => {
            if (projectUpdating.current) clearTimeout(projectUpdating.current)
        }
    }, [projectItems])

    useEffect(() => {
        void scrollToActive()
    }, [active, outputShowId, outputShowLayout, outputShowProjectIndex, outputIndex, items])

    useEffect(() => {
        const list = listElem.current
        const center = list?.closest(".center") as HTMLElement | null
        if (!list || !center) return
        fromTop.current = (list.children[0] as HTMLElement)?.offsetTop || 0
        center.onscroll = (event) => scrolling(event)
        void scrollToActive()
        return () => {
            center.onscroll = null
        }
    }, [items])

    if (loading) {
        return (
            <Center>
                <Loader />
            </Center>
        )
    }

    if (!items.length) {
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <div className={styles.list} ref={listElem}>
            {items.map((item, i) => (
                <div key={`${item.id}_${i}`} id={"id_" + getId(item.id) + "_" + i} className="focusId">
                    <div className={styles.name} style={item.color ? { borderBottom: `2px solid ${item.color}` } : undefined}>
                        <Icon id={item.icon || "noIcon"} custom={(item.type || "show") === "show"} white right />
                        <p>{item.name}</p>
                    </div>
                    <FocusItem show={{ ...item, index: i }} />
                </div>
            ))}
        </div>
    )
}
