<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ContextItem } from "../../react/context/ContextItem"
    import type { ContextMenuItem } from "./contextMenus"

    export let contextElem: HTMLDivElement | null = null
    export let topBar = false
    export let id: string
    export let menu: ContextMenuItem | undefined = undefined
    export let disabled = false
    export let highlighted = false
    export let group = false
</script>

<ReactIsland
    component={ContextItem}
    props={{
        contextElem,
        topBar,
        id,
        menu,
        disabled,
        highlighted,
        group
    }}
/>
