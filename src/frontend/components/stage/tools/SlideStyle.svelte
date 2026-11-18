<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { SlideStyle as ReactSlideStyle } from "../../../react/stage/tools/SlideStyle"
</script>

<ReactIsland component={ReactSlideStyle} />
