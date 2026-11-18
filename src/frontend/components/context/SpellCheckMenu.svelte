<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { SpellCheckMenu } from "../../react/context/SpellCheckMenu"
</script>

<ReactIsland component={SpellCheckMenu} props={{}} />
