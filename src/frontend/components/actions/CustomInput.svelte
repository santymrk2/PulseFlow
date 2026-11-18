<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { CustomInput } from "../../react/actions/CustomInput"

    export let inputId: string
    export let value: unknown
    export let actionId: string
    export let actionIndex = 0
    export let mainId = ""
    export let list = false

    const dispatch = createEventDispatcher<{ change: unknown }>()
</script>

<ReactIsland component={CustomInput} props={{ inputId, value, actionId, actionIndex, mainId, list, onChange: (next: unknown) => dispatch("change", next) }} />
