<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import type { Item } from "../../../../types/Show"
    import type { EditboxMouseState } from "../../../react/edit/editbox/Editbox"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Editbox as ReactEditbox } from "../../../react/edit/editbox/Editbox"

    export let item: Item | null
    export let filter = ""
    export let backdropFilter = ""
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        origin?: string
        id: string
    } = { type: "show", id: "" }
    export let index: number
    export let editIndex = -1
    export let ratio = 1
    export let plain = false
    export let chordsMode = false
    export let chordsAction = ""
    export let mouse: EditboxMouseState | Record<string, never> | null = null
</script>

<ReactIsland
    component={ReactEditbox}
    props={{
        item,
        filter,
        backdropFilter,
        ref,
        index,
        editIndex,
        ratio,
        plain,
        chordsMode,
        chordsAction,
        mouse,
        onMouseChange: (value: EditboxMouseState) => {
            mouse = value
        }
    }}
/>
