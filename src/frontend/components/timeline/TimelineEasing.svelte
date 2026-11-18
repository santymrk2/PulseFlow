<script lang="ts">
    // Migrado a React en F24.19b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { TimelineAction } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { TimelineEasing as ReactTimelineEasing } from "../../react/timeline/TimelineEasing"
    import type { TimelineActions } from "./TimelineActions"

    export let groupedActions: TimelineAction[][]
    export let actions: TimelineAction[]
    export let selectedActionIds: string[]
    export let selectedItemIndexes: number[]
    export let activeGroupIndex: number | null
    export let zoomLevel: number
    export let sectionHeight: number
    export let sectionGap: number
    export let sectionTop: number
    export let onActionDrag: (e: MouseEvent, id: string) => void
    export let timeline: TimelineActions

    const dispatch = createEventDispatcher<{ clearSelection: void }>()
</script>

<ReactIsland
    component={ReactTimelineEasing}
    props={{
        groupedActions,
        actions,
        selectedActionIds,
        selectedItemIndexes,
        activeGroupIndex,
        zoomLevel,
        sectionHeight,
        sectionGap,
        sectionTop,
        onActionDrag,
        timeline,
        onClearSelection: () => dispatch("clearSelection")
    }}
/>
