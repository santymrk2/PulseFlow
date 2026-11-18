<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { MediaItem } from "../../../react/slide/views/MediaItem"

    export let item: Item
    export let outputId = ""
    export let slideRef: any = {}
    export let preview = false
    export let miniPreview = false
    export let edit = false
    export let cropPreviewMode = false
</script>

<ReactIsland component={MediaItem} props={{ item, outputId, slideRef, preview, miniPreview, edit, cropPreviewMode }} />
