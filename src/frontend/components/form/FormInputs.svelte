<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Input as TInput } from "../../../types/Input"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { FormInputs } from "../../react/form/FormInputs"

    export let inputs: TInput[]
    export let title = ""

    const dispatch = createEventDispatcher<{ change: TInput }>()
</script>

<ReactIsland
    component={FormInputs}
    props={{
        inputs,
        title,
        onChange: (value: TInput) => dispatch("change", value)
    }}
/>
