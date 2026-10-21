<script lang="ts">
    // Columna izquierda de la página Show: LIBRARIES · PLAYLISTS · ÍTEMS.
    // Resuelve la fuente de ÍTEMS (nunca queda sin una si hay algo que mostrar) y reparte el
    // alto con dos divisores arrastrables que se recuerdan.
    import { activeProject, categories, drawerTabsData, leftSource, loaded, projects, projectView, resized } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import { isSourceValid, resolveInitialSource, UNLABELED_LIBRARY_ID } from "../leftSource"
    import ItemsPanel from "./ItemsPanel.svelte"
    import LibrariesPanel from "./LibrariesPanel.svelte"
    import { DEFAULT_SIZES, dragSplitter, type PanelSizes } from "./panelSizes"
    import PlaylistsPanel from "./PlaylistsPanel.svelte"

    $: playlistIds = sortByName(keysToID($projects))
        .filter((a) => !a.deleted)
        .map((a) => a.id)
    $: libraryIds = [...Object.keys($categories), UNLABELED_LIBRARY_ID]

    // espera a que carguen los datos: antes de eso "no hay playlists" sería mentira
    $: if ($loaded && !isSourceValid($leftSource, { playlists: playlistIds, libraries: libraryIds })) resolveSource()

    function resolveSource() {
        const last = $activeProject ? ({ type: "playlist", id: $activeProject } as const) : null
        const next = resolveInitialSource({ last, playlists: playlistIds, libraries: libraryIds })

        if (next?.type === "playlist") {
            activeProject.set(next.id)
            projectView.set(false)
        } else if (next) {
            const id = next.id
            drawerTabsData.update((a) => {
                a.shows = { ...(a.shows || { enabled: true }), activeSubTab: id }
                return a
            })
        }
        leftSource.set(next)
    }

    // --- divisores ---
    let column: HTMLElement | undefined
    let sizes: PanelSizes = DEFAULT_SIZES
    let dragging = false
    $: if (!dragging) sizes = { libraries: $resized.leftLibraries ?? DEFAULT_SIZES.libraries, playlists: $resized.leftPlaylists ?? DEFAULT_SIZES.playlists }

    function startDrag(handle: "libraries" | "playlists", e: PointerEvent) {
        if (!column) return
        e.preventDefault()
        dragging = true
        const startY = e.clientY
        const startSizes = sizes
        const height = column.getBoundingClientRect().height || 1

        const move = (ev: PointerEvent) => (sizes = dragSplitter(startSizes, handle, ((ev.clientY - startY) / height) * 100))
        const up = () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", up)
            resized.update((a) => ({ ...a, leftLibraries: sizes.libraries, leftPlaylists: sizes.playlists }))
            dragging = false
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
    }
</script>

<div class="column" bind:this={column}>
    <div class="panel" style="flex: 0 0 {sizes.libraries}%;"><LibrariesPanel /></div>
    <div class="splitter" role="separator" aria-orientation="horizontal" on:pointerdown={(e) => startDrag("libraries", e)}></div>
    <div class="panel" style="flex: 0 0 {sizes.playlists}%;"><PlaylistsPanel /></div>
    <div class="splitter" role="separator" aria-orientation="horizontal" on:pointerdown={(e) => startDrag("playlists", e)}></div>
    <div class="panel items"><ItemsPanel /></div>
</div>

<style>
    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
    .panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }
    .items {
        flex: 1;
    }
    /* línea gruesa entre paneles; la franja de 6 px es el área de arrastre */
    .splitter {
        position: relative;
        flex: 0 0 2px;
        background: var(--border-color, var(--primary-lighter));
        cursor: row-resize;
        z-index: 1;
    }
    .splitter::before {
        content: "";
        position: absolute;
        inset: -3px 0;
    }
</style>
