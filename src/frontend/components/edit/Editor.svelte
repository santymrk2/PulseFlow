<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Editor as ReactEditor } from "../../react/edit/Editor"
</script>

<ReactIsland component={ReactEditor} props={{}} />
