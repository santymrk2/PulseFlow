<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { StageItemsList as ReactStageItemsList } from "../../../react/stage/tools/StageItemsList"
</script>

<ReactIsland component={ReactStageItemsList} />
