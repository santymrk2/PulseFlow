<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ContextChild } from "../../react/context/ContextChild"
    import type { ContextMenuItem } from "./contextMenus"

    export let contextElem: HTMLDivElement | null = null
    export let topBar = false
    export let id: string
    export let menu: ContextMenuItem | undefined = undefined
    export let translate = 0
    export let highlightedPath: string[] = []
    export let side: "right" | "left" | undefined = undefined
</script>

<ReactIsland
    component={ContextChild}
    props={{
        contextElem,
        topBar,
        id,
        menu,
        translate,
        highlightedPath,
        side
    }}
/>
