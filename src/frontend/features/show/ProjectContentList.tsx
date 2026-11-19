import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { ProjectShowRef, Tree } from "../../../types/Projects"
import type { ShowType } from "../../../types/Show"
import { addProjectItem, addToProject, updateRecentlyAddedFiles } from "../import/project"
import { actions, activeFocus, activeProject, activeShow, contextActive, drawer, editingProjectTemplate, focusMode, fullColors, playerVideos, projects, projectTemplates, recentFiles, selected, special } from "../../shared/core/stores"
import { getAccess } from "../../shared/utils/profile"
import { getActionIcon } from "../../components/actions/actions"
import { getTimeUntilClock } from "../drawer/logic/timers/timers"
import { clone } from "../../shared/utils/helpers/array"
import { brightenDarkColor, fadeColor, getContrast } from "../../shared/utils/helpers/color"
import { getExtension, getFileName, getMediaType, removeExtension } from "../../shared/utils/helpers/media"
import { joinTimeBig } from "../../shared/utils/helpers/time"
import { T } from "../../shared/ui/helpers/T"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { Center } from "../../shared/ui/system/Center"
import { DropArea } from "../../shared/ui/system/DropArea"
import { Autoscroll } from "../../shared/ui/system/Autoscroll"
import { SelectElem } from "../../shared/ui/system/SelectElem"
import { clipboardToProject } from "./logic/project"
import { ShowButton } from "./ShowButton"
import styles from "./ProjectContentList.module.css"

interface ProjectItem extends ProjectShowRef {
    type?: ShowType | "section" | "DIVIDER"
    index?: number
}

interface SectionData {
    time?: string
    settings?: { triggerAction?: string }
}

interface ProjectData {
    parent?: string
    shows?: ProjectItem[]
    sectionsCollapsed?: boolean
    sectionsLocked?: boolean
}

interface SectionGroup {
    color: string
    items: ProjectItem[]
}

export interface ProjectContentListProps {
    tree: Tree[]
    recentlyUsedList?: unknown[]
    isTemplate?: boolean
    onScrollElem?: (elem: HTMLElement) => void
}

const VALID_IDS = ["show_drawer", "player", "media", "audio", "overlay", "effect"]

function toStyle(value: string): CSSProperties {
    const result: Record<string, string> = {}
    value.split(";").forEach((declaration) => {
        const separator = declaration.indexOf(":")
        if (separator < 0) return
        const key = declaration
            .slice(0, separator)
            .trim()
            .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        result[key] = declaration.slice(separator + 1).trim()
    })
    return result as CSSProperties
}

function getContextMenuId(type: ShowType | undefined, isTemplate: boolean) {
    if ((type || "show") === "show") return "show"
    if (type === "video" || type === "image") return "media"
    if (type === "show_placeholder") return isTemplate ? "show_placeholder_template" : "show_placeholder"
    return type
}

// (F24.20a).
export function ProjectContentList({ tree, recentlyUsedList: _recentlyUsedList = [], isTemplate = false, onScrollElem }: ProjectContentListProps) {
    const currentActions = useStore(actions)
    const currentActiveFocus = useStore(activeFocus)
    const currentActiveProject = useStore(activeProject)
    const currentActiveShow = useStore(activeShow)
    const currentContextActive = useStore(contextActive)
    const currentDrawer = useStore(drawer)
    const currentEditingProjectTemplate = useStore(editingProjectTemplate)
    const currentFocusMode = useStore(focusMode)
    const currentFullColors = useStore(fullColors)
    const currentPlayerVideos = useStore(playerVideos)
    const currentProjects = useStore(projects)
    const currentProjectTemplates = useStore(projectTemplates)
    const currentRecentFiles = useStore(recentFiles)
    const currentSelected = useStore(selected)
    const currentSpecial = useStore(special)

    const profile = getAccess("projects")
    const readOnly = profile.global === "read"
    const scrollElem = useRef<HTMLDivElement>(null)
    const [offset, setOffset] = useState(-1)
    const [shouldPasteText, setShouldPasteText] = useState(false)
    const [today, setToday] = useState(() => new Date())

    const projectId = isTemplate ? currentEditingProjectTemplate : currentActiveProject
    const currentProject = (isTemplate ? currentProjectTemplates[currentEditingProjectTemplate || ""] : currentActiveProject ? currentProjects[currentActiveProject] : null) as unknown as ProjectData | null
    const activeProjectParent = currentActiveProject ? currentProject?.parent || "" : ""
    const projectReadOnly = readOnly || profile[activeProjectParent] === "read" || tree.find((item) => item.id === activeProjectParent)?.readOnly
    const projectItemsList = currentProject?.shows || []

    useEffect(() => {
        if (scrollElem.current) onScrollElem?.(scrollElem.current)
    }, [onScrollElem])

    useEffect(() => {
        const elem = scrollElem.current
        if (!elem) return
        const timer = setTimeout(
            () => {
                const buttons = [...elem.querySelectorAll(".listSection")].flatMap((section) => Array.from(section.querySelectorAll("button")))
                const active = buttons.findLast((button) => button.classList.contains("isActive"))
                if (!active) return
                const container = active.closest("#show") as HTMLElement | null
                setOffset(Math.max(0, (container?.offsetTop || 0) + elem.offsetTop - (currentDrawer.height < 400 ? 120 : 20)))
            },
            tree.length * 0.5 + 20
        )
        return () => clearTimeout(timer)
    }, [tree.length, currentDrawer.height])

    useEffect(() => {
        if (!currentActiveProject || currentProject) return
        activeProject.set(null)
    }, [currentActiveProject, currentProject])

    useEffect(() => {
        if (!currentActiveProject || currentActiveShow?.index === undefined) return
        if (!currentProject?.shows) return
        const item = currentProject.shows[currentActiveShow.index]
        if (item?.id === currentActiveShow.id) return
        const found = currentProject.shows.findIndex((show) => show.id === currentActiveShow.id)
        const pos = found > -1 ? found : currentActiveShow.index
        if (pos < 0 || currentActiveShow.index === pos) return
        activeShow.update((show) => {
            if (show) show.index = pos
            return show
        })
    }, [currentActiveProject, currentActiveShow?.id, currentActiveShow?.index, currentProject])

    useEffect(() => {
        projects.update((all) => {
            const project = all[currentActiveProject || ""]
            if (!project?.shows) return all
            project.shows = project.shows.map((item) => {
                if (item.type !== "section") return item
                const match = (item.name || "").match(/^(\d{1,2}:\d{2})\s+(.*)$/)
                if (match) {
                    item.data = { ...(item.data || {}), time: match[1] }
                    item.name = match[2]
                }
                return item
            })
            return all
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const interval = setInterval(() => setToday(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!currentProject || currentProject.shows?.length || isTemplate || !navigator.clipboard?.readText) return
        let cancelled = false
        setShouldPasteText(false)
        navigator.clipboard
            .readText()
            .then((text) => {
                if (cancelled) return
                const lines = text.split("\n")
                setShouldPasteText(lines.length > 2 && lines.length <= 30)
            })
            .catch(() => {
                if (!cancelled) setShouldPasteText(false)
            })
        return () => {
            cancelled = true
        }
    }, [currentProject, isTemplate])

    const closestTime = projectItemsList.reduce((closest, item) => {
        const timeLeft = getTimeUntilClock((item.data as SectionData | undefined)?.time || "", today)
        return timeLeft > 0 && (!closest || timeLeft < closest) ? timeLeft : closest
    }, 0)

    const recommended = (currentRecentFiles.projectMedia || [])
        .filter((path) => !projectItemsList.find((item) => item.id === path || item.name === removeExtension(getFileName(path))))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 5)

    const selectedData = Array.isArray(currentSelected.data) ? currentSelected.data : []
    const canAddToProject = !!currentContextActive && !!projectId && VALID_IDS.includes(currentSelected.id || "") && !readOnly
    const activeIndex = currentFocusMode ? currentActiveFocus.index : currentActiveShow?.index
    const activeId = currentFocusMode ? currentActiveFocus.id : currentActiveShow?.id

    const sections: SectionGroup[] = []
    projectItemsList.forEach((item, index) => {
        const previous = projectItemsList[index - 1]
        const next = projectItemsList[index + 1]
        let previousType = previous?.type || "show"
        let currentType = item.type || "show"
        let nextType = next?.type || "show"
        if (previousType === "image" || previousType === "video") previousType = "image"
        if (currentType === "image" || currentType === "video") currentType = "image"
        if (nextType === "image" || nextType === "video") nextType = "image"

        const last = sections.at(-1)
        if (!last) sections.push({ color: item.color || "", items: [] })
        else if (currentType === "section" && (item.color || previousType === "section" || nextType === "section")) sections.push({ color: item.color || "", items: [] })
        else if (currentType !== "section" && previousType !== "section" && projectItemsList[index - 2]?.type !== "section" && currentType !== previousType) {
            if (last.color === "") last.items.push({ id: "", type: "DIVIDER" })
            else sections.push({ color: "", items: [] })
        }
        sections.at(-1)!.items.push({ ...clone(item), index })
    })

    function addSelectedToProject() {
        if (readOnly || !projectId || !VALID_IDS.includes(currentSelected.id || "")) return
        let data = clone(selectedData)
        if (!data?.length) return
        if (currentSelected.id === "overlay") data = data.map((id) => ({ id, type: "overlay" }))
        else if (currentSelected.id === "effect") data = data.map((id) => ({ id, type: "effect" }))
        else if (currentSelected.id === "player") data = data.map((id) => ({ id, type: "player", data: { type: currentPlayerVideos[id]?.type, id: currentPlayerVideos[id]?.id, name: currentPlayerVideos[id]?.name } }))
        else if (currentSelected.id === "audio") data = data.filter((item) => item.path).map(({ path, name }) => ({ id: path, name, type: "audio" }))
        else if (currentSelected.id === "media") data = data.filter((item) => item.path).map(({ path, name }) => ({ id: path, name, type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)) }))

        data.forEach((item) => addProjectItem(item as ProjectShowRef))
        contextActive.set(false)
    }

    return (
        <div id="projectArea" className={`list ${styles.list} ${projectReadOnly ? "" : "context #project"}`}>
            <Autoscroll scrollElem={scrollElem} offset={offset} timeout={150}>
                <DropArea id="project" selectChildren hoverTimeout={150}>
                    {(fileOver) =>
                        projectItemsList.length ? (
                            <>
                                {sections.map((section, sectionIndex) => {
                                    const first = section.items[0]
                                    const isCollapsed = !!currentProject?.sectionsCollapsed && first?.type === "section" && !section.items.some((item) => (activeIndex === undefined ? item.id === activeId : item.index === activeIndex))
                                    return (
                                        <div key={sectionIndex} className={`listSection ${styles.listSection}`} style={{ ...(section.color ? { "--border-color": section.color } : {}), ...(isCollapsed && section.items.length > 1 ? { borderBottom: "3px solid var(--primary-lighter)" } : {}) } as CSSProperties}>
                                            {section.items.map((show, index) => {
                                                const itemIndex = show.index ?? -1
                                                const sectionData = show.data as SectionData | undefined
                                                const triggerAction = sectionData?.settings?.triggerAction || currentSpecial.sectionTriggerAction
                                                const sectionTime = sectionData?.time ? getTimeUntilClock(sectionData.time, today) : 0
                                                const isActive = show.type === "section" ? (currentFocusMode ? currentActiveFocus.id === show.id : currentActiveShow?.id === show.id) : false
                                                const isLocked = show.type === "section" && !!currentProject?.sectionsLocked
                                                if (isCollapsed && index > 0) return null
                                                if (show.type === "DIVIDER") return <div key={index} style={{ borderTop: "1px solid var(--primary-lighter)", margin: "5px 0" }} />

                                                return (
                                                    <SelectElem key={index} id="show" dropAbove={index === 0} triggerOnHover data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index: itemIndex } as never} fileOver={fileOver} borders={show.type === "show_placeholder" ? "all" : "edges"} trigger="column" draggable={!isLocked} selectable={!isLocked}>
                                                        {show.type === "section" ? (
                                                            <Button
                                                                isActive={isActive}
                                                                className={`section ${projectReadOnly || isLocked ? "" : `context #project_section ${show.color ? "color-border" : ""}`}`}
                                                                style={{
                                                                    justifyContent: "left",
                                                                    borderTop: "1px solid var(--primary-lighter)",
                                                                    padding: "0.1em 1em",
                                                                    ...(currentFullColors ? { backgroundColor: show.color || "var(--primary-darker)", color: getContrast(show.color || "") } : { backgroundColor: fadeColor(show.color || "", 0.2), color: show.color ? brightenDarkColor(show.color) : "" })
                                                                }}
                                                                onClick={(detail) => {
                                                                    if (detail.ctrl) return
                                                                    const next = { ...show, index: itemIndex }
                                                                    if (currentFocusMode) activeFocus.set({ id: show.id, index: itemIndex, type: show.type as ShowType })
                                                                    else activeShow.set(next as never)
                                                                }}
                                                                tab
                                                            >
                                                                {sectionTime ? (
                                                                    <span style={{ fontWeight: "normal" }}>
                                                                        <span style={{ opacity: 0.7 }}>{sectionData?.time}</span>
                                                                        {sectionTime > 0 && closestTime === sectionTime ? <span style={{ color: "var(--secondary)" }}>{joinTimeBig(sectionTime)}</span> : null}
                                                                    </span>
                                                                ) : null}
                                                                <p style={{ minHeight: 10, maxWidth: "97%" }}>
                                                                    {show.name?.length ? (
                                                                        show.name
                                                                    ) : (
                                                                        <span style={{ opacity: 0.5 }}>
                                                                            <T id="main.unnamed" />
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                {show.notes?.length ? <p style={{ opacity: 0.5, fontWeight: "normal", fontSize: "0.9em", maxWidth: "50%" }}>{show.notes}</p> : null}
                                                                {triggerAction && currentActions[triggerAction] ? (
                                                                    <span style={{ display: "flex", position: "absolute", insetInlineEnd: 7 }} data-title={currentActions[triggerAction].name}>
                                                                        <Icon id={getActionIcon(triggerAction)} size={0.8} white />
                                                                    </span>
                                                                ) : null}
                                                                {isActive ? (
                                                                    <span className={`arrow ${styles.arrow}`}>
                                                                        <Icon id="next" white />
                                                                    </span>
                                                                ) : isCollapsed && section.items.length > 1 ? (
                                                                    <span className={`arrow ${styles.arrow}`}>
                                                                        <Icon id="add" size={0.8} white />
                                                                    </span>
                                                                ) : null}
                                                            </Button>
                                                        ) : (
                                                            <ShowButton id={show.id} show={show} index={itemIndex} className={projectReadOnly ? "" : `context #project_${getContextMenuId(show.type, isTemplate)}`} icon isProject />
                                                        )}
                                                    </SelectElem>
                                                )
                                            })}
                                        </div>
                                    )
                                })}

                                {recommended.length ? (
                                    <>
                                        <div className="section" style={{ marginTop: 80, borderTop: "1px solid var(--primary-lighter)", backgroundColor: "var(--primary-darkest)", padding: "2px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <T id="media.recommended" />
                                            <Button
                                                className="show"
                                                style={toStyle("padding: 0.2em;border-radius: 2px;border-left: none;min-height: unset;")}
                                                onClick={() => {
                                                    recentFiles.update((all) => {
                                                        all.cleared = [...(all.cleared || []), ...recommended]
                                                        return all
                                                    })
                                                    void updateRecentlyAddedFiles()
                                                }}
                                                title="clear.general"
                                                tab
                                            >
                                                <Icon id="clear" size={0.9} white />
                                            </Button>
                                        </div>
                                        <div className={`recommended ${styles.recommended}`}>
                                            <div className={`listSection ${styles.listSection}`}>
                                                {recommended.map((path) => {
                                                    const name = getFileName(path)
                                                    const type = getMediaType(getExtension(name))
                                                    return (
                                                        <Button key={path} className="show context #recent_file__project" style={toStyle("justify-content: space-between;padding: 0.35em 0.8em;font-weight: normal;")} onClick={() => addToProject(null, [path])} title={`context.addToProject: <b>${name}</b>`} tab>
                                                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <Icon id={type === "audio" ? "music" : type || ""} size={0.9} white right />
                                                                <p style={{ minHeight: 10 }}>{removeExtension(name)}</p>
                                                            </span>
                                                            <Icon id="add" size={0.9} white right />
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            <Center absolute>
                                <span style={{ opacity: 0.5 }}>
                                    <T id="empty.general" />
                                </span>
                                {shouldPasteText ? (
                                    <span className={`buttons ${styles.buttons}`} style={{ paddingTop: 20 }}>
                                        <Button variant="outline" title="actions.import: formats.clipboard" onClick={() => clipboardToProject()}>
                                            <Icon id="paste" white />
                                            <T id="formats.clipboard" />
                                        </Button>
                                    </span>
                                ) : null}
                            </Center>
                        )
                    }
                </DropArea>
            </Autoscroll>

            {canAddToProject ? (
                <div className={`${styles.addToProject} fade`} role="none" onMouseDown={addSelectedToProject}>
                    <Icon id="add" size={2} white />
                    <T id="context.addToProject" />
                </div>
            ) : null}
        </div>
    )
}
