<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import PreviewReact from "../../../react/output/Preview"
</script>

<ReactIsland component={PreviewReact} props={{}} />
