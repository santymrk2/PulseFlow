<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { API_output_style } from "../api"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { ChooseStyle } from "../../../react/actions/specific/ChooseStyle"

    export let value: API_output_style

    const dispatch = createEventDispatcher<{ change: API_output_style }>()
</script>

<ReactIsland
    component={ChooseStyle}
    props={{
        value,
        onChange: (next: API_output_style) => dispatch("change", next)
    }}
/>
