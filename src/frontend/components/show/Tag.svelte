<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Tag } from "../../react/show/Tag"

    export let tag
    export let active = false
</script>

<ReactIsland component={Tag} props={{ tag, active }} />
