<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Output } from "../../../../types/Output"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import ToolsOverlayReact from "../../../react/output/ToolsOverlay"

    export let currentOutput: Output
</script>

<ReactIsland component={ToolsOverlayReact} props={{ currentOutput }} />
