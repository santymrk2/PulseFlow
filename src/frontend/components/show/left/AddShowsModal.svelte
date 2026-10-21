<script lang="ts">
    // Modal "Agregar shows" (el "+" de ÍTEMS con una playlist elegida): bibliotecas a la
    // izquierda, shows a la derecha con casillas de selección múltiple. Lo marcado se conserva
    // al cambiar de biblioteca y se agrega al final de la playlist en un solo paso.
    import Button from "../../../lib/components/ui/button/button.svelte"
    import Input from "../../../lib/components/ui/input/input.svelte"
    import { activePopup, activeProfile, categories, leftSource, projects, sortedShowsList } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import Modal from "../../main/Modal.svelte"
    import { filterShows, isHiddenLegacyLibrary, showsOfLibrary, toggleId, UNLABELED_LIBRARY_ID } from "../leftSource"
    import { addShowsToProject } from "../project"

    $: playlistId = $leftSource?.type === "playlist" ? $leftSource.id : null
    $: profile = $activeProfile ? getAccess("shows") : {}

    $: counts = $sortedShowsList.reduce<Record<string, number>>((result, show) => {
        if (show?.category) result[show.category] = (result[show.category] || 0) + 1
        return result
    }, {})
    $: all = keysToID($categories).filter((a) => profile[a.id] !== "none" && !isHiddenLegacyLibrary(a.id, counts, null))
    $: libraries = [
        ...sortObject(
            all.filter((a) => !a.isArchive),
            "name"
        ),
        ...sortObject(
            all.filter((a) => a.isArchive),
            "name"
        ),
        { id: UNLABELED_LIBRARY_ID, name: "category.unlabeled" }
    ]
    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    let browsing = ""
    $: if (!browsing || !libraries.some((a) => a.id === browsing)) browsing = libraries[0]?.id || ""

    let query = ""
    let selected: string[] = []

    $: shown = filterShows(showsOfLibrary($sortedShowsList, browsing, $categories, profile), query)
    $: names = Object.fromEntries($sortedShowsList.map((a) => [a.id, a.name]))

    function confirm() {
        if (playlistId) addShowsToProject(playlistId, selected)
        activePopup.set(null)
    }
</script>

<Modal title="ui.add_shows" width={720} height={480} lockOutsideClick={false}>
    <div class="container">
        <nav class="libraries" aria-label={translateText("ui.libraries")}>
            {#each libraries as library (library.id)}
                <button type="button" class="library" class:active={browsing === library.id} onclick={() => ((browsing = library.id), (query = ""))}>{label(library.name)}</button>
            {/each}
        </nav>

        <div class="shows">
            <div class="search"><Input value={query} placeholder={translateText("ui.search_shows")} on:input={(e) => (query = (e.target as HTMLInputElement).value)} /></div>
            <div class="list">
                {#each shown as show (show.id)}
                    <label class="show">
                        <input type="checkbox" checked={selected.includes(show.id)} onchange={() => (selected = toggleId(selected, show.id))} />
                        <span class="name">{show.name}</span>
                    </label>
                {:else}
                    <p class="empty">{translateText(query.trim() ? "ui.no_results" : "empty.shows")}</p>
                {/each}
            </div>
            <footer>
                <span class="chosen"
                    >{selected
                        .map((id) => names[id])
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(", ")}{selected.length > 3 ? "…" : ""}</span
                >
                <Button variant="outline" onclick={() => activePopup.set(null)}>{translateText("popup.cancel")}</Button>
                <Button disabled={!selected.length || !playlistId || !$projects[playlistId]} onclick={confirm}>{translateText("ui.add_count", null, [String(selected.length)])}</Button>
            </footer>
        </div>
    </div>
</Modal>

<style>
    .container {
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 0;
    }
    .libraries {
        width: 200px;
        flex-shrink: 0;
        overflow-y: auto;
        border-right: 1px solid var(--primary-lighter);
        padding: 6px 0;
    }
    .library {
        display: block;
        width: 100%;
        padding: 6px 14px;
        border: 0;
        background: transparent;
        color: var(--text);
        text-align: left;
        font-size: 13px;
    }
    .library:hover {
        background: rgb(255 255 255 / 0.05);
    }
    .library.active {
        background: var(--secondary-opacity);
        box-shadow: inset 2px 0 0 var(--secondary);
    }
    .shows {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
    }
    .search {
        padding: 8px;
        border-bottom: 1px solid var(--primary-lighter);
    }
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }
    .show {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        font-size: 13px;
        cursor: pointer;
    }
    .show:hover {
        background: rgb(255 255 255 / 0.05);
    }
    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .empty {
        padding: 24px;
        text-align: center;
        color: var(--text-muted);
    }
    footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-top: 1px solid var(--primary-lighter);
    }
    .chosen {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-muted);
        font-size: 12px;
    }
</style>
