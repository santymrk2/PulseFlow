<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideProgress } from "../../../react/slide/views/SlideProgress"

    export let tracker: any
    export let outputId = ""
    export let item: any = {}
    export let autoSize = 0
</script>

<ReactIsland component={SlideProgress} props={{ tracker, outputId, item, autoSize }} />
