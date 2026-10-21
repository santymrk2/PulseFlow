<script lang="ts">
    // PLAYLISTS: sólo la lista de playlists (con sus carpetas). Elegir una hace que ÍTEMS
    // muestre sus ítems. Se marca como activa únicamente si la fuente es una playlist.
    import { activeProfile, folders, leftSource, projects, sorted } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import DropArea from "../../system/DropArea.svelte"
    import ProjectList from "../ProjectList.svelte"
    import { buildProjectTree } from "../projectTree"
    import LeftPanel from "./LeftPanel.svelte"
    import PlaylistAddMenu from "./PlaylistAddMenu.svelte"

    $: profile = $activeProfile ? getAccess("projects") : {}
    $: readOnly = profile.global === "read"

    $: tree = buildProjectTree({ folders: $folders, projects: $projects, sortType: $sorted.projects?.type || "name", profile })
    $: count = tree.filter((a) => a.type !== "folder").length
    $: selectedId = $leftSource?.type === "playlist" ? $leftSource.id : null
</script>

<LeftPanel title={translateText("ui.playlists")} {count}>
    {#snippet actions()}
        <PlaylistAddMenu {readOnly} />
    {/snippet}

    <div class={readOnly ? "" : "context #projects"} style="min-height: 100%;">
        <DropArea id="projects">
            <ProjectList {tree} {readOnly} {selectedId} />
        </DropArea>
    </div>
</LeftPanel>
