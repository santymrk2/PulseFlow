<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Pdf } from "../../react/export/Pdf"

    export let shows: unknown[] = []
    export let options: unknown = {}
    export let path = ""
</script>

<ReactIsland component={Pdf} props={{ shows, options, path }} />
