<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Section } from "../../react/show/Section"

    export let section
</script>

<ReactIsland component={Section} props={{ section }} />
