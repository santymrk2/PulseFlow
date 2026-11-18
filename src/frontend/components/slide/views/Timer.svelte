<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Timer } from "../../../react/slide/views/Timer"

    export let item: null | Item | StageItem = null
    export let id: string
    export let today: Date
    export let style = ""
    export let edit = false
    export let showMs = false
</script>

<ReactIsland component={Timer} props={{ item, id, today, style, edit, showMs }} />
