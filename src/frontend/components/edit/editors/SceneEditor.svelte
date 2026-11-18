<script lang="ts">
    // Migrado a React en F24.21b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SceneEditor } from "../../../react/edit/SceneEditor"
</script>

<ReactIsland component={SceneEditor} />
