<script lang="ts">
    // LIBRARIES: sólo la lista de bibliotecas (las categorías de shows). Elegir una hace que
    // ÍTEMS muestre sus shows. Usa los mismos ids que la pestaña Shows del cajón
    // (`category_shows`) para conservar renombrar, menú contextual y mover shows arrastrando.
    import Button from "../../../lib/components/ui/button/button.svelte"
    import HiddenInput from "../../../lib/components/ui/hidden-input/hidden-input.svelte"
    import { activeProfile, categories, drawerTabsData, leftSource, shows } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import DropArea from "../../system/DropArea.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import LeftPanel from "./LeftPanel.svelte"

    const UNLABELED = "unlabeled"

    $: profile = $activeProfile ? getAccess("shows") : {}
    $: readOnly = profile.global === "read"

    // Las bibliotecas heredadas de FreeShow no se muestran: "Scripture" (las Biblias se abren desde su pestaña) y las
    // de fábrica "Songs"/"Presentations" mientras estén vacías. Una biblioteca elegida nunca se oculta.
    const LEGACY_EMPTY_HIDDEN = ["song", "presentation"]
    $: all = keysToID($categories).filter((a) => profile[a.id] !== "none" && !isHiddenLegacy(a.id, counts, activeLibrary))
    function isHiddenLegacy(id: string, counts: Record<string, number>, active: string | null) {
        if (id === active) return false
        if (id === "scripture") return true
        return LEGACY_EMPTY_HIDDEN.includes(id) && !counts[id]
    }
    $: libraries = [
        ...sortObject(
            all.filter((a) => !a.isArchive),
            "name"
        ),
        ...sortObject(
            all.filter((a) => a.isArchive),
            "name"
        )
    ]

    $: visibleShows = Object.values($shows).filter((a) => a && !a.private && profile[a.category || ""] !== "none")
    $: counts = visibleShows.reduce<Record<string, number>>((result, show) => {
        const key = show.category && $categories[show.category] ? show.category : UNLABELED
        result[key] = (result[key] || 0) + 1
        return result
    }, {})
    // los shows sin biblioteca no pueden quedar inalcanzables: aparece "Sin etiqueta" sólo si hace falta
    $: showUnlabeled = !!counts[UNLABELED] || ($leftSource?.type === "library" && $leftSource.id === UNLABELED)

    $: activeLibrary = $leftSource?.type === "library" ? $leftSource.id : null

    function select(id: string) {
        leftSource.set({ type: "library", id })
        // "nuevo show" toma la biblioteca de esta sub-pestaña
        drawerTabsData.update((a) => {
            a.shows = { ...(a.shows || { enabled: true }), activeSubTab: id }
            return a
        })
    }

    const newLibrary = () => history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })

    function rename(id: string, value: string) {
        categories.update((a) => {
            if (!a[id]) return a
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }

    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")
</script>

<LeftPanel title={translateText("ui.libraries")} count={libraries.length}>
    {#snippet actions()}
        <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.new_library" disabled={readOnly} onclick={newLibrary} />
    {/snippet}

    <DropArea id="navigation" selectChildren>
        {#each libraries as library (library.id)}
            {@const isReadOnly = readOnly || profile[library.id] === "read"}
            <SelectElem id="category_shows" data={library.id} selectable trigger="column" borders="center" style="width: 100%;">
                <button type="button" class="library-row context #category_shows_button{isReadOnly ? '_readonly' : ''}" class:active={activeLibrary === library.id} aria-current={activeLibrary === library.id ? "true" : undefined} onclick={() => select(library.id)}>
                    <span class="name">
                        <HiddenInput value={label(library.name)} id="category_shows_{library.id}" on:edit={(e) => rename(library.id, e.detail.value)} allowEdit={!isReadOnly} />
                    </span>
                    <span class="count">{counts[library.id] || 0}</span>
                </button>
            </SelectElem>
        {/each}

        {#if showUnlabeled}
            <button type="button" class="library-row" class:active={activeLibrary === UNLABELED} onclick={() => select(UNLABELED)}>
                <span class="name">{translateText("category.unlabeled")}</span>
                <span class="count">{counts[UNLABELED] || 0}</span>
            </button>
        {/if}
    </DropArea>
</LeftPanel>

<style>
    .library-row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        height: 28px;
        padding: 0 12px;
        border: 0;
        background: transparent;
        color: var(--text);
        font-size: 13px;
        text-align: left;
    }
    .library-row:hover {
        background: var(--hover, rgb(255 255 255 / 0.05));
    }
    .library-row.active {
        background: var(--secondary-opacity);
    }
    .library-row.active::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 2px;
        background: var(--secondary);
    }
    .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .count {
        font-size: 12px;
        color: var(--text-muted);
    }
</style>
