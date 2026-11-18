<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Movebox as ReactMovebox } from "../../react/system/Movebox"

    export let ratio = 1
    export let itemStyle = ""
    export let active: boolean
    export let onlyCorners = false
</script>

<ReactIsland component={ReactMovebox} props={{ ratio, itemStyle, active, onlyCorners }} />
