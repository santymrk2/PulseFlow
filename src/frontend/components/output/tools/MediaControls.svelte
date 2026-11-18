<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Output } from "../../../../types/Output"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { MediaControls } from "../../../react/output/MediaControls"

    export let currentOutput: Output | null
    export let outputId: string
    export let big = false
    export let transport = false
</script>

<ReactIsland component={MediaControls} props={{ currentOutput, outputId, big, transport }} />
