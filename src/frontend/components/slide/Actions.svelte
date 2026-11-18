<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Slide } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Actions } from "../../react/slide/Actions"

    export let slide: Slide | null = null
    export let columns: number
    export let index = -1
    export let templateId = ""
    export let actions: any
</script>

<ReactIsland component={Actions} props={{ slide, columns, index, templateId, actions }} />
