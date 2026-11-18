<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Slides } from "../../react/show/Slides"

    export let showId: string
    export let layout = ""
    export let projectIndex = -1
</script>

<ReactIsland component={Slides} props={{ showId, layout, projectIndex }} />
