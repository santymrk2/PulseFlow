<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { OutData } from "../../../types/Output"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import OutputReact from "../../react/output/Output"

    export let outputId = ""
    export let style = ""
    export let ratio = 0
    export let mirror = false
    export let preview = false
    export let styleIdOverride = ""
    export let outOverride: OutData | null = null
</script>

<ReactIsland component={OutputReact} props={{ outputId, style, ratio, mirror, preview, styleIdOverride, outOverride }} />
