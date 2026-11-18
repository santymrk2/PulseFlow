<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Show } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Reference } from "../../react/slide/Reference"

    export let showId: string
    export let show: Show
</script>

<ReactIsland component={Reference} props={{ showId, show }} />
