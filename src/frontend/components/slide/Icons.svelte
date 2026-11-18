<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Media, Slide, SlideData } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Icons } from "../../react/slide/Icons"

    export let slide: Slide
    export let timer: number[]
    export let layoutSlide: SlideData
    export let background: Media | null
    export let backgroundCount = 0
    export let duration: number
    export let columns: number
    export let index: number
    export let style: string
</script>

<ReactIsland component={Icons} props={{ slide, timer, layoutSlide, background, backgroundCount, duration, columns, index, style }} />
