import { useState } from "react"
import { uid } from "uid"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { clone, keysToID, sortByName } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getProjectName } from "../../../components/helpers/historyHelpers"
import { activePopup, activeProject, activeRename, folders, projects, projectTemplates } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { Menu, MenuItem, MenuSeparator } from "../../ui/menu"
import styles from "./PlaylistAddMenu.module.css"

// Port de components/show/left/PlaylistAddMenu.svelte: el "+" de PLAYLISTS (playlist, carpeta, plantillas, importar).
export interface PlaylistAddMenuProps {
    readOnly?: boolean
}

export function PlaylistAddMenu({ readOnly = false }: PlaylistAddMenuProps) {
    const [open, setOpen] = useState(false)
    const currentProject = useStore(activeProject)
    const projectsValue = useStore(projects)
    const foldersValue = useStore(folders)
    const templatesValue = useStore(projectTemplates)

    function run(action: () => void) {
        setOpen(false)
        action()
    }

    // nueva playlist/carpeta dentro de la carpeta de la playlist activa (o en la raíz)
    function currentParent() {
        const parent = currentProject ? projectsValue[currentProject]?.parent : ""
        return parent && foldersValue[parent] ? parent : "/"
    }

    function create(folder = false) {
        history({ id: "UPDATE", newData: { replace: { parent: currentParent() } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })
    }

    const templates = sortByName(keysToID(templatesValue)).filter((a) => !a.deleted)

    function fromTemplate(id: string) {
        const project = clone(templatesValue[id])
        if (!project) return

        project.parent = currentParent()
        project.name = project.name?.includes("{") ? getProjectName(project.parent, { default_project_name: project.name }) : getProjectName(project.parent)

        const projectId = uid()
        history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        setTimeout(() => activeRename.set("project_" + projectId))
    }

    function newTemplate() {
        const id = uid()
        activeRename.set("project_" + id)
        history({ id: "UPDATE", newData: { data: { name: "", parent: "/", shows: [], created: 0 } }, oldData: { id }, location: { page: "show", id: "project_template" } })
    }

    function importProject() {
        sendMain(Main.IMPORT, { channel: "freeshow_project", format: { extensions: ["project", "shows", "json", "zip"], name: translateText("formats.project") } })
    }

    return (
        <div className={styles.anchor}>
            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.new_playlist" disabled={readOnly} onNativeClick={() => setOpen(!open)} />
            <Menu open={open} onClose={() => setOpen(false)}>
                <MenuItem onClick={() => run(() => create())}>{translateText("new.project")}</MenuItem>
                <MenuItem onClick={() => run(() => create(true))}>{translateText("new.folder")}</MenuItem>
                {templates.length ? (
                    <>
                        <MenuSeparator />
                        {templates.map((template) => (
                            <MenuItem key={template.id} onClick={() => run(() => fromTemplate(template.id))}>
                                {template.name}
                            </MenuItem>
                        ))}
                    </>
                ) : null}
                <MenuSeparator />
                <MenuItem onClick={() => run(newTemplate)}>{translateText("actions.project_template")}</MenuItem>
                <MenuItem onClick={() => run(importProject)}>{translateText("actions.import")}</MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => run(() => activePopup.set("playlist_options"))}>{translateText("edit.options")}</MenuItem>
            </Menu>
        </div>
    )
}
