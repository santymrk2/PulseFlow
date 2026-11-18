<script lang="ts">
    // Migrado a React en F24.21b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EffectEditor } from "../../../react/edit/EffectEditor"
</script>

<ReactIsland component={EffectEditor} />
