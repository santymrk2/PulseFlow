<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { ItemStyle as ReactItemStyle } from "../../../react/stage/tools/ItemStyle"
</script>

<ReactIsland component={ReactItemStyle} />
