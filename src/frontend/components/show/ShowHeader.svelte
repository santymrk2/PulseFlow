<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ShowHeader } from "../../react/show/ShowHeader"

    export let showId: string
    export let hideOptions = false
</script>

<ReactIsland component={ShowHeader} props={{ showId, hideOptions }} />
