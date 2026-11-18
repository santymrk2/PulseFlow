<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { getContext } from "svelte"
    import type { StageItem, StageLayout as TStageLayout } from "../../../types/Stage"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Stagebox as ReactStagebox } from "../../react/stage/Stagebox"

    export let id: string
    export let item: StageItem | undefined = undefined
    export let stageLayout: TStageLayout | null = null
    export let ratio: number
    export let preview = false
    export let edit = false
    export let disableStagePreview = false
    export let mouse: any = null

    const getLayoutMounted = getContext<() => boolean>("layoutMounted")
</script>

<ReactIsland
    component={ReactStagebox}
    props={{
        id,
        item,
        stageLayout,
        ratio,
        preview,
        edit,
        disableStagePreview,
        getLayoutMounted,
        onMouseChange: (value: any) => {
            mouse = value
        }
    }}
/>
