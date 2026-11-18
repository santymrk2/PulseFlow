<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ChooseEmitter } from "../../react/actions/ChooseEmitter"
    import type { API_emitter } from "./api"

    export let value: API_emitter

    const dispatch = createEventDispatcher<{ change: API_emitter }>()
</script>

<ReactIsland component={ChooseEmitter} props={{ value, onChange: (next: API_emitter) => dispatch("change", next) }} />
