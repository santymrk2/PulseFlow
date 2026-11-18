<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import PreviewOutputReact from "../../../react/output/PreviewOutput"

    export let fullscreen = false
    export let disableTransitions = false
    export let disabled = false
    export let outputId = ""
    export let style = ""
</script>

<ReactIsland component={PreviewOutputReact} props={{ fullscreen, disableTransitions, disabled, outputId, style }} />
