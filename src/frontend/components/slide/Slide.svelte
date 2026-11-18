<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Show, Slide, SlideData } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Slide as ReactSlide } from "../../react/slide/Slide"

    export let showId: string
    export let slide: Slide
    export let layoutSlide: SlideData
    export let layoutSlides: SlideData[] = []
    export let show: Show
    export let color: string | null = slide.color
    export let index: number
    export let columns = 1
    export let output: { color: string; line: number; maxLines: number; cached: boolean; clickRevealed?: boolean } | null = null
    export let active = false
    export let focused = false
    export let list = false
    export let endIndex: null | number = null
    export let icons = false
    export let noQuickEdit = false
    export let altKeyPressed = false
    export let disableThumbnails = false
    export let centerPreview = false

    const dispatch = createEventDispatcher<{ click: MouseEvent }>()
</script>

<ReactIsland
    component={ReactSlide}
    props={{
        showId,
        slide,
        layoutSlide,
        layoutSlides,
        show,
        color,
        index,
        columns,
        output,
        active,
        focused,
        list,
        endIndex,
        icons,
        noQuickEdit,
        altKeyPressed,
        disableThumbnails,
        centerPreview,
        onClick: (event: MouseEvent) => dispatch("click", event)
    }}
/>
