<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { ProjectShowRef } from "../../../../types/Projects"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { FocusItem } from "../../../react/show/focus/FocusItem"

    export let show: ProjectShowRef
</script>

<ReactIsland component={FocusItem} props={{ show }} />
