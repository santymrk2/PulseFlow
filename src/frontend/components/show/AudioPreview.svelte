<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { AudioPreview } from "../../react/show/AudioPreview"

    export let active: any
</script>

<ReactIsland component={AudioPreview} props={{ active }} />
