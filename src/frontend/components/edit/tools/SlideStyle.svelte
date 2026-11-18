<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideStyle } from "../../../react/edit/tools/SlideStyle"
    import type { Item } from "../../../../types/Show"

    export let allSlideItems: Item[]
</script>

<ReactIsland component={SlideStyle} props={{ allSlideItems }} />
