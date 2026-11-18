<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Chart } from "../../../react/slide/views/Chart"

    export let item: Item
    export let ref: any = {}
</script>

<ReactIsland component={Chart} props={{ item, ref }} />
