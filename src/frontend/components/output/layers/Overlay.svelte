<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item, Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import OutputOverlayReact from "../../../react/output/OutputOverlay"

    export let outputId: string
    export let isClearing = false
    export let id: string = ""
    export let overlay: { items: Item[]; [key: string]: unknown }
    export let mirror = false
    export let preview = false
    export let transition: Transition
    export let styleIdOverride = ""
</script>

<ReactIsland component={OutputOverlayReact} props={{ outputId, isClearing, id, overlay, mirror, preview, transition, styleIdOverride }} />
