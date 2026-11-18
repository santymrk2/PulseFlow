<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { StageLayout as ReactStageLayout } from "../../react/stage/StageLayout"

    export let outputId = ""
    export let stageId = ""
    export let preview = false
    export let edit = true
    export let disableStagePreview = false
</script>

<ReactIsland component={ReactStageLayout} props={{ outputId, stageId, preview, edit, disableStagePreview }} />
