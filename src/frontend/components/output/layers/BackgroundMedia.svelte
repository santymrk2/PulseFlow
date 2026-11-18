<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte (export let/bind/on:*) mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import BackgroundMediaReact from "../../../react/output/BackgroundMedia"

    export let outputId = ""
    export let data: OutBackground
    export let transition: Transition
    export let fadingOut = false
    export let currentStyle: Styles | null = null
    export let animationStyle = ""
    export let mirror = false

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={BackgroundMediaReact}
    props={{
        outputId,
        data,
        transition,
        fadingOut,
        currentStyle,
        animationStyle,
        mirror,
        onOutroStart: () => (fadingOut = true),
        onLoaded: () => dispatch("loaded")
    }}
/>
