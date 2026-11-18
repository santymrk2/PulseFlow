<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { StageLayouts as ReactStageLayouts } from "../../react/stage/StageLayouts"
</script>

<ReactIsland component={ReactStageLayouts} />
