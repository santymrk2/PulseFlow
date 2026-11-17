<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Date as DateReact } from "../../react/system/Date"

    export let format = "day,d,m,y"
</script>

<ReactIsland component={DateReact} props={{ format }} />
