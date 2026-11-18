<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { OutSlide } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideText } from "../../../react/stage/SlideText"

    export let currentSlide: OutSlide
    export let slideOffset = 0
    export let chords = false
    export let style = false
    export let textStyle = ""
    export let autoSize = false
    export let fontSize = 0
    export let stageItem: StageItem
    export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }
</script>

<ReactIsland component={SlideText} props={{ currentSlide, slideOffset, chords, style, textStyle, autoSize, fontSize, stageItem, ref }} />
