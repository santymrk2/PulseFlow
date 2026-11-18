<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Output } from "../../../../types/Output"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { NextTimer } from "../../../react/output/NextTimer"

    export let currentOutput: Output
    export let timer: any
</script>

<ReactIsland component={NextTimer} props={{ currentOutput, timer }} />
