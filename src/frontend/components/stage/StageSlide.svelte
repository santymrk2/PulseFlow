<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { StageLayout } from "../../../types/Stage"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { StageSlide } from "../../react/stage/StageSlide"

    export let layout: StageLayout
    export let id: string
    export let columns = 1
    export let active = false
    export let list = false
    export let selectable = true

    const dispatch = createEventDispatcher<{ click: void }>()
</script>

<ReactIsland component={StageSlide} props={{ layout, id, columns, active, list, selectable, onClick: () => dispatch("click") }} />
