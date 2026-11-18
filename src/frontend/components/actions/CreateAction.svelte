<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { CreateAction } from "../../react/actions/CreateAction"

    export let list = false
    export let full = false
    export let mainId = ""
    export let mode = ""
    export let actionId: string
    export let actionValue: unknown = {}
    export let customData: unknown = {}
    export let existingActions: string[] = []
    export let actionNameIndex = 0
    export let choosePopup = false

    const dispatch = createEventDispatcher<{ change: unknown; choose: void }>()
</script>

<ReactIsland
    component={CreateAction}
    props={{
        list,
        full,
        mainId,
        mode,
        actionId,
        actionValue,
        customData,
        existingActions,
        actionNameIndex,
        choosePopup,
        onChange: (data: unknown) => dispatch("change", data),
        onChoose: () => dispatch("choose")
    }}
/>
