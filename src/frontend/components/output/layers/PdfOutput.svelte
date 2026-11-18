<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import PdfOutputReact from "../../../react/output/PdfOutput"

    export let slide: unknown
    export let currentStyle: unknown
    export let transition: Transition
</script>

<ReactIsland component={PdfOutputReact} props={{ slide, currentStyle, transition }} />
