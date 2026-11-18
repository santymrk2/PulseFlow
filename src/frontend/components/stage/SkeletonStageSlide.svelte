<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { StageLayout } from "../../../types/Stage"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { SkeletonStageSlide } from "../../react/stage/SkeletonStageSlide"

    export let layout: StageLayout
    export let columns = 1
    export let active = false
    export let list = false

    const dispatch = createEventDispatcher<{ click: void }>()
</script>

<ReactIsland component={SkeletonStageSlide} props={{ layout, columns, active, list, onClick: () => dispatch("click") }} />
