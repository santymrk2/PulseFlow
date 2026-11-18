<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { BoxStyle as ReactBoxStyle } from "../../../react/stage/tools/BoxStyle"
</script>

<ReactIsland component={ReactBoxStyle} />
