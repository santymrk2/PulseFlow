<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideEditor as ReactSlideEditor } from "../../../react/edit/editors/SlideEditor"
</script>

<ReactIsland component={ReactSlideEditor} props={{}} />
