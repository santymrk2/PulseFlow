<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { ItemStyle } from "../../../react/edit/tools/ItemStyle"
    import type { Item } from "../../../../types/Show"

    export let allSlideItems: Item[]
    export let item: Item | null
</script>

<ReactIsland component={ItemStyle} props={{ allSlideItems, item }} />
