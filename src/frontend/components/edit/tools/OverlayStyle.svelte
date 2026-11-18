<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { OverlayStyle } from "../../../react/edit/tools/OverlayStyle"
    import type { Item } from "../../../../types/Show"

    export let allSlideItems: Item[]
</script>

<ReactIsland component={OverlayStyle} props={{ allSlideItems }} />
