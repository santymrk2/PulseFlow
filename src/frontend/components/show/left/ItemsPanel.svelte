<script lang="ts">
    // ÍTEMS: muestra lo que esté elegido arriba. Con una biblioteca, sus shows y un buscador;
    // con una playlist, sus ítems en orden. Nunca queda sin fuente (ver `LeftColumn`).
    import Button from "../../../lib/components/ui/button/button.svelte"
    import Input from "../../../lib/components/ui/input/input.svelte"
    import { activePopup, activeProfile, categories, leftSource, projects, sortedShowsList } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import ProjectContentList from "../ProjectContentList.svelte"
    import { filterShows, showsOfLibrary, UNLABELED_LIBRARY_ID } from "../leftSource"
    import LeftPanel from "./LeftPanel.svelte"
    import LibraryShowList from "./LibraryShowList.svelte"
    import PlaylistOptionsMenu from "./PlaylistOptionsMenu.svelte"

    $: source = $leftSource
    $: library = source?.type === "library" ? source.id : null
    $: playlistId = source?.type === "playlist" ? source.id : null

    $: showsProfile = $activeProfile ? getAccess("shows") : {}
    $: projectsProfile = $activeProfile ? getAccess("projects") : {}
    $: readOnly = library ? showsProfile.global === "read" || showsProfile[library] === "read" : projectsProfile.global === "read"

    // la búsqueda se reinicia al cambiar de fuente
    let query = ""
    let lastSource = ""
    $: if ((source ? `${source.type}:${source.id}` : "") !== lastSource) {
        lastSource = source ? `${source.type}:${source.id}` : ""
        query = ""
    }

    $: libraryShows = library ? showsOfLibrary($sortedShowsList, library, $categories, showsProfile) : []
    $: visibleShows = filterShows(libraryShows, query)

    const rawName = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")
    $: contextName = library ? (library === UNLABELED_LIBRARY_ID ? translateText("category.unlabeled") : rawName($categories[library]?.name)) : playlistId ? $projects[playlistId]?.name || translateText("main.unnamed") : ""
    $: count = library ? libraryShows.length : playlistId ? ($projects[playlistId]?.shows?.length ?? 0) : null

    // biblioteca: show nuevo (queda en esa biblioteca); playlist: modal para elegir shows
    const add = () => activePopup.set(library ? "show" : "add_shows")
    $: addTitle = library ? "new.show" : "ui.add_shows"
</script>

<LeftPanel title={translateText("ui.items_title")} context={contextName} {count}>
    {#snippet actions()}
        {#if playlistId}<PlaylistOptionsMenu projectId={playlistId} />{/if}
        {#if source}
            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title={addTitle} disabled={readOnly} onclick={add} />
        {/if}
    {/snippet}

    {#if library}
        <div class="flex h-full flex-col">
            <div class="library-search shrink-0 border-b border-border p-2">
                <Input value={query} placeholder={translateText("ui.search_shows")} on:input={(e) => (query = (e.target as HTMLInputElement).value)} />
            </div>
            <div class="min-h-0 flex-1">
                <LibraryShowList shows={visibleShows} searching={!!query.trim() && !visibleShows.length} />
            </div>
        </div>
    {:else if playlistId}
        <ProjectContentList tree={[]} recentlyUsedList={[]} />
    {/if}
</LeftPanel>
