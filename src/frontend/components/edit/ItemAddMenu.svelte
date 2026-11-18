<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ItemAddMenu } from "../../react/edit/ItemAddMenu"

    export let isLocked = false
</script>

<ReactIsland component={ItemAddMenu} props={{ isLocked }} />
