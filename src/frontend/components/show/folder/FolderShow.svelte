<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { FolderShow } from "../../../react/show/folder/FolderShow"

    export let path: string
    export let index: number
</script>

<ReactIsland component={FolderShow} props={{ path, index }} />
