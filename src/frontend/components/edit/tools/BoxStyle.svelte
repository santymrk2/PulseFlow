<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { BoxStyle } from "../../../react/edit/tools/BoxStyle"
    import type { CustomFont, Item, ItemType } from "../../../../types/Show"

    export let id: ItemType
    export let allSlideItems: Item[] = []
    export let item: Item | null = null
    export let customLocalFonts: CustomFont[] = []
</script>

<ReactIsland component={BoxStyle} props={{ id, allSlideItems, item, customLocalFonts }} />
