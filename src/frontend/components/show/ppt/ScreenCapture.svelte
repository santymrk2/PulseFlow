<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { ScreenCapture } from "../../../react/show/ppt/ScreenCapture"

    export let path = ""
</script>

<ReactIsland component={ScreenCapture} props={{ path }} />
