<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { PdfPreview } from "../../../react/show/pdf/PdfPreview"

    export let show
    export let index: number
</script>

<ReactIsland component={PdfPreview} props={{ show, index }} />
