<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EditboxChords as ReactEditboxChords } from "../../../react/edit/editbox/EditboxChords"

    export let item: Item
    export let autoSize: number = 0
    export let index: number
    export let ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        id: string
    }
    export let chordsMode = false
    export let chordsAction = ""
</script>

<ReactIsland component={ReactEditboxChords} props={{ item, autoSize, index, ref, chordsMode, chordsAction }} />
