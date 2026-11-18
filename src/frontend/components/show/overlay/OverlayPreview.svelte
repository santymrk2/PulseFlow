<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Show } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { OverlayPreview } from "../../../react/show/overlay/OverlayPreview"

    export let show: Show
</script>

<ReactIsland component={OverlayPreview} props={{ show }} />
