<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { IconItem as IconItemReact } from "../../../react/slide/views/IconItem"

    export let item: Item
    export let ratio = 1
</script>

<ReactIsland component={IconItemReact} props={{ item, ratio }} />
