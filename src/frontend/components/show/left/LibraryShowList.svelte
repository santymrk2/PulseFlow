<script lang="ts">
    // Lista de shows de una biblioteca (estado "library" de ÍTEMS). Misma fila, selección y
    // arrastre que usaba la pestaña Shows del cajón; sin columnas de orden, que no entran acá.
    import type { ShowList } from "../../../../types/Show"
    import { activeShow, focusedArea, sorted } from "../../../stores"
    import { dateToString } from "../../helpers/time"
    import VirtualList from "../../drawer/VirtualList.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import T from "../../helpers/T.svelte"
    import ShowButton from "../ShowButton.svelte"

    export let shows: ShowList[]
    /** true cuando la lista está vacía por la búsqueda y no porque la biblioteca no tenga shows */
    export let searching = false

    $: sortType = $sorted.shows?.type || "name"
</script>

<div class="list context #drawer_show" role="none" on:mouseup={() => focusedArea.set("show_drawer")}>
    {#if shows.length}
        <VirtualList items={shows} let:item={show} activeIndex={shows.findIndex((a) => a.id === $activeShow?.id)}>
            <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={shows} draggable>
                <ShowButton id={show.id} {show} data={dateToString(show.timestamps?.[sortType.replace("_old", "")] || show.timestamps?.modified || show.timestamps?.created || "", true)} class="#drawer_show_button" />
            </SelectElem>
        </VirtualList>
    {:else}
        <Center size={1} faded>
            {#if searching}<T id="ui.no_results" />{:else}<T id="empty.shows" />{/if}
        </Center>
    {/if}
</div>

<style>
    .list {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
</style>
