<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { ClearButtons } from "../../../react/output/ClearButtons"

    export let autoChange: any
    export let activeClear: any

    const dispatch = createEventDispatcher<{ update: string }>()
</script>

<ReactIsland
    component={ClearButtons}
    props={{
        autoChange,
        activeClear,
        onAutoChangeChange: (value: boolean) => (autoChange = value),
        onUpdate: (key: string) => dispatch("update", key)
    }}
/>
