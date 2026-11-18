<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Show } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { TextEditor } from "../../react/show/TextEditor"

    export let currentShow: Show | undefined
</script>

<ReactIsland component={TextEditor} props={{ currentShow }} />
