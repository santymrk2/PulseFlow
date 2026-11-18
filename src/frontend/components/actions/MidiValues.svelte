<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { MidiValues } from "../../react/actions/MidiValues"
    import type { API_midi } from "./api"

    export let value: API_midi
    export let firstActionId = ""
    export let type: "input" | "output" | "emitter" = "input"
    export let playSlide = false
    export let simple = false

    const dispatch = createEventDispatcher<{ change: API_midi }>()
</script>

<ReactIsland
    component={MidiValues}
    props={{
        value,
        firstActionId,
        type,
        playSlide,
        simple,
        onChange: (nextValue: API_midi) => dispatch("change", nextValue)
    }}
/>
