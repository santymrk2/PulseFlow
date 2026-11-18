<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { QuickSearch } from "../../react/quicksearch/QuickSearch"
</script>

<ReactIsland component={QuickSearch} props={{}} />
