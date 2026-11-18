<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EditboxLines as ReactEditboxLines } from "../../../react/edit/editbox/EditboxLines"

    export let item: Item
    export let ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        origin?: string
        id: string
    }
    export let index: number
    export let editIndex = -1
    export let plain = false
    export let chordsMode = false
    export let chordsAction = ""
    export let isLocked = false
</script>

<ReactIsland component={ReactEditboxLines} props={{ item, ref, index, editIndex, plain, chordsMode, chordsAction, isLocked }} />
