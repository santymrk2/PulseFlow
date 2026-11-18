<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import BackgroundReact from "../../../react/output/Background"

    export let data: OutBackground
    export let outputId: string
    export let transition: Transition
    export let currentStyle: Styles | null = null
    export let slideFilter = ""
    export let ratio = 1
    export let animationStyle = ""
    export let mirror = false
</script>

<ReactIsland component={BackgroundReact} props={{ data, outputId, transition, currentStyle, slideFilter, ratio, animationStyle, mirror }} />
