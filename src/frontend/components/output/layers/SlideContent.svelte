<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { OutSlide, SlideData } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import SlideContentReact from "../../../react/output/SlideContent"

    export let outputId: string
    export let outSlide: OutSlide
    export let isClearing = false
    export let slideData: SlideData | null
    export let currentSlide: unknown
    export let currentStyle: unknown
    export let animationData: unknown
    export let currentLineId: string | undefined
    export let lines: unknown
    export let ratio: number
    export let mirror = false
    export let preview = false
    export let transition: unknown = {}
    export let transitionEnabled = false
    export let styleIdOverride = ""
</script>

<ReactIsland component={SlideContentReact} props={{ outputId, outSlide, isClearing, slideData, currentSlide, currentStyle, animationData, currentLineId, lines, ratio, mirror, preview, transition, transitionEnabled, styleIdOverride }} />
