<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Variable as VariableReact, type VariableRef } from "../../../react/slide/views/Variable"

    export let id = ""
    export let item: null | Item = null
    export let style = ""
    export let edit = false
    export let hideText = true
    export let ref: VariableRef = { id: "" }
</script>

<ReactIsland component={VariableReact} props={{ id, item, style, edit, hideText, ref }} />
