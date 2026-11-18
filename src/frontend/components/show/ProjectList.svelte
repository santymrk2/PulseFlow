<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Tree } from "../../../types/Projects"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ProjectList } from "../../react/show/ProjectList"

    export let tree: Tree[]
    export let readOnly: boolean = false
    export let selectedId: string | null | undefined = undefined
</script>

<ReactIsland component={ProjectList} props={{ tree, readOnly, selectedId }} />
