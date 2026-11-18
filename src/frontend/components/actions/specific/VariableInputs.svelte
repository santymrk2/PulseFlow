<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { VariableInputs } from "../../../react/actions/specific/VariableInputs"

    export let value: unknown

    const dispatch = createEventDispatcher<{ update: { key: string; value: unknown } }>()
</script>

<ReactIsland
    component={VariableInputs}
    props={{
        value,
        onUpdate: (detail: { key: string; value: unknown }) => dispatch("update", detail)
    }}
/>
