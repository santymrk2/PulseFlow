<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Notes } from "../../../react/show/tools/Notes"

    export let value: string
    export let placeholder = ""
    export let disabled = false
    export let lines = 4
    export let autofocus = false

    const dispatch = createEventDispatcher<{ edit: string; change: string; keydown: KeyboardEvent }>()
</script>

<ReactIsland
    component={Notes}
    props={{
        value,
        placeholder,
        disabled,
        lines,
        autofocus,
        className: $$props.class || "",
        style: $$props.style || undefined,
        onEdit: (next: string) => dispatch("edit", next),
        onChange: (next: string) => dispatch("change", next),
        onKeydown: (event: KeyboardEvent) => dispatch("keydown", event)
    }}
/>
