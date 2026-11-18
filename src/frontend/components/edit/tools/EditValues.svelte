<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EditValues } from "../../../react/edit/tools/EditValues"
    import type { CustomFont } from "../../../../types/Show"
    import type { EditBoxSection } from "../values/boxes"

    export let sections: { [key: string]: EditBoxSection } = {}
    export let styles: { [key: string]: string } = {}
    export let customValues: { [key: string]: string } = {}
    export let customLocalFonts: CustomFont[] = []
    export let item: any = {}
    export let isStage = false
    export let type = ""

    const dispatch = createEventDispatcher()

    function onChange(input: any) {
        dispatch("change", input)
    }
</script>

<ReactIsland component={EditValues} props={{ sections, styles, customValues, customLocalFonts, item, isStage, type, onChange }} />
