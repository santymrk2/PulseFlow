<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Slide } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { SkeletonSlide as SkeletonSlideReact } from "../../react/slide/SkeletonSlide"

    export let slide: Slide
    export let index: number
    export let color: string
    export let columns = 1
    export let active: boolean = false

    const dispatch = createEventDispatcher()
</script>

<ReactIsland component={SkeletonSlideReact} props={{ slide, index, color, columns, active, onClick: (e) => dispatch("click", e) }} />
