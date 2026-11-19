import { buildProjectTree } from "../../../components/show/projectTree"
import { activeProfile, folders, leftSource, projects, sorted } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { DropArea } from "../../../shared/ui/system/DropArea"
import { ProjectList } from "../ProjectList"
import { LeftPanel } from "./LeftPanel"
import { PlaylistAddMenu } from "./PlaylistAddMenu"

// Port de components/show/left/PlaylistsPanel.svelte: sólo la lista de playlists (con sus carpetas).
// Elegir una hace que ÍTEMS muestre sus ítems; se marca como activa únicamente si la fuente es una playlist.
interface ProjectsAccess {
    global?: string
    [id: string]: string | undefined
}

interface SortedProjects {
    projects?: { type?: string }
}

export function PlaylistsPanel() {
    const profileId = useStore(activeProfile)
    const foldersValue = useStore(folders)
    const projectsValue = useStore(projects)
    const sortedValue = useStore(sorted) as SortedProjects
    const source = useStore(leftSource)

    const profile = (profileId ? getAccess("projects") : {}) as ProjectsAccess
    const readOnly = profile.global === "read"

    const tree = buildProjectTree({ folders: foldersValue, projects: projectsValue, sortType: sortedValue.projects?.type || "name", profile })
    const count = tree.filter((a) => a.type !== "folder").length
    const selectedId = source?.type === "playlist" ? source.id : null

    return (
        <LeftPanel title={translateText("ui.playlists")} count={count} actions={<PlaylistAddMenu readOnly={readOnly} />}>
            {/* El Svelte original no tiene bloque <style>: el contexto y el alto vienen de utilidades y del tema. */}
            <div className={readOnly ? "" : "context #projects"} style={{ minHeight: "100%" }}>
                <DropArea id="projects">
                    <ProjectList tree={tree} readOnly={readOnly} selectedId={selectedId} />
                </DropArea>
            </div>
        </LeftPanel>
    )
}
