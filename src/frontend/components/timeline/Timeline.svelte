<script lang="ts">
    // Migrado a React en F24.19b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Timeline as ReactTimeline } from "../../react/timeline/Timeline"
    import type { TimelineType } from "./TimelineActions"

    export let type: TimelineType
    export let isClosed: boolean = false
</script>

<ReactIsland component={ReactTimeline} props={{ type, isClosed }} />
