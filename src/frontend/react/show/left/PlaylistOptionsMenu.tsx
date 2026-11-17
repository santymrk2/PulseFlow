import { useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import { exportProject } from "../../../components/export/project"
import { shareProjectLink } from "../../../components/export/projectLink"
import { contentProviderData, projects, providerConnections, special } from "../../../stores"
import { translateText } from "../../../utils/language"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { Menu, MenuItem, MenuSeparator } from "../../ui/menu"
import styles from "./PlaylistOptionsMenu.module.css"

// Port de components/show/left/PlaylistOptionsMenu.svelte: el "⋯" de ÍTEMS cuando la fuente es una playlist.
export interface PlaylistOptionsMenuProps {
    projectId: string
}

export function PlaylistOptionsMenu({ projectId }: PlaylistOptionsMenuProps) {
    const [open, setOpen] = useState(false)
    const projectsValue = useStore(projects)
    const connections = useStore(providerConnections)
    const providerData = useStore(contentProviderData)
    const specialValue = useStore(special)

    const project = projectsValue[projectId]
    const isOnStage = !!connections.onstage && (project?.origin === "onstage" || projectId.startsWith("onstage_"))
    const hasSections = !!project?.shows?.some((a) => a.type === "section")

    function run(action: () => void) {
        setOpen(false)
        action()
    }

    function update(key: "sectionsCollapsed" | "sectionsLocked", value: boolean) {
        projects.update((a) => {
            if (a[projectId]) a[projectId][key] = value
            return a
        })
    }

    function syncOnStage() {
        sendMain(Main.ONSTAGE_LOAD_SERVICE, { serviceId: projectId.replace("onstage_", ""), data: providerData.onstage })
    }

    if (!project) return null

    return (
        <div className={styles.anchor}>
            <Button variant="ghost" size="icon-sm" icon="more" iconSize={0.9} title="create_show.more_options" onNativeClick={() => setOpen(!open)} />
            <Menu open={open} onClose={() => setOpen(false)}>
                {isOnStage ? (
                    <>
                        <MenuItem onClick={() => run(syncOnStage)}>{translateText("cloud.sync")}</MenuItem>
                        <MenuSeparator />
                    </>
                ) : null}
                {project.sourcePath ? <MenuItem onClick={() => run(() => exportProject(project, projectId, project.sourcePath))}>{translateText("actions.save_to_file")}</MenuItem> : null}
                <MenuItem onClick={() => run(() => shareProjectLink(project, projectId))}>{translateText("export.data_link")}</MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => run(() => special.update((a) => ({ ...a, projectTimelineActive: !a.projectTimelineActive })))}>
                    {translateText("timeline.toggle_timeline")}
                    {specialValue.projectTimelineActive ? " ✓" : ""}
                </MenuItem>
                {hasSections ? (
                    <>
                        <MenuSeparator />
                        <MenuItem onClick={() => run(() => update("sectionsCollapsed", !project.sectionsCollapsed))}>
                            {translateText("actions.collapsed")}
                            {project.sectionsCollapsed ? " ✓" : ""}
                        </MenuItem>
                        <MenuItem onClick={() => run(() => update("sectionsLocked", !project.sectionsLocked))}>
                            {translateText("actions.lock_sections")}
                            {project.sectionsLocked ? " ✓" : ""}
                        </MenuItem>
                    </>
                ) : null}
            </Menu>
        </div>
    )
}
