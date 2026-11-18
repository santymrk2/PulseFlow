import { useEffect, useState } from "react"
import type { Tree } from "../../../types/Projects"
import { activeProfile, activeProject, folders, labelsDisabled, openedFolders, projects } from "../../stores"
import { history } from "../../components/helpers/history"
import { isProjectLinked, openProject } from "../../components/show/project"
import Loader from "../../components/main/Loader.svelte"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { T } from "../helpers/T"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { HiddenInput } from "../ui/hidden-input/HiddenInput"
import { Center } from "../system/Center"
import { SelectElem } from "../system/SelectElem"
import styles from "./ProjectList.module.css"

interface ArchivedCount {
    [parent: string]: { id: string; count: number }
}

export interface ProjectListProps {
    tree: Tree[]
    readOnly?: boolean
    selectedId?: string | null
}

// Port de components/show/ProjectList.svelte (F24.20a).
export function ProjectList({ tree, readOnly = false, selectedId }: ProjectListProps) {
    const currentActiveProfile = useStore(activeProfile)
    const currentActiveProject = useStore(activeProject)
    const currentFolders = useStore(folders)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOpenedFolders = useStore(openedFolders)
    const currentProjects = useStore(projects)

    const activeId = selectedId === undefined ? currentActiveProject : selectedId
    const [visibleArchives, setVisibleArchives] = useState<string[]>([])
    const [startLoading, setStartLoading] = useState(tree.length < 50)
    const [editActive, setEditActive] = useState(false)
    const [foldersWithoutContent, setFoldersWithoutContent] = useState<string[]>([])
    const [archivedCount, setArchivedCount] = useState<ArchivedCount>({})
    const [splittedTree, setSplittedTree] = useState<Tree[][]>([])
    const [pathToActive, setPathToActive] = useState("")

    useEffect(() => {
        openedFolders.set([...new Set(currentOpenedFolders.filter((id) => currentFolders[id]))])
        setTimeout(() => setStartLoading(true), 20)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setFoldersWithoutContent(
            currentOpenedFolders.filter((folderId) => {
                if (Object.values(currentProjects).some((project) => project.parent === folderId)) return false
                return !Object.values(currentFolders).some((folder) => folder.parent === folderId)
            })
        )
    }, [currentOpenedFolders, currentProjects, currentFolders])

    useEffect(() => {
        const count: ArchivedCount = {}
        tree.forEach((project) => {
            if (project.type === "folder" || !project.archived) return
            if (!count[project.parent]) count[project.parent] = { id: project.id, count: 0 }
            count[project.parent].count++
        })
        setArchivedCount(count)
    }, [tree])

    useEffect(() => {
        const sections: Tree[][] = [[]]
        const rootProjects: Tree[] = []
        tree.forEach((item) => {
            if (item.parent === "/" && item.type !== "folder") {
                rootProjects.push(item)
                return
            }
            if (item.type === "folder" && item.parent === "/" && sections.at(-1)?.length) sections.push([])
            sections.at(-1)!.push(item)
        })
        if (rootProjects.length) sections.push([{ id: "ROOT" } as Tree, ...rootProjects])
        setSplittedTree(sections.filter((section) => section.length))
    }, [tree])

    useEffect(() => {
        const paths: string[] = []
        let parent = currentProjects[activeId || ""]?.parent
        let loopstop = 0
        while ((parent || "/") !== "/" && loopstop < 80) {
            loopstop++
            paths.push(parent || "")
            parent = currentFolders[parent || ""]?.parent
        }
        setPathToActive(paths.reverse().join("/"))
    }, [activeId, currentProjects, currentFolders])

    function checkIfShown(project: Tree) {
        let allOpened = true
        ;(project.path || "").split("/").forEach((id) => {
            if (id.length && !currentOpenedFolders.includes(id)) allOpened = false
        })
        return allOpened
    }

    function rename(id: string, value: string) {
        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_key" } })
    }

    function renameFolder(id: string, value: string) {
        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_folder_key" } })
    }

    function open(detail: { ctrl: boolean; alt: boolean; target: EventTarget }, id: string) {
        const target = detail.target instanceof Element ? detail.target : null
        if (target?.closest(".edit") || target?.querySelector(".edit") || editActive) return
        if (detail.ctrl) return
        openProject(id, !detail.alt)
    }

    function toggleFolder(detail: { ctrl: boolean; target: EventTarget }, project: Tree, opened: boolean) {
        const target = detail.target instanceof Element ? detail.target : null
        if (editActive || detail.ctrl || target?.classList.contains("name") || target?.classList.contains("add")) return
        if (opened) {
            openedFolders.set(currentOpenedFolders.filter((id) => id !== project.id))
        } else if (!currentOpenedFolders.includes(project.id)) {
            openedFolders.set([...currentOpenedFolders, project.id])
        }
    }

    if (!tree.length)
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    if (!startLoading)
        return (
            <Center>
                <SvelteIsland component={Loader as never} />
            </Center>
        )

    return (
        <div className={styles.fullTree}>
            {splittedTree.map((section, sectionIndex) => (
                <div key={sectionIndex} className={styles.rootFolder}>
                    {section.map((project, projectIndex) => {
                        if (project.id === "ROOT")
                            return (
                                <div key="root" className={styles.title}>
                                    <T id="category.unlabeled" />
                                </div>
                            )
                        const opened = currentOpenedFolders.includes(project.id)
                        const shown = checkIfShown(project)
                        const isArchivedShown = !project.archived || visibleArchives.includes(project.parent)
                        const isEmpty = project.type === "folder" && foldersWithoutContent.includes(project.id)
                        const itemReadOnly = readOnly || project.readOnly
                        const noEditing = !!currentActiveProfile && project.parent === "/" && !!project.name
                        const projectsCount = project.parent === "/" ? section.filter((item) => item.type !== "folder").length : 0
                        const key = project.id || `${sectionIndex}-${projectIndex}`

                        return (
                            <div key={key}>
                                <div className={`${styles.projectItem} ${project.parent !== "/" ? styles.indented : ""}`} style={{ marginInlineStart: 8 * (project.index || 0) }}>
                                    <SelectElem id={project.type || "project"} data={{ type: project.type || "project", id: project.id } as never} draggable={!itemReadOnly && !noEditing} trigger="column" borders="center">
                                        {project.type === "folder" && (project.parent === "/" || shown) ? (
                                            <Button style={{ width: "100%", padding: "0.22rem 0.65rem" }} title={`${opened ? "actions.close" : "main.open"}: <b>${project.name}</b>`} onClick={(detail) => toggleFolder(detail, project, opened)} className={`folder context #folder${itemReadOnly ? "_readonly" : noEditing ? "_noediting" : ""}`} isActive={pathToActive.includes(project.id)} tab>
                                                <Icon id={opened ? "folderOpen" : "folder"} white />
                                                <span className={styles.grow}>
                                                    <HiddenInput value={project.name} id={`folder_${project.id}`} onEdit={(detail) => renameFolder(project.id, detail.value)} edit={editActive} onEditChange={(value) => setEditActive(!!value)} allowEdit={!itemReadOnly && !noEditing} />
                                                </span>
                                                {projectsCount ? <span className={styles.count}>{projectsCount}</span> : null}
                                            </Button>
                                        ) : project.id && shown && isArchivedShown ? (
                                            <Button style={{ width: "100%", padding: "0.08rem 0.65rem", fontWeight: "normal" }} title={`actions.id_select_project: <b>${project.name}</b>`} onClick={(detail) => open(detail, project.id)} className={`context #project_button${itemReadOnly ? "_readonly" : ""}`} isActive={activeId === project.id} tab>
                                                <span className={styles.grow}>
                                                    <HiddenInput value={project.name} id={`project_${project.id}`} onEdit={(detail) => rename(project.id, detail.value)} edit={editActive} onEditChange={(value) => setEditActive(!!value)} allowEdit={!itemReadOnly} />
                                                </span>
                                                {isProjectLinked(currentProjects[project.id], project.id) ? <Icon id="cloud" size={0.8} white /> : null}
                                                <span className={styles.count}>{currentProjects[project.id]?.shows?.length ?? 0}</span>
                                            </Button>
                                        ) : null}
                                    </SelectElem>
                                </div>

                                {shown && project.archived && !visibleArchives.includes(project.parent) && project.id === archivedCount[project.parent]?.id ? (
                                    <div className={project.parent !== "/" ? styles.indented : ""} style={{ marginInlineStart: 8 * (project.index || 0), display: "flex", alignItems: "center", flexDirection: "column" }}>
                                        <Button onClick={() => setVisibleArchives((all) => [...all, project.parent])} style={{ width: "100%", borderTop: "1px solid var(--primary-lighter)", fontSize: "0.9em" }}>
                                            <Icon id="archive" size={0.8} white right />
                                            <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <T id="actions.show_archived" /> <span style={{ opacity: 0.4, fontSize: "0.9em" }}>{archivedCount[project.parent].count}</span>
                                            </p>
                                        </Button>
                                    </div>
                                ) : null}

                                {shown && isEmpty && !itemReadOnly ? (
                                    <div className={project.parent !== "/" ? styles.indented : ""} style={{ marginInlineStart: 8 * ((project.index || 0) + 1), display: "flex", alignItems: "center", flexDirection: "column", padding: 12 }}>
                                        <p style={{ opacity: 0.5, paddingBottom: 8 }}>
                                            <T id="empty.general" />
                                        </p>
                                        <Button variant="outline" icon="add" title="new.project" style={{ justifyContent: "start", padding: "6px 14px" }} onClick={() => history({ id: "UPDATE", newData: { replace: { parent: project.id } }, location: { page: "show", id: "project" } })}>
                                            {currentLabelsDisabled ? null : (
                                                <p>
                                                    <T id="new.project" />
                                                </p>
                                            )}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}
