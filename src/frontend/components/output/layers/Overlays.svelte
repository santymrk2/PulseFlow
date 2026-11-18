<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Overlays, Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import OverlaysReact from "../../../react/output/Overlays"

    export let outputId: string
    export let overlays: Overlays | null
    export let activeOverlays: string[]
    export let transition: Transition
    export let mirror = false
    export let preview = false
    export let styleIdOverride = ""
</script>

<ReactIsland component={OverlaysReact} props={{ outputId, overlays, activeOverlays, transition, mirror, preview, styleIdOverride }} />
