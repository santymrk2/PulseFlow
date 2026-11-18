<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { StageTools as ReactStageTools } from "../../react/stage/StageTools"
</script>

<ReactIsland component={ReactStageTools} />
