<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Input } from "../../../types/Input"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { FormInput } from "../../react/form/FormInput"

    export let input: Input
    export let hasTimelineAction: boolean = false

    const dispatch = createEventDispatcher<{ change: unknown; keyframe: unknown }>()
</script>

<ReactIsland
    component={FormInput}
    props={{
        input,
        hasTimelineAction,
        onChange: (value: unknown) => dispatch("change", value),
        onKeyframe: (value: unknown) => dispatch("keyframe", value)
    }}
/>
