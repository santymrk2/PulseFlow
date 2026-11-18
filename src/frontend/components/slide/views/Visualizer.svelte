<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Visualizer } from "../../../react/slide/views/Visualizer"

    export let item: Item
    export let preview = false
    export let edit = false
</script>

<ReactIsland component={Visualizer} props={{ item, preview, edit }} />
