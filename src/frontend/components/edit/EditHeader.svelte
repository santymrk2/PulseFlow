<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { EditHeader } from "../../react/edit/EditHeader"

    export let showId: string
    export let hideOptions = false
</script>

<ReactIsland component={EditHeader} props={{ showId, hideOptions }} />
