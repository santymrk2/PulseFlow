<script lang="ts">
    // import VirtualList from "@sveltejs/svelte-virtual-list"
    // import VirtualList from "./VirtualList2.svelte"
    import type { ShowList } from "../../../../types/Show"
    import { ShowObj } from "../../../classes/Show"
    import { activeEdit, activeFocus, activePopup, activeProfile, activeProject, activeShow, activeTagFilter, categories, drawer, focusedArea, focusMode, labelsDisabled, shows, sorted, sortedShowsList } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { updateShowsList } from "../../helpers/show"
    import { dateToString } from "../../helpers/time"
    import FloatingBar from "../../../lib/components/ui/floating-bar/floating-bar.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import ShowButton from "../../show/ShowButton.svelte"
    import Autoscroll from "../../system/Autoscroll.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import VirtualList from "../VirtualList.svelte"

    export let active: string | null

    $: showsSorted = $sortedShowsList

    // // don't update unless it's changed
    // let updatedSorted: typeof showsSorted = []
    // $: if (showsSorted) updateSorted()
    // function updateSorted() {
    //     if (JSON.stringify(updateSorted) !== JSON.stringify(updatedSorted)) updatedSorted = clone(showsSorted)
    // }

    $: profile = $activeProfile ? getAccess("shows") : {}
    $: readOnly = profile.global === "read"

    let filteredShows: ShowList[] = []
    let filteredStored: ShowList[] = []
    $: filteredStored = filteredShows =
        active === "all"
            ? showsSorted.filter((a) => !$categories[a?.category || ""]?.isArchive && profile[a?.category || ""] !== "none")
            : // : active === "number" ? sortByNameAndNumber(showsSorted.filter((a) => a.quickAccess?.number), "asc")
              active === "locked"
              ? showsSorted.filter((a) => a.locked)
              : showsSorted.filter((s) => profile[s?.category || ""] !== "none" && (active === s.category || (active === "unlabeled" && (s.category === null || !$categories[s.category]))))

    $: drawerIsClosed = $drawer.height <= 40
    let shouldUpdate = false
    // update when drawer is opened if it has changes
    $: if (shouldUpdate && !drawerIsClosed) update()

    $: if (filteredStored || $activeTagFilter) update()
    function update() {
        // don't update if drawer is closed
        // updates to this lags the editor when moving/resizing items, if many shows in list
        if (drawerIsClosed) {
            shouldUpdate = true
            return
        }
        shouldUpdate = false

        filteredShows = filterByTags(clone(filteredStored), $activeTagFilter)
    }

    function filterByTags(shows, tags: string[]) {
        if (!tags.length) return shows

        return shows.filter((a) => {
            return !tags.find((tagId) => !a.quickAccess?.tags?.includes(tagId))
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest?.("input") || e.target?.closest?.(".edit") || (!e.ctrlKey && !e.metaKey) || !filteredShows?.length) return
        if ($activeEdit.items.length) return

        let id = ""
        if (e.key === "ArrowRight") {
            if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[0].id
            else {
                let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                if (currentIndex < filteredShows.length - 1) id = filteredShows[currentIndex + 1].id
            }
        } else if (e.key === "ArrowLeft") {
            if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[filteredShows.length - 1].id
            else {
                let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                if (currentIndex > 0) id = filteredShows[currentIndex - 1].id
            }
        }

        if (id) {
            if ($focusMode) activeFocus.set({ id, type: "show" })
            else activeShow.set({ id, type: "show" })
        }
    }

    $: showWithNumber = filteredShows.some((a) => a.quickAccess?.number)
    $: sortType = $sorted.shows?.type || "name"
    $: modifiedType = ["modified", "created", "used"].includes(sortType.replace("_old", "")) ? sortType.replace("_old", "") : "modified"
    // All sortable columns share the same metadata so the UI + store stay in sync
    $: sortHeaders = [{ id: "name", style: "flex: 1;", label: translateText("show.name"), asc: "name", desc: "name_des", default: "asc" }, ...(showWithNumber ? [{ id: "number", style: "min-width: var(--number-width);", label: translateText("meta.number"), asc: "number", desc: "number_des", default: "asc" }] : []), { id: "modified", style: "min-width: var(--modified-width);", label: translateText(`info.${modifiedType}`), asc: `${modifiedType}_old`, desc: modifiedType, default: "desc" }]

    function toggleSort(columnId: string) {
        const definition = sortHeaders.find((header) => header.id === columnId)
        if (!definition) return

        const currentType = $sorted.shows?.type || "name"
        let nextType: string = definition.default === "desc" ? definition.desc : definition.asc
        if (currentType === definition.asc) nextType = definition.desc
        else if (currentType === definition.desc) nextType = definition.asc

        sorted.update((state) => {
            if (!state.shows) state.shows = {}
            state.shows.type = nextType
            return state
        })

        updateShowsList($shows)
    }

    function createShow(e: any, border = false) {
        if (border && e.target?.closest("button")) return

        const { ctrl } = e.detail
        if (ctrl) {
            let show = new ShowObj()
            const selectedIndex = $activeShow?.index === undefined ? undefined : $activeShow.index + 1
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject, index: selectedIndex } }, location: { page: "show", id: "show" } })
        } else {
            activePopup.set("show")
        }
    }

    // let listElem: HTMLElement | null = null
    // let scrollElem: HTMLElement | null = null
    // $: if (listElem && active) setTimeout(updateScrollElem)
    // function updateScrollElem() {
    //     scrollElem = listElem?.querySelector("svelte-virtual-list-viewport") || null
    // }

    $: showWithNonExistentCategory = active === "unlabeled" && filteredStored.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredStored.map((s) => s.category))] as string[]

        categories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll style="overflow-y: auto;flex: 1;">
    <!-- bind:this={listElem} -->
    <div class="column {readOnly ? '' : 'context #drawer_show'}" on:mouseup={() => focusedArea.set("show_drawer")}>
        {#if filteredShows.length}
            <div class="sort-header" role="group">
                {#each sortHeaders as header}
                    {@const direction = sortType === header.asc ? "asc" : sortType === header.desc ? "desc" : ""}
                    {@const isActive = direction !== ""}

                    <Button style="{header.style}justify-content: {header.id === 'name' ? 'flex-start' : 'center'};" {isActive} on:click={() => toggleSort(header.id)} title={header.label}>
                        <p>{header.label}</p>
                        {#if direction}
                            <span class="sort-indicator">
                                <Icon id={direction === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                            </span>
                        {/if}
                    </Button>
                {/each}
            </div>

            <!-- reload list when changing category -->
            {#key active}
                <VirtualList items={filteredShows} let:item={show} activeIndex={filteredShows.findIndex((a) => a.id === $activeShow?.id)}>
                    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={filteredShows} draggable>
                        <ShowButton id={show.id} {show} data={dateToString(show.timestamps?.[sortType.replace("_old", "")] || show.timestamps?.modified || show.timestamps?.created || "", true)} class="#drawer_show_button" />
                    </SelectElem>
                </VirtualList>
            {/key}
        {:else}
            <Center size={1.2} faded><T id="empty.shows" /></Center>
        {/if}
    </div>
</Autoscroll>

{#if showWithNonExistentCategory}
    <FloatingBar side="left" onlyOne>
        <Button on:click={createNonExistentCategories}>
            <Icon id="autofill" />
            <T id="category.create_nonexistent" />
        </Button>
    </FloatingBar>
{:else if active === "all" && filteredShows.length < 20}
    <FloatingBar side="left" onlyOne>
        <Button variant="outline" title="actions.import [Ctrl+I]" on:click={() => activePopup.set("import")}>
            <Icon id="import" />
            <T id="actions.import" />
        </Button>
    </FloatingBar>
{/if}

<FloatingBar onlyOne>
    <div role="none" class="overflow-interact" on:click={(e) => createShow(e, true)}>
        <Button icon="add" class="context #drawer_new_show" title="tooltip.show [Ctrl+N]" disabled={readOnly} on:click={createShow} white>
            {#if !$labelsDisabled}<T id="new.show" />{/if}
        </Button>
    </div>
</FloatingBar>

<style>
    .column {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        height: 100%;

        --number-width: 100px;
        --modified-width: 220px;
    }

    .warning {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }

    .column :global(svelte-virtual-list-viewport) {
        padding-bottom: 60px;
    }

    /* THIS don't work with virtual list */
    /* .column :global(svelte-virtual-list-contents:nth-child(even) button) {
        background-color: var(--primary-darkest);
    } */

    /* SORT HEADER */

    .sort-header {
        display: flex;
        height: 28px;
        border-radius: 4px;
        background-color: var(--primary-darker);
        /* */
        border-bottom: 1px solid var(--primary-lighter);
    }

    .sort-header :global(button) {
        font-size: 0.72em;
        opacity: 0.7;
    }
    .sort-header :global(button:not(:last-child)) {
        border-right: 1px solid var(--primary-lighter) !important;
    }
    .sort-header :global(button.isActive) {
        background-color: var(--primary-darkest) !important;
        border-bottom: 0 !important;
    }

    .sort-indicator {
        font-size: var(--text-xs);
        line-height: 1;
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate(-50%, -38%);
        opacity: 0.7;
    }
</style>
