<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { ShowRef } from "../../../../types/Projects"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { PowerPointPreview } from "../../../react/show/ppt/PowerPointPreview"

    export let show: ShowRef
</script>

<ReactIsland component={PowerPointPreview} props={{ show }} />
