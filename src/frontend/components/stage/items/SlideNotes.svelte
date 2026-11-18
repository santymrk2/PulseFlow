<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { OutSlide } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideNotes } from "../../../react/stage/SlideNotes"

    export let currentSlide: OutSlide
    export let slideOffset = 0
    export let autoSize = 100
</script>

<ReactIsland component={SlideNotes} props={{ currentSlide, slideOffset, autoSize }} />
