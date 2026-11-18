<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { MultiOutputs } from "../../../react/output/MultiOutputs"

    export let disableTransitions = false
</script>

<ReactIsland component={MultiOutputs} props={{ disableTransitions }} />
