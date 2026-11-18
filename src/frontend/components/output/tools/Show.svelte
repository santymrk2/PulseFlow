<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Output } from "../../../../types/Output"
    import type { LayoutRef } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import ShowReact from "../../../react/output/Show"

    export let currentOutput: Output
    export let ref: LayoutRef[] | { temp: boolean; items: unknown; id: string }[] | undefined
    export let linesIndex: null | number
    export let maxLines: null | number
</script>

<ReactIsland component={ShowReact} props={{ currentOutput, ref, linesIndex, maxLines }} />
