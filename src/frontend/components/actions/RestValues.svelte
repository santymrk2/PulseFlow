<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { API_rest_command } from "./api"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { RestValues } from "../../react/actions/RestValues"

    export let value: API_rest_command
    export let emitter = false

    const dispatch = createEventDispatcher<{ change: API_rest_command }>()
</script>

<ReactIsland
    component={RestValues}
    props={{
        value,
        emitter,
        onChange: (next: API_rest_command) => dispatch("change", next)
    }}
/>
