<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { ProjectShowRef } from "../../../../types/Projects"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { MediaPreview } from "../../../react/show/media/MediaPreview"

    export let projectShow: ProjectShowRef | null = null
</script>

<ReactIsland component={MediaPreview} props={{ projectShow }} />
