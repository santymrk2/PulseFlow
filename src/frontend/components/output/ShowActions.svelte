<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Output } from "../../../types/Output"
    import type { LayoutRef } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ShowActions } from "../../react/output/ShowActions"

    export let currentOutput: Output
    export let ref: (LayoutRef | { temp: boolean; items: any; id: string })[]
    export let linesIndex: null | number
    export let maxLines: null | number
</script>

<ReactIsland component={ShowActions} props={{ currentOutput, refItems: ref, linesIndex, maxLines }} />
