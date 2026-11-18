import ProjectList from "../../../components/show/ProjectList.svelte"
import { buildProjectTree } from "../../../components/show/projectTree"
import { activeProfile, folders, leftSource, projects, sorted } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { DropArea } from "../../system/DropArea"
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
                    <SvelteIsland component={ProjectList} props={{ tree, readOnly, selectedId }} />
                </DropArea>
            </div>
        </LeftPanel>
    )
}
