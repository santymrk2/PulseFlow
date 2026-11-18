<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Table } from "../../../react/slide/views/Table"

    export let item: Item
    export let edit = false
    export let ref: any = {}
    export let ratio = 1
    export let index = -1
</script>

<ReactIsland component={Table} props={{ item, edit, ref, ratio, index }} />
